// Pantalla del entreno: registrar una serie hecha según lo previsto cuesta un toque.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { obtenerEjercicio } from "../../datos/biblioteca";
import * as repo from "../../datos/repositorio";
import type { Dificultad, PlanEjercicio, Sesion } from "../../datos/tipos";
import {
  cambiarPeso,
  cambiarReps,
  ejercicioTerminado,
  numeroSerie,
  serieHecha,
  siguientePendiente,
  type Posicion,
} from "../../logica/plan";
import type { MarcaPersonal } from "../../logica/progresion";
import * as servicio from "../../logica/servicio";
import { interpretarDictado } from "../../logica/voz";
import { Ajustador } from "../componentes/Ajustador";
import { Icono, Toast, type Aviso } from "../componentes/comunes";
import { ir } from "../enrutador";
import { cerrarNotificacion, notificarSerie, vibrar } from "../feedback";
import { kg, mmss } from "../formato";

const CLAVE_DESCANSO = "gym.descanso";
const DESCANSO_CALENTAMIENTO = 60;

interface Descanso {
  sesionId: string;
  fin: number;
  total: number;
}

function leerDescanso(sesionId: string): Descanso | null {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_DESCANSO) ?? "null") as Descanso | null;
    return d && d.sesionId === sesionId ? d : null;
  } catch {
    return null;
  }
}

function guardarDescanso(d: Descanso | null): void {
  try {
    if (d) localStorage.setItem(CLAVE_DESCANSO, JSON.stringify(d));
    else localStorage.removeItem(CLAVE_DESCANSO);
  } catch {
    /* almacenamiento no disponible */
  }
}

function textoSerie(p: PlanEjercicio, i: number): string {
  const s = p.series[i];
  const total = p.series.filter((x) => x.esCalentamiento === s.esCalentamiento).length;
  return s.esCalentamiento
    ? `Calentamiento ${numeroSerie(p, i)}/${total}`
    : `Serie ${numeroSerie(p, i)} de ${total}`;
}

function nombre(id: string): string {
  return obtenerEjercicio(id)?.nombre ?? id;
}

type Reconocimiento = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
};

function constructorVoz(): (new () => Reconocimiento) | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Reconocimiento) | undefined;
}

export function Entreno({ hechaDesdeNotificacion }: { hechaDesdeNotificacion: boolean }) {
  const [sesion, setSesionEstado] = useState<Sesion | null | undefined>(undefined);
  const [pos, setPos] = useState<Posicion>({ ejercicio: 0, serie: 0 });
  const [descanso, setDescansoEstado] = useState<Descanso | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [dificultad, setDificultad] = useState<{ indice: number; elegida?: Dificultad } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [records, setRecords] = useState<{ ejercicioId: string; marca: MarcaPersonal }[]>([]);
  const [escuchando, setEscuchando] = useState(false);

  const sesionRef = useRef<Sesion | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const ocupado = useRef(false);
  const avisado = useRef(false);

  const setSesion = (s: Sesion | null) => {
    sesionRef.current = s;
    setSesionEstado(s);
  };
  const setDescanso = (d: Descanso | null) => {
    guardarDescanso(d);
    avisado.current = false;
    setDescansoEstado(d);
  };

  // Carga (o recupera tras cerrar la app) la sesión en curso.
  useEffect(() => {
    servicio.asegurarDatosIniciales().then(async () => {
      const s = (await repo.sesionEnCurso()) ?? null;
      setSesion(s);
      if (!s) return;
      setPos(siguientePendiente(s.plan) ?? { ejercicio: 0, serie: 0 });
      setDescansoEstado(leerDescanso(s.id));
    });
  }, []);

  // Acción "Hecha" desde la notificación (con la app abierta o al abrirla desde ella).
  useEffect(() => {
    const alMensaje = (e: MessageEvent) => {
      if (e.data?.tipo === "serie-hecha") void marcar();
    };
    navigator.serviceWorker?.addEventListener("message", alMensaje);
    return () => navigator.serviceWorker?.removeEventListener("message", alMensaje);
  }, []);

  useEffect(() => {
    if (sesion && hechaDesdeNotificacion) {
      ir("/entreno", true);
      void marcar();
    }
  }, [sesion === undefined]);

  // Temporizador de descanso basado en la hora real: sigue siendo correcto tras bloquear el móvil.
  useEffect(() => {
    if (!descanso) return;
    const t = setInterval(() => setAhora(Date.now()), 250);
    const alVolver = () => setAhora(Date.now());
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [descanso]);

  const restante = descanso ? (descanso.fin - ahora) / 1000 : 0;
  useEffect(() => {
    if (descanso && restante <= 0 && !avisado.current) {
      avisado.current = true;
      vibrar([250, 120, 250]);
      const s = sesionRef.current;
      const p = s?.plan[posRef.current.ejercicio];
      const serie = p?.series[posRef.current.serie];
      if (s && p && serie && !serieHecha(serie)) {
        void notificarSerie(
          `A por la siguiente · ${nombre(p.ejercicioId)}`,
          `${textoSerie(p, posRef.current.serie)}: ${kg(serie.pesoKg)} kg × ${serie.reps}`,
          document.hidden,
        );
      }
    }
  }, [descanso, restante <= 0]);

  const plan = sesion?.plan ?? [];
  const actual = plan[pos.ejercicio];
  const serie = actual?.series[pos.serie];
  const ejercicio = actual ? obtenerEjercicio(actual.ejercicioId) : undefined;
  const pendiente = useMemo(() => (sesion ? siguientePendiente(sesion.plan) : null), [sesion]);

  async function editar(nuevoPlan: PlanEjercicio[]) {
    const s = sesionRef.current;
    if (!s) return;
    const nueva = await servicio.guardarPlan(s, nuevoPlan);
    setSesion(nueva);
    if (serieHecha(nueva.plan[posRef.current.ejercicio].series[posRef.current.serie])) {
      await servicio.actualizarSerieMarcada(nueva, posRef.current);
    }
  }

  /** Marca la serie seleccionada (con valores dictados si los hay) y prepara la siguiente. */
  async function marcar(valores?: { reps?: number; pesoKg?: number }) {
    let s = sesionRef.current;
    if (!s || ocupado.current) return;
    ocupado.current = true;
    try {
      let p = posRef.current;
      if (serieHecha(s.plan[p.ejercicio].series[p.serie]) && !valores) {
        // Una serie ya marcada: el botón solo pasa a la siguiente pendiente.
        const sig = siguientePendiente(s.plan, p.ejercicio);
        if (sig) setPos(sig);
        return;
      }
      if (serieHecha(s.plan[p.ejercicio].series[p.serie])) {
        const sig = siguientePendiente(s.plan, p.ejercicio);
        if (!sig) return;
        p = sig;
      }
      let planEditado = s.plan;
      if (valores?.pesoKg !== undefined) planEditado = cambiarPeso(planEditado, p, valores.pesoKg);
      if (valores?.reps !== undefined) planEditado = cambiarReps(planEditado, p, valores.reps);
      if (planEditado !== s.plan) s = { ...s, plan: planEditado };

      vibrar(30);
      const { sesion: nueva, record } = await servicio.marcarSerie(s, p);
      setSesion(nueva);
      const hecha = nueva.plan[p.ejercicio];
      const serieMarcada = hecha.series[p.serie];

      if (ejercicioTerminado(hecha)) setDificultad({ indice: p.ejercicio });
      else setDificultad((d) => (d && d.indice !== p.ejercicio ? null : d));

      const sig = siguientePendiente(nueva.plan, p.ejercicio);
      const anterior = p;
      if (sig) {
        setPos(sig);
        const seg = serieMarcada.esCalentamiento ? DESCANSO_CALENTAMIENTO : hecha.descansoSeg;
        setDescanso({ sesionId: nueva.id, fin: Date.now() + seg * 1000, total: seg });
        const pe = nueva.plan[sig.ejercicio];
        const se = pe.series[sig.serie];
        void notificarSerie(
          `Descanso ${mmss(seg)} · ${nombre(pe.ejercicioId)}`,
          `${textoSerie(pe, sig.serie)}: ${kg(se.pesoKg)} kg × ${se.reps}`,
          false,
        );
      } else {
        setDescanso(null);
        void cerrarNotificacion();
      }

      if (record) {
        setRecords((r) => [...r, { ejercicioId: hecha.ejercicioId, marca: record }]);
        vibrar([40, 60, 40, 60, 120]);
        setAviso({
          tipo: "record",
          texto:
            record.tipo === "peso"
              ? `¡Récord! ${kg(record.pesoKg)} kg en ${nombre(hecha.ejercicioId)}`
              : `¡Récord! ${record.reps} reps con ${kg(record.pesoKg)} kg`,
        });
      } else {
        setAviso({
          texto: `Hecha · ${kg(serieMarcada.pesoKg)} × ${serieMarcada.reps}`,
          accion: { texto: "Deshacer", hacer: () => void deshacer(anterior) },
        });
      }
    } finally {
      ocupado.current = false;
    }
  }

  async function deshacer(p: Posicion) {
    const s = sesionRef.current;
    if (!s) return;
    const nueva = await servicio.deshacerSerie(s, p);
    setSesion(nueva);
    setPos(p);
    setDescanso(null);
    setDificultad(null);
    setRecords((r) => r.slice(0, -1));
  }

  async function elegirDificultad(d: Dificultad) {
    const s = sesionRef.current;
    if (!s || !dificultad) return;
    await servicio.guardarDificultad(s, s.plan[dificultad.indice].ejercicioId, d);
    setDificultad({ ...dificultad, elegida: d });
    setTimeout(() => setDificultad((x) => (x?.elegida ? null : x)), 700);
  }

  async function sustituir() {
    const s = sesionRef.current;
    if (!s) return;
    const nueva = await servicio.sustituir(s, pos.ejercicio);
    setSesion(nueva);
    setPos({ ejercicio: pos.ejercicio, serie: nueva.plan[pos.ejercicio].series.findIndex((x) => !serieHecha(x)) });
    setAviso({ texto: `Cambiado a ${nombre(nueva.plan[pos.ejercicio].ejercicioId)}` });
  }

  function irAEjercicio(delta: number) {
    const n = plan.length;
    const e = (pos.ejercicio + delta + n) % n;
    const i = plan[e].series.findIndex((x) => !serieHecha(x));
    setPos({ ejercicio: e, serie: i >= 0 ? i : plan[e].series.length - 1 });
  }

  function dictar() {
    const C = constructorVoz();
    if (!C) return;
    const r = new C();
    r.lang = "es-ES";
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      const alternativas = Array.from(e.results[0]).map((a) => a.transcript);
      const dictado = alternativas.map(interpretarDictado).find(Boolean);
      if (dictado) void marcar(dictado);
      else setAviso({ texto: `No entendí «${alternativas[0] ?? ""}». Prueba «doce con sesenta»` });
    };
    r.onerror = () => setAviso({ texto: "No se pudo usar la voz (¿sin conexión?)" });
    r.onend = () => setEscuchando(false);
    setEscuchando(true);
    r.start();
  }

  async function terminar() {
    const s = sesionRef.current;
    if (!s) return;
    const quedan = s.plan.reduce((t, p) => t + p.series.filter((x) => !serieHecha(x)).length, 0);
    if (quedan > 0 && !confirm(`Quedan ${quedan} series sin marcar. ¿Terminar el entreno igualmente?`)) return;
    await servicio.terminarSesion(s);
    setDescanso(null);
    await cerrarNotificacion();
    ir("/", true);
  }

  // ------------------------------------------------------------------ Render

  if (sesion === undefined) return <div class="entreno" />;
  if (sesion === null || !actual || !serie || !ejercicio) {
    return (
      <div class="pantalla">
        <p class="vacio">No hay ningún entreno en marcha.</p>
        <a class="boton principal ancho" href="#/">
          Ir a hoy
        </a>
      </div>
    );
  }

  const hecha = serieHecha(serie);
  const sinPendientes = pendiente === null;
  const algunaTrabajoHecha = actual.series.some((x) => !x.esCalentamiento && serieHecha(x));
  const unidadPeso = ejercicio.equipo === "peso-corporal" ? "kg de lastre" : "kg";

  return (
    <div class="entreno">
      <Toast aviso={aviso} alCerrar={() => setAviso(null)} />

      <div class="entreno-barra">
        <button class="atras" aria-label="Salir (el entreno queda guardado)" onClick={() => ir("/")}>
          <Icono nombre="cerrar" />
        </button>
        <span class="titulo">
          {sesion.nombreDia}
          {sesion.esDescarga ? " · descarga" : ""} · {pos.ejercicio + 1}/{plan.length}
        </span>
        <button class="boton pequeno" onClick={terminar}>
          Terminar
        </button>
      </div>

      <div class="entreno-ejercicio">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button class="atras" aria-label="Ejercicio anterior" onClick={() => irAEjercicio(-1)}>
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{ejercicio.nombre}</h1>
            <div class="motivo">{actual.pesoPorDefinir ? "Primera vez: ajusta el peso una sola vez" : actual.motivo}</div>
          </div>
          <button class="atras" aria-label="Ejercicio siguiente" onClick={() => irAEjercicio(1)}>
            ›
          </button>
        </div>

        <div class="series" role="list" aria-label="Series">
          {actual.series.map((x, i) => (
            <button
              role="listitem"
              key={i}
              class={`serie-chip ${serieHecha(x) ? "hecha" : ""} ${i === pos.serie ? "actual" : ""} ${x.esCalentamiento ? "calentamiento" : ""}`}
              aria-current={i === pos.serie}
              onClick={() => setPos({ ejercicio: pos.ejercicio, serie: i })}
            >
              <span class="n">
                {x.esCalentamiento ? `C${numeroSerie(actual, i)}` : `S${numeroSerie(actual, i)}`} {serieHecha(x) ? "✓" : ""}
              </span>
              {kg(x.pesoKg)}×{x.reps}
            </button>
          ))}
        </div>
      </div>

      {descanso && (
        <div class={`descanso ${restante <= 0 ? "listo" : ""}`} role="timer" aria-live="off">
          <div class="tiempo">
            <small>{restante <= 0 ? "Descanso terminado" : "Descanso"}</small>
            {restante <= 0 ? "¡Listo!" : mmss(restante)}
          </div>
          <button onClick={() => setDescanso({ ...descanso, fin: descanso.fin - 15000 })} aria-label="Quitar 15 segundos">
            −15
          </button>
          <button onClick={() => setDescanso({ ...descanso, fin: descanso.fin + 30000 })} aria-label="Añadir 30 segundos">
            +30
          </button>
          <button onClick={() => setDescanso(null)} aria-label="Cerrar descanso">
            <Icono nombre="cerrar" />
          </button>
        </div>
      )}

      <div class="zona-numeros">
        <div class={`etiqueta-serie ${serie.esCalentamiento ? "calentamiento" : ""}`}>
          {textoSerie(actual, pos.serie)}
          {hecha ? " · hecha" : ""}
          {!serie.esCalentamiento ? ` · objetivo ${actual.repsMin}–${actual.repsMax}` : ""}
        </div>
        <Ajustador
          etiqueta="peso"
          unidad={unidadPeso}
          valor={serie.pesoKg}
          paso={ejercicio.saltoPesoKg}
          formato={kg}
          alCambiar={(n) => void editar(cambiarPeso(plan, pos, n))}
        />
        <Ajustador
          etiqueta="repeticiones"
          unidad="reps"
          valor={serie.reps}
          paso={1}
          formato={String}
          alCambiar={(n) => void editar(cambiarReps(plan, pos, n))}
        />
      </div>

      <div class="zona-pulgar">
        {dificultad && (
          <div class="dificultad" role="group" aria-label="¿Qué tal el ejercicio?">
            <p>
              ¿Qué tal {nombre(plan[dificultad.indice].ejercicioId)}?
              <button aria-label="Omitir" onClick={() => setDificultad(null)}>
                Omitir
              </button>
            </p>
            <div class="opciones">
              {(
                [
                  ["facil", "Fácil"],
                  ["justo", "Justo"],
                  ["no-pude", "No pude"],
                ] as const
              ).map(([v, t]) => (
                <button key={v} aria-pressed={dificultad.elegida === v} onClick={() => void elegirDificultad(v)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div class="acciones-ejercicio">
          <a class="boton" href={`#/ejercicio/${ejercicio.id}`}>
            <Icono nombre="tecnica" /> Técnica
          </a>
          <button class="boton" aria-label="Máquina ocupada: cambiar por un sustituto" onClick={sustituir} disabled={algunaTrabajoHecha || (obtenerEjercicio(actual.ejercicioRutinaId)?.sustitutos.length ?? 0) === 0}>
            <Icono nombre="cambiar" /> Ocupada
          </button>
          {constructorVoz() && (
            <button class="boton" aria-label="Dictar serie, por ejemplo «doce con sesenta»" aria-pressed={escuchando} onClick={dictar}>
              <Icono nombre="microfono" />
            </button>
          )}
        </div>

        {sinPendientes && hecha ? (
          <button class="marcar" onClick={terminar}>
            <Icono nombre="check" /> Terminar entreno
            {records.length > 0 ? ` · ${records.length} récord${records.length > 1 ? "s" : ""}` : ""}
          </button>
        ) : (
          <button class={`marcar ${hecha ? "editar" : ""}`} onClick={() => void marcar()}>
            <Icono nombre="check" />
            {hecha ? "Ir a la siguiente serie" : "Marcar serie"}
          </button>
        )}
      </div>
    </div>
  );
}
