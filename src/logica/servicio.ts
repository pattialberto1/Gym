// Orquesta el entreno: une el repositorio con la lógica pura de plan y progresión.
import { obtenerEjercicio, PLANTILLAS } from "../datos/biblioteca";
import * as repo from "../datos/repositorio";
import type { Dificultad, EjercicioDia, PlanEjercicio, Rutina, Sesion } from "../datos/tipos";
import {
  construirPlan,
  construirPlanEjercicio,
  marcarRegistro,
  numeroSerie,
  type EntradaPlan,
  type Posicion,
} from "./plan";
import { debeProponerDescarga, detectarRecord, type MarcaPersonal } from "./progresion";

const AJ_RUTINA = "rutinaActiva";
const AJ_SIGUIENTE = "siguienteDia";
const AJ_DESCARGA = "decisionDescarga";

/** Primera vez: crea las plantillas y activa la primera. */
export async function asegurarDatosIniciales(): Promise<void> {
  const rutinas = await repo.listarRutinas();
  if (rutinas.length > 0) return;
  const copias = PLANTILLAS.map((p) => ({ ...structuredClone(p), id: repo.nuevoId() }));
  for (const r of copias) await repo.guardarRutina(r);
  await repo.guardarAjuste(AJ_RUTINA, copias[0].id);
}

export async function rutinaActiva(): Promise<Rutina | undefined> {
  const id = await repo.leerAjuste<string | null>(AJ_RUTINA, null);
  const rutinas = await repo.listarRutinas();
  return rutinas.find((r) => r.id === id) ?? rutinas[0];
}

export async function activarRutina(id: string): Promise<void> {
  await repo.guardarAjuste(AJ_RUTINA, id);
}

export async function diaSiguiente(rutina: Rutina): Promise<number> {
  const mapa = await repo.leerAjuste<Record<string, number>>(AJ_SIGUIENTE, {});
  const i = mapa[rutina.id] ?? 0;
  return rutina.dias.length === 0 ? 0 : i % rutina.dias.length;
}


export async function fijarDiaSiguiente(rutinaId: string, indice: number): Promise<void> {
  const mapa = await repo.leerAjuste<Record<string, number>>(AJ_SIGUIENTE, {});
  await repo.guardarAjuste(AJ_SIGUIENTE, { ...mapa, [rutinaId]: indice });
}

async function entradas(ejercicios: EjercicioDia[], excluirSesionId?: string): Promise<EntradaPlan[]> {
  const res: EntradaPlan[] = [];
  for (const d of ejercicios) {
    const ejercicio = obtenerEjercicio(d.ejercicioId);
    if (!ejercicio) continue;
    res.push({ ejercicioDia: d, ejercicio, historial: await repo.historialEjercicio(d.ejercicioId, excluirSesionId) });
  }
  return res;
}

/** Plan previsto para un día (sin guardar nada). */
export async function previsualizarDia(rutina: Rutina, diaIndice: number, descarga = false): Promise<PlanEjercicio[]> {
  const dia = rutina.dias[diaIndice];
  if (!dia) return [];
  return construirPlan(await entradas(dia.ejercicios), { descarga });
}

export async function propuestaDescarga(rutina: Rutina): Promise<boolean> {
  const ids = [...new Set(rutina.dias.flatMap((d) => d.ejercicios.map((e) => e.ejercicioId)))];
  const historiales = await Promise.all(ids.map((id) => repo.historialEjercicio(id)));
  const terminadas = (await repo.sesionesTerminadas()).length;
  const ultima = await repo.leerAjuste<number | null>(AJ_DESCARGA, null);
  const desde = ultima === null ? Infinity : terminadas - ultima;
  return debeProponerDescarga(historiales, desde);
}

/** Guarda la respuesta a la propuesta de descarga para no repetirla enseguida. */
export async function responderDescarga(): Promise<void> {
  await repo.guardarAjuste(AJ_DESCARGA, (await repo.sesionesTerminadas()).length);
}

export async function iniciarSesion(rutina: Rutina, diaIndice: number, descarga: boolean): Promise<Sesion> {
  const plan = await previsualizarDia(rutina, diaIndice, descarga);
  if (descarga) await responderDescarga();
  const sesion: Sesion = {
    id: repo.nuevoId(),
    fecha: new Date().toISOString(),
    rutinaId: rutina.id,
    diaIndice,
    nombreDia: rutina.dias[diaIndice].nombre,
    esDescarga: descarga,
    terminada: false,
    plan,
  };
  await repo.guardarSesion(sesion);
  return sesion;
}

export interface ResultadoSerie {
  sesion: Sesion;
  record: MarcaPersonal | null;
}

export async function marcarSerie(sesion: Sesion, pos: Posicion): Promise<ResultadoSerie> {
  const p = sesion.plan[pos.ejercicio];
  const s = p.series[pos.serie];
  const id = s.registroId ?? repo.nuevoId();
  const previas = s.esCalentamiento ? [] : await repo.seriesDeTrabajo(p.ejercicioId, sesion.id);
  const deEstaSesion = s.esCalentamiento
    ? []
    : p.series.filter((x, i) => i !== pos.serie && x.registroId && !x.esCalentamiento);
  await repo.guardarSerie({
    id,
    sesionId: sesion.id,
    ejercicioId: p.ejercicioId,
    numeroSerie: numeroSerie(p, pos.serie),
    pesoKg: s.pesoKg,
    reps: s.reps,
    fecha: new Date().toISOString(),
    esCalentamiento: s.esCalentamiento,
  });
  let plan = marcarRegistro(sesion.plan, pos, id);
  if (p.pesoPorDefinir && !s.esCalentamiento) {
    // El peso queda fijado con la primera serie: a partir de aquí lo calcula la app.
    plan = plan.map((x, i) =>
      i === pos.ejercicio ? { ...x, pesoPorDefinir: false, motivo: "Peso fijado: la próxima vez se calcula solo" } : x,
    );
  }
  const nueva = { ...sesion, plan };
  await repo.guardarSesion(nueva);
  // Solo avisa del récord en la primera serie que lo bate dentro de la sesión.
  const record = s.esCalentamiento ? null : detectarRecord([...previas, ...deEstaSesion], s);
  return { sesion: nueva, record };
}

export async function deshacerSerie(sesion: Sesion, pos: Posicion): Promise<Sesion> {
  const id = sesion.plan[pos.ejercicio].series[pos.serie].registroId;
  if (id) await repo.borrarSerie(id);
  const nueva = { ...sesion, plan: marcarRegistro(sesion.plan, pos, undefined) };
  await repo.guardarSesion(nueva);
  return nueva;
}

/** Guarda los cambios del plan (peso o reps editados) sin marcar nada. */
export async function guardarPlan(sesion: Sesion, plan: PlanEjercicio[]): Promise<Sesion> {
  const nueva = { ...sesion, plan };
  await repo.guardarSesion(nueva);
  return nueva;
}

/** Si una serie ya marcada se edita, actualiza también su registro. */
export async function actualizarSerieMarcada(sesion: Sesion, pos: Posicion): Promise<void> {
  const p = sesion.plan[pos.ejercicio];
  const s = p.series[pos.serie];
  if (!s.registroId) return;
  await repo.guardarSerie({
    id: s.registroId,
    sesionId: sesion.id,
    ejercicioId: p.ejercicioId,
    numeroSerie: numeroSerie(p, pos.serie),
    pesoKg: s.pesoKg,
    reps: s.reps,
    fecha: new Date().toISOString(),
    esCalentamiento: s.esCalentamiento,
  });
}

export async function guardarDificultad(sesion: Sesion, ejercicioId: string, d: Dificultad): Promise<void> {
  await repo.guardarDificultad(sesion.id, ejercicioId, d);
}

/**
 * Cambia un ejercicio por el siguiente de sus sustitutos (vuelve al original al final de la lista).
 * Solo si aún no se ha marcado ninguna serie de trabajo. El sustituto usa su propio historial.
 */
export async function sustituir(sesion: Sesion, indice: number): Promise<Sesion> {
  const p = sesion.plan[indice];
  const original = obtenerEjercicio(p.ejercicioRutinaId);
  if (!original) return sesion;
  const ciclo = [original.id, ...original.sustitutos.filter((id) => obtenerEjercicio(id))];
  const siguienteId = ciclo[(ciclo.indexOf(p.ejercicioId) + 1) % ciclo.length];
  const ejercicio = obtenerEjercicio(siguienteId)!;
  const rutina = await repo.obtenerRutina(sesion.rutinaId);
  const ejDia = rutina?.dias[sesion.diaIndice]?.ejercicios.find((e) => e.ejercicioId === p.ejercicioRutinaId) ?? {
    ejercicioId: p.ejercicioRutinaId,
    series: p.series.filter((s) => !s.esCalentamiento).length,
    repsMin: p.repsMin,
    repsMax: p.repsMax,
    descansoSeg: p.descansoSeg,
  };
  // Borra lo ya marcado del ejercicio anterior (normalmente nada, o calentamientos).
  for (const s of p.series) if (s.registroId) await repo.borrarSerie(s.registroId);
  const nuevo = construirPlanEjercicio(
    {
      ejercicioDia: ejDia,
      ejercicio,
      historial: await repo.historialEjercicio(siguienteId, sesion.id),
      ejercicioRutinaId: p.ejercicioRutinaId,
    },
    { descarga: sesion.esDescarga, conCalentamiento: p.series.some((s) => s.esCalentamiento) },
  );
  const nueva = { ...sesion, plan: sesion.plan.map((x, i) => (i === indice ? nuevo : x)) };
  await repo.guardarSesion(nueva);
  return nueva;
}

export async function terminarSesion(sesion: Sesion): Promise<void> {
  const hechas = sesion.plan.some((p) => p.series.some((s) => s.registroId));
  if (!hechas) {
    await repo.borrarSesion(sesion.id);
    return;
  }
  await repo.guardarSesion({ ...sesion, terminada: true });
  const rutina = await repo.obtenerRutina(sesion.rutinaId);
  if (rutina && rutina.dias.length > 0) {
    await fijarDiaSiguiente(rutina.id, (sesion.diaIndice + 1) % rutina.dias.length);
  }
}

export async function descartarSesion(sesion: Sesion): Promise<void> {
  await repo.borrarSesion(sesion.id);
}
