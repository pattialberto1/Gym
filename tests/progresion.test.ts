import { describe, expect, it } from "vitest";
import {
  aplicarDescarga,
  calcularCalentamiento,
  debeProponerDescarga,
  decidirPeso,
  detectarRecord,
  estaEstancado,
  incrementoSubida,
  pesoBajado,
  planificarSeries,
  redondearAlSalto,
  type DatosEjercicio,
  type Objetivo,
  type SesionHistorial,
} from "../src/logica/progresion";
import type { Dificultad } from "../src/datos/tipos";

const obj: Objetivo = { series: 3, repsMin: 8, repsMax: 12 };
const barraInferior: DatosEjercicio = { tipo: "inferior", saltoPesoKg: 2.5 };
const barraSuperior: DatosEjercicio = { tipo: "superior", saltoPesoKg: 2.5 };
const mancuerna: DatosEjercicio = { tipo: "superior", saltoPesoKg: 2 };
const maquina5: DatosEjercicio = { tipo: "superior", saltoPesoKg: 5 };

let dia = 0;
function ses(peso: number, reps: number[], dificultad?: Dificultad): SesionHistorial {
  dia++;
  return {
    fecha: `2026-01-${String(dia).padStart(2, "0")}`,
    series: reps.map((r) => ({ pesoKg: peso, reps: r })),
    dificultad,
  };
}

describe("redondeo", () => {
  it("redondea al salto del equipo sin restos de coma flotante", () => {
    expect(redondearAlSalto(61.3, 2.5)).toBe(62.5);
    expect(redondearAlSalto(7.4999999, 2.5)).toBe(7.5);
    expect(redondearAlSalto(13, 2)).toBe(14);
  });
});

describe("decidirPeso: primera vez", () => {
  it("sin historial pide el peso", () => {
    const d = decidirPeso([], obj, barraInferior);
    expect(d.accion).toBe("inicial");
    expect(d.pesoKg).toBeNull();
  });
});

describe("decidirPeso: subir", () => {
  it("todas las series al tope: +5 kg en tren inferior", () => {
    const d = decidirPeso([ses(100, [12, 12, 12])], obj, barraInferior);
    expect(d).toMatchObject({ accion: "subir", pesoKg: 105 });
  });

  it("todas las series al tope: +2.5 kg en tren superior", () => {
    const d = decidirPeso([ses(60, [12, 12, 12])], obj, barraSuperior);
    expect(d).toMatchObject({ accion: "subir", pesoKg: 62.5 });
  });

  it("redondea la subida al salto del equipo (mancuernas de 2 en 2)", () => {
    expect(incrementoSubida(mancuerna)).toBe(2);
    expect(decidirPeso([ses(20, [12, 12, 12])], obj, mancuerna).pesoKg).toBe(22);
  });

  it("nunca sube menos de un salto (máquina de 5 en 5)", () => {
    expect(decidirPeso([ses(40, [12, 12, 12])], obj, maquina5).pesoKg).toBe(45);
  });

  it("'fácil' con reps en el tope sube el doble", () => {
    const d = decidirPeso([ses(100, [12, 12, 12], "facil")], obj, barraInferior);
    expect(d).toMatchObject({ accion: "subir", pesoKg: 110 });
  });

  it("'no pude' no sube aunque las reps lo permitan", () => {
    const d = decidirPeso([ses(100, [12, 12, 12], "no-pude")], obj, barraInferior);
    expect(d).toMatchObject({ accion: "mantener", pesoKg: 100 });
  });

  it("no sube si se hicieron menos series de las previstas", () => {
    const d = decidirPeso([ses(100, [12, 12])], obj, barraInferior);
    expect(d.accion).toBe("mantener");
  });

  it("usa el peso más alto de la sesión como referencia", () => {
    const s: SesionHistorial = {
      fecha: "x",
      series: [
        { pesoKg: 102.5, reps: 12 },
        { pesoKg: 102.5, reps: 12 },
        { pesoKg: 102.5, reps: 12 },
      ],
    };
    expect(decidirPeso([s], obj, barraInferior).pesoKg).toBe(107.5);
  });
});

describe("decidirPeso: mantener", () => {
  it("todas al menos en el mínimo: mismo peso", () => {
    const d = decidirPeso([ses(100, [10, 9, 8])], obj, barraInferior);
    expect(d).toMatchObject({ accion: "mantener", pesoKg: 100 });
  });

  it("una sola sesión por debajo del mínimo: mantiene", () => {
    const d = decidirPeso([ses(100, [10, 9]), ses(100, [8, 7, 6])], obj, barraInferior);
    expect(d).toMatchObject({ accion: "mantener", pesoKg: 100 });
  });

  it("un solo 'no pude': mantiene", () => {
    const d = decidirPeso([ses(100, [9, 9, 9]), ses(100, [8, 8, 8], "no-pude")], obj, barraInferior);
    expect(d.accion).toBe("mantener");
  });
});

describe("decidirPeso: bajar", () => {
  it("dos sesiones seguidas por debajo del mínimo: baja entre 5 y 10 %", () => {
    const d = decidirPeso([ses(100, [8, 7, 6]), ses(100, [7, 6, 6])], obj, barraInferior);
    expect(d.accion).toBe("bajar");
    expect(d.pesoKg).toBe(92.5);
    const bajada = (100 - d.pesoKg!) / 100;
    expect(bajada).toBeGreaterThanOrEqual(0.05);
    expect(bajada).toBeLessThanOrEqual(0.1);
  });

  it("dos 'no pude' seguidos: baja aunque llegara al mínimo", () => {
    const d = decidirPeso(
      [ses(100, [8, 8, 8], "no-pude"), ses(100, [8, 8, 8], "no-pude")],
      obj,
      barraInferior,
    );
    expect(d.accion).toBe("bajar");
  });

  it("la bajada respeta el salto del equipo", () => {
    expect(pesoBajado(40, 2.5)).toBe(37.5); // 6.25 %
    expect(pesoBajado(20, 2)).toBe(18); // 10 %
    expect(pesoBajado(200, 2.5)).toBe(185); // 7.5 %
  });

  it("si un salto supera el 10 %, baja un único salto", () => {
    expect(pesoBajado(30, 5)).toBe(25);
  });

  it("no baja por debajo de 0", () => {
    expect(pesoBajado(0, 2.5)).toBe(0);
    expect(pesoBajado(2, 2.5)).toBe(0);
  });

  it("una mala sesión antigua no cuenta si la última fue buena", () => {
    const d = decidirPeso([ses(100, [6, 6, 6]), ses(100, [9, 9, 8])], obj, barraInferior);
    expect(d.accion).toBe("mantener");
  });
});

describe("planificarSeries", () => {
  it("tras subir, empieza en el mínimo de reps", () => {
    const h = [ses(100, [12, 12, 12])];
    const plan = planificarSeries(decidirPeso(h, obj, barraInferior), h, obj);
    expect(plan).toEqual([
      { pesoKg: 105, reps: 8 },
      { pesoKg: 105, reps: 8 },
      { pesoKg: 105, reps: 8 },
    ]);
  });

  it("al mantener, propone una rep más por serie sin pasar del tope", () => {
    const h = [ses(100, [12, 10, 7])];
    const plan = planificarSeries(decidirPeso(h, obj, barraInferior), h, obj);
    expect(plan.map((s) => s.reps)).toEqual([12, 11, 8]);
  });

  it("si la rutina tiene más series que la última sesión, repite la última", () => {
    const h = [ses(100, [9, 9])];
    const plan = planificarSeries(decidirPeso(h, obj, barraInferior), h, obj);
    expect(plan.map((s) => s.reps)).toEqual([10, 10, 10]);
  });

  it("sin historial planifica el mínimo con peso 0 (por definir)", () => {
    const plan = planificarSeries(decidirPeso([], obj, barraInferior), [], obj);
    expect(plan).toHaveLength(3);
    expect(plan[0]).toEqual({ pesoKg: 0, reps: 8 });
  });
});

describe("estancamiento y descarga", () => {
  it("detecta 3 sesiones sin mejorar peso ni reps", () => {
    const h = [ses(100, [10, 10, 10]), ses(100, [10, 10, 9]), ses(100, [10, 10, 10]), ses(100, [9, 9, 9])];
    expect(estaEstancado(h)).toBe(true);
  });

  it("más reps con el mismo peso cuenta como progreso", () => {
    const h = [ses(100, [10, 10, 10]), ses(100, [10, 10, 9]), ses(100, [10, 10, 11]), ses(100, [9, 9, 9])];
    expect(estaEstancado(h)).toBe(false);
  });

  it("más peso cuenta como progreso", () => {
    const h = [ses(100, [12, 12, 12]), ses(100, [10, 9, 9]), ses(105, [8, 8, 8]), ses(105, [8, 8, 8])];
    expect(estaEstancado(h)).toBe(false);
  });

  it("con pocas sesiones no hay estancamiento", () => {
    expect(estaEstancado([ses(100, [10]), ses(100, [10]), ses(100, [10])])).toBe(false);
  });

  it("propone descarga con 3 ejercicios estancados", () => {
    const parado = [ses(50, [8, 8]), ses(50, [8, 8]), ses(50, [8, 8]), ses(50, [8, 8])];
    const mejora = [ses(50, [8, 8]), ses(50, [9, 9]), ses(50, [10, 10]), ses(50, [11, 11])];
    expect(debeProponerDescarga([parado, parado, parado], 5)).toBe(true);
    expect(debeProponerDescarga([parado, parado, mejora], 5)).toBe(false);
  });

  it("no la vuelve a proponer justo después de una descarga o un rechazo", () => {
    const parado = [ses(50, [8, 8]), ses(50, [8, 8]), ses(50, [8, 8]), ses(50, [8, 8])];
    expect(debeProponerDescarga([parado, parado, parado], 1)).toBe(false);
  });

  it("la descarga es 60 % del peso y la mitad de series", () => {
    expect(aplicarDescarga(100, 4, 2.5)).toEqual({ pesoKg: 60, series: 2 });
    expect(aplicarDescarga(62.5, 3, 2.5)).toEqual({ pesoKg: 37.5, series: 2 });
    expect(aplicarDescarga(20, 1, 2)).toEqual({ pesoKg: 12, series: 1 });
  });
});

describe("calentamiento", () => {
  it("series al 50 % y 75 % redondeadas al salto", () => {
    expect(calcularCalentamiento(100, 2.5)).toEqual([
      { pesoKg: 50, reps: 8 },
      { pesoKg: 75, reps: 4 },
    ]);
    expect(calcularCalentamiento(65, 2.5)).toEqual([
      { pesoKg: 32.5, reps: 8 },
      { pesoKg: 50, reps: 4 },
    ]);
  });

  it("respeta el peso mínimo (barra vacía) y descarta series inútiles", () => {
    expect(calcularCalentamiento(30, 2.5, 20)).toEqual([
      { pesoKg: 20, reps: 8 },
      { pesoKg: 22.5, reps: 4 },
    ]);
    expect(calcularCalentamiento(25, 2.5, 20)).toEqual([{ pesoKg: 20, reps: 8 }]);
    expect(calcularCalentamiento(20, 2.5, 20)).toEqual([]);
    expect(calcularCalentamiento(0, 2.5)).toEqual([]);
  });
});

describe("récords", () => {
  const previas = [
    { pesoKg: 100, reps: 8 },
    { pesoKg: 100, reps: 10 },
    { pesoKg: 90, reps: 12 },
  ];

  it("más peso que nunca", () => {
    expect(detectarRecord(previas, { pesoKg: 102.5, reps: 5 })).toEqual({ tipo: "peso", pesoKg: 102.5 });
  });

  it("más reps que nunca con ese peso", () => {
    expect(detectarRecord(previas, { pesoKg: 100, reps: 11 })).toEqual({ tipo: "reps", pesoKg: 100, reps: 11 });
  });

  it("sin récord", () => {
    expect(detectarRecord(previas, { pesoKg: 100, reps: 10 })).toBeNull();
    expect(detectarRecord(previas, { pesoKg: 95, reps: 9 })).toBeNull();
  });

  it("la primera serie de la historia no es récord", () => {
    expect(detectarRecord([], { pesoKg: 100, reps: 8 })).toBeNull();
  });
});
