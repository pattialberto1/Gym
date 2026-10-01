import { describe, expect, it } from "vitest";
import { obtenerEjercicio } from "../src/datos/biblioteca";
import {
  cambiarPeso,
  cambiarReps,
  construirPlan,
  marcarRegistro,
  numeroSerie,
  siguientePendiente,
  type EntradaPlan,
} from "../src/logica/plan";
import type { SesionHistorial } from "../src/logica/progresion";

const sentadilla = obtenerEjercicio("sentadilla-profunda")!;
const flexiones = obtenerEjercicio("flexiones")!;
const curl = obtenerEjercicio("curl-femoral-sentado")!;

const h = (peso: number, reps: number[]): SesionHistorial[] => [
  { fecha: "2026-01-01", series: reps.map((r) => ({ pesoKg: peso, reps: r })) },
];

function entrada(e = sentadilla, historial: SesionHistorial[] = []): EntradaPlan {
  return {
    ejercicio: e,
    historial,
    ejercicioDia: { ejercicioId: e.id, series: 3, repsMin: 6, repsMax: 10, descansoSeg: 120 },
  };
}

describe("construirPlan", () => {
  it("primera vez: peso por defecto del equipo y sin calentamiento", () => {
    const [p] = construirPlan([entrada()]);
    expect(p.pesoPorDefinir).toBe(true);
    expect(p.series).toHaveLength(3);
    expect(p.series[0]).toMatchObject({ pesoKg: 20, reps: 6, esCalentamiento: false });
  });

  it("calentamiento solo antes del primer ejercicio con carga", () => {
    const plan = construirPlan([
      entrada(flexiones, h(0, [10, 10, 10])),
      entrada(sentadilla, h(100, [10, 10, 10])),
      entrada(curl, h(40, [8, 8, 8])),
    ]);
    expect(plan[0].series.some((s) => s.esCalentamiento)).toBe(false);
    expect(plan[1].series.filter((s) => s.esCalentamiento).map((s) => s.pesoKg)).toEqual([52.5, 80]);
    expect(plan[1].series.filter((s) => !s.esCalentamiento).every((s) => s.pesoKg === 105)).toBe(true);
    expect(plan[2].series.some((s) => s.esCalentamiento)).toBe(false);
  });

  it("descarga: 60 % del último peso y mitad de series", () => {
    const [p] = construirPlan([entrada(sentadilla, h(100, [8, 8, 8]))], { descarga: true });
    const trabajo = p.series.filter((s) => !s.esCalentamiento);
    expect(trabajo).toHaveLength(2);
    expect(trabajo[0].pesoKg).toBe(60);
  });
});

describe("edición durante el entreno", () => {
  const base = () => construirPlan([entrada(sentadilla, h(100, [8, 8, 8]))]);

  it("herencia: cambiar el peso actualiza las series siguientes", () => {
    const plan = base();
    const primera = plan[0].series.findIndex((s) => !s.esCalentamiento);
    const nuevo = cambiarPeso(plan, { ejercicio: 0, serie: primera }, 95);
    const trabajo = nuevo[0].series.filter((s) => !s.esCalentamiento);
    expect(trabajo.map((s) => s.pesoKg)).toEqual([95, 95, 95]);
  });

  it("herencia: no toca series ya marcadas ni anteriores", () => {
    let plan = base();
    const w = plan[0].series.findIndex((s) => !s.esCalentamiento);
    plan = marcarRegistro(plan, { ejercicio: 0, serie: w }, "r1");
    plan = cambiarPeso(plan, { ejercicio: 0, serie: w + 1 }, 90);
    const trabajo = plan[0].series.filter((s) => !s.esCalentamiento);
    expect(trabajo.map((s) => s.pesoKg)).toEqual([100, 90, 90]);
  });

  it("cambiar el peso de un calentamiento no afecta al resto", () => {
    const plan = cambiarPeso(base(), { ejercicio: 0, serie: 0 }, 40);
    expect(plan[0].series[0].pesoKg).toBe(40);
    expect(plan[0].series.filter((s) => !s.esCalentamiento).every((s) => s.pesoKg === 100)).toBe(true);
  });

  it("al fijar el peso la primera vez deja de estar por definir", () => {
    const plan = cambiarPeso(construirPlan([entrada()]), { ejercicio: 0, serie: 0 }, 60);
    expect(plan[0].pesoPorDefinir).toBe(false);
    expect(plan[0].series.map((s) => s.pesoKg)).toEqual([60, 60, 60]);
  });

  it("cambiar reps solo afecta a esa serie", () => {
    const plan = cambiarReps(base(), { ejercicio: 0, serie: 2 }, 12);
    expect(plan[0].series[2].reps).toBe(12);
    expect(plan[0].series[3].reps).not.toBe(12);
  });

  it("siguientePendiente recorre el plan y vuelve al principio", () => {
    let plan = construirPlan([entrada(flexiones), entrada(curl)]);
    expect(siguientePendiente(plan)).toEqual({ ejercicio: 0, serie: 0 });
    expect(siguientePendiente(plan, 1)).toEqual({ ejercicio: 1, serie: 0 });
    for (let i = 0; i < 3; i++) plan = marcarRegistro(plan, { ejercicio: 1, serie: i }, `r${i}`);
    expect(siguientePendiente(plan, 1)).toEqual({ ejercicio: 0, serie: 0 });
  });

  it("numera calentamientos y series de trabajo por separado", () => {
    const plan = base();
    expect(numeroSerie(plan[0], 0)).toBe(1);
    expect(numeroSerie(plan[0], 1)).toBe(2);
    expect(numeroSerie(plan[0], 2)).toBe(1);
  });
});
