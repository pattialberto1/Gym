// Lógica de progresión automática (doble progresión, descarga, calentamiento y récords).
// Módulo puro: sin dependencias de UI ni de almacenamiento.

import type { Dificultad } from "../datos/tipos";

export interface SerieHecha {
  pesoKg: number;
  reps: number;
}

/** Una sesión pasada de un ejercicio: solo series de trabajo, sin descargas. */
export interface SesionHistorial {
  fecha: string;
  series: SerieHecha[];
  dificultad?: Dificultad;
}

export interface Objetivo {
  series: number;
  repsMin: number;
  repsMax: number;
}

export interface DatosEjercicio {
  tipo: "superior" | "inferior";
  saltoPesoKg: number;
}

export type Accion = "inicial" | "subir" | "mantener" | "bajar";

export interface Decision {
  accion: Accion;
  /** null cuando aún no hay historial y el usuario debe poner el peso. */
  pesoKg: number | null;
  motivo: string;
}

const SUBIDA_SUPERIOR_KG = 2.5;
const SUBIDA_INFERIOR_KG = 5;
const BAJADA_MIN = 0.05;
const BAJADA_MAX = 0.1;
const BAJADA_IDEAL = 0.075;

/** Evita restos de coma flotante (2.5 * 3 = 7.499999…). */
export function limpiar(kg: number): number {
  return Math.round(kg * 1000) / 1000;
}

export function redondearAlSalto(kg: number, salto: number): number {
  if (salto <= 0) return limpiar(kg);
  return limpiar(Math.round(kg / salto) * salto);
}

/** Peso de referencia de una sesión: el más alto usado en las series de trabajo. */
export function pesoDeSesion(sesion: SesionHistorial): number {
  return sesion.series.reduce((max, s) => Math.max(max, s.pesoKg), 0);
}

function todasLlegan(sesion: SesionHistorial, reps: number, seriesEsperadas: number): boolean {
  return sesion.series.length >= seriesEsperadas && sesion.series.every((s) => s.reps >= reps);
}

function quedoPorDebajo(sesion: SesionHistorial, repsMin: number): boolean {
  return sesion.series.some((s) => s.reps < repsMin);
}

/** Incremento al subir, redondeado al salto real del equipo (nunca menor que un salto). */
export function incrementoSubida(ej: DatosEjercicio, doble = false): number {
  const base = ej.tipo === "superior" ? SUBIDA_SUPERIOR_KG : SUBIDA_INFERIOR_KG;
  const inc = Math.max(ej.saltoPesoKg, redondearAlSalto(base, ej.saltoPesoKg));
  return limpiar(doble ? inc * 2 : inc);
}

/**
 * Peso tras una bajada del 5–10 %, en saltos enteros del equipo desde el peso actual.
 * Si un solo salto ya supera el 10 %, baja un salto (es lo mínimo que permite el equipo).
 */
export function pesoBajado(pesoKg: number, salto: number): number {
  if (pesoKg <= 0) return 0;
  if (salto <= 0) return limpiar(pesoKg * (1 - BAJADA_IDEAL));
  let mejorK = 1;
  let mejorDist = Infinity;
  const maxK = Math.max(1, Math.ceil((pesoKg * BAJADA_MAX) / salto));
  for (let k = 1; k <= maxK; k++) {
    const frac = (k * salto) / pesoKg;
    if (frac < BAJADA_MIN - 1e-9 || frac > BAJADA_MAX + 1e-9) continue;
    const dist = Math.abs(frac - BAJADA_IDEAL);
    if (dist < mejorDist) {
      mejorDist = dist;
      mejorK = k;
    }
  }
  return Math.max(0, limpiar(pesoKg - mejorK * salto));
}

/**
 * Doble progresión evaluando la última sesión (y la penúltima para las bajadas).
 * `historial` va en orden cronológico y contiene solo sesiones normales (no descargas).
 */
export function decidirPeso(
  historial: SesionHistorial[],
  objetivo: Objetivo,
  ej: DatosEjercicio,
): Decision {
  const ultima = historial.at(-1);
  if (!ultima || ultima.series.length === 0) {
    return { accion: "inicial", pesoKg: null, motivo: "Primera vez: elige el peso" };
  }
  const penultima = historial.at(-2);
  const peso = pesoDeSesion(ultima);

  const dosVecesPorDebajo =
    !!penultima &&
    quedoPorDebajo(ultima, objetivo.repsMin) &&
    quedoPorDebajo(penultima, objetivo.repsMin);
  const dosVecesNoPude =
    !!penultima && ultima.dificultad === "no-pude" && penultima.dificultad === "no-pude";

  if (dosVecesPorDebajo || dosVecesNoPude) {
    const nuevo = pesoBajado(peso, ej.saltoPesoKg);
    return {
      accion: "bajar",
      pesoKg: nuevo,
      motivo: dosVecesPorDebajo
        ? "Dos sesiones por debajo del mínimo: bajamos un poco"
        : "Dos sesiones sin poder: bajamos un poco",
    };
  }

  if (todasLlegan(ultima, objetivo.repsMax, objetivo.series)) {
    if (ultima.dificultad === "no-pude") {
      return { accion: "mantener", pesoKg: peso, motivo: "Llegaste al tope, pero costó: mismo peso" };
    }
    const doble = ultima.dificultad === "facil";
    return {
      accion: "subir",
      pesoKg: limpiar(peso + incrementoSubida(ej, doble)),
      motivo: doble ? "Tope de reps y fácil: subida doble" : "Tope de reps: sube el peso",
    };
  }

  if (todasLlegan(ultima, objetivo.repsMin, objetivo.series)) {
    return { accion: "mantener", pesoKg: peso, motivo: "Mismo peso: intenta sumar reps" };
  }

  return { accion: "mantener", pesoKg: peso, motivo: "Mismo peso: intenta llegar al mínimo" };
}

/** Reps previstas para cada serie según la decisión. Con "mantener" se busca una rep más. */
export function planificarSeries(
  decision: Decision,
  historial: SesionHistorial[],
  objetivo: Objetivo,
): SerieHecha[] {
  const peso = decision.pesoKg ?? 0;
  const ultima = historial.at(-1);
  return Array.from({ length: objetivo.series }, (_, i) => {
    if (decision.accion !== "mantener" || !ultima || ultima.series.length === 0) {
      return { pesoKg: peso, reps: objetivo.repsMin };
    }
    const previa = (ultima.series[i] ?? ultima.series.at(-1)!).reps;
    const reps = Math.min(objetivo.repsMax, Math.max(objetivo.repsMin, previa + 1));
    return { pesoKg: peso, reps };
  });
}

// ---------------------------------------------------------------------------
// Estancamiento y descarga

interface Rendimiento {
  peso: number;
  reps: number;
}

function rendimiento(s: SesionHistorial): Rendimiento {
  const peso = pesoDeSesion(s);
  const reps = s.series.filter((x) => x.pesoKg === peso).reduce((t, x) => t + x.reps, 0);
  return { peso, reps };
}

function mejor(a: Rendimiento, b: Rendimiento): boolean {
  return a.peso > b.peso || (a.peso === b.peso && a.reps > b.reps);
}

/**
 * true si las últimas `n` sesiones no superaron la mejor marca anterior
 * (ni más peso, ni más reps con el mismo peso).
 */
export function estaEstancado(historial: SesionHistorial[], n = 3): boolean {
  const validas = historial.filter((s) => s.series.length > 0);
  if (validas.length < n + 1) return false;
  let tope = rendimiento(validas[0]);
  for (let i = 1; i < validas.length; i++) {
    const r = rendimiento(validas[i]);
    const enVentana = i >= validas.length - n;
    if (mejor(r, tope)) {
      if (enVentana) return false;
      tope = r;
    }
  }
  return true;
}

export const EJERCICIOS_PARA_DESCARGA = 3;
export const SESIONES_ENTRE_PROPUESTAS = 3;

/**
 * Se propone descarga si 3 o más ejercicios están estancados y han pasado
 * suficientes sesiones desde la última descarga o rechazo.
 */
export function debeProponerDescarga(
  historiales: SesionHistorial[][],
  sesionesDesdeUltimaDecision: number,
): boolean {
  if (sesionesDesdeUltimaDecision < SESIONES_ENTRE_PROPUESTAS) return false;
  const estancados = historiales.filter((h) => estaEstancado(h)).length;
  return estancados >= EJERCICIOS_PARA_DESCARGA;
}

export function aplicarDescarga(
  pesoKg: number,
  series: number,
  salto: number,
): { pesoKg: number; series: number } {
  return {
    pesoKg: redondearAlSalto(pesoKg * 0.6, salto),
    series: Math.max(1, Math.ceil(series / 2)),
  };
}

// ---------------------------------------------------------------------------
// Calentamiento

export interface SerieCalentamiento {
  pesoKg: number;
  reps: number;
}

/** Series de aproximación al 50 % y 75 % del peso de trabajo. */
export function calcularCalentamiento(
  pesoTrabajo: number,
  salto: number,
  pesoMinimo = 0,
): SerieCalentamiento[] {
  const pasos: [number, number][] = [
    [0.5, 8],
    [0.75, 4],
  ];
  const res: SerieCalentamiento[] = [];
  for (const [frac, reps] of pasos) {
    const peso = Math.max(pesoMinimo, redondearAlSalto(pesoTrabajo * frac, salto));
    if (peso <= 0 || peso >= pesoTrabajo) continue;
    if (res.some((r) => r.pesoKg === peso)) continue;
    res.push({ pesoKg: peso, reps });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Récords

export type MarcaPersonal = { tipo: "peso"; pesoKg: number } | { tipo: "reps"; pesoKg: number; reps: number };

/** Detecta si una serie supera la marca personal frente a todas las series previas. */
export function detectarRecord(previas: SerieHecha[], nueva: SerieHecha): MarcaPersonal | null {
  if (previas.length === 0 || nueva.reps <= 0) return null;
  const pesoMax = Math.max(...previas.map((s) => s.pesoKg));
  if (nueva.pesoKg > pesoMax) return { tipo: "peso", pesoKg: nueva.pesoKg };
  const conMismoPeso = previas.filter((s) => s.pesoKg === nueva.pesoKg);
  if (conMismoPeso.length === 0) return null;
  const repsMax = Math.max(...conMismoPeso.map((s) => s.reps));
  if (nueva.reps > repsMax) return { tipo: "reps", pesoKg: nueva.pesoKg, reps: nueva.reps };
  return null;
}
