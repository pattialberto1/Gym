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

export const PLANTILLAS: Rutina[] = [
  {
    id: "plantilla-torso-pierna",
    nombre: "Torso / Pierna",
    dias: [
      {
        nombre: "Torso A",
        ejercicios: [
          ej("press-banca", 3, 6, 10, 150),
          ej("jalon-pecho", 3, 8, 12, 120),
          ej("extension-triceps-overhead", 3, 10, 15, 90),
          ej("curl-predicador", 3, 10, 15, 90),
          ej("elevacion-lateral-polea", 3, 12, 20, 60),
        ],
      },
      {
        nombre: "Pierna A",
        ejercicios: [
          ej("sentadilla-profunda", 3, 6, 10, 180),
          ej("curl-femoral-sentado", 3, 8, 12, 120),
          ej("extension-rodilla", 3, 10, 15, 90),
          ej("elevacion-talones-pausa", 3, 10, 15, 60),
        ],
      },
      {
        nombre: "Torso B",
        ejercicios: [
          ej("flexiones", 3, 8, 15, 90),
          ej("remo-polea", 3, 8, 12, 120),
          ej("extension-triceps-overhead", 3, 10, 15, 90),
          ej("curl-predicador", 3, 10, 15, 90),
          ej("elevacion-lateral-polea", 3, 12, 20, 60),
        ],
      },
      {
        nombre: "Pierna B",
        ejercicios: [
          ej("sentadilla-profunda", 3, 8, 12, 180),
          ej("hip-thrust", 3, 8, 12, 120),
          ej("curl-femoral-sentado", 3, 10, 15, 90),
          ej("elevacion-talones-pausa", 3, 10, 15, 60),
        ],
      },
    ],
  },
  {
    id: "plantilla-empuje-tiron-pierna",
    nombre: "Empuje / Tirón / Pierna",
    dias: [
      {
        nombre: "Empuje",
        ejercicios: [
          ej("press-banca", 3, 6, 10, 150),
          ej("press-inclinado-mancuerna", 3, 8, 12, 120),
          ej("extension-triceps-overhead", 3, 10, 15, 90),
          ej("elevacion-lateral-polea", 3, 12, 20, 60),
        ],
      },
      {
        nombre: "Tirón",
        ejercicios: [
          ej("jalon-pecho", 3, 8, 12, 120),
          ej("remo-polea", 3, 8, 12, 120),
          ej("curl-predicador", 3, 10, 15, 90),
          ej("curl-femoral-sentado", 3, 8, 12, 120),
        ],
      },
      {
        nombre: "Pierna",
        ejercicios: [
          ej("sentadilla-profunda", 3, 6, 10, 180),
          ej("curl-femoral-sentado", 3, 8, 12, 120),
          ej("extension-rodilla", 3, 10, 15, 90),
          ej("elevacion-talones-pausa", 3, 10, 15, 60),
        ],
      },
    ],
  },
];
