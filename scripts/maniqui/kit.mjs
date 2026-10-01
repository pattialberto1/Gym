// Kit de poses: coloca el maniquí con posiciones y direcciones en el mundo
// (cinemática inversa de dos segmentos para brazos y piernas) y registra los objetos.
import * as THREE from "three";

export const M = {
  pie: 0.08, // altura del tobillo
  tibia: 0.43,
  femur: 0.45,
  caderaAncho: 0.095,
  columna: [0.12, 0.14, 0.14], // Spine, Spine1, Spine2
  cuello: 0.1,
  hombroAncho: 0.18,
  brazo: 0.29,
  antebrazo: 0.26,
};
export const ALTURA_CADERA = M.pie + M.tibia + M.femur;
export const N = (n) => `mixamorig${n}`;
export const ABAJO = new THREE.Vector3(0, -1, 0);
export const ARRIBA = new THREE.Vector3(0, 1, 0);
export const rad = THREE.MathUtils.degToRad;
export const v = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(...a));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpV = (a, b, t) => v(a).lerp(v(b), t);
/** Interpola direcciones (normalizadas). */
export const lerpD = (a, b, t) => v(a).normalize().lerp(v(b).normalize(), t).normalize();

export const LADOS = [
  ["Left", 1],
  ["Right", -1],
];

/** Rodilla/codo por IK de dos segmentos, doblando hacia `polo`. */
export function articulacionIK(raiz, fin, l1, l2, polo) {
  const d = fin.clone().sub(raiz);
  const dist = Math.max(0.02, Math.min(d.length(), (l1 + l2) * 0.9995));
  const u = d.normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let w = polo.clone().sub(u.clone().multiplyScalar(polo.dot(u)));
  if (w.lengthSq() < 1e-8) w = new THREE.Vector3(0, 0, 1);
  w.normalize();
  return raiz.clone().add(u.multiplyScalar(a)).add(w.multiplyScalar(h));
}

export function quatDesde(reposo, dir) {
  return new THREE.Quaternion().setFromUnitVectors(reposo, v(dir).normalize());
}

export function euler(pitch = 0, yaw = 0, roll = 0) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(pitch), rad(yaw), rad(roll), "YXZ"));
}

export class Kit {
  constructor(huesos, raiz) {
    this.huesos = huesos;
    this.raiz = raiz;
    this.reset();
  }

  reset() {
    for (const h of Object.values(this.huesos)) h.quaternion.identity();
    this.raiz.position.set(0, ALTURA_CADERA, 0);
    this.yaw = 0;
    this.objetos = {};
    this.actualizar();
  }

  actualizar() {
    this.raiz.updateMatrixWorld(true);
  }

  /** Posición de la pelvis y su orientación (grados: inclinación, giro, alabeo). */
  cadera(pos, [pitch = 0, yaw = 0, roll = 0] = []) {
    this.raiz.position.copy(v(pos));
    this.raiz.quaternion.copy(euler(pitch, yaw, roll));
    this.yaw = yaw;
    this.actualizar();
  }

  /** Flexión local de la columna (positivo = hacia delante). */
  columna(a = 0, b = 0, c = 0, cuello = 0, cabeza = 0) {
    const ejeX = new THREE.Vector3(1, 0, 0);
    [
      ["Spine", a],
      ["Spine1", b],
      ["Spine2", c],
      ["Neck", cuello],
      ["Head", cabeza],
    ].forEach(([h, g]) => this.huesos[h].quaternion.setFromAxisAngle(ejeX, rad(g)));
    this.actualizar();
  }

  punto(hueso, local = [0, 0, 0]) {
    this.actualizar();
    return this.huesos[hueso].localToWorld(v(local));
  }

  fijarMundo(hueso, q) {
    const h = this.huesos[hueso];
    const qPadre = h.parent.getWorldQuaternion(new THREE.Quaternion());
    h.quaternion.copy(qPadre.invert().multiply(q));
    h.updateMatrixWorld(true);
  }

  piernaDir(lado, dMuslo, dTibia, pie) {
    this.fijarMundo(`${lado}UpLeg`, quatDesde(ABAJO, dMuslo));
    this.fijarMundo(`${lado}Leg`, quatDesde(ABAJO, dTibia));
    this.pie(lado, pie);
  }

  pierna(lado, tobillo, polo, pie) {
    const cadera = this.punto(`${lado}UpLeg`);
    const rodilla = articulacionIK(cadera, v(tobillo), M.femur, M.tibia, v(polo));
    this.piernaDir(lado, rodilla.clone().sub(cadera), v(tobillo).sub(rodilla), pie);
  }

  /**
   * pie: "plano" (apoyado en el suelo), número (inclinación en grados en el mundo:
   * positivo = talón arriba) o undefined (perpendicular a la tibia).
   */
  pie(lado, pie) {
    const s = lado === "Left" ? 1 : -1;
    if (pie === "plano") this.fijarMundo(`${lado}Foot`, euler(0, this.yaw + s * 12));
    else if (typeof pie === "number") this.fijarMundo(`${lado}Foot`, euler(pie, this.yaw + s * 8));
    else {
      this.huesos[`${lado}Foot`].quaternion.identity();
      this.actualizar();
    }
  }

  brazoDir(lado, dBrazo, dAntebrazo) {
    this.fijarMundo(`${lado}Arm`, quatDesde(ABAJO, dBrazo));
    this.fijarMundo(`${lado}ForeArm`, quatDesde(ABAJO, dAntebrazo));
    this.huesos[`${lado}Hand`].quaternion.identity();
    this.actualizar();
  }

  brazo(lado, mano, polo) {
    const hombro = this.punto(`${lado}Arm`);
    const codo = articulacionIK(hombro, v(mano), M.brazo, M.antebrazo, v(polo));
    this.brazoDir(lado, codo.clone().sub(hombro), v(mano).sub(codo));
  }

  /** Posición real de la mano (centro de la palma). */
  mano(lado) {
    return this.punto(`${lado}Hand`, [0, -0.03, 0]);
  }

  tobillo(lado) {
    return this.punto(`${lado}Foot`);
  }

  objeto(nombre, pos, rot = [0, 0, 0], escala = [1, 1, 1]) {
    const q = rot instanceof THREE.Quaternion ? rot.clone() : euler(...rot);
    this.objetos[nombre] = { pos: v(pos), q, escala: v(escala) };
  }

  /** Cable de polea: cilindro de longitud 1 escalado entre dos puntos. */
  cable(desde, hasta) {
    const a = v(desde);
    const b = v(hasta);
    const dir = b.clone().sub(a);
    this.objeto("obj-cable", a.clone().add(b).multiplyScalar(0.5), quatDesde(ARRIBA, dir), [1, dir.length(), 1]);
  }

  capturar() {
    this.actualizar();
    const locales = {};
    for (const [n, h] of Object.entries(this.huesos)) locales[n] = h.quaternion.clone();
    return { cadera: this.raiz.position.clone(), locales, objetos: { ...this.objetos } };
  }
}
