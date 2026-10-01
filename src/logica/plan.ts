// Construcción y edición del plan de una sesión. Módulo puro.
import { PESO_INICIAL, pesoMinimo } from "../datos/biblioteca";
import type { Ejercicio, EjercicioDia, PlanEjercicio, SeriePlan } from "../datos/tipos";
import {
  aplicarDescarga,
  calcularCalentamiento,
  decidirPeso,
  pesoDeSesion,
  planificarSeries,
  type SesionHistorial,
} from "./progresion";

export interface EntradaPlan {
  ejercicioDia: EjercicioDia;
  ejercicio: Ejercicio;
  historial: SesionHistorial[];
  /** Id del ejercicio de la rutina si `ejercicio` es un sustituto. */
  ejercicioRutinaId?: string;
}

export interface OpcionesPlan {
  descarga?: boolean;
  conCalentamiento?: boolean;
}

export function construirPlanEjercicio(entrada: EntradaPlan, op: OpcionesPlan = {}): PlanEjercicio {
  const { ejercicioDia: d, ejercicio: e, historial } = entrada;
  const objetivo = { series: d.series, repsMin: d.repsMin, repsMax: d.repsMax };
  const decision = decidirPeso(historial, objetivo, e);
  const pesoPorDefinir = decision.pesoKg === null;

  let trabajo: SeriePlan[];
  let motivo = decision.motivo;
  let accion: PlanEjercicio["accion"] = decision.accion;
  if (op.descarga && !pesoPorDefinir) {
    const ultimoPeso = pesoDeSesion(historial.at(-1)!);
    const des = aplicarDescarga(ultimoPeso, d.series, e.saltoPesoKg);
    trabajo = Array.from({ length: des.series }, () => ({
      pesoKg: des.pesoKg,
      reps: d.repsMin,
      esCalentamiento: false,
    }));
    motivo = "Descarga: 60 % del peso y la mitad de series";
    accion = "descarga";
  } else {
    const peso = pesoPorDefinir ? PESO_INICIAL[e.equipo] : decision.pesoKg!;
    trabajo = planificarSeries({ ...decision, pesoKg: peso }, historial, objetivo).map((s) => ({
      ...s,
      esCalentamiento: false,
    }));
  }

  const calentamiento: SeriePlan[] =
    op.conCalentamiento && !pesoPorDefinir
      ? calcularCalentamiento(trabajo[0].pesoKg, e.saltoPesoKg, pesoMinimo(e)).map((s) => ({
          ...s,
          esCalentamiento: true,
        }))
      : [];

  return {
    ejercicioRutinaId: entrada.ejercicioRutinaId ?? d.ejercicioId,
    ejercicioId: e.id,
    repsMin: d.repsMin,
    repsMax: d.repsMax,
    descansoSeg: d.descansoSeg,
    series: [...calentamiento, ...trabajo],
    pesoPorDefinir,
    accion,
    motivo,
  };
}

/** Índice del primer ejercicio con carga externa: ahí va el calentamiento. */
export function indicePrimerPesado(entradas: EntradaPlan[]): number {
  return entradas.findIndex((x) => x.ejercicio.equipo !== "peso-corporal");
}

export function construirPlan(entradas: EntradaPlan[], op: OpcionesPlan = {}): PlanEjercicio[] {
  const pesado = indicePrimerPesado(entradas);
  return entradas.map((x, i) =>
    construirPlanEjercicio(x, { descarga: op.descarga, conCalentamiento: i === pesado }),
  );
}

// ---------------------------------------------------------------------------
// Edición durante el entreno

export interface Posicion {
  ejercicio: number;
  serie: number;
}

export function serieHecha(s: SeriePlan): boolean {
  return s.registroId !== undefined;
}

/** Primera serie sin marcar, empezando por el ejercicio indicado y luego el resto en orden. */
export function siguientePendiente(plan: PlanEjercicio[], desde = 0): Posicion | null {
  const orden = [...plan.keys()].slice(desde).concat([...plan.keys()].slice(0, desde));
  for (const e of orden) {
    const serie = plan[e].series.findIndex((s) => !serieHecha(s));
    if (serie >= 0) return { ejercicio: e, serie };
  }
  return null;
}

export function ejercicioTerminado(p: PlanEjercicio): boolean {
  return p.series.every(serieHecha);
}

/**
 * Cambia el peso de una serie. Si es de trabajo, las siguientes series de trabajo
 * sin marcar del mismo ejercicio heredan el nuevo peso.
 */
export function cambiarPeso(plan: PlanEjercicio[], pos: Posicion, pesoKg: number): PlanEjercicio[] {
  return plan.map((p, ei) => {
    if (ei !== pos.ejercicio) return p;
    const actual = p.series[pos.serie];
    return {
      ...p,
      pesoPorDefinir: actual.esCalentamiento ? p.pesoPorDefinir : false,
      series: p.series.map((s, si) => {
        if (si === pos.serie) return { ...s, pesoKg };
        const hereda = !actual.esCalentamiento && si > pos.serie && !s.esCalentamiento && !serieHecha(s);
        return hereda ? { ...s, pesoKg } : s;
      }),
    };
  });
}

export function cambiarReps(plan: PlanEjercicio[], pos: Posicion, reps: number): PlanEjercicio[] {
  return plan.map((p, ei) =>
    ei !== pos.ejercicio
      ? p
      : { ...p, series: p.series.map((s, si) => (si === pos.serie ? { ...s, reps: Math.max(0, reps) } : s)) },
  );
}

export function marcarRegistro(plan: PlanEjercicio[], pos: Posicion, registroId: string | undefined): PlanEjercicio[] {
  return plan.map((p, ei) =>
    ei !== pos.ejercicio
      ? p
      : { ...p, series: p.series.map((s, si) => (si === pos.serie ? { ...s, registroId } : s)) },
  );
}

/** Número de serie de trabajo (1, 2, 3…) o de calentamiento, para mostrar y registrar. */
export function numeroSerie(p: PlanEjercicio, indice: number): number {
  const s = p.series[indice];
  return p.series.slice(0, indice + 1).filter((x) => x.esCalentamiento === s.esCalentamiento).length;
}
