import { useEffect, useRef, useState } from "preact/hooks";
import { EQUIPO, MUSCULOS, obtenerEjercicio } from "../../datos/biblioteca";
import type { Ejercicio } from "../../datos/tipos";
import { Cabecera, Insignia } from "../componentes/comunes";
import { reduceMovimiento } from "../feedback";
import type { Comparacion, ModoCamara, VisorTecnica } from "../../visor/visor";

type EstadoVisor = "cargando" | "listo" | "sin-visor";

function Visor({ ejercicio, alIndicar }: { ejercicio: Ejercicio; alIndicar: (i: number | null) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const visor = useRef<VisorTecnica>();
  const [estado, setEstado] = useState<EstadoVisor>("cargando");
  const [indicacion, setIndicacion] = useState<{ texto: string; i: number } | null>(null);
  const [modo, setModo] = useState<ModoCamara>("guiada");
  const [comparacion, setComparacion] = useState<Comparacion>("ninguna");
  const total = ejercicio.tecnica.puntosClave.length;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      // Three.js se carga solo al abrir una ficha con modelo.
      const { VisorTecnica, hayWebGL } = await import("../../visor/visor");
      if (cancelado || !contenedor.current) return;
      if (!hayWebGL()) return setEstado("sin-visor");
      const v = new VisorTecnica(contenedor.current, ejercicio.tecnica, {
        reducirMovimiento: reduceMovimiento(),
        alIndicar: (texto, i) => {
          setIndicacion(texto !== null && i !== null ? { texto, i } : null);
          alIndicar(i);
        },
        alCambiarModo: setModo,
      });
      visor.current = v;
      try {
        await v.cargar();
        if (!cancelado) setEstado("listo");
      } catch {
        v.destruir();
        visor.current = undefined;
        if (!cancelado) setEstado("sin-visor");
      }
    })();
    return () => {
      cancelado = true;
      visor.current?.destruir();
      visor.current = undefined;
    };
  }, [ejercicio.id]);

  function comparar(c: Comparacion) {
    const nueva = comparacion === c ? "ninguna" : c;
    setComparacion(nueva);
    visor.current?.setComparacion(nueva === "ninguna" ? "ninguna" : nueva);
  }

  if (estado === "sin-visor") return null;

  return (
    <div class="visor" ref={contenedor}>
      {estado === "cargando" && <div class="cargando">Cargando figura…</div>}
      {comparacion === "error" && ejercicio.tecnica.descripcionError ? (
        <div class="indicacion error">
          <span class="paso-guia">Error común</span>
          {ejercicio.tecnica.descripcionError}
        </div>
      ) : (
        indicacion && (
          <div class="indicacion" aria-live="polite">
            <span class="paso-guia">
              <span>
                Punto {indicacion.i + 1} de {total}
              </span>
              <span class="puntos-guia" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <i key={i} class={i <= indicacion.i ? "hecho" : ""} />
                ))}
              </span>
            </span>
            {indicacion.texto}
          </div>
        )
      )}
      {estado === "listo" && (
        <div class="controles">
          {modo === "libre" ? (
            <button class="boton pequeno guia" onClick={() => visor.current?.iniciarGuia()}>
              ▶ Ver guía
            </button>
          ) : (
            <span />
          )}
          {ejercicio.tecnica.clipError && (
            <div class="fila-botones" style={{ flex: "none" }}>
              <button class="boton pequeno bien" aria-pressed={comparacion === "correcto"} onClick={() => comparar("correcto")}>
                Correcto
              </button>
              <button class="boton pequeno error" aria-pressed={comparacion === "error"} onClick={() => comparar("error")}>
                Error común
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Ficha({ id }: { id: string }) {
  const ejercicio = obtenerEjercicio(id);
  const [activo, setActivo] = useState<number | null>(null);
  if (!ejercicio) {
    return (
      <div class="pantalla">
        <Cabecera titulo="Ejercicio" atras="/biblioteca" />
        <p class="vacio">No encuentro ese ejercicio.</p>
      </div>
    );
  }
  const { evidencia, tecnica } = ejercicio;
  const conModelo = !!tecnica.modelo;

  return (
    <div class="pantalla">
      <Cabecera titulo={ejercicio.nombre} atras="/biblioteca" />
      <div class="ficha-sub">
        <span>{MUSCULOS[ejercicio.musculoPrincipal]}</span>
        {ejercicio.musculosSecundarios.map((m) => (
          <span key={m}>+ {MUSCULOS[m] ?? m}</span>
        ))}
        <span>{EQUIPO[ejercicio.equipo]}</span>
      </div>

      {conModelo && <Visor ejercicio={ejercicio} alIndicar={setActivo} />}

      <section class="tarjeta">
        <h2>Puntos clave</h2>
        <ol class="puntos">
          {tecnica.puntosClave.map((p, i) => (
            <li key={i} class={activo === i ? "activo" : ""}>
              {p.indicacion}
            </li>
          ))}
        </ol>
      </section>

      <section class="tarjeta">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <h2>Por qué está en tu rutina</h2>
          <Insignia nivel={evidencia.nivel} />
        </div>
        <p>{evidencia.resumen}</p>
        {evidencia.referencias.length > 0 ? (
          <ul class="referencias">
            {evidencia.referencias.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p class="terciario">Sin estudios directos de crecimiento muscular; se basa en el principio de cargar el músculo estirado.</p>
        )}
      </section>

      {ejercicio.sustitutos.length > 0 && (
        <section>
          <h3 class="seccion">Si la máquina está ocupada</h3>
          {ejercicio.sustitutos.map((sid) => {
            const s = obtenerEjercicio(sid);
            return s ? (
              <a key={sid} class="fila" href={`#/ejercicio/${sid}`}>
                <span class="crece">{s.nombre}</span>
                <Insignia nivel={s.evidencia.nivel} />
              </a>
            ) : null;
          })}
        </section>
      )}

      <a class="boton ancho" style={{ marginTop: "12px" }} href={`#/historial/${ejercicio.id}`}>
        Ver mi historial
      </a>
    </div>
  );
}
