// Modelo de datos de la app. Compartido por la capa de datos, la lógica y la UI.

export type NivelEvidencia = "fuerte" | "moderada" | "principio";
export type Equipo = "barra" | "mancuerna" | "maquina" | "polea" | "peso-corporal";
export type Dificultad = "facil" | "justo" | "no-pude";

export interface Ejercicio {
  id: string;
  nombre: string;
  musculoPrincipal: string;
  musculosSecundarios: string[];
  equipo: Equipo;
  saltoPesoKg: number;
  tipo: "superior" | "inferior";
  evidencia: {
    nivel: NivelEvidencia;
    resumen: string;
    referencias: string[];
  };
  sustitutos: string[];
  tecnica: FichaTecnica;
}

export interface FichaTecnica {
  modelo?: string;
  clipCorrecto?: string;
  clipError?: string;
  /** Huesos que se resaltan (rojo en el clip de error, verde en el correcto). */
  huesosError?: string[];
  /** Descripción breve del error común, se muestra al activar el modo error. */
  descripcionError?: string;
  /** Objetos del modelo que se muestran (barra, banco, polea…). */
  objetos?: string[];
  /** Vista general de la cámara. */
  vista?: { objetivo: [number, number, number]; distancia: number; azimut: number; elevacion: number };
  puntosClave: PuntoClave[];
}

export interface PuntoClave {
  hueso: string;
  tiempoInicio: number;
  duracion: number;
  zoom: number;
  angulo: { azimut: number; elevacion: number };
  indicacion: string;
}

export interface Rutina {
  id: string;
  nombre: string;
  /** Días de la semana en que se entrena (0 = lunes … 6 = domingo). */
  diasSemana?: number[];
  dias: DiaRutina[];
}

export interface EjercicioDia {
  ejercicioId: string;
  series: number;
  repsMin: number;
  repsMax: number;
  descansoSeg: number;
}

export interface DiaRutina {
  nombre: string;
  ejercicios: EjercicioDia[];
}

export interface RegistroSerie {
  id: string;
  sesionId: string;
  ejercicioId: string;
  numeroSerie: number;
  pesoKg: number;
  reps: number;
  fecha: string;
  esCalentamiento: boolean;
}

export interface RegistroEjercicio {
  sesionId: string;
  ejercicioId: string;
  dificultad?: Dificultad;
}

/** Una sesión de entrenamiento (un día de una rutina hecho en una fecha). */
export interface Sesion {
  id: string;
  fecha: string;
  rutinaId: string;
  diaIndice: number;
  nombreDia: string;
  esDescarga: boolean;
  terminada: boolean;
  /** Plan con el que se empezó la sesión; permite retomarla tras cerrar la app. */
  plan: PlanEjercicio[];
}

export interface SeriePlan {
  pesoKg: number;
  reps: number;
  esCalentamiento: boolean;
  /** Registro guardado, si la serie ya se marcó. */
  registroId?: string;
}

export interface PlanEjercicio {
  /** Ejercicio original de la rutina. */
  ejercicioRutinaId: string;
  /** Ejercicio que se está haciendo (puede ser un sustituto). */
  ejercicioId: string;
  repsMin: number;
  repsMax: number;
  descansoSeg: number;
  series: SeriePlan[];
  /** true si el peso aún no se conoce (primera vez con este ejercicio). */
  pesoPorDefinir: boolean;
  accion: "inicial" | "subir" | "mantener" | "bajar" | "descarga";
  motivo: string;
}

export interface Ajuste {
  clave: string;
  valor: unknown;
}
