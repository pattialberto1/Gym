// Biblioteca de ejercicios basada en evidencia y plantillas de rutina.
import datos from "./ejercicios.json";
import type { Ejercicio, Equipo, NivelEvidencia, Rutina } from "./tipos";

export const EJERCICIOS: Ejercicio[] = datos as Ejercicio[];

const porId = new Map(EJERCICIOS.map((e) => [e.id, e]));

export function obtenerEjercicio(id: string): Ejercicio | undefined {
  return porId.get(id);
}

export const ORDEN_EVIDENCIA: Record<NivelEvidencia, number> = {
  fuerte: 0,
  moderada: 1,
  principio: 2,
};

export const ETIQUETA_EVIDENCIA: Record<NivelEvidencia, string> = {
  fuerte: "Evidencia fuerte",
  moderada: "Evidencia moderada",
  principio: "Principio general",
};

export const MUSCULOS: Record<string, string> = {
  gluteos: "Glúteos",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  gemelos: "Gemelos",
  pecho: "Pecho",
  espalda: "Espalda",
  deltoides: "Hombro (deltoides)",
  triceps: "Tríceps",
  biceps: "Bíceps",
  aductores: "Aductores",
};

export const EQUIPO: Record<Equipo, string> = {
  barra: "Barra",
  mancuerna: "Mancuernas",
  maquina: "Máquina",
  polea: "Polea",
  "peso-corporal": "Peso corporal",
};

/** Peso con el que se propone empezar la primera vez (el usuario lo ajusta). */
export const PESO_INICIAL: Record<Equipo, number> = {
  barra: 20,
  mancuerna: 8,
  maquina: 20,
  polea: 10,
  "peso-corporal": 0,
};

/** Peso mínimo con sentido para el calentamiento (la barra vacía). */
export function pesoMinimo(e: Ejercicio): number {
  return e.equipo === "barra" ? 20 : 0;
}

export function ordenarPorEvidencia(lista: Ejercicio[]): Ejercicio[] {
  return [...lista].sort(
    (a, b) =>
      ORDEN_EVIDENCIA[a.evidencia.nivel] - ORDEN_EVIDENCIA[b.evidencia.nivel] ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
}

/** Ejercicios de un músculo, primero el principal y luego por nivel de evidencia. */
export function ejerciciosPorMusculo(musculo: string): Ejercicio[] {
  const principales = ordenarPorEvidencia(EJERCICIOS.filter((e) => e.musculoPrincipal === musculo));
  const secundarios = ordenarPorEvidencia(
    EJERCICIOS.filter((e) => e.musculoPrincipal !== musculo && e.musculosSecundarios.includes(musculo)),
  );
  return [...principales, ...secundarios];
}

export function musculosConEjercicios(): string[] {
  return Object.keys(MUSCULOS).filter((m) => EJERCICIOS.some((e) => e.musculoPrincipal === m));
}

// ---------------------------------------------------------------------------
// Plantillas

function ej(ejercicioId: string, series: number, repsMin: number, repsMax: number, descansoSeg: number) {
  return { ejercicioId, series, repsMin, repsMax, descansoSeg };
}

/**
 * Rutina de cuerpo completo, la misma todos los días de entreno (lunes, miércoles y viernes).
 * - Frecuencia: cada músculo 3 veces por semana con 48 h de descanso entre sesiones
 *   (≥2 veces por semana supera a 1: Schoenfeld et al., 2016).
 * - Volumen: 3 series × 3 días = 9 series directas por músculo y semana, más el trabajo
 *   indirecto de los multiarticulares (≈10 o más, donde la meta-análisis ve mejores resultados:
 *   Schoenfeld et al., 2017).
 * - Descansos: 3 min en los básicos, 2 min en los de aislamiento (Schoenfeld et al., 2016).
 */
export const PLANTILLA_CUERPO_COMPLETO: Rutina = {
  id: "plantilla-cuerpo-completo",
  nombre: "Cuerpo completo",
  diasSemana: [0, 2, 4],
  dias: [
    {
      nombre: "Cuerpo completo",
      ejercicios: [
        ej("sentadilla-profunda", 3, 6, 10, 180),
        ej("press-banca", 3, 6, 10, 180),
        ej("jalon-pecho", 3, 8, 12, 150),
        ej("curl-femoral-sentado", 3, 8, 12, 120),
        ej("extension-triceps-overhead", 3, 10, 15, 120),
        ej("curl-predicador", 3, 10, 15, 120),
        ej("elevacion-lateral-polea", 3, 12, 20, 90),
        ej("elevacion-talones-pausa", 3, 10, 15, 90),
      ],
    },
  ],
};

export const PLANTILLAS: Rutina[] = [PLANTILLA_CUERPO_COMPLETO];

/** Nombres de las plantillas de versiones anteriores (se sustituyen por la nueva). */
export const PLANTILLAS_ANTIGUAS = ["Torso / Pierna", "Empuje / Tirón / Pierna"];

/** Evidencia que justifica la rutina, para mostrarla en la app. */
export const EVIDENCIA_RUTINA = [
  {
    titulo: "3 días por semana, cuerpo completo",
    texto: "Entrenar cada músculo al menos 2 veces por semana dio más crecimiento que 1 vez. Con el mismo volumen total, repartirlo en más días no suma por sí mismo, pero facilita hacer buenas series sin acumular fatiga.",
    refs: [
      "Schoenfeld BJ, Ogborn D, Krieger JW. Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis. Sports Med. 2016;46(11):1689-1697.",
      "Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis. J Sports Sci. 2019;37(11):1286-1295.",
    ],
  },
  {
    titulo: "≈10 series por músculo y semana",
    texto: "Más series semanales se asocian a más crecimiento, con buenos resultados a partir de unas 10 por músculo. Aquí son 9 directas más las indirectas de los ejercicios básicos (cuentan como media serie).",
    refs: [
      "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073-1082.",
      "Pelland JC, Remmert JF, Robinson ZP, Hinson S, Zourdos MC. The Resistance Training Dose-Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gain. Sports Med. 2026;56(2):481-505.",
    ],
  },
  {
    titulo: "Descansos largos entre series",
    texto: "Descansar 3 minutos dio más fuerza y más grosor muscular que 1 minuto. Por eso 3 min en los básicos y 2 min en los de aislamiento; entre sesiones, 48 h para el mismo músculo.",
    refs: [
      "Schoenfeld BJ, Pope ZK, Benik FM, et al. Longer Interset Rest Periods Enhance Muscle Strength and Hypertrophy in Resistance-Trained Men. J Strength Cond Res. 2016;30(7):1805-1812.",
    ],
  },
  {
    titulo: "Cerca del fallo, sin llegar siempre",
    texto: "Llegar al fallo total apenas aporta frente a quedarse cerca. Acaba cada serie con 1–3 repeticiones en reserva; si marcas «fácil», la app sube el peso más rápido.",
    refs: [
      "Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis. Sports Med. 2023;53(3):649-665.",
    ],
  },
];
