import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as repo from "../src/datos/repositorio";
import type { RegistroSerie, Sesion } from "../src/datos/tipos";

let n = 0;
function sesion(fecha: string, extra: Partial<Sesion> = {}): Sesion {
  return {
    id: `s${++n}`,
    fecha,
    rutinaId: "r",
    diaIndice: 0,
    nombreDia: "Pierna",
    esDescarga: false,
    terminada: true,
    plan: [],
    ...extra,
  };
}

function serie(s: Sesion, numeroSerie: number, pesoKg: number, reps: number, esCalentamiento = false): RegistroSerie {
  return {
    id: `${s.id}-${numeroSerie}-${esCalentamiento}`,
    sesionId: s.id,
    ejercicioId: "sentadilla-profunda",
    numeroSerie,
    pesoKg,
    reps,
    fecha: s.fecha,
    esCalentamiento,
  };
}

beforeEach(() => {
  repo.usarBaseDatos(`test-${Math.random()}`);
});

describe("historialEjercicio", () => {
  it("agrupa por sesión, excluye calentamiento, descargas y la sesión en curso", async () => {
    const a = sesion("2026-01-01T10:00");
    const b = sesion("2026-01-03T10:00");
    const descarga = sesion("2026-01-05T10:00", { esDescarga: true });
    const actual = sesion("2026-01-07T10:00", { terminada: false });
    for (const s of [a, b, descarga, actual]) await repo.guardarSesion(s);
    await repo.guardarSerie(serie(a, 1, 50, 8, true));
    await repo.guardarSerie(serie(a, 1, 100, 8));
    await repo.guardarSerie(serie(a, 2, 100, 7));
    await repo.guardarSerie(serie(b, 1, 100, 9));
    await repo.guardarSerie(serie(descarga, 1, 60, 8));
    await repo.guardarSerie(serie(actual, 1, 105, 8));
    await repo.guardarDificultad(b.id, "sentadilla-profunda", "facil");

    const h = await repo.historialEjercicio("sentadilla-profunda", actual.id);
    expect(h).toEqual([
      { fecha: a.fecha, series: [{ pesoKg: 100, reps: 8 }, { pesoKg: 100, reps: 7 }], dificultad: undefined },
      { fecha: b.fecha, series: [{ pesoKg: 100, reps: 9 }], dificultad: "facil" },
    ]);
    expect((await repo.sesionEnCurso())?.id).toBe(actual.id);
  });
});

describe("copia de seguridad", () => {
  it("exporta e importa todos los datos", async () => {
    const s = sesion("2026-02-01T10:00");
    await repo.guardarSesion(s);
    await repo.guardarSerie(serie(s, 1, 80, 10));
    await repo.guardarRutina({ id: "r1", nombre: "Mi rutina", dias: [] });
    await repo.guardarAjuste("rutinaActiva", "r1");
    const copia = JSON.parse(JSON.stringify(await repo.exportarTodo()));

    repo.usarBaseDatos(`test-import-${Math.random()}`);
    expect(await repo.listarRutinas()).toEqual([]);
    await repo.importarTodo(copia);
    expect((await repo.listarRutinas())[0].nombre).toBe("Mi rutina");
    expect(await repo.leerAjuste("rutinaActiva", null)).toBe("r1");
    expect(await repo.seriesDeSesion(s.id)).toHaveLength(1);
  });

  it("rechaza archivos que no son copias", async () => {
    await expect(repo.importarTodo({ hola: 1 } as never)).rejects.toThrow();
  });

  it("borrar una sesión elimina sus series", async () => {
    const s = sesion("2026-02-02T10:00");
    await repo.guardarSesion(s);
    await repo.guardarSerie(serie(s, 1, 80, 10));
    await repo.guardarDificultad(s.id, "sentadilla-profunda", "justo");
    await repo.borrarSesion(s.id);
    expect(await repo.seriesDeSesion(s.id)).toHaveLength(0);
    expect(await repo.historialEjercicio("sentadilla-profunda")).toEqual([]);
  });
});
