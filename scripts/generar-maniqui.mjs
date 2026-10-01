// Genera public/modelos/maniqui.glb: maniquí neutro con esqueleto de nombres tipo Mixamo
// (mixamorigHips, mixamorigLeftLeg…), los objetos del gimnasio y un clip por ejercicio
// (más los clips de error común). También actualiza la ficha técnica de cada ejercicio
// en src/datos/ejercicios.json (modelo, clips, objetos, vista y puntos clave).
//
// Uso: npm run modelo
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ALTURA_CADERA, Kit, LADOS, M, N } from "./maniqui/kit.mjs";
import { EJERCICIOS } from "./maniqui/ejercicios.mjs";

// GLTFExporter usa FileReader para empaquetar el binario; Node no lo trae.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
};

// ---------------------------------------------------------------------------
// Esqueleto

const huesos = {};
function hueso(nombre, padre, x, y, z) {
  const h = new THREE.Bone();
  h.name = N(nombre);
  h.position.set(x, y, z);
  if (padre) huesos[padre].add(h);
  huesos[nombre] = h;
  return h;
}

const raiz = hueso("Hips", null, 0, ALTURA_CADERA, 0);
hueso("Spine", "Hips", 0, 0.06, 0);
hueso("Spine1", "Spine", 0, M.columna[0], 0);
hueso("Spine2", "Spine1", 0, M.columna[1], 0);
hueso("Neck", "Spine2", 0, M.columna[2], 0);
hueso("Head", "Neck", 0, M.cuello, 0);
for (const [lado, s] of LADOS) {
  hueso(`${lado}UpLeg`, "Hips", s * M.caderaAncho, -0.05, 0);
  hueso(`${lado}Leg`, `${lado}UpLeg`, 0, -M.femur, 0);
  hueso(`${lado}Foot`, `${lado}Leg`, 0, -M.tibia, 0);
  hueso(`${lado}Shoulder`, "Spine2", s * 0.05, M.columna[2] - 0.03, 0);
  hueso(`${lado}Arm`, `${lado}Shoulder`, s * (M.hombroAncho - 0.05), 0, 0);
  hueso(`${lado}ForeArm`, `${lado}Arm`, 0, -M.brazo, 0);
  hueso(`${lado}Hand`, `${lado}ForeArm`, 0, -M.antebrazo, 0);
}

// ---------------------------------------------------------------------------
// Mallas del maniquí (rígidas, colgadas de cada hueso; en reposo los miembros apuntan abajo)

const piel = new THREE.MeshStandardMaterial({ color: 0xdcd6cc, roughness: 0.5, metalness: 0.02 });
const articulacion = new THREE.MeshStandardMaterial({ color: 0x9d978d, roughness: 0.55 });

function malla(nombreHueso, geo, mat = piel, pos = [0, 0, 0], nombre) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.name = nombre ?? `${nombreHueso}-malla`;
  huesos[nombreHueso].add(m);
  return m;
}
const capsula = (r, largo) => new THREE.CapsuleGeometry(r, Math.max(0.001, largo - 2 * r), 4, 14);
const esfera = (r) => new THREE.SphereGeometry(r, 14, 10);

{
  const pelvis = malla("Hips", capsula(0.1, 0.32), piel, [0, 0, 0], "pelvis");
  pelvis.rotation.z = Math.PI / 2;
  pelvis.scale.set(1, 1, 0.8);
}
malla("Spine", capsula(0.105, M.columna[0] + 0.04), piel, [0, (M.columna[0] + 0.04) / 2, 0]).scale.set(1.15, 1, 0.75);
malla("Spine1", capsula(0.115, M.columna[1] + 0.02), piel, [0, (M.columna[1] + 0.02) / 2, 0]).scale.set(1.25, 1, 0.8);
malla("Spine2", capsula(0.125, M.columna[2] + 0.02), piel, [0, (M.columna[2] + 0.02) / 2, 0]).scale.set(1.35, 1, 0.8);
malla("Neck", capsula(0.045, M.cuello), piel, [0, M.cuello / 2, 0]);
malla("Head", new THREE.SphereGeometry(0.1, 20, 14), piel, [0, 0.1, 0], "cabeza").scale.set(0.9, 1.1, 1);
{
  const nariz = malla("Head", new THREE.ConeGeometry(0.018, 0.04, 8), articulacion, [0, 0.09, 0.1], "nariz");
  nariz.rotation.x = Math.PI / 2;
}
for (const [lado] of LADOS) {
  malla(`${lado}UpLeg`, capsula(0.075, M.femur), piel, [0, -M.femur / 2, 0]);
  malla(`${lado}Leg`, esfera(0.06), articulacion, [0, 0, 0], `${lado}Leg-articulacion`);
  malla(`${lado}Leg`, capsula(0.058, M.tibia), piel, [0, -M.tibia / 2, 0]);
  malla(`${lado}Foot`, esfera(0.045), articulacion, [0, 0, 0], `${lado}Foot-articulacion`);
  malla(`${lado}Foot`, new THREE.BoxGeometry(0.09, 0.06, 0.24), piel, [0, -M.pie + 0.03, 0.06]);
  malla(`${lado}Arm`, esfera(0.055), articulacion, [0, 0, 0], `${lado}Arm-articulacion`);
  malla(`${lado}Arm`, capsula(0.05, M.brazo), piel, [0, -M.brazo / 2, 0]);
  malla(`${lado}ForeArm`, esfera(0.043), articulacion, [0, 0, 0], `${lado}ForeArm-articulacion`);
  malla(`${lado}ForeArm`, capsula(0.042, M.antebrazo), piel, [0, -M.antebrazo / 2, 0]);
  malla(`${lado}Hand`, new THREE.SphereGeometry(0.045, 12, 10), piel, [0, -0.015, 0]).scale.set(0.8, 1.2, 0.6);
}

// ---------------------------------------------------------------------------
// Objetos del gimnasio (nodos "obj-*" en la raíz; el visor muestra solo los de cada ejercicio)

const metal = new THREE.MeshStandardMaterial({ color: 0x41454c, roughness: 0.32, metalness: 0.8 });
const disco = new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 0.6, metalness: 0.2 });
const tapizado = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.85 });
const estructura = new THREE.MeshStandardMaterial({ color: 0x6a707a, roughness: 0.45, metalness: 0.5 });
const cableMat = new THREE.MeshStandardMaterial({ color: 0xe7e9ec, roughness: 0.4 });
const acento = new THREE.MeshStandardMaterial({ color: 0xc8f04a, roughness: 0.5 });

const objetos = new THREE.Group();
objetos.name = "objetos";

function grupo(nombre, padre = objetos) {
  const g = new THREE.Group();
  g.name = nombre;
  padre.add(g);
  return g;
}
function pieza(g, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  g.add(m);
  return m;
}
const cil = (r, h, seg = 16) => new THREE.CylinderGeometry(r, r, h, seg);
const caja = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Z90 = [0, 0, Math.PI / 2];

{
  const g = grupo("obj-barra");
  pieza(g, cil(0.014, 1.9, 10), metal, [0, 0, 0], Z90);
  for (const s of [1, -1]) {
    pieza(g, cil(0.16, 0.04, 28), disco, [s * 0.68, 0, 0], Z90);
    pieza(g, cil(0.12, 0.03, 24), disco, [s * 0.725, 0, 0], Z90);
    pieza(g, cil(0.028, 0.05, 12), metal, [s * 0.64, 0, 0], Z90);
  }
}
{
  const g = grupo("obj-barra-corta");
  pieza(g, cil(0.015, 1.0, 10), metal, [0, 0, 0], Z90);
  for (const s of [1, -1]) pieza(g, cil(0.02, 0.14, 10), tapizado, [s * 0.4, 0, 0], Z90);
}
for (const nombre of ["obj-mancuerna-izq", "obj-mancuerna-der"]) {
  const g = grupo(nombre);
  pieza(g, cil(0.016, 0.14, 10), metal, [0, 0, 0], Z90);
  for (const s of [1, -1]) pieza(g, cil(0.05, 0.065, 6), disco, [s * 0.1, 0, 0], Z90);
}
{
  const g = grupo("obj-banco");
  pieza(g, caja(0.3, 0.07, 1.15), tapizado, [0, -0.035, 0]);
  for (const z of [0.45, -0.45]) {
    pieza(g, caja(0.06, 0.38, 0.06), estructura, [0, -0.26, z]);
    pieza(g, caja(0.36, 0.04, 0.06), estructura, [0, -0.43, z]);
  }
}
{
  const g = grupo("obj-banco-inclinado");
  pieza(g, caja(0.3, 0.07, 0.38), tapizado, [0, -0.035, 0.03]);
  pieza(g, caja(0.06, 0.38, 0.06), estructura, [0, -0.26, 0]);
  pieza(g, caja(0.4, 0.04, 0.5), estructura, [0, -0.43, -0.05]);
  const r = grupo("obj-respaldo", g);
  pieza(r, caja(0.3, 0.85, 0.07), tapizado, [0, 0.43, -0.04]);
}
{
  const g = grupo("obj-asiento");
  pieza(g, caja(0.38, 0.08, 0.42), tapizado, [0, -0.04, 0.05]);
  pieza(g, caja(0.38, 0.62, 0.08), tapizado, [0, 0.32, -0.2]);
  pieza(g, caja(0.07, 0.45, 0.07), estructura, [0, -0.3, 0]);
  pieza(g, caja(0.5, 0.04, 0.5), estructura, [0, -0.5, 0]);
}
{
  const g = grupo("obj-asiento-prensa");
  pieza(g, caja(0.42, 0.08, 0.42), tapizado, [0, -0.04, 0.04]);
  pieza(g, caja(0.42, 0.75, 0.08), tapizado, [0, 0.28, -0.3], [-0.96, 0, 0]);
  pieza(g, caja(0.1, 0.4, 0.1), estructura, [0, -0.22, 0]);
  pieza(g, caja(0.5, 0.06, 1.6), estructura, [0, -0.37, 0.35]);
}
{
  const g = grupo("obj-plataforma");
  pieza(g, caja(0.6, 0.5, 0.04), estructura, [0, 0, 0]);
  pieza(g, caja(0.62, 0.04, 0.06), acento, [0, -0.25, 0]);
}
{
  const g = grupo("obj-rodillo");
  pieza(g, cil(0.055, 0.36, 18), tapizado, [0, 0, 0], Z90);
  pieza(g, cil(0.012, 0.5, 8), metal, [0, 0, 0], Z90);
}
{
  const g = grupo("obj-predicador");
  pieza(g, caja(0.44, 0.06, 0.34), tapizado, [0, 0, 0], [Math.PI / 2, 0, 0]);
}
{
  const g = grupo("obj-polea");
  pieza(g, caja(0.12, 2.3, 0.12), estructura, [0, 1.15, 0]);
  pieza(g, caja(0.5, 0.05, 0.5), estructura, [0, 0.025, 0]);
  pieza(g, caja(0.18, 0.18, 0.06), acento, [0, 1.6, 0.06]);
}
{
  const g = grupo("obj-cable");
  pieza(g, cil(0.006, 1, 6), cableMat);
}
{
  const g = grupo("obj-barra-fija");
  pieza(g, cil(0.017, 1.5, 10), metal, [0, 0, 0], Z90);
  for (const s of [1, -1]) pieza(g, caja(0.07, 2.3, 0.07), estructura, [s * 0.75, -1.1, 0]);
}
{
  const g = grupo("obj-escalon");
  pieza(g, caja(0.6, 0.12, 0.3), estructura, [0, 0.06, 0]);
  pieza(g, caja(0.6, 0.012, 0.3), tapizado, [0, 0.126, 0]);
}
{
  const g = grupo("obj-poste");
  pieza(g, cil(0.025, 1.3, 12), estructura, [0, 0.65, 0]);
  pieza(g, cil(0.12, 0.03, 20), estructura, [0, 0.015, 0]);
}
{
  const g = grupo("obj-almohadillas");
  for (const s of [1, -1]) pieza(g, caja(0.14, 0.07, 0.2), tapizado, [s * 0.13, 0, 0]);
  pieza(g, caja(0.8, 0.04, 0.04), estructura, [0, 0.03, 0.08]);
}

// ---------------------------------------------------------------------------
// Animación

const DURACION = 5;
const FPS = 15;
const suave = (t) => t * t * (3 - 2 * t);

/** 0 = posición contraída, 1 = estirada. Arriba 0.6 s, baja 2 s, pausa 0.6 s, sube 1.2 s, arriba 0.6 s. */
function fase(t) {
  if (t < 0.6) return 0;
  if (t < 2.6) return suave((t - 0.6) / 2);
  if (t < 3.2) return 1;
  if (t < 4.4) return 1 - suave((t - 3.2) / 1.2);
  return 0;
}

const kit = new Kit(huesos, raiz);

function crearClip(nombre, def, error) {
  const n = DURACION * FPS + 1;
  const tiempos = Array.from({ length: n }, (_, i) => i / FPS);
  const muestras = tiempos.map((t) => {
    kit.reset();
    def.pose(kit, fase(t), error);
    return kit.capturar();
  });
  const pistas = [
    new THREE.VectorKeyframeTrack(`${N("Hips")}.position`, tiempos, muestras.flatMap((m) => m.cadera.toArray())),
  ];
  for (const h of Object.keys(huesos)) {
    pistas.push(
      new THREE.QuaternionKeyframeTrack(`${N(h)}.quaternion`, tiempos, muestras.flatMap((m) => m.locales[h].toArray())),
    );
  }
  for (const obj of Object.keys(muestras[0].objetos)) {
    const ms = muestras.map((m) => m.objetos[obj]);
    pistas.push(new THREE.VectorKeyframeTrack(`${obj}.position`, tiempos, ms.flatMap((o) => o.pos.toArray())));
    pistas.push(new THREE.QuaternionKeyframeTrack(`${obj}.quaternion`, tiempos, ms.flatMap((o) => o.q.toArray())));
    if (ms.some((o) => !o.escala.equals(new THREE.Vector3(1, 1, 1)))) {
      pistas.push(new THREE.VectorKeyframeTrack(`${obj}.scale`, tiempos, ms.flatMap((o) => o.escala.toArray())));
    }
  }
  // El primer fotograma deja la escena en una pose válida al exportar.
  return { clip: new THREE.AnimationClip(nombre, DURACION, pistas), primera: muestras[0] };
}

const clips = [];
let poseInicial;
for (const def of EJERCICIOS) {
  const { clip, primera } = crearClip(def.id, def, false);
  clips.push(clip);
  if (def.id === "sentadilla-profunda") poseInicial = primera;
  if (def.error) clips.push(crearClip(def.error.clip, def, true).clip);
}

const escena = new THREE.Scene();
escena.name = "maniqui";
escena.add(raiz);
escena.add(objetos);
raiz.position.copy(poseInicial.cadera);
for (const [h, q] of Object.entries(poseInicial.locales)) huesos[h].quaternion.copy(q);

const glb = await new GLTFExporter().parseAsync(escena, { binary: true, animations: clips });
mkdirSync("public/modelos", { recursive: true });
writeFileSync("public/modelos/maniqui.glb", Buffer.from(glb));
console.log(`maniqui.glb: ${(glb.byteLength / 1024).toFixed(0)} KB, ${clips.length} clips`);

// ---------------------------------------------------------------------------
// Ficha técnica de cada ejercicio

const RUTA_JSON = "src/datos/ejercicios.json";
const ejercicios = JSON.parse(readFileSync(RUTA_JSON, "utf8"));
const porId = new Map(EJERCICIOS.map((d) => [d.id, d]));
for (const e of ejercicios) {
  const d = porId.get(e.id);
  if (!d) {
    console.warn(`Sin animación: ${e.id}`);
    continue;
  }
  e.tecnica = {
    modelo: "modelos/maniqui.glb",
    clipCorrecto: d.id,
    ...(d.error
      ? { clipError: d.error.clip, huesosError: d.error.huesos, descripcionError: d.error.descripcion }
      : {}),
    objetos: d.objetos,
    vista: d.vista,
    puntosClave: d.puntos.map((x) => ({
      hueso: x.hueso,
      tiempoInicio: x.t,
      duracion: x.d,
      zoom: x.zoom,
      angulo: { azimut: x.az, elevacion: x.el },
      indicacion: x.texto,
    })),
  };
}
writeFileSync(RUTA_JSON, JSON.stringify(ejercicios, null, 2) + "\n");
console.log(`Fichas actualizadas: ${ejercicios.filter((e) => porId.has(e.id)).length}/${ejercicios.length}`);
