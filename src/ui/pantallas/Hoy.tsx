import { useEffect, useState } from "preact/hooks";
import { obtenerEjercicio } from "../../datos/biblioteca";
import * as repo from "../../datos/repositorio";
import type { PlanEjercicio, Rutina, Sesion } from "../../datos/tipos";
import * as servicio from "../../logica/servicio";
import { Icono } from "../componentes/comunes";
import { ir } from "../enrutador";
import { kg, rangoReps } from "../formato";

const FLECHA: Record<string, string> = { subir: "↑", bajar: "↓" };

export function Hoy() {
  const [rutina, setRutina] = useState<Rutina>();
  const [dia, setDia] = useState(0);
  const [plan, setPlan] = useState<PlanEjercicio[]>([]);
  const [enCurso, setEnCurso] = useState<Sesion | null>(null);
  const [descarga, setDescarga] = useState<"propuesta" | "aceptada" | "no">("no");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      await servicio.asegurarDatosIniciales();
      setEnCurso((await repo.sesionEnCurso()) ?? null);
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

  if (enCurso) {
    const hechas = enCurso.plan.reduce((t, p) => t + p.series.filter((s) => s.registroId).length, 0);
    const total = enCurso.plan.reduce((t, p) => t + p.series.length, 0);
    return (
      <div class="pantalla">
        <header class="cabecera">
          <h1>Hoy</h1>
        </header>
        <div class="tarjeta">
          <h2>{enCurso.nombreDia}</h2>
          <p class="secundario">
            Entreno a medias: {hechas} de {total} series marcadas.
          </p>
          <a class="boton principal ancho" href="#/entreno">
            Seguir entreno
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

  return (
    <div class="pantalla">
      <header class="cabecera">
        <h1>{diaActual?.nombre ?? "Hoy"}</h1>
        <a class="terciario" href="#/rutinas">
          {rutina.nombre}
        </a>
      </header>

      {rutina.dias.length > 1 && (
        <div class="chips" role="group" aria-label="Día de la rutina">
          {rutina.dias.map((d, i) => (
            <button key={i} class="chip" aria-pressed={i === dia} onClick={() => setDia(i)}>
              {d.nombre}
            </button>
          ))}
        </div>
      )}

      {descarga !== "no" && (
        <div class="tarjeta aviso" style={{ marginTop: "12px" }}>
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

      <ul class="lista" style={{ marginTop: "16px" }}>
        {plan.map((p) => {
          const e = obtenerEjercicio(p.ejercicioId);
          const trabajo = p.series.filter((s) => !s.esCalentamiento);
          const calent = p.series.length - trabajo.length;
          const accion = p.accion;
          return (
            <li key={p.ejercicioRutinaId}>
              <a class="fila" href={`#/ejercicio/${p.ejercicioId}`}>
                <div class="crece">
                  <div>{e?.nombre}</div>
                  <div class="secundario">
                    {trabajo.length} × {rangoReps(p.repsMin, p.repsMax)} reps
                    {calent > 0 ? ` · ${calent} de calentamiento` : ""}
                  </div>
                  {(accion === "subir" || accion === "bajar") && <div class="terciario">{p.motivo}</div>}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {p.pesoPorDefinir ? (
                    <span class="terciario">Primera vez</span>
                  ) : (
                    <strong style={{ fontSize: "1.25rem" }}>
                      {FLECHA[accion] ?? ""} {kg(trabajo[0]?.pesoKg ?? 0)} kg
                    </strong>
                  )}
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      {plan.length === 0 && <p class="vacio">Este día no tiene ejercicios. Añádelos en Rutinas.</p>}

      <div style={{ position: "sticky", bottom: "calc(76px + var(--inferior))", marginTop: "16px" }}>
        <button class="marcar" style={{ width: "100%" }} disabled={plan.length === 0} onClick={empezar}>
          <Icono nombre="check" /> Empezar entreno
        </button>
      </div>
    </div>
  );
}
