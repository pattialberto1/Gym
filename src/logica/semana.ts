// Calendario semanal de la rutina. Módulo puro.
import type { EjercicioDia, Rutina } from "../datos/tipos";

export const NOMBRES_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const INICIAL_DIA = ["L", "M", "X", "J", "V", "S", "D"];

/** Día de la semana con el lunes como 0. */
export function diaSemana(fecha: Date): number {
  return (fecha.getDay() + 6) % 7;
}

/** Sin días configurados se puede entrenar cualquier día. */
export function diasDeEntreno(r: Rutina): number[] {
  return r.diasSemana && r.diasSemana.length > 0 ? [...r.diasSemana].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

export function tocaEntrenar(r: Rutina, fecha: Date): boolean {
  return diasDeEntreno(r).includes(diaSemana(fecha));
}

/** Días que faltan hasta el próximo entreno (0 = hoy) y qué día de la semana es. */
export function proximoEntreno(r: Rutina, fecha: Date): { enDias: number; dia: number } {
  const hoy = diaSemana(fecha);
  const dias = diasDeEntreno(r);
  for (let n = 0; n < 7; n++) {
    const d = (hoy + n) % 7;
    if (dias.includes(d)) return { enDias: n, dia: d };
  }
  return { enDias: 0, dia: hoy };
}

/** Lunes 00:00 de la semana de la fecha. */
export function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diaSemana(d));
  return d;
}

/** Días de esta semana (0 = lunes) en que hay alguna sesión terminada. */
export function diasEntrenados(fechasSesiones: string[], hoy: Date): Set<number> {
  const inicio = inicioSemana(hoy).getTime();
  const fin = inicio + 7 * 864e5;
  const res = new Set<number>();
  for (const f of fechasSesiones) {
    const d = new Date(f);
    if (d.getTime() >= inicio && d.getTime() < fin) res.add(diaSemana(d));
  }
  return res;
}

/** Duración aproximada en minutos: ~45 s por serie más el descanso que la sigue. */
export function duracionEstimada(ejercicios: EjercicioDia[]): number {
  const seg = ejercicios.reduce((t, e) => t + e.series * (45 + e.descansoSeg), 0);
  return Math.round(seg / 60 / 5) * 5;
}

/** Series semanales directas por músculo principal. */
export function seriesSemanales(
  ejercicios: EjercicioDia[],
  diasPorSemana: number,
  musculoDe: (id: string) => string | undefined,
): Map<string, number> {
  const res = new Map<string, number>();
  for (const e of ejercicios) {
    const m = musculoDe(e.ejercicioId);
    if (m) res.set(m, (res.get(m) ?? 0) + e.series * diasPorSemana);
  }
  return res;
}
