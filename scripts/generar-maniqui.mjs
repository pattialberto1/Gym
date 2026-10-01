// Genera public/modelos/maniqui.glb: un maniquí neutro con esqueleto de nombres tipo Mixamo
// (mixamorigHips, mixamorigLeftLeg…) y los clips "sentadilla" y "sentadilla-valgo".
// Los segmentos son mallas rígidas colgadas de cada hueso, así que cualquier animación
// sobre el mismo esqueleto (también una de Mixamo con esos nombres) sirve sin cambios.
//
// Uso: npm run modelo
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFileSync, mkdirSync } from "node:fs";

// GLTFExporter usa FileReader para empaquetar el binario; Node no lo trae.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

// ---------------------------------------------------------------------------
// Medidas (metros). El personaje mira hacia +Z, su izquierda es +X.
const M = {
  pie: 0.08, // altura del tobillo
  tibia: 0.43,
  femur: 0.45,
  caderaAncho: 0.095,
  pieAncho: 0.15, // separación de los pies respecto al centro
  columna: [0.12, 0.14, 0.14], // Spine, Spine1, Spine2
  cuello: 0.1,
  hombroAncho: 0.18,
  brazo: 0.29,
  antebrazo: 0.26,
};
const ALTURA_CADERA = M.pie + M.tibia + M.femur;
// Posición de la barra en el espacio de Spine2 (sobre los trapecios, algo por detrás).
const BARRA = { y: M.columna[2] - 0.0, z: -0.12 };

const N = (n) => `mixamorig${n}`;
const ABAJO = new THREE.Vector3(0, -1, 0);
const ARRIBA = new THREE.Vector3(0, 1, 0);

const huesos = {};
function hueso(nombre, padre, x, y, z) {
  const h = new THREE.Bone();
  h.name = N(nombre);
  h.position.set(x, y, z);
  (padre ? huesos[padre] : null)?.add(h);
  huesos[nombre] = h;
  return h;
}

const raiz = hueso("Hips", null, 0, ALTURA_CADERA, 0);
hueso("Spine", "Hips", 0, 0.06, 0);
hueso("Spine1", "Spine", 0, M.columna[0], 0);
hueso("Spine2", "Spine1", 0, M.columna[1], 0);
hueso("Neck", "Spine2", 0, M.columna[2], 0);
hueso("Head", "Neck", 0, M.cuello, 0);
for (const [lado, s] of [["Left", 1], ["Right", -1]]) {
  hueso(`${lado}UpLeg`, "Hips", s * M.caderaAncho, -0.05, 0);
  hueso(`${lado}Leg`, `${lado}UpLeg`, 0, -M.femur, 0);
  hueso(`${lado}Foot`, `${lado}Leg`, 0, -M.tibia, 0);
  hueso(`${lado}Shoulder`, "Spine2", s * 0.05, M.columna[2] - 0.03, 0);
  hueso(`${lado}Arm`, `${lado}Shoulder`, s * (M.hombroAncho - 0.05), 0, 0);
  hueso(`${lado}ForeArm`, `${lado}Arm`, 0, -M.brazo, 0);
  hueso(`${lado}Hand`, `${lado}ForeArm`, 0, -M.antebrazo, 0);
}

// ---------------------------------------------------------------------------
// Mallas: cápsulas en el espacio local de cada hueso (en reposo los miembros apuntan abajo).
const material = new THREE.MeshStandardMaterial({ color: 0xc9ccd3, roughness: 0.55, metalness: 0.05 });
const materialArticulacion = new THREE.MeshStandardMaterial({ color: 0x9aa0ab, roughness: 0.6 });

function capsula(nombreHueso, radio, largo, dir = -1, nombre) {
  const g = new THREE.CapsuleGeometry(radio, Math.max(0.001, largo - 2 * radio), 6, 16);
  const m = new THREE.Mesh(g, material);
  m.position.y = (dir * largo) / 2;
  m.name = nombre ?? `${nombreHueso}-malla`;
  huesos[nombreHueso].add(m);
  return m;
}
function esfera(nombreHueso, radio, y = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radio, 16, 12), materialArticulacion);
  m.position.y = y;
  m.name = `${nombreHueso}-articulacion`;
  huesos[nombreHueso].add(m);
}

// Pelvis y tronco
{
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.12, 6, 16), material);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.position.y = 0.0;
  pelvis.scale.set(1, 1, 0.8);
  pelvis.name = "pelvis";
  huesos.Hips.add(pelvis);
}
capsula("Spine", 0.105, M.columna[0] + 0.04, 1).scale.set(1.15, 1, 0.75);
capsula("Spine1", 0.115, M.columna[1] + 0.02, 1).scale.set(1.25, 1, 0.8);
capsula("Spine2", 0.125, M.columna[2] + 0.02, 1).scale.set(1.35, 1, 0.8);
capsula("Neck", 0.045, M.cuello, 1);
{
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), material);
  cabeza.scale.set(0.9, 1.1, 1);
  cabeza.position.y = 0.1;
  cabeza.name = "cabeza";
  huesos.Head.add(cabeza);
  // Nariz discreta para saber hacia dónde mira la figura.
  const nariz = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 8), materialArticulacion);
  nariz.rotation.x = Math.PI / 2;
  nariz.position.set(0, 0.09, 0.1);
  nariz.name = "nariz";
  huesos.Head.add(nariz);
}
for (const lado of ["Left", "Right"]) {
  capsula(`${lado}UpLeg`, 0.075, M.femur);
  esfera(`${lado}Leg`, 0.06);
  capsula(`${lado}Leg`, 0.058, M.tibia);
  esfera(`${lado}Foot`, 0.045);
  const pie = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.24), material);
  pie.position.set(0, -M.pie + 0.03, 0.06);
  pie.name = `${lado}Foot-malla`;
  huesos[`${lado}Foot`].add(pie);
  esfera(`${lado}Arm`, 0.055);
  capsula(`${lado}Arm`, 0.05, M.brazo);
  esfera(`${lado}ForeArm`, 0.043);
  capsula(`${lado}ForeArm`, 0.042, M.antebrazo);
  const mano = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), material);
  mano.scale.set(0.8, 1.2, 0.6);
  mano.position.y = -0.015;
  mano.name = `${lado}Hand-malla`;
  huesos[`${lado}Hand`].add(mano);
}

// ---------------------------------------------------------------------------
// Cinemática de la sentadilla

const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);
const rad = THREE.MathUtils.degToRad;

/** Profundidad 0..1 a lo largo del bucle de 4 s: de pie, baja, pausa, sube, de pie. */
const DURACION = 4;
function profundidad(t) {
  if (t < 0.5) return 0;
  if (t < 2.0) return suave((t - 0.5) / 1.5);
  if (t < 2.4) return 1;
  if (t < 3.5) return 1 - suave((t - 2.4) / 1.1);
  return 0;
}

/** Rodilla por IK de dos segmentos, doblando hacia `polo`. */
function rodillaIK(cadera, tobillo, l1, l2, polo) {
  const d = tobillo.clone().sub(cadera);
  const dist = Math.min(d.length(), (l1 + l2) * 0.9995);
  const u = d.normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const v = polo.clone().sub(u.clone().multiplyScalar(polo.dot(u))).normalize();
  return cadera.clone().add(u.multiplyScalar(a)).add(v.multiplyScalar(h));
}

function quatDesde(reposo, dir) {
  return new THREE.Quaternion().setFromUnitVectors(reposo, dir.clone().normalize());
}

/** Calcula las rotaciones locales de todos los huesos para una profundidad dada. */
function pose(p, valgo) {
  // Ángulos sagitales de referencia para encontrar una trayectoria de cadera viable.
  const tibiaAng = rad(lerp(3, 38, p));
  const femurAng = rad(lerp(4, 112, p));
  const troncoAng = rad(lerp(4, 42, p));

  const zCadera = M.tibia * Math.sin(tibiaAng) - M.femur * Math.sin(femurAng);
  const yCadera = M.pie + M.tibia * Math.cos(tibiaAng) + M.femur * Math.cos(femurAng);
  const posCadera = new THREE.Vector3(0, yCadera, zCadera + 0.02);

  const qHips = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), troncoAng * 0.35);
  const local = {};
  local.Hips = qHips;
  local.Spine = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), troncoAng * 0.35);
  local.Spine1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), troncoAng * 0.3);
  local.Spine2 = new THREE.Quaternion();
  local.Neck = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -troncoAng * 0.6);
  local.Head = new THREE.Quaternion();

  // Mundo de la pelvis
  const hipsMundo = qHips.clone();

  for (const [lado, s] of [["Left", 1], ["Right", -1]]) {
    const caderaLocal = huesos[`${lado}UpLeg`].position.clone();
    const cadera = caderaLocal.applyQuaternion(hipsMundo).add(posCadera);
    const tobillo = new THREE.Vector3(s * M.pieAncho, M.pie, 0);
    // Rodilla hacia delante y algo hacia fuera (sigue la punta del pie); con valgo, hacia dentro.
    const fuera = valgo ? -lerp(0.0, 0.8, p) : 0.35;
    const polo = new THREE.Vector3(s * fuera, 0, 1).normalize();
    const rodilla = rodillaIK(cadera, tobillo, M.femur, M.tibia, polo);

    const qMuslo = quatDesde(ABAJO, rodilla.clone().sub(cadera));
    const qTibia = quatDesde(ABAJO, tobillo.clone().sub(rodilla));
    local[`${lado}UpLeg`] = hipsMundo.clone().invert().multiply(qMuslo);
    local[`${lado}Leg`] = qMuslo.clone().invert().multiply(qTibia);
    // Pie plano y con la punta un poco hacia fuera.
    const qPie = new THREE.Quaternion().setFromAxisAngle(ARRIBA, s * rad(12));
    local[`${lado}Foot`] = qTibia.clone().invert().multiply(qPie);

    // Brazos sujetando la barra sobre la espalda alta: IK en el espacio del tronco (Spine2),
    // con las manos en la barra y los codos hacia abajo y atrás.
    const hombro = new THREE.Vector3(s * M.hombroAncho, M.columna[2] - 0.03, 0);
    const mano = new THREE.Vector3(s * 0.4, BARRA.y, BARRA.z + 0.02);
    const codo = rodillaIK(hombro, mano, M.brazo, M.antebrazo, new THREE.Vector3(s * 0.2, -1, -0.5));
    const qBrazo = quatDesde(ABAJO, codo.clone().sub(hombro));
    const qAntebrazo = quatDesde(ABAJO, mano.clone().sub(codo));
    local[`${lado}Shoulder`] = new THREE.Quaternion();
    local[`${lado}Arm`] = qBrazo;
    local[`${lado}ForeArm`] = qBrazo.clone().invert().multiply(qAntebrazo);
    local[`${lado}Hand`] = new THREE.Quaternion();
  }
  return { posCadera, local };
}

function crearClip(nombre, valgo) {
  const fps = 30;
  const n = DURACION * fps + 1;
  const tiempos = Array.from({ length: n }, (_, i) => i / fps);
  const pistasQ = {};
  const posiciones = [];
  for (const t of tiempos) {
    const { posCadera, local } = pose(profundidad(t), valgo);
    posiciones.push(posCadera.x, posCadera.y, posCadera.z);
    for (const [h, q] of Object.entries(local)) (pistasQ[h] ??= []).push(q.x, q.y, q.z, q.w);
  }
  const pistas = [new THREE.VectorKeyframeTrack(`${N("Hips")}.position`, tiempos, posiciones)];
  for (const [h, valores] of Object.entries(pistasQ)) {
    pistas.push(new THREE.QuaternionKeyframeTrack(`${N(h)}.quaternion`, tiempos, valores));
  }
  return new THREE.AnimationClip(nombre, DURACION, pistas);
}

// Barra con discos para dar contexto (cuelga de Spine2, a la altura de los trapecios).
{
  const barra = new THREE.Group();
  barra.name = "barra";
  const metal = new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.35, metalness: 0.8 });
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.9, 12), metal);
  eje.rotation.z = Math.PI / 2;
  barra.add(eje);
  for (const s of [1, -1]) {
    const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 32), metal);
    disco.rotation.z = Math.PI / 2;
    disco.position.x = s * 0.72;
    barra.add(disco);
  }
  barra.position.set(0, BARRA.y, BARRA.z);
  huesos.Spine2.add(barra);
}

const escena = new THREE.Scene();
escena.name = "maniqui";
escena.add(raiz);
// Pose inicial = primer fotograma del clip correcto.
{
  const { posCadera, local } = pose(0, false);
  raiz.position.copy(posCadera);
  for (const [h, q] of Object.entries(local)) huesos[h].quaternion.copy(q);
}

const clips = [crearClip("sentadilla", false), crearClip("sentadilla-valgo", true)];

const exportador = new GLTFExporter();
const glb = await exportador.parseAsync(escena, { binary: true, animations: clips });
mkdirSync("public/modelos", { recursive: true });
writeFileSync("public/modelos/maniqui.glb", Buffer.from(glb));
console.log(`maniqui.glb: ${(glb.byteLength / 1024).toFixed(1)} KB, clips: ${clips.map((c) => c.name).join(", ")}`);
