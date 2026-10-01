// Definición de cada ejercicio: pose en función de p (0 = posición contraída/arriba,
// 1 = posición estirada), objetos, vista general y puntos clave de la guía.
// Convención: el personaje mira hacia +Z; su izquierda es +X; suelo en y = 0.
import * as THREE from "three";
import { LADOS, M, euler, lerp, lerpD, lerpV, quatDesde, v } from "./kit.mjs";

// Momentos del bucle de 5 s: arriba (0–0.6), bajando (0.6–2.6), pausa abajo (2.6–3.2), subiendo (3.2–4.4).
const T = { arriba: 0.2, bajando: 1.4, abajo: 2.7, subiendo: 3.7 };

function punto(hueso, t, zoom, az, el, texto, d = 2) {
  return { hueso, t, d, zoom, az, el, texto };
}

// ---------------------------------------------------------------------------
// Bloques reutilizables

function dePie(k, { ancho = 0.12, y = 0.93, z = 0, pitch = 0, columna = [0, 0, 0] } = {}) {
  k.cadera([0, y, z], [pitch, 0, 0]);
  k.columna(...columna);
  for (const [l, s] of LADOS) k.pierna(l, [s * ancho, M.pie, 0.02], [s * 0.25, 0, 1], "plano");
}

/** Tumbado boca arriba en un banco plano (cabeza hacia -Z). */
function tumbadoBanco(k) {
  k.cadera([0, 0.54, 0], [-90, 0, 0]);
  k.columna(-4, -4, 0, 12, 0);
  for (const [l, s] of LADOS) k.pierna(l, [s * 0.3, M.pie, 0.52], [s * 0.4, 1, 0.2], "plano");
  k.objeto("obj-banco", [0, 0.45, -0.33]);
}

/** Sentado con los muslos horizontales hacia delante y los pies en el suelo. */
function sentado(k, { y = 0.58, pitch = 0, columna = [0, 0, 0], muslo = [0, -0.05, 1], tibia = [0, -1, 0.05] } = {}) {
  k.cadera([0, y, 0], [pitch, 0, 0]);
  k.columna(...columna);
  for (const [l, s] of LADOS) k.piernaDir(l, [s * 0.12 + muslo[0], muslo[1], muslo[2]], tibia, "plano");
}

function barraEnManos(k) {
  const pos = k.mano("Left").add(k.mano("Right")).multiplyScalar(0.5);
  k.objeto("obj-barra", pos);
  return pos;
}

function mancuernasEnManos(k, rot = [0, 0, 0]) {
  k.objeto("obj-mancuerna-izq", k.mano("Left"), rot);
  k.objeto("obj-mancuerna-der", k.mano("Right"), rot);
}

/** Sentadilla genérica: devuelve la inclinación del tronco usada. */
function sentadilla(k, p, { ancho = 0.15, tronco = [4, 42], femur = [4, 112], polo = () => 0.35 } = {}) {
  const tibiaAng = THREE.MathUtils.degToRad(lerp(3, 38, p));
  const femurAng = THREE.MathUtils.degToRad(lerp(femur[0], femur[1], p));
  const troncoAng = lerp(tronco[0], tronco[1], p);
  const z = M.tibia * Math.sin(tibiaAng) - M.femur * Math.sin(femurAng);
  const y = M.pie + M.tibia * Math.cos(tibiaAng) + M.femur * Math.cos(femurAng);
  k.cadera([0, y + 0.03, z + 0.02], [troncoAng * 0.35, 0, 0]);
  k.columna(troncoAng * 0.35, troncoAng * 0.3, 0, -troncoAng * 0.6);
  for (const [l, s] of LADOS) {
    const fuera = polo(p);
    k.pierna(l, [s * ancho, M.pie, 0], [s * fuera, 0, 1], "plano");
  }
  return troncoAng;
}

// ---------------------------------------------------------------------------

export const EJERCICIOS = [
  {
    id: "sentadilla-profunda",
    objetos: ["obj-barra"],
    vista: { objetivo: [0, 0.75, 0], distancia: 3.3, azimut: 35, elevacion: 12 },
    pose(k, p, error) {
      sentadilla(k, p, { polo: (x) => (error ? -lerp(0, 0.8, x) : 0.35) });
      const barra = k.punto("Spine2", [0, M.columna[2], -0.12]);
      k.objeto("obj-barra", barra);
      for (const [l, s] of LADOS) k.brazo(l, barra.clone().add(v([s * 0.4, 0, 0.02])), [s * 0.2, -1, -0.5]);
    },
    error: {
      clip: "sentadilla-valgo",
      huesos: ["mixamorigLeftLeg", "mixamorigRightLeg", "mixamorigLeftUpLeg", "mixamorigRightUpLeg"],
      descripcion: "Rodillas que se van hacia dentro al bajar y al subir",
    },
    puntos: [
      punto("mixamorigLeftFoot", T.arriba, 1.5, 30, 25, "Pies a la anchura de los hombros, puntas un poco hacia fuera"),
      punto("mixamorigLeftLeg", T.bajando, 1.7, 10, 15, "Rodillas en la línea de la punta del pie"),
      punto("mixamorigHips", T.abajo, 2.3, 70, 5, "Baja hasta que la cadera pase la rodilla"),
      punto("mixamorigSpine1", T.subiendo, 2.2, 150, 25, "Espalda neutra y pecho arriba al subir"),
      punto("mixamorigRightFoot", T.arriba, 1.5, -70, 10, "Empuja con todo el pie, talones pegados al suelo"),
    ],
  },
  {
    id: "hip-thrust",
    objetos: ["obj-barra", "obj-banco"],
    vista: { objetivo: [0, 0.35, -0.05], distancia: 3, azimut: 70, elevacion: 15 },
    pose(k, p) {
      k.cadera(lerpV([0, 0.47, 0], [0, 0.25, -0.06], p), [lerp(-90, -58, p), 0, 0]);
      k.columna(0, 0, 0, lerp(25, 10, p));
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.17, M.pie, 0.45], [s * 0.4, 1, 0.2], "plano");
      const barra = k.punto("Hips", [0, 0.0, 0.14]);
      k.objeto("obj-barra", barra);
      for (const [l, s] of LADOS) k.brazo(l, barra.clone().add(v([s * 0.32, 0, 0])), [s * 1, 0.3, 0]);
      k.objeto("obj-banco", [0, 0.36, -0.5], [0, 90, 0]);
    },
    puntos: [
      punto("mixamorigSpine2", T.arriba, 2, 90, 15, "Apoya la parte baja de los omóplatos en el banco"),
      punto("mixamorigHips", T.abajo, 2, 80, 10, "Baja la cadera sin mover los hombros del banco"),
      punto("mixamorigLeftLeg", T.subiendo, 1.8, 60, 10, "Arriba, espinillas verticales"),
      punto("mixamorigHips", T.arriba, 2, 100, 20, "Cadera extendida y barbilla recogida; aprieta un segundo"),
    ],
  },
  {
    id: "prensa-piernas",
    objetos: ["obj-asiento-prensa", "obj-plataforma"],
    vista: { objetivo: [0, 0.6, 0.25], distancia: 3, azimut: 70, elevacion: 15 },
    pose(k, p) {
      k.cadera([0, 0.5, 0], [-55, 0, 0]);
      k.columna(0, 0, 0, 25);
      for (const [l, s] of LADOS)
        k.pierna(l, lerpV([s * 0.15, 0.95, 0.62], [s * 0.15, 0.74, 0.3], p), [s * 0.5, 1, 0.2], -45);
      const centro = k.tobillo("Left").add(k.tobillo("Right")).multiplyScalar(0.5);
      k.objeto("obj-plataforma", centro.add(v([0, 0.07, 0.07])), [-45, 0, 0]);
      for (const [l, s] of LADOS) k.brazoDir(l, [s * 0.3, -1, 0.25], [s * 0.1, -1, 0.5]);
      k.objeto("obj-asiento-prensa", [0, 0.4, 0.02]);
    },
    puntos: [
      punto("mixamorigLeftFoot", T.arriba, 1.8, 40, 20, "Pies en el centro de la plataforma, a la anchura de la cadera"),
      punto("mixamorigLeftLeg", T.bajando, 2, 20, 15, "Rodillas siguiendo la dirección de los pies"),
      punto("mixamorigHips", T.abajo, 2, 90, 10, "Baja todo lo que puedas sin que la pelvis se despegue del respaldo"),
      punto("mixamorigLeftLeg", T.subiendo, 2, 70, 15, "Empuja sin bloquear del todo las rodillas arriba"),
    ],
  },
  {
    id: "sentadilla-goblet",
    objetos: ["obj-mancuerna-izq"],
    vista: { objetivo: [0, 0.75, 0], distancia: 3.2, azimut: 35, elevacion: 12 },
    pose(k, p) {
      sentadilla(k, p, { ancho: 0.17, tronco: [3, 28] });
      const pecho = k.punto("Spine2", [0, 0.04, 0.2]);
      k.objeto("obj-mancuerna-izq", pecho, [0, 0, 90]);
      for (const [l, s] of LADOS) k.brazo(l, pecho.clone().add(v([s * 0.05, 0, 0])), [s * 0.4, -1, 0]);
    },
    puntos: [
      punto("mixamorigSpine2", T.arriba, 1.8, 30, 15, "Mancuerna pegada al pecho, codos hacia abajo"),
      punto("mixamorigLeftLeg", T.bajando, 1.8, 15, 15, "Rodillas hacia fuera, siguiendo los pies"),
      punto("mixamorigHips", T.abajo, 2.2, 75, 5, "Baja entre las piernas, lo más hondo que controles"),
      punto("mixamorigSpine1", T.subiendo, 2.2, 60, 15, "Sube con el pecho alto"),
    ],
  },
  {
    id: "curl-femoral-sentado",
    objetos: ["obj-asiento", "obj-rodillo"],
    vista: { objetivo: [0, 0.6, 0.25], distancia: 3, azimut: 70, elevacion: 15 },
    pose(k, p) {
      sentado(k, { y: 0.58, pitch: 12, columna: [8, 6, 0, -10], tibia: lerpD([0, -1, -0.55], [0, -0.06, 1], p) });
      const a = k.punto("LeftLeg", [0, -0.37, -0.07]);
      const b = k.punto("RightLeg", [0, -0.37, -0.07]);
      k.objeto("obj-rodillo", a.add(b).multiplyScalar(0.5));
      for (const [l, s] of LADOS) k.brazoDir(l, [s * 0.25, -1, 0.15], [s * 0.05, -1, 0.35]);
      k.objeto("obj-asiento", [0, 0.48, -0.05]);
    },
    puntos: [
      punto("mixamorigHips", T.arriba, 2, 80, 15, "Inclínate un poco hacia delante para estirar más los isquios"),
      punto("mixamorigLeftLeg", T.bajando, 1.8, 90, 10, "Rodilla alineada con el eje de la máquina"),
      punto("mixamorigLeftFoot", T.abajo, 1.8, 70, 10, "Estira la pierna del todo: es la parte que más hace crecer"),
      punto("mixamorigLeftLeg", T.subiendo, 1.8, 100, 15, "Flexiona hasta atrás sin despegar la cadera"),
    ],
  },
  {
    id: "curl-femoral-tumbado",
    objetos: ["obj-banco", "obj-rodillo"],
    vista: { objetivo: [0, 0.6, -0.1], distancia: 3, azimut: 80, elevacion: 15 },
    pose(k, p) {
      k.cadera([0, 0.55, 0], [90, 0, 0]);
      k.columna(-3, -3, 0, -15);
      for (const [l, s] of LADOS) k.piernaDir(l, [s * 0.08, -0.05, -1], lerpD([0, 1, 0.45], [0, -0.04, -1], p));
      const a = k.punto("LeftLeg", [0, -0.37, -0.07]);
      const b = k.punto("RightLeg", [0, -0.37, -0.07]);
      k.objeto("obj-rodillo", a.add(b).multiplyScalar(0.5));
      for (const [l, s] of LADOS) k.brazoDir(l, [s * 0.15, -0.5, 1], [0, -0.8, 0.4]);
      k.objeto("obj-banco", [0, 0.45, 0.17]);
    },
    puntos: [
      punto("mixamorigHips", T.arriba, 2, 90, 20, "Cadera pegada al banco"),
      punto("mixamorigLeftLeg", T.bajando, 2, 90, 10, "Baja despacio hasta estirar la pierna"),
      punto("mixamorigHips", T.subiendo, 2, 60, 25, "Sube sin levantar la cadera"),
    ],
  },
  {
    id: "peso-muerto-rumano",
    objetos: ["obj-barra"],
    vista: { objetivo: [0, 0.75, 0], distancia: 3.2, azimut: 70, elevacion: 10 },
    pose(k, p, error) {
      if (error) {
        k.cadera(lerpV([0, 0.93, 0], [0, 0.9, -0.12], p), [lerp(0, 50, p), 0, 0]);
        k.columna(lerp(0, 25, p), lerp(0, 25, p), lerp(0, 15, p), lerp(0, 10, p));
      } else {
        k.cadera(lerpV([0, 0.93, 0], [0, 0.88, -0.28], p), [lerp(0, 72, p), 0, 0]);
        k.columna(0, 0, 0, lerp(0, -20, p));
      }
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.12, M.pie, 0.04], [s * 0.2, 0, 1], "plano");
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        k.brazo(l, hombro.add(lerpV([s * 0.02, -0.52, 0.07], [s * 0.02, -0.52, -0.1], p)), [s * 0.3, 0, -1]);
      }
      barraEnManos(k);
    },
    error: {
      clip: "peso-muerto-rumano-espalda",
      huesos: ["mixamorigSpine", "mixamorigSpine1", "mixamorigSpine2"],
      descripcion: "Espalda redondeada: la flexión sale de la columna, no de la cadera",
    },
    puntos: [
      punto("mixamorigHips", T.arriba, 2.4, 80, 10, "Lleva la cadera hacia atrás, rodillas apenas flexionadas"),
      punto("mixamorigSpine1", T.bajando, 2.4, 90, 15, "Espalda neutra durante todo el recorrido"),
      punto("mixamorigLeftHand", T.abajo, 2, 60, 10, "La barra baja pegada a las piernas; para al notar el estiramiento"),
      punto("mixamorigHips", T.subiendo, 2.4, 100, 10, "Sube empujando la cadera hacia delante"),
    ],
  },
  {
    id: "extension-rodilla",
    objetos: ["obj-asiento", "obj-rodillo"],
    vista: { objetivo: [0, 0.6, 0.2], distancia: 3, azimut: 70, elevacion: 15 },
    pose(k, p) {
      sentado(k, { y: 0.58, pitch: -10, columna: [-3, 0, 0, 10], tibia: lerpD([0, 0.06, 1], [0, -1, -0.28], p) });
      const a = k.punto("LeftLeg", [0, -0.37, 0.07]);
      const b = k.punto("RightLeg", [0, -0.37, 0.07]);
      k.objeto("obj-rodillo", a.add(b).multiplyScalar(0.5));
      for (const [l, s] of LADOS) k.brazoDir(l, [s * 0.3, -1, 0.05], [s * 0.05, -1, 0.3]);
      k.objeto("obj-asiento", [0, 0.48, -0.05], [-10, 0, 0]);
    },
    puntos: [
      punto("mixamorigLeftLeg", T.arriba, 1.8, 70, 15, "Arriba, pierna estirada sin bloquear de golpe"),
      punto("mixamorigLeftLeg", T.abajo, 1.8, 90, 10, "Baja hasta doblar bien la rodilla: esa parte es la que más cuenta"),
      punto("mixamorigHips", T.subiendo, 2, 100, 15, "Respaldo algo reclinado para estirar el recto femoral"),
    ],
  },
  {
    id: "sentadilla-sissy",
    objetos: ["obj-poste"],
    vista: { objetivo: [0, 0.7, 0.05], distancia: 3, azimut: 70, elevacion: 10 },
    pose(k, p) {
      k.cadera(lerpV([0, 0.95, 0], [0, 0.55, 0.02], p), [lerp(0, -30, p), 0, 0]);
      k.columna(lerp(0, -5, p), 0, 0, lerp(0, 15, p));
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.12, 0.12, 0.03], [s * 0.15, 0, 1], 40);
      k.brazo("Right", [-0.42, 1.0, 0.2], [-1, -1, 0]);
      k.brazoDir("Left", [0.1, -0.3, 1], [0.05, -0.2, 1]);
      k.objeto("obj-poste", [-0.47, 0, 0.2]);
    },
    puntos: [
      punto("mixamorigLeftFoot", T.arriba, 1.6, 60, 15, "De puntillas, agarrado a algo estable"),
      punto("mixamorigLeftLeg", T.bajando, 2, 80, 10, "Rodillas hacia delante y cadera estirada"),
      punto("mixamorigHips", T.abajo, 2.2, 90, 10, "El cuerpo forma una línea de rodillas a hombros"),
    ],
  },
  {
    id: "elevacion-talones-pausa",
    objetos: ["obj-escalon", "obj-almohadillas"],
    vista: { objetivo: [0, 0.7, 0.05], distancia: 3.2, azimut: 70, elevacion: 10 },
    pose(k, p) {
      talones(k, p);
      const almohadillas = k.punto("Spine2", [0, M.columna[2] + 0.07, 0]);
      k.objeto("obj-almohadillas", almohadillas);
      for (const [l, s] of LADOS) k.brazo(l, almohadillas.clone().add(v([s * 0.33, 0, 0.08])), [s * 0.3, -1, 0]);
    },
    puntos: [
      punto("mixamorigLeftFoot", T.arriba, 1.4, 80, 5, "Arriba del todo, sobre la punta del pie"),
      punto("mixamorigLeftFoot", T.abajo, 1.4, 90, 0, "Baja el talón al máximo y para dos segundos abajo"),
      punto("mixamorigLeftLeg", T.subiendo, 1.8, 60, 10, "Rodilla estirada para cargar el gemelo"),
    ],
  },
  {
    id: "elevacion-talones-escalon",
    objetos: ["obj-escalon", "obj-poste", "obj-mancuerna-der"],
    vista: { objetivo: [0, 0.7, 0.05], distancia: 3.2, azimut: 70, elevacion: 10 },
    pose(k, p) {
      talones(k, p);
      k.brazo("Left", [0.42, 1.1, 0.12], [1, -1, 0]);
      k.brazoDir("Right", [-0.1, -1, 0], [-0.05, -1, 0.05]);
      k.objeto("obj-mancuerna-der", k.mano("Right"), [0, 90, 0]);
      k.objeto("obj-poste", [0.48, 0, 0.12]);
    },
    puntos: [
      punto("mixamorigLeftFoot", T.arriba, 1.4, 80, 5, "Punta del pie en el borde del escalón"),
      punto("mixamorigLeftFoot", T.abajo, 1.4, 90, 0, "Baja el talón y pausa abajo"),
      punto("mixamorigLeftHand", T.subiendo, 2, 40, 10, "Agárrate solo para equilibrarte"),
    ],
  },
  {
    id: "extension-triceps-overhead",
    objetos: ["obj-polea", "obj-cable"],
    vista: { objetivo: [0, 1.1, -0.1], distancia: 3.4, azimut: 75, elevacion: 10 },
    pose(k, p) {
      k.cadera([0, 0.9, 0.02], [18, 0, 0]);
      k.columna(5, 4, 0, -10);
      k.pierna("Left", [0.12, M.pie, 0.28], [0.2, 0, 1], "plano");
      k.pierna("Right", [-0.12, M.pie, -0.22], [-0.2, 0, 1], "plano");
      for (const [l, s] of LADOS) {
        const brazo = [-s * 0.06, 0.85, 0.5];
        k.brazoDir(l, brazo, lerpD(brazo, [s * 0.02, -0.4, -0.9], p));
      }
      const manos = k.mano("Left").add(k.mano("Right")).multiplyScalar(0.5);
      k.cable(manos, [0, 1.45, -0.8]);
      k.objeto("obj-polea", [0, 0, -0.88]);
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2, 90, 10, "Brazos junto a la cabeza; los codos no se abren"),
      punto("mixamorigRightForeArm", T.bajando, 2, 100, 15, "Baja despacio doblando solo el codo"),
      punto("mixamorigRightForeArm", T.abajo, 2, 80, 10, "Abajo, nota el estiramiento detrás del brazo"),
      punto("mixamorigLeftFoot", T.subiendo, 2.4, 60, 15, "Un pie adelantado para estar estable"),
    ],
  },
  {
    id: "extension-triceps-overhead-mancuerna",
    objetos: ["obj-mancuerna-izq"],
    vista: { objetivo: [0, 1.15, 0], distancia: 3.2, azimut: 60, elevacion: 10 },
    pose(k, p) {
      dePie(k, { ancho: 0.13 });
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        const mano = lerpV([-s * 0.13, 0.52, 0.04], [-s * 0.13, 0.1, -0.22], p).add(hombro);
        k.brazo(l, mano, [s * 0.4, 1, 0.4]);
      }
      const m = k.mano("Left").add(k.mano("Right")).multiplyScalar(0.5);
      k.objeto("obj-mancuerna-izq", m, [0, 0, 90]);
    },
    puntos: [
      punto("mixamorigHead", T.arriba, 1.8, 40, 15, "Mancuerna arriba, agarrada con las dos manos"),
      punto("mixamorigRightForeArm", T.abajo, 1.8, 120, 15, "Bájala detrás de la cabeza, codos hacia el techo"),
      punto("mixamorigSpine1", T.subiendo, 2.2, 90, 10, "Abdomen firme, sin arquear la espalda"),
    ],
  },
  {
    id: "press-frances",
    objetos: ["obj-barra", "obj-banco"],
    vista: { objetivo: [0, 0.75, -0.25], distancia: 3, azimut: 70, elevacion: 20 },
    pose(k, p) {
      tumbadoBanco(k);
      for (const [l, s] of LADOS) {
        const brazo = [-s * 0.15, 0.95, -0.25];
        k.brazoDir(l, brazo, lerpD(brazo, [-s * 0.03, -0.15, -1], p));
      }
      barraEnManos(k);
    },
    puntos: [
      punto("mixamorigRightForeArm", T.arriba, 2, 90, 20, "Brazos casi verticales, algo inclinados hacia la cabeza"),
      punto("mixamorigRightForeArm", T.abajo, 1.8, 80, 15, "Baja la barra detrás de la frente, codos quietos"),
      punto("mixamorigRightArm", T.subiendo, 2, 30, 25, "Solo se mueve el antebrazo"),
    ],
  },
  {
    id: "pushdown-triceps",
    objetos: ["obj-polea", "obj-cable"],
    vista: { objetivo: [0, 1.05, 0.15], distancia: 3.3, azimut: 70, elevacion: 10 },
    pose(k, p) {
      dePie(k, { pitch: 8, columna: [5, 3, 0] });
      for (const [l, s] of LADOS) k.brazoDir(l, [s * 0.06, -1, -0.1], lerpD([s * 0.02, -1, 0.12], [-s * 0.05, 0.35, 1], p));
      const manos = k.mano("Left").add(k.mano("Right")).multiplyScalar(0.5);
      k.cable(manos, [0, 1.95, 0.45]);
      k.objeto("obj-polea", [0, 0, 0.53]);
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2, 80, 10, "Codos pegados al cuerpo"),
      punto("mixamorigRightForeArm", T.abajo, 2, 90, 10, "Sube hasta que el antebrazo pase la horizontal"),
      punto("mixamorigRightHand", T.subiendo, 1.8, 60, 5, "Extiende del todo abajo"),
    ],
  },
  {
    id: "curl-predicador",
    objetos: ["obj-predicador", "obj-mancuerna-izq", "obj-mancuerna-der"],
    vista: { objetivo: [0, 0.85, 0.15], distancia: 3, azimut: 65, elevacion: 15 },
    pose(k, p) {
      sentado(k, { y: 0.6, pitch: 15, columna: [5, 5, 0, -10] });
      for (const [l, s] of LADOS) {
        const brazo = [s * 0.05, -0.62, 0.78];
        k.brazoDir(l, brazo, lerpD([0, 0.85, 0.35], [s * 0.02, -0.8, 0.62], p));
      }
      mancuernasEnManos(k);
      const hombro = k.punto("LeftArm").add(k.punto("RightArm")).multiplyScalar(0.5);
      const codo = k.punto("LeftForeArm").add(k.punto("RightForeArm")).multiplyScalar(0.5);
      const dir = codo.clone().sub(hombro).normalize();
      const centro = hombro.lerp(codo, 0.6).add(v([0, -0.07, 0.03]));
      k.objeto("obj-predicador", centro, quatDesde(v([0, 0, 1]), dir));
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2, 50, 20, "Axila apoyada en el borde del banco"),
      punto("mixamorigRightForeArm", T.abajo, 1.8, 90, 10, "Baja hasta casi estirar el codo: ahí está el estímulo"),
      punto("mixamorigRightHand", T.subiendo, 1.8, 70, 15, "Sube sin despegar el brazo del apoyo"),
    ],
  },
  {
    id: "curl-inclinado",
    objetos: ["obj-banco-inclinado", "obj-mancuerna-izq", "obj-mancuerna-der"],
    vista: { objetivo: [0, 0.85, -0.05], distancia: 3.1, azimut: 70, elevacion: 12 },
    pose(k, p) {
      k.cadera([0, 0.6, 0.05], [-30, 0, 0]);
      k.columna(0, 0, 0, 20);
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.25, M.pie, 0.62], [s * 0.3, 1, 0.2], "plano");
      for (const [l, s] of LADOS) k.brazoDir(l, [s * 0.06, -1, -0.12], lerpD([0, 0.55, 0.85], [s * 0.02, -1, -0.04], p));
      mancuernasEnManos(k);
      k.objeto("obj-banco-inclinado", [0, 0.45, 0.05]);
      k.objeto("obj-respaldo", [0, 0, -0.17], [-30, 0, 0]);
    },
    puntos: [
      punto("mixamorigSpine1", T.arriba, 2.2, 90, 15, "Respaldo a unos 60°, espalda apoyada"),
      punto("mixamorigRightArm", T.abajo, 2, 100, 10, "Brazos colgando por detrás del cuerpo, sin adelantar los codos"),
      punto("mixamorigRightHand", T.subiendo, 1.8, 60, 15, "Sube sin balancear"),
    ],
  },
  {
    id: "curl-barra",
    objetos: ["obj-barra"],
    vista: { objetivo: [0, 0.95, 0], distancia: 3.2, azimut: 60, elevacion: 10 },
    pose(k, p, error) {
      if (error) {
        dePie(k, { pitch: lerp(-16, 10, p), columna: [lerp(-8, 6, p), lerp(-6, 4, p), 0] });
      } else dePie(k);
      for (const [l, s] of LADOS) {
        const brazo = error ? lerpD([s * 0.08, -1, 0.35], [s * 0.08, -1, 0.02], p) : [s * 0.08, -1, 0.03];
        k.brazoDir(l, brazo, lerpD([0, 0.8, 0.6], [s * 0.03, -1, 0.12], p));
      }
      barraEnManos(k);
    },
    error: {
      clip: "curl-barra-balanceo",
      huesos: ["mixamorigSpine", "mixamorigSpine1", "mixamorigLeftArm", "mixamorigRightArm"],
      descripcion: "Balancear el tronco y adelantar los codos para subir la barra",
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2, 70, 10, "Codos quietos junto al cuerpo"),
      punto("mixamorigRightForeArm", T.abajo, 1.8, 80, 10, "Baja del todo, hasta estirar el brazo"),
      punto("mixamorigSpine1", T.subiendo, 2.4, 90, 10, "El tronco no se mueve: nada de impulso"),
    ],
  },
  {
    id: "press-banca",
    objetos: ["obj-barra", "obj-banco"],
    vista: { objetivo: [0, 0.75, -0.25], distancia: 3, azimut: 55, elevacion: 22 },
    pose(k, p, error) {
      tumbadoBanco(k);
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        const abajo = error ? [s * 0.12, 0.1, 0.0] : [s * 0.12, 0.1, 0.12];
        const mano = lerpV([s * 0.1, 0.52, 0.04], abajo, p).add(hombro);
        k.brazo(l, mano, error ? [s * 1, -0.3, -0.1] : [s * 0.8, -0.6, 0.5]);
      }
      barraEnManos(k);
    },
    error: {
      clip: "press-banca-codos",
      huesos: ["mixamorigLeftArm", "mixamorigRightArm"],
      descripcion: "Codos abiertos a 90° y la barra hacia el cuello: castiga el hombro",
    },
    puntos: [
      punto("mixamorigSpine2", T.arriba, 2, 70, 25, "Omóplatos juntos y pies firmes en el suelo"),
      punto("mixamorigRightForeArm", T.bajando, 2, 0, 25, "Antebrazos verticales, codos a unos 45° del cuerpo"),
      punto("mixamorigSpine2", T.abajo, 1.8, 80, 20, "Toca el pecho a la altura del esternón"),
      punto("mixamorigRightHand", T.subiendo, 2, 40, 30, "Empuja la barra hacia arriba y un poco hacia la cabeza"),
    ],
  },
  {
    id: "flexiones",
    objetos: [],
    vista: { objetivo: [0, 0.35, -0.15], distancia: 3, azimut: 75, elevacion: 15 },
    pose(k, p) {
      const alfa = THREE.MathUtils.degToRad(lerp(17, 5, p));
      const za = -0.92;
      k.cadera([0, 0.1 + 0.91 * Math.sin(alfa), za + 0.91 * Math.cos(alfa)], [90 - THREE.MathUtils.radToDeg(alfa), 0, 0]);
      k.columna(0, 0, 0, -20);
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.1, 0.1, za], [0, -1, 0]);
      const alfa0 = THREE.MathUtils.degToRad(17);
      const zHombro = za + 0.91 * Math.cos(alfa0) + 0.43 * Math.cos(alfa0);
      for (const [l, s] of LADOS) k.brazo(l, [s * 0.27, 0.03, zHombro + 0.02], [s * 1, 0.4, -0.5]);
    },
    puntos: [
      punto("mixamorigHips", T.arriba, 2.2, 90, 15, "Cuerpo en bloque: la cadera no cae"),
      punto("mixamorigRightHand", T.bajando, 1.6, 40, 15, "Manos algo más abiertas que los hombros"),
      punto("mixamorigSpine2", T.abajo, 2, 80, 10, "Baja hasta casi tocar el suelo con el pecho"),
      punto("mixamorigRightForeArm", T.subiendo, 1.8, 20, 25, "Codos a unos 45°, no abiertos en cruz"),
    ],
  },
  {
    id: "press-inclinado-mancuerna",
    objetos: ["obj-banco-inclinado", "obj-mancuerna-izq", "obj-mancuerna-der"],
    vista: { objetivo: [0, 0.85, -0.1], distancia: 3.1, azimut: 60, elevacion: 15 },
    pose(k, p) {
      k.cadera([0, 0.58, 0.05], [-60, 0, 0]);
      k.columna(-3, -3, 0, 25);
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.3, M.pie, 0.62], [s * 0.3, 1, 0.2], "plano");
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        k.brazo(l, lerpV([-s * 0.04, 0.5, 0.12], [s * 0.15, 0.05, 0.06], p).add(hombro), [s * 1, -0.8, 0.3]);
      }
      mancuernasEnManos(k);
      k.objeto("obj-banco-inclinado", [0, 0.45, 0.05]);
      k.objeto("obj-respaldo", [0, 0, -0.17], [-60, 0, 0]);
    },
    puntos: [
      punto("mixamorigSpine2", T.arriba, 2, 70, 20, "Banco a unos 30°, omóplatos juntos"),
      punto("mixamorigRightHand", T.abajo, 1.8, 40, 20, "Baja las mancuernas hasta notar el estiramiento del pecho"),
      punto("mixamorigRightForeArm", T.subiendo, 2, 0, 25, "Sube juntándolas por encima del pecho"),
    ],
  },
  {
    id: "aperturas-mancuerna",
    objetos: ["obj-banco", "obj-mancuerna-izq", "obj-mancuerna-der"],
    vista: { objetivo: [0, 0.75, -0.25], distancia: 3.1, azimut: 40, elevacion: 30 },
    pose(k, p) {
      tumbadoBanco(k);
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        k.brazo(l, lerpV([-s * 0.06, 0.5, 0.05], [s * 0.49, -0.06, 0.06], p).add(hombro), lerpV([s * 1, 0.2, 0.2], [0, -1, 0.2], p));
      }
      mancuernasEnManos(k, [0, 90, 0]);
    },
    puntos: [
      punto("mixamorigRightForeArm", T.arriba, 2, 30, 30, "Codos algo doblados y fijos"),
      punto("mixamorigSpine2", T.abajo, 2, 0, 35, "Abre hasta notar el estiramiento del pecho"),
      punto("mixamorigRightHand", T.subiendo, 2, 60, 25, "Cierra como si abrazaras un árbol"),
    ],
  },
  {
    id: "jalon-pecho",
    objetos: ["obj-asiento", "obj-polea", "obj-cable", "obj-barra-corta"],
    vista: { objetivo: [0, 1.1, 0.05], distancia: 3.5, azimut: 50, elevacion: 10 },
    pose(k, p) {
      sentado(k, { y: 0.55, pitch: -8, columna: [-5, -5, 0, 10], tibia: [0, -1, 0.1] });
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        const mano = lerpV([s * 0.2, 0.05, 0.12], [s * 0.2, 0.5, 0.08], p).add(hombro);
        k.brazo(l, mano, lerpV([s * 0.6, -1, -0.4], [s * 1, 0, -0.2], p));
      }
      const barra = k.mano("Left").add(k.mano("Right")).multiplyScalar(0.5);
      k.objeto("obj-barra-corta", barra);
      k.cable(barra, [0, 2.2, 0.12]);
      k.objeto("obj-polea", [0, 0, -0.35]);
      k.objeto("obj-asiento", [0, 0.45, -0.02]);
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2.2, 30, 10, "Tira con los codos hacia los costados, pecho alto"),
      punto("mixamorigRightHand", T.abajo, 2.4, 40, 15, "Arriba, brazos estirados y hombros que suben"),
      punto("mixamorigSpine1", T.subiendo, 2.2, 90, 10, "Tronco algo inclinado atrás, sin balancearte"),
    ],
  },
  {
    id: "dominadas",
    objetos: ["obj-barra-fija"],
    vista: { objetivo: [0, 1.5, 0], distancia: 3.8, azimut: 40, elevacion: 5 },
    pose(k, p) {
      const yHombro = lerp(2.2 - 0.13, 2.2 - 0.53, p);
      k.cadera([0, yHombro - 0.43, -0.04], [0, 0, 0]);
      k.columna(-4, -4, 0, lerp(-15, 0, p));
      for (const [l, s] of LADOS) k.piernaDir(l, [s * 0.05, -1, 0.15], [-s * 0.05, -1, -0.5]);
      for (const [l, s] of LADOS) k.brazo(l, [s * 0.36, 2.2, 0], [s * 1, -0.6, 0.1]);
      k.objeto("obj-barra-fija", [0, 2.2, 0]);
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2.2, 30, 5, "Sube hasta que la barbilla pase la barra"),
      punto("mixamorigRightForeArm", T.abajo, 2.4, 20, 0, "Empieza colgado con los brazos estirados"),
      punto("mixamorigSpine1", T.subiendo, 2.4, 100, 5, "Pecho hacia la barra, sin balancearte"),
    ],
  },
  {
    id: "remo-polea",
    objetos: ["obj-banco", "obj-polea", "obj-cable"],
    vista: { objetivo: [0, 0.55, 0.35], distancia: 3.2, azimut: 75, elevacion: 15 },
    pose(k, p) {
      k.cadera([0, 0.4, 0], [lerp(-5, 22, p), 0, 0]);
      k.columna(lerp(0, 8, p), lerp(0, 8, p), lerp(0, 6, p), lerp(0, -15, p));
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.15, 0.22, 0.74], [s * 0.3, 1, 0], -60);
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        const mano = lerpV([s * 0.12, 0.6, 0.28], hombro.add(v([-s * 0.07, -0.1, 0.5])), p);
        k.brazo(l, mano, lerpV([s * 0.3, -0.2, -1], [s * 0.2, -1, 0], p));
      }
      const manos = k.mano("Left").add(k.mano("Right")).multiplyScalar(0.5);
      k.cable(manos, [0, 0.3, 1.02]);
      k.objeto("obj-polea", [0, 0, 1.1]);
      k.objeto("obj-banco", [0, 0.32, 0.15]);
    },
    puntos: [
      punto("mixamorigSpine1", T.arriba, 2.2, 90, 10, "Tronco quieto y recto al terminar"),
      punto("mixamorigRightArm", T.bajando, 2.2, 60, 20, "Tira con los codos pegados, hacia atrás"),
      punto("mixamorigSpine2", T.abajo, 2.2, 80, 15, "Deja que los hombros se adelanten al estirar"),
    ],
  },
  {
    id: "remo-barra",
    objetos: ["obj-barra"],
    vista: { objetivo: [0, 0.75, 0.05], distancia: 3.2, azimut: 70, elevacion: 10 },
    pose(k, p) {
      k.cadera([0, 0.85, -0.14], [50, 0, 0]);
      k.columna(0, 0, 0, -25);
      for (const [l, s] of LADOS) k.pierna(l, [s * 0.13, M.pie, 0.04], [s * 0.2, 0, 1], "plano");
      for (const [l, s] of LADOS) {
        const arriba = k.punto("Hips", [s * 0.22, 0.14, 0.2]);
        const abajo = k.punto(`${l}Arm`).add(v([s * 0.04, -0.52, 0.04]));
        k.brazo(l, lerpV(arriba, abajo, p), lerpV([s * 0.3, 1, -0.6], [s * 0.3, 0, -1], p));
      }
      barraEnManos(k);
    },
    puntos: [
      punto("mixamorigSpine1", T.arriba, 2.4, 90, 10, "Espalda neutra e inclinada unos 45°"),
      punto("mixamorigRightHand", T.bajando, 2, 70, 10, "La barra va al ombligo"),
      punto("mixamorigRightArm", T.abajo, 2.2, 60, 20, "Abajo, brazos estirados sin perder la postura"),
    ],
  },
  {
    id: "elevacion-lateral-polea",
    objetos: ["obj-polea", "obj-cable"],
    vista: { objetivo: [0, 1.05, 0], distancia: 3.3, azimut: 15, elevacion: 10 },
    pose(k, p) {
      dePie(k, { ancho: 0.13 });
      k.brazo("Left", [0.45, 1.02, 0.1], [1, -1, 0]);
      k.brazoDir("Right", lerpD([-1, -0.06, 0.12], [0.22, -1, 0.2], p), lerpD([-1, 0.02, 0.15], [0.28, -1, 0.25], p));
      k.cable(k.mano("Right"), [0.46, 0.15, 0.1]);
      k.objeto("obj-polea", [0.56, 0, 0.1]);
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2, 10, 10, "Sube hasta la altura del hombro, no más"),
      punto("mixamorigRightHand", T.abajo, 2, 20, 5, "Abajo, la mano cruza por delante: ahí el deltoides está estirado"),
      punto("mixamorigLeftHand", T.subiendo, 2.2, -30, 10, "Agárrate a la polea y no inclines el tronco"),
    ],
  },
  {
    id: "elevacion-lateral-mancuerna",
    objetos: ["obj-mancuerna-izq", "obj-mancuerna-der"],
    vista: { objetivo: [0, 1.05, 0], distancia: 3.3, azimut: 20, elevacion: 10 },
    pose(k, p) {
      dePie(k, { ancho: 0.13, columna: [3, 0, 0] });
      for (const [l, s] of LADOS)
        k.brazoDir(l, lerpD([s * 1, -0.08, 0.18], [s * 0.15, -1, 0.1], p), lerpD([s * 1, 0, 0.22], [s * 0.1, -1, 0.15], p));
      mancuernasEnManos(k, [0, 90, 0]);
    },
    puntos: [
      punto("mixamorigRightArm", T.arriba, 2, 10, 10, "Sube con el codo por delante de la mano"),
      punto("mixamorigRightHand", T.abajo, 2, 30, 5, "Baja controlando, sin dejarla caer"),
      punto("mixamorigSpine1", T.subiendo, 2.4, 90, 10, "Sin impulso: el tronco no se mueve"),
    ],
  },
  {
    id: "press-militar",
    objetos: ["obj-barra"],
    vista: { objetivo: [0, 1.2, 0], distancia: 3.4, azimut: 50, elevacion: 8 },
    pose(k, p) {
      dePie(k, { ancho: 0.14 });
      k.columna(0, 0, 0, lerp(0, -12, p));
      for (const [l, s] of LADOS) {
        const hombro = k.punto(`${l}Arm`);
        k.brazo(l, lerpV([s * 0.05, 0.52, -0.02], [s * 0.07, 0.03, 0.17], p).add(hombro), [s * 0.4, -1, 0.5]);
      }
      barraEnManos(k);
    },
    puntos: [
      punto("mixamorigSpine1", T.arriba, 2.4, 90, 10, "Glúteos apretados, sin arquear la zona lumbar"),
      punto("mixamorigRightForeArm", T.abajo, 2, 30, 10, "Abajo, la barra sobre la clavícula y antebrazos verticales"),
      punto("mixamorigHead", T.subiendo, 2, 70, 15, "Aparta la cabeza y sube la barra en línea recta"),
    ],
  },
];

/** Elevación de talones: el pie pivota sobre la punta apoyada en el borde del escalón. */
function talones(k, p) {
  const pitch = lerp(35, -22, p);
  const q = euler(pitch, 0, 0);
  const tobillos = {};
  for (const [l, s] of LADOS) {
    const punta = v([s * 0.12, 0.14, 0.12]);
    tobillos[l] = punta.sub(v([0, -0.06, 0.14]).applyQuaternion(q));
  }
  const subida = tobillos.Left.y - M.pie;
  k.cadera([0, 0.93 + subida, tobillos.Left.z - 0.02], [0, 0, 0]);
  k.columna(0, 0, 0);
  for (const [l, s] of LADOS) k.pierna(l, tobillos[l], [s * 0.2, 0, 1], pitch);
  k.objeto("obj-escalon", [0, 0, -0.02]);
}
