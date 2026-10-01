import { describe, expect, it } from "vitest";
import { PLANTILLA_CUERPO_COMPLETO, obtenerEjercicio } from "../src/datos/biblioteca";
import {
  diaSemana,
  diasEntrenados,
  duracionEstimada,
  inicioSemana,
  proximoEntreno,
  seriesSemanales,
  tocaEntrenar,
} from "../src/logica/semana";

const r = PLANTILLA_CUERPO_COMPLETO;
// 2026-10-05 es lunes.
const lunes = new Date(2026, 9, 5, 10);
const martes = new Date(2026, 9, 6, 10);
const sabado = new Date(2026, 9, 10, 10);

describe("calendario semanal", () => {
  it("lunes es el día 0", () => {
    expect(diaSemana(lunes)).toBe(0);
    expect(diaSemana(new Date(2026, 9, 11))).toBe(6);
  });

  it("la plantilla entrena lunes, miércoles y viernes", () => {
    expect(tocaEntrenar(r, lunes)).toBe(true);
    expect(tocaEntrenar(r, martes)).toBe(false);
  });

  it("calcula el próximo entreno", () => {
    expect(proximoEntreno(r, lunes)).toEqual({ enDias: 0, dia: 0 });
    expect(proximoEntreno(r, martes)).toEqual({ enDias: 1, dia: 2 });
    expect(proximoEntreno(r, sabado)).toEqual({ enDias: 2, dia: 0 });
  });

  it("sin días configurados se entrena cualquier día", () => {
    expect(tocaEntrenar({ ...r, diasSemana: [] }, martes)).toBe(true);
  });

  it("marca los días entrenados de la semana actual", () => {
    const fechas = [new Date(2026, 9, 5, 18).toISOString(), new Date(2026, 9, 2, 18).toISOString()];
    expect([...diasEntrenados(fechas, sabado)]).toEqual([0]);
    expect(inicioSemana(sabado).getDate()).toBe(5);
  });
});

describe("rutina de cuerpo completo", () => {
  const ejercicios = r.dias[0].ejercicios;

  it("tiene 8 ejercicios, uno por músculo principal", () => {
    expect(ejercicios).toHaveLength(8);
    const musculos = ejercicios.map((e) => obtenerEjercicio(e.ejercicioId)?.musculoPrincipal);
    expect(new Set(musculos).size).toBe(8);
  });

  it("cada músculo recibe 9 series directas por semana", () => {
    const series = seriesSemanales(ejercicios, 3, (id) => obtenerEjercicio(id)?.musculoPrincipal);
    expect([...series.values()].every((n) => n === 9)).toBe(true);
  });

  it("descansos de 3 min en básicos y al menos 90 s en el resto", () => {
    expect(ejercicios[0].descansoSeg).toBe(180);
    expect(ejercicios.every((e) => e.descansoSeg >= 90)).toBe(true);
  });

  it("la sesión dura alrededor de una hora", () => {
    const min = duracionEstimada(ejercicios);
    expect(min).toBeGreaterThanOrEqual(55);
    expect(min).toBeLessThanOrEqual(80);
  });
});
