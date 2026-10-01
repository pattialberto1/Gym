import { useEffect, useState } from "preact/hooks";
import { MUSCULOS, obtenerEjercicio } from "../../datos/biblioteca";
import * as repo from "../../datos/repositorio";
import type { PlanEjercicio, Rutina, Sesion } from "../../datos/tipos";
import { INICIAL_DIA, NOMBRES_DIA, diaSemana, diasDeEntreno, diasEntrenados, duracionEstimada, proximoEntreno, tocaEntrenar } from "../../logica/semana";
import * as servicio from "../../logica/servicio";
import { Icono } from "../componentes/comunes";
import { ir } from "../enrutador";
import { kg, rangoReps } from "../formato";

function Semana({ rutina, hechos, hoy }: { rutina: Rutina; hechos: Set<number>; hoy: number }) {
  const dias = diasDeEntreno(rutina);
  return (
    <div class="semana" role="list" aria-label="Esta semana">
      {INICIAL_DIA.map((ini, i) => {
        const clases = [
          "dia",
          dias.includes(i) ? "toca" : "",
          hechos.has(i) ? "hecho" : "",
          i === hoy ? "hoy" : "",
        ].join(" ");
        const estado = hechos.has(i) ? "entrenado" : dias.includes(i) ? "toca entrenar" : "descanso";
        return (
          <div role="listitem" key={i} class={clases} aria-label={`${NOMBRES_DIA[i]}: ${estado}`}>
            <span class="punto">{hechos.has(i) ? "✓" : ini}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Hoy() {
  const [rutina, setRutina] = useState<Rutina>();
  const [dia, setDia] = useState(0);
  const [plan, setPlan] = useState<PlanEjercicio[]>([]);
  const [enCurso, setEnCurso] = useState<Sesion | null>(null);
  const [hechos, setHechos] = useState<Set<number>>(new Set());
  const [descarga, setDescarga] = useState<"propuesta" | "aceptada" | "no">("no");
  const [entrenarIgual, setEntrenarIgual] = useState(false);
  const [cargando, setCargando] = useState(true);
  const ahora = new Date();
  const hoy = diaSemana(ahora);

  useEffect(() => {
    (async () => {
      await servicio.asegurarDatosIniciales();
      setEnCurso((await repo.sesionEnCurso()) ?? null);
      setHechos(diasEntrenados((await repo.sesionesTerminadas()).map((s) => s.fecha), new Date()));
      const r = await servicio.rutinaActiva();
      setRutina(r);
      if (r) {
        setDia(await servicio.diaSiguiente(r));
        if (await servicio.propuestaDescarga(r)) setDescarga("propuesta");
      }
      setCargando(false);
    })();
  }, []);

  useEffect(() => {
    if (rutina) servicio.previsualizarDia(rutina, dia, descarga === "aceptada").then(setPlan);
  }, [rutina, dia, descarga]);

  async function empezar() {
    if (!rutina) return;
    await servicio.fijarDiaSiguiente(rutina.id, dia);
    await servicio.iniciarSesion(rutina, dia, descarga === "aceptada");
    ir("/entreno");
  }

  async function rechazarDescarga() {
    await servicio.responderDescarga();
    setDescarga("no");
  }

  if (cargando) return <div class="pantalla" />;

  const fechaTexto = ahora.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  if (enCurso) {
    const hechas = enCurso.plan.reduce((t, p) => t + p.series.filter((s) => s.registroId).length, 0);
    const total = enCurso.plan.reduce((t, p) => t + p.series.length, 0);
    return (
      <div class="pantalla">
        <div class="hero">
          <span class="etiqueta">Entreno a medias</span>
          <h1>{enCurso.nombreDia}</h1>
          <div class="stats">
            <div>
              <span class="cifra">
                {hechas}/{total}
              </span>
              <span class="terciario">series hechas</span>
            </div>
          </div>
          <div class="progreso-entreno" style={{ marginBottom: "16px" }}>
            <span style={{ width: `${(hechas / total) * 100}%` }} />
          </div>
          <a class="marcar" style={{ textDecoration: "none" }} href="#/entreno">
            <Icono nombre="check" /> Seguir entreno
          </a>
        </div>
      </div>
    );
  }

  if (!rutina) {
    return (
      <div class="pantalla">
        <header class="cabecera">
          <h1>Hoy</h1>
        </header>
        <p class="vacio">Aún no tienes ninguna rutina.</p>
        <a class="boton principal ancho" href="#/rutinas">
          Crear una rutina
        </a>
      </div>
    );
  }

  const diaActual = rutina.dias[dia];
  const toca = tocaEntrenar(rutina, ahora);
  const yaHecho = hechos.has(hoy);
  const descansa = (!toca || yaHecho) && !entrenarIgual;
  const proximo = proximoEntreno(rutina, new Date(ahora.getTime() + (yaHecho ? 864e5 : 0)));
  const proximoTexto =
    proximo.enDias + (yaHecho ? 1 : 0) === 1 ? "mañana" : `el ${NOMBRES_DIA[proximo.dia]}`;
  const totalSeries = plan.reduce((t, p) => t + p.series.filter((s) => !s.esCalentamiento).length, 0);

  return (
    <div class="pantalla">
      <div class={`hero ${descansa ? "descanso-dia" : ""}`}>
        <span class="etiqueta">{fechaTexto}</span>
        <h1>{descansa ? (yaHecho ? "Hecho por hoy" : "Día de descanso") : diaActual?.nombre ?? "Hoy"}</h1>
        {descansa ? (
          <p class="secundario" style={{ margin: "8px 0 16px" }}>
            {yaHecho
              ? "Buen trabajo. El músculo crece mientras descansa: "
              : "Descansar 48 h entre sesiones deja que el músculo se recupere y crezca. "}
            Próximo entreno {proximoTexto}.
          </p>
        ) : (
          <div class="stats">
            <div>
              <span class="cifra">{plan.length}</span>
              <span class="terciario">ejercicios</span>
            </div>
            <div>
              <span class="cifra">{totalSeries}</span>
              <span class="terciario">series</span>
            </div>
            <div>
              <span class="cifra">≈{diaActual ? duracionEstimada(diaActual.ejercicios) : 0}</span>
              <span class="terciario">minutos</span>
            </div>
          </div>
        )}
        <Semana rutina={rutina} hechos={hechos} hoy={hoy} />
        {descansa ? (
          <button class="boton ancho" onClick={() => setEntrenarIgual(true)}>
            Entrenar igualmente
          </button>
        ) : (
          <button class="marcar" style={{ width: "100%" }} disabled={plan.length === 0} onClick={empezar}>
            <Icono nombre="check" /> Empezar entreno
          </button>
        )}
      </div>

      {rutina.dias.length > 1 && !descansa && (
        <div class="chips" role="group" aria-label="Día de la rutina" style={{ marginBottom: "12px" }}>
          {rutina.dias.map((d, i) => (
            <button key={i} class="chip" aria-pressed={i === dia} onClick={() => setDia(i)}>
              {d.nombre}
            </button>
          ))}
        </div>
      )}

      {descarga !== "no" && !descansa && (
        <div class="tarjeta aviso">
          <h3>{descarga === "aceptada" ? "Sesión de descarga" : "¿Toca descargar?"}</h3>
          <p class="secundario">
            {descarga === "aceptada"
              ? "Hoy al 60 % del peso y con la mitad de series. La progresión sigue después como si nada."
              : "Tres o más ejercicios llevan 3 sesiones sin progresar. Una sesión suave (60 % del peso, mitad de series) suele ayudar."}
          </p>
          <div class="fila-botones">
            {descarga === "propuesta" ? (
              <>
                <button class="boton" onClick={() => setDescarga("aceptada")}>
                  Hacer descarga
                </button>
                <button class="boton" onClick={rechazarDescarga}>
                  No, gracias
                </button>
              </>
            ) : (
              <button class="boton" onClick={() => setDescarga("propuesta")}>
                Mejor un entreno normal
              </button>
            )}
          </div>
        </div>
      )}

      <h3 class="seccion">{descansa ? "Próxima sesión" : "La sesión de hoy"}</h3>
      <ul class="lista">
        {plan.map((p, i) => {
          const e = obtenerEjercicio(p.ejercicioId);
          const trabajo = p.series.filter((s) => !s.esCalentamiento);
          const calent = p.series.length - trabajo.length;
          return (
            <li key={p.ejercicioRutinaId}>
              <a class="fila" href={`#/ejercicio/${p.ejercicioId}`}>
                <span class="num">{String(i + 1).padStart(2, "0")}</span>
                <div class="crece">
                  <div class="nombre">{e?.nombre}</div>
                  <div class="terciario">
                    {trabajo.length} × {rangoReps(p.repsMin, p.repsMax)} · {e ? MUSCULOS[e.musculoPrincipal] : ""}
                    {calent > 0 ? ` · +${calent} calentamiento` : ""}
                  </div>
                </div>
                <div class="peso-objetivo">
                  {p.pesoPorDefinir ? (
                    <small class="terciario">Primera vez</small>
                  ) : (
                    <>
                      <span class="cifra">{kg(trabajo[0]?.pesoKg ?? 0)}</span>
                      <small class={p.accion === "subir" ? "sube" : p.accion === "bajar" ? "baja" : "terciario"}>
                        {p.accion === "subir" ? "▲ sube" : p.accion === "bajar" ? "▼ baja" : "kg"}
                      </small>
                    </>
                  )}
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      {plan.length === 0 && <p class="vacio">Este día no tiene ejercicios. Añádelos en Rutinas.</p>}
    </div>
  );
}
