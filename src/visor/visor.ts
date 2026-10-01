// Visor 3D de técnica: figura animada, cámara guiada por puntos clave y rotación libre.
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FichaTecnica, PuntoClave } from "../datos/tipos";

export type Comparacion = "ninguna" | "correcto" | "error";
export type ModoCamara = "guiada" | "libre";

export interface OpcionesVisor {
  /** Se llama con la indicación activa (o null) durante la guía. */
  alIndicar: (texto: string | null, indice: number | null) => void;
  alCambiarModo: (modo: ModoCamara) => void;
  reducirMovimiento: boolean;
}

const cacheModelos = new Map<string, Promise<GLTF>>();

function cargarModelo(url: string): Promise<GLTF> {
  let p = cacheModelos.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url);
    p.catch(() => cacheModelos.delete(url));
    cacheModelos.set(url, p);
  }
  return p;
}

export function hayWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const VISTA_GENERAL = {
  posicion: new THREE.Vector3(1.9, 1.35, 2.7),
  objetivo: new THREE.Vector3(0, 0.75, 0),
};

const COLOR_ERROR = new THREE.Color(0xe5484d);
const COLOR_BIEN = new THREE.Color(0x30a46c);

type Fase = "esperando" | "mostrando" | "volviendo" | "fin";

export class VisorTecnica {
  private renderer: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  private controles: OrbitControls;
  private reloj = new THREE.Clock();
  private mixer?: THREE.AnimationMixer;
  private accionCorrecta?: THREE.AnimationAction;
  private accionError?: THREE.AnimationAction;
  private raiz?: THREE.Object3D;
  private mallasPorHueso = new Map<string, THREE.Mesh[]>();
  private coloresOriginales = new Map<THREE.Mesh, THREE.Color>();
  private observador: ResizeObserver;
  private frame = 0;
  private destruido = false;

  private modo: ModoCamara = "guiada";
  private indice = 0;
  private indiceAnunciado = -1;
  private fase: Fase = "esperando";
  private inicioMostrar = 0;
  private tiempoPrevio = 0;
  private destinoPos = VISTA_GENERAL.posicion.clone();
  private destinoObj = VISTA_GENERAL.objetivo.clone();
  private moviendoPorCodigo = false;
  private comparacion: Comparacion = "ninguna";

  constructor(
    private contenedor: HTMLElement,
    private ficha: FichaTecnica,
    private op: OpcionesVisor,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    contenedor.appendChild(this.renderer.domElement);

    this.camara.position.copy(VISTA_GENERAL.posicion);
    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.target.copy(VISTA_GENERAL.objetivo);
    this.controles.enableDamping = true;
    this.controles.enablePan = false;
    this.controles.minDistance = 0.8;
    this.controles.maxDistance = 6;
    this.controles.addEventListener("start", this.alTocar);

    this.montarEscena();
    this.observador = new ResizeObserver(() => this.ajustarTamano());
    this.observador.observe(contenedor);
    this.ajustarTamano();
  }

  /** Carga el modelo. Rechaza si no existe o no tiene el clip. */
  async cargar(): Promise<void> {
    if (!this.ficha.modelo || !this.ficha.clipCorrecto) throw new Error("Sin modelo");
    const base = import.meta.env.BASE_URL;
    const gltf = await cargarModelo(base + this.ficha.modelo);
    if (this.destruido) return;
    const clipBien = THREE.AnimationClip.findByName(gltf.animations, this.ficha.clipCorrecto);
    if (!clipBien) throw new Error(`Falta el clip ${this.ficha.clipCorrecto}`);

    // Copia independiente para poder colorear sin afectar a otros visores.
    this.raiz = gltf.scene.clone(true);
    this.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = (o.material as THREE.MeshStandardMaterial).clone();
        o.castShadow = true;
        this.coloresOriginales.set(o, (o.material as THREE.MeshStandardMaterial).color.clone());
        const hueso = o.parent?.name;
        if (hueso) this.mallasPorHueso.set(hueso, [...(this.mallasPorHueso.get(hueso) ?? []), o]);
      }
    });
    this.escena.add(this.raiz);

    this.mixer = new THREE.AnimationMixer(this.raiz);
    this.accionCorrecta = this.mixer.clipAction(clipBien);
    this.accionCorrecta.play();
    const clipMal = this.ficha.clipError && THREE.AnimationClip.findByName(gltf.animations, this.ficha.clipError);
    if (clipMal) {
      this.accionError = this.mixer.clipAction(clipMal);
      this.accionError.play();
      this.accionError.weight = 0;
    }
    this.iniciarGuia();
    this.reloj.start();
    this.bucle();
  }

  get tieneError(): boolean {
    return !!this.accionError;
  }

  iniciarGuia(): void {
    if (this.ficha.puntosClave.length === 0) {
      this.modo = "libre";
      this.op.alCambiarModo("libre");
      return;
    }
    this.modo = "guiada";
    this.indice = 0;
    this.indiceAnunciado = -1;
    this.fase = "esperando";
    this.controles.enabled = true;
    this.op.alCambiarModo("guiada");
    this.op.alIndicar(null, null);
    this.tiempoPrevio = this.tiempoBucle();
  }

  verVistaGeneral(): void {
    this.destinoPos.copy(VISTA_GENERAL.posicion);
    this.destinoObj.copy(VISTA_GENERAL.objetivo);
    if (this.op.reducirMovimiento) this.saltarADestino();
  }

  setComparacion(c: Comparacion): void {
    this.comparacion = c;
    if (this.accionCorrecta && this.accionError) {
      const error = c === "error";
      // Sincroniza ambos clips y cambia el peso (fundido corto o salto si se reduce el movimiento).
      this.accionError.time = this.accionCorrecta.time;
      if (this.op.reducirMovimiento) {
        this.accionCorrecta.weight = error ? 0 : 1;
        this.accionError.weight = error ? 1 : 0;
      } else {
        const desde = error ? this.accionCorrecta : this.accionError;
        const hacia = error ? this.accionError : this.accionCorrecta;
        hacia.enabled = true;
        hacia.setEffectiveWeight(1);
        desde.crossFadeTo(hacia, 0.35, false);
      }
    }
    this.colorear();
  }

  destruir(): void {
    this.destruido = true;
    cancelAnimationFrame(this.frame);
    this.observador.disconnect();
    this.controles.removeEventListener("start", this.alTocar);
    this.controles.dispose();
    this.mixer?.stopAllAction();
    this.raiz?.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // -------------------------------------------------------------------------

  private montarEscena(): void {
    this.escena.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(2, 4, 3);
    this.escena.add(sol);
    const suelo = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1, transparent: true, opacity: 0.55 }),
    );
    suelo.rotation.x = -Math.PI / 2;
    this.escena.add(suelo);
    const anillo = new THREE.Mesh(
      new THREE.RingGeometry(1.38, 1.4, 64),
      new THREE.MeshBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.6 }),
    );
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.y = 0.001;
    this.escena.add(anillo);
  }

  private alTocar = (): void => {
    if (this.moviendoPorCodigo) return;
    if (this.modo !== "libre") {
      this.modo = "libre";
      this.op.alCambiarModo("libre");
      this.op.alIndicar(null, null);
    }
  };

  private ajustarTamano(): void {
    const { clientWidth: w, clientHeight: h } = this.contenedor;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  private tiempoBucle(): number {
    return this.accionCorrecta?.time ?? 0;
  }

  private duracionBucle(): number {
    return this.accionCorrecta?.getClip().duration ?? 1;
  }

  private posicionHueso(nombre: string): THREE.Vector3 {
    const h = this.raiz?.getObjectByName(nombre);
    const v = new THREE.Vector3();
    if (h) h.getWorldPosition(v);
    else v.copy(VISTA_GENERAL.objetivo);
    return v;
  }

  private poseDe(p: PuntoClave): { pos: THREE.Vector3; obj: THREE.Vector3 } {
    // En vertical el campo horizontal es estrecho: aleja la cámara en proporción.
    const distancia = p.zoom * Math.max(1, 0.9 / this.camara.aspect);
    // Sube un poco el punto de mira para que la indicación superpuesta no tape el hueso.
    const obj = this.posicionHueso(p.hueso).add(new THREE.Vector3(0, distancia * 0.1, 0));
    const az = THREE.MathUtils.degToRad(p.angulo.azimut);
    const el = THREE.MathUtils.degToRad(p.angulo.elevacion);
    const pos = new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    )
      .multiplyScalar(distancia)
      .add(obj);
    return { pos, obj };
  }

  /** ¿El bucle ha pasado por el instante `t` desde el fotograma anterior? */
  private cruzo(t: number, previo: number, actual: number): boolean {
    const D = this.duracionBucle();
    const tt = ((t % D) + D) % D;
    if (actual >= previo) return previo < tt && tt <= actual;
    return tt > previo || tt <= actual; // dio la vuelta
  }

  private actualizarGuia(): void {
    const puntos = this.ficha.puntosClave;
    const ahora = this.tiempoBucle();
    const previo = this.tiempoPrevio;
    this.tiempoPrevio = ahora;
    if (this.modo !== "guiada" || this.fase === "fin" || puntos.length === 0) return;

    if (this.fase === "volviendo") {
      this.verVistaGeneral();
      if (this.camara.position.distanceTo(this.destinoPos) < 0.02) this.fase = "fin";
      return;
    }

    const p = puntos[this.indice];
    if (this.fase === "esperando" && this.indiceAnunciado !== this.indice) {
      this.indiceAnunciado = this.indice;
      this.op.alIndicar(p.indicacion, this.indice);
    }
    if (this.fase === "esperando") {
      // Mientras espera su momento en el bucle, la cámara viaja hacia el siguiente punto.
      const { pos, obj } = this.poseDe(p);
      this.destinoPos.copy(pos);
      this.destinoObj.copy(obj);
      if (this.cruzo(p.tiempoInicio, previo, ahora) || (this.indice === 0 && p.tiempoInicio === 0 && previo === 0)) {
        this.fase = "mostrando";
        this.inicioMostrar = this.reloj.elapsedTime;
        if (this.op.reducirMovimiento) this.saltarADestino();
      }
    } else if (this.fase === "mostrando") {
      if (!this.op.reducirMovimiento) {
        const { pos, obj } = this.poseDe(p);
        this.destinoPos.copy(pos);
        this.destinoObj.copy(obj);
      }
      if (this.reloj.elapsedTime - this.inicioMostrar >= Math.max(1, p.duracion)) {
        this.indice++;
        if (this.indice >= puntos.length) {
          this.fase = "volviendo";
          this.op.alIndicar(null, null);
          this.verVistaGeneral();
        } else {
          this.fase = "esperando";
        }
      }
    }
  }

  private saltarADestino(): void {
    this.camara.position.copy(this.destinoPos);
    this.controles.target.copy(this.destinoObj);
  }

  private moverCamara(dt: number): void {
    if (this.modo !== "guiada") return;
    if (this.op.reducirMovimiento) {
      // Sin interpolación: solo salta cuando cambia de punto (ver actualizarGuia).
      return;
    }
    const k = 1 - Math.exp(-dt * 3.2);
    this.camara.position.lerp(this.destinoPos, k);
    this.controles.target.lerp(this.destinoObj, k);
  }

  private colorear(): void {
    for (const [malla, color] of this.coloresOriginales) {
      const m = malla.material as THREE.MeshStandardMaterial;
      m.color.copy(color);
      m.emissive.setRGB(0, 0, 0);
    }
    if (this.comparacion === "ninguna") return;
    const color = this.comparacion === "error" ? COLOR_ERROR : COLOR_BIEN;
    for (const hueso of this.ficha.huesosError ?? []) {
      for (const malla of this.mallasPorHueso.get(hueso) ?? []) {
        const m = malla.material as THREE.MeshStandardMaterial;
        m.color.copy(color);
        m.emissive.copy(color).multiplyScalar(0.25);
      }
    }
  }

  private bucle = (): void => {
    if (this.destruido) return;
    this.frame = requestAnimationFrame(this.bucle);
    const dt = Math.min(0.05, this.reloj.getDelta());
    this.mixer?.update(dt);
    this.raiz?.updateMatrixWorld(true);
    this.actualizarGuia();
    this.moverCamara(dt);
    this.moviendoPorCodigo = true;
    this.controles.update();
    this.moviendoPorCodigo = false;
    this.renderer.render(this.escena, this.camara);
  };
}
