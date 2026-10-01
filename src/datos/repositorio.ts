// Capa de datos. Toda la app accede al almacenamiento a través de este módulo,
// de modo que una futura sincronización entre dispositivos solo tenga que tocar aquí.
import { BaseDatos } from "./db";
import type { SesionHistorial, SerieHecha } from "../logica/progresion";
import type { Dificultad, RegistroEjercicio, RegistroSerie, Rutina, Sesion } from "./tipos";

let db = new BaseDatos();

/** Solo para tests: usa una base de datos con otro nombre. */
export function usarBaseDatos(nombre: string): void {
  db.close();
  db = new BaseDatos(nombre);
}

export function nuevoId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Ajustes

export async function leerAjuste<T>(clave: string, porDefecto: T): Promise<T> {
  const a = await db.ajustes.get(clave);
  return a === undefined ? porDefecto : (a.valor as T);
}

export async function guardarAjuste(clave: string, valor: unknown): Promise<void> {
  await db.ajustes.put({ clave, valor });
}

// ---------------------------------------------------------------------------
// Rutinas

export function listarRutinas(): Promise<Rutina[]> {
  return db.rutinas.toArray();
}

export function obtenerRutina(id: string): Promise<Rutina | undefined> {
  return db.rutinas.get(id);
}

export async function guardarRutina(r: Rutina): Promise<void> {
  await db.rutinas.put(structuredClone(r));
}

export async function borrarRutina(id: string): Promise<void> {
  await db.rutinas.delete(id);
}

// ---------------------------------------------------------------------------
// Sesiones

export function obtenerSesion(id: string): Promise<Sesion | undefined> {
  return db.sesiones.get(id);
}

export async function guardarSesion(s: Sesion): Promise<void> {
  await db.sesiones.put(structuredClone(s));
}

export async function borrarSesion(id: string): Promise<void> {
  await db.transaction("rw", db.sesiones, db.series, db.registrosEjercicio, async () => {
    await db.sesiones.delete(id);
    await db.series.where("sesionId").equals(id).delete();
    await db.registrosEjercicio.where("[sesionId+ejercicioId]").between([id, ""], [id, "￿"]).delete();
  });
}

/** La sesión empezada y no terminada, si existe. */
export async function sesionEnCurso(): Promise<Sesion | undefined> {
  const todas = await db.sesiones.orderBy("fecha").reverse().toArray();
  return todas.find((s) => !s.terminada);
}

export async function sesionesTerminadas(): Promise<Sesion[]> {
  const todas = await db.sesiones.orderBy("fecha").toArray();
  return todas.filter((s) => s.terminada);
}

// ---------------------------------------------------------------------------
// Series y dificultad

export async function guardarSerie(s: RegistroSerie): Promise<void> {
  await db.series.put(s);
}

export async function borrarSerie(id: string): Promise<void> {
  await db.series.delete(id);
}

export function seriesDeSesion(sesionId: string): Promise<RegistroSerie[]> {
  return db.series.where("sesionId").equals(sesionId).toArray();
}

export async function guardarDificultad(
  sesionId: string,
  ejercicioId: string,
  dificultad: Dificultad | undefined,
): Promise<void> {
  await db.registrosEjercicio.put({ sesionId, ejercicioId, dificultad });
}

/** Series de trabajo de un ejercicio (sin calentamiento), en orden cronológico. */
export async function seriesDeTrabajo(ejercicioId: string, excluirSesionId?: string): Promise<RegistroSerie[]> {
  const series = await db.series.where("ejercicioId").equals(ejercicioId).toArray();
  return series
    .filter((s) => !s.esCalentamiento && s.sesionId !== excluirSesionId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numeroSerie - b.numeroSerie);
}

/**
 * Historial de un ejercicio agrupado por sesión, listo para el módulo de progresión.
 * Excluye calentamientos, sesiones de descarga y la sesión indicada (la que está en curso).
 */
export async function historialEjercicio(
  ejercicioId: string,
  excluirSesionId?: string,
): Promise<SesionHistorial[]> {
  const series = await seriesDeTrabajo(ejercicioId, excluirSesionId);
  if (series.length === 0) return [];
  const ids = [...new Set(series.map((s) => s.sesionId))];
  const sesiones = new Map((await db.sesiones.bulkGet(ids)).filter(Boolean).map((s) => [s!.id, s!]));
  const dificultades = new Map<string, RegistroEjercicio>(
    (await db.registrosEjercicio.where("ejercicioId").equals(ejercicioId).toArray()).map((r) => [r.sesionId, r]),
  );
  const grupos = new Map<string, { fecha: string; series: SerieHecha[] }>();
  for (const s of series) {
    const sesion = sesiones.get(s.sesionId);
    if (sesion?.esDescarga) continue;
    const g = grupos.get(s.sesionId) ?? { fecha: sesion?.fecha ?? s.fecha, series: [] };
    g.series.push({ pesoKg: s.pesoKg, reps: s.reps });
    grupos.set(s.sesionId, g);
  }
  return [...grupos.entries()]
    .map(([sesionId, g]) => ({ ...g, dificultad: dificultades.get(sesionId)?.dificultad }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Ids de todos los ejercicios con alguna serie registrada. */
export async function ejerciciosConHistorial(): Promise<string[]> {
  const claves = await db.series.orderBy("ejercicioId").uniqueKeys();
  return claves as string[];
}

// ---------------------------------------------------------------------------
// Copia de seguridad

export interface CopiaSeguridad {
  app: "gym";
  version: 1;
  fecha: string;
  rutinas: Rutina[];
  sesiones: Sesion[];
  series: RegistroSerie[];
  registrosEjercicio: RegistroEjercicio[];
  ajustes: { clave: string; valor: unknown }[];
}

export async function exportarTodo(): Promise<CopiaSeguridad> {
  return {
    app: "gym",
    version: 1,
    fecha: new Date().toISOString(),
    rutinas: await db.rutinas.toArray(),
    sesiones: await db.sesiones.toArray(),
    series: await db.series.toArray(),
    registrosEjercicio: await db.registrosEjercicio.toArray(),
    ajustes: await db.ajustes.toArray(),
  };
}

export function validarCopia(datos: unknown): datos is CopiaSeguridad {
  const d = datos as CopiaSeguridad;
  return (
    !!d &&
    d.app === "gym" &&
    d.version === 1 &&
    [d.rutinas, d.sesiones, d.series, d.registrosEjercicio, d.ajustes].every(Array.isArray)
  );
}

/** Sustituye todos los datos por los de la copia. */
export async function importarTodo(copia: CopiaSeguridad): Promise<void> {
  if (!validarCopia(copia)) throw new Error("El archivo no es una copia de seguridad válida");
  await db.transaction("rw", [db.rutinas, db.sesiones, db.series, db.registrosEjercicio, db.ajustes], async () => {
    await Promise.all([
      db.rutinas.clear(),
      db.sesiones.clear(),
      db.series.clear(),
      db.registrosEjercicio.clear(),
      db.ajustes.clear(),
    ]);
    await db.rutinas.bulkPut(copia.rutinas);
    await db.sesiones.bulkPut(copia.sesiones);
    await db.series.bulkPut(copia.series);
    await db.registrosEjercicio.bulkPut(copia.registrosEjercicio);
    await db.ajustes.bulkPut(copia.ajustes);
  });
}
