import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as repo from "../src/datos/repositorio";
import type { Rutina, Sesion } from "../src/datos/tipos";
import { cambiarPeso, cambiarReps, siguientePendiente } from "../src/logica/plan";
import * as servicio from "../src/logica/servicio";

const rutina: Rutina = {
  id: "r1",
  nombre: "Prueba",
  dias: [
    {
      nombre: "Pierna",
      ejercicios: [
        { ejercicioId: "sentadilla-profunda", series: 2, repsMin: 6, repsMax: 8, descansoSeg: 120 },
        { ejercicioId: "curl-femoral-sentado", series: 2, repsMin: 8, repsMax: 12, descansoSeg: 90 },
      ],
    },
  ],
};

beforeEach(async () => {
  repo.usarBaseDatos(`servicio-${Math.random()}`);
  await repo.guardarRutina(rutina);
  await servicio.activarRutina(rutina.id);
});

/** Hace todas las series pendientes con el peso y las reps indicados por ejercicio. */
async function hacerTodo(s: Sesion, valores: Record<string, { peso?: number; reps: number }>): Promise<Sesion> {
  for (let pos = siguientePendiente(s.plan); pos; pos = siguientePendiente(s.plan)) {
    const p = s.plan[pos.ejercicio];
    const v = valores[p.ejercicioId];
    if (!p.series[pos.serie].esCalentamiento && v) {
      if (v.peso !== undefined) s = await servicio.guardarPlan(s, cambiarPeso(s.plan, pos, v.peso));
      s = await servicio.guardarPlan(s, cambiarReps(s.plan, pos, v.reps));
    }
    s = (await servicio.marcarSerie(s, pos)).sesion;
  }
  return s;
}

describe("flujo completo de entreno", () => {
  it("primera sesión fija el peso y la siguiente sube con la doble progresión", async () => {
    let s = await servicio.iniciarSesion(rutina, 0, false);
    expect(s.plan[0].pesoPorDefinir).toBe(true);
    s = await hacerTodo(s, {
      "sentadilla-profunda": { peso: 100, reps: 8 },
      "curl-femoral-sentado": { peso: 40, reps: 10 },
    });
    await servicio.terminarSesion(s);
    expect(await repo.sesionEnCurso()).toBeUndefined();

    const plan = await servicio.previsualizarDia(rutina, 0);
    const sentadilla = plan[0].series.filter((x) => !x.esCalentamiento);
    expect(sentadilla.map((x) => x.pesoKg)).toEqual([105, 105]);
    expect(plan[0].series.filter((x) => x.esCalentamiento).length).toBeGreaterThan(0);
    // Curl: llegó al mínimo pero no al tope → mismo peso, una rep más.
    expect(plan[1].series.map((x) => [x.pesoKg, x.reps])).toEqual([
      [40, 11],
      [40, 11],
    ]);
  });

  it("los calentamientos no cuentan para la progresión", async () => {
    let s = await servicio.iniciarSesion(rutina, 0, false);
    s = await hacerTodo(s, { "sentadilla-profunda": { peso: 100, reps: 6 }, "curl-femoral-sentado": { peso: 40, reps: 8 } });
    await servicio.terminarSesion(s);
    s = await servicio.iniciarSesion(rutina, 0, false);
    expect(s.plan[0].series[0].esCalentamiento).toBe(true);
    // Calentamientos con pocas reps no deben provocar bajadas.
    s = await hacerTodo(s, { "sentadilla-profunda": { reps: 6 }, "curl-femoral-sentado": { reps: 8 } });
    await servicio.terminarSesion(s);
    const h = await repo.historialEjercicio("sentadilla-profunda");
    expect(h.every((x) => x.series.every((y) => y.pesoKg === 100))).toBe(true);
  });

  it("el sustituto usa su propio historial", async () => {
    let s = await servicio.iniciarSesion(rutina, 0, false);
    s = await servicio.sustituir(s, 1);
    expect(s.plan[1].ejercicioId).toBe("curl-femoral-tumbado");
    expect(s.plan[1].ejercicioRutinaId).toBe("curl-femoral-sentado");
    s = await hacerTodo(s, { "sentadilla-profunda": { peso: 80, reps: 8 }, "curl-femoral-tumbado": { peso: 30, reps: 12 } });
    await servicio.terminarSesion(s);

    s = await servicio.iniciarSesion(rutina, 0, false);
    expect(s.plan[1].ejercicioId).toBe("curl-femoral-sentado");
    expect(s.plan[1].pesoPorDefinir).toBe(true);
    s = await servicio.sustituir(s, 1);
    expect(s.plan[1].series.map((x) => x.pesoKg)).toEqual([35, 35]);
  });

  it("deshacer borra el registro", async () => {
    let s = await servicio.iniciarSesion(rutina, 0, false);
    const pos = siguientePendiente(s.plan)!;
    s = (await servicio.marcarSerie(s, pos)).sesion;
    expect(await repo.seriesDeSesion(s.id)).toHaveLength(1);
    s = await servicio.deshacerSerie(s, pos);
    expect(await repo.seriesDeSesion(s.id)).toHaveLength(0);
    expect(siguientePendiente(s.plan)).toEqual(pos);
  });

  it("terminar sin series marcadas descarta la sesión y no avanza el día", async () => {
    const s = await servicio.iniciarSesion(rutina, 0, false);
    await servicio.terminarSesion(s);
    expect(await repo.sesionesTerminadas()).toHaveLength(0);
  });

  it("propone descarga cuando 3 ejercicios se estancan, y no justo después de responder", async () => {
    const r: Rutina = {
      id: "r2",
      nombre: "Tres",
      dias: [
        {
          nombre: "A",
          ejercicios: ["press-banca", "jalon-pecho", "curl-predicador"].map((ejercicioId) => ({
            ejercicioId,
            series: 1,
            repsMin: 8,
            repsMax: 12,
            descansoSeg: 60,
          })),
        },
      ],
    };
    await repo.guardarRutina(r);
    for (let i = 0; i < 4; i++) {
      let s = await servicio.iniciarSesion(r, 0, false);
      s = await hacerTodo(s, {
        "press-banca": { peso: 50, reps: 9 },
        "jalon-pecho": { peso: 40, reps: 9 },
        "curl-predicador": { peso: 10, reps: 9 },
      });
      await servicio.terminarSesion(s);
    }
    expect(await servicio.propuestaDescarga(r)).toBe(true);
    await servicio.responderDescarga();
    expect(await servicio.propuestaDescarga(r)).toBe(false);

    const descarga = await servicio.iniciarSesion(r, 0, true);
    expect(descarga.esDescarga).toBe(true);
    expect(descarga.plan[0].series.filter((x) => !x.esCalentamiento)[0].pesoKg).toBe(30);
  });
});

describe("datos iniciales", () => {
  it("sustituye las plantillas antiguas por la rutina de cuerpo completo", async () => {
    repo.usarBaseDatos(`migracion-${Math.random()}`);
    await repo.guardarRutina({ id: "vieja", nombre: "Torso / Pierna", dias: [] });
    await repo.guardarRutina({ id: "mia", nombre: "Mi rutina", dias: [] });
    await servicio.asegurarDatosIniciales();
    const nombres = (await repo.listarRutinas()).map((r) => r.nombre).sort();
    expect(nombres).toEqual(["Cuerpo completo", "Mi rutina"]);
    expect((await servicio.rutinaActiva())?.nombre).toBe("Cuerpo completo");
    // Idempotente
    await servicio.asegurarDatosIniciales();
    expect(await repo.listarRutinas()).toHaveLength(2);
  });
});
