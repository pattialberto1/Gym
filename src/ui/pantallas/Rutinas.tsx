import { useEffect, useState } from "preact/hooks";
import { EVIDENCIA_RUTINA, MUSCULOS, PLANTILLAS, obtenerEjercicio } from "../../datos/biblioteca";
import { INICIAL_DIA, NOMBRES_DIA, diasDeEntreno, duracionEstimada, seriesSemanales } from "../../logica/semana";
import * as repo from "../../datos/repositorio";
import type { EjercicioDia, Rutina } from "../../datos/tipos";
import * as servicio from "../../logica/servicio";
import { Cabecera, Icono, Paso } from "../componentes/comunes";
import { ir, volver } from "../enrutador";
import { mmss, rangoReps } from "../formato";
import { Biblioteca } from "./Biblioteca";

export function Rutinas() {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [activa, setActiva] = useState<string>();

  async function cargar() {
    await servicio.asegurarDatosIniciales();
    setRutinas(await repo.listarRutinas());
    setActiva((await servicio.rutinaActiva())?.id);
  }
  useEffect(() => void cargar(), []);

  async function nueva() {
    const r: Rutina = { id: repo.nuevoId(), nombre: "Mi rutina", dias: [{ nombre: "Día 1", ejercicios: [] }] };
    await repo.guardarRutina(r);
    ir(`/rutina/${r.id}`);
  }

  async function desdePlantilla(p: Rutina) {
    await repo.guardarRutina({ ...structuredClone(p), id: repo.nuevoId() });
    await cargar();
  }

  const enUso = rutinas.find((r) => r.id === activa);
  const otras = rutinas.filter((r) => r.id !== activa);

  return (
    <div class="pantalla">
      <Cabecera titulo="Rutina" />
      {enUso && <ResumenRutina rutina={enUso} />}

      <section class="tarjeta">
        <h2>Por qué esta rutina</h2>
        <p class="secundario">La misma sesión de cuerpo completo cada día de entreno, con lo que dice la evidencia sobre crecimiento muscular:</p>
        {EVIDENCIA_RUTINA.map((x) => (
          <details key={x.titulo} class="evidencia">
            <summary>{x.titulo}</summary>
            <p class="secundario">{x.texto}</p>
            <ul class="referencias">
              {x.refs.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      {otras.length > 0 && <h3 class="seccion">Otras rutinas</h3>}
      <ul class="lista">
        {otras.map((r) => (
          <li key={r.id}>
            <div class="fila">
              <a class="crece" href={`#/rutina/${r.id}`} style={{ textDecoration: "none" }}>
                <div class="nombre">{r.nombre}</div>
                <div class="terciario">{textoDias(r)}</div>
              </a>
              <button
                class="boton pequeno"
                onClick={async () => {
                  await servicio.activarRutina(r.id);
                  setActiva(r.id);
                }}
              >
                Usar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div class="fila-botones" style={{ marginTop: "12px" }}>
        <button class="boton" onClick={nueva}>
          <Icono nombre="mas" /> Nueva rutina
        </button>
        {!rutinas.some((r) => r.nombre === PLANTILLAS[0].nombre) && (
          <button class="boton" onClick={() => desdePlantilla(PLANTILLAS[0])}>
            Rutina recomendada
          </button>
        )}
      </div>
    </div>
  );
}

function textoDias(r: Rutina): string {
  const dias = diasDeEntreno(r);
  return dias.length === 7 ? "Cualquier día" : dias.map((d) => NOMBRES_DIA[d]).join(", ");
}

function ResumenRutina({ rutina }: { rutina: Rutina }) {
  const dias = diasDeEntreno(rutina);
  const ejercicios = rutina.dias[0]?.ejercicios ?? [];
  const porSemana = rutina.dias.length === 1 ? dias.length : 1;
  const series = seriesSemanales(
    rutina.dias.flatMap((d) => d.ejercicios),
    porSemana,
    (id) => obtenerEjercicio(id)?.musculoPrincipal,
  );
  return (
    <div class="hero">
      <span class="etiqueta">En uso</span>
      <h1>{rutina.nombre}</h1>
      <div class="stats">
        <div>
          <span class="cifra">{dias.length === 7 ? "—" : dias.length}</span>
          <span class="terciario">días/semana</span>
        </div>
        <div>
          <span class="cifra">{ejercicios.length}</span>
          <span class="terciario">ejercicios</span>
        </div>
        <div>
          <span class="cifra">≈{duracionEstimada(ejercicios)}</span>
          <span class="terciario">min/sesión</span>
        </div>
      </div>
      <div class="dias-semana" aria-label="Días de entreno" style={{ marginBottom: "14px" }}>
        {INICIAL_DIA.map((d, i) => (
          <button key={i} disabled aria-pressed={dias.includes(i)} style={{ opacity: 1 }} aria-label={NOMBRES_DIA[i]}>
            {d}
          </button>
        ))}
      </div>
      {series.size > 0 && (
        <p class="terciario" style={{ margin: "0 0 14px" }}>
          Series por semana:{" "}
          {[...series.entries()].map(([m, n]) => `${MUSCULOS[m] ?? m} ${n}`).join(" · ")}
        </p>
      )}
      <a class="boton ancho" href={`#/rutina/${rutina.id}`}>
        Editar rutina
      </a>
    </div>
  );
}

export function EditarRutina({ id }: { id: string }) {
  const [rutina, setRutina] = useState<Rutina | null>();
  const [eligiendo, setEligiendo] = useState<number | null>(null);

  useEffect(() => {
    repo.obtenerRutina(id).then((r) => setRutina(r ?? null));
  }, [id]);

  async function cambiar(r: Rutina) {
    setRutina(r);
    await repo.guardarRutina(r);
  }

  if (rutina === undefined) return <div class="pantalla" />;
  if (rutina === null) {
    return (
      <div class="pantalla">
        <Cabecera titulo="Rutina" atras="/rutinas" />
        <p class="vacio">Esta rutina ya no existe.</p>
      </div>
    );
  }

  if (eligiendo !== null) {
    return (
      <Biblioteca
        alCancelar={() => setEligiendo(null)}
        alElegir={(ejercicioId) => {
          const dias = rutina.dias.map((d, i) =>
            i === eligiendo
              ? { ...d, ejercicios: [...d.ejercicios, { ejercicioId, series: 3, repsMin: 8, repsMax: 12, descansoSeg: 120 }] }
              : d,
          );
          void cambiar({ ...rutina, dias });
          setEligiendo(null);
        }}
      />
    );
  }

  const cambiarDia = (i: number, f: (ej: EjercicioDia[]) => EjercicioDia[], nombre?: string) =>
    cambiar({
      ...rutina,
      dias: rutina.dias.map((d, j) => (j === i ? { nombre: nombre ?? d.nombre, ejercicios: f(d.ejercicios) } : d)),
    });

  return (
    <div class="pantalla">
      <Cabecera titulo="Editar rutina" atras="/rutinas" />
      <label class="secundario" for="nombre-rutina">
        Nombre
      </label>
      <input
        id="nombre-rutina"
        class="campo"
        value={rutina.nombre}
        onChange={(e) => cambiar({ ...rutina, nombre: (e.target as HTMLInputElement).value || "Mi rutina" })}
      />

      <p class="secundario" style={{ margin: "16px 0 8px" }}>
        Días de entreno <span class="terciario">(deja al menos un día de descanso entre sesiones)</span>
      </p>
      <div class="dias-semana" role="group" aria-label="Días de entreno">
        {INICIAL_DIA.map((d, i) => {
          const dias = rutina.diasSemana ?? [];
          const activo = dias.includes(i);
          return (
            <button
              key={i}
              aria-pressed={activo}
              aria-label={NOMBRES_DIA[i]}
              onClick={() =>
                cambiar({ ...rutina, diasSemana: activo ? dias.filter((x) => x !== i) : [...dias, i].sort((a, b) => a - b) })
              }
            >
              {d}
            </button>
          );
        })}
      </div>

      {rutina.dias.map((dia, i) => (
        <section key={i} class="tarjeta" style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
            <input
              class="campo"
              aria-label="Nombre del día"
              value={dia.nombre}
              onChange={(e) => cambiarDia(i, (x) => x, (e.target as HTMLInputElement).value || `Día ${i + 1}`)}
            />
            <button
              class="atras"
              aria-label="Borrar día"
              onClick={() => {
                if (confirm(`¿Borrar el día «${dia.nombre}»?`)) cambiar({ ...rutina, dias: rutina.dias.filter((_, j) => j !== i) });
              }}
            >
              <Icono nombre="papelera" />
            </button>
          </div>

          {dia.ejercicios.map((ej, k) => {
            const e = obtenerEjercicio(ej.ejercicioId);
            const set = (cambios: Partial<EjercicioDia>) =>
              cambiarDia(i, (lista) => lista.map((x, n) => (n === k ? { ...x, ...cambios } : x)));
            const mover = (d: number) =>
              cambiarDia(i, (lista) => {
                const copia = [...lista];
                const [x] = copia.splice(k, 1);
                copia.splice(Math.max(0, Math.min(copia.length, k + d)), 0, x);
                return copia;
              });
            return (
              <div key={`${ej.ejercicioId}-${k}`} style={{ borderTop: "1px solid var(--borde)", padding: "12px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong class="crece" style={{ flex: 1 }}>
                    {e?.nombre ?? ej.ejercicioId}
                  </strong>
                  <button class="atras" aria-label="Subir" disabled={k === 0} onClick={() => mover(-1)}>
                    <Icono nombre="arriba" />
                  </button>
                  <button class="atras" aria-label="Bajar" disabled={k === dia.ejercicios.length - 1} onClick={() => mover(1)}>
                    <Icono nombre="abajo" />
                  </button>
                  <button class="atras" aria-label="Quitar ejercicio" onClick={() => cambiarDia(i, (l) => l.filter((_, n) => n !== k))}>
                    <Icono nombre="papelera" />
                  </button>
                </div>
                <div class="terciario" style={{ margin: "4px 0 8px" }}>
                  {ej.series} × {rangoReps(ej.repsMin, ej.repsMax)} · descanso {mmss(ej.descansoSeg)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 12px", alignItems: "center" }}>
                  <span class="secundario">Series</span>
                  <Paso etiqueta="series" valor={ej.series} min={1} max={10} alCambiar={(n) => set({ series: n })} />
                  <span class="secundario">Reps mín.</span>
                  <Paso
                    etiqueta="reps mínimas"
                    valor={ej.repsMin}
                    min={1}
                    max={50}
                    alCambiar={(n) => set({ repsMin: n, repsMax: Math.max(n, ej.repsMax) })}
                  />
                  <span class="secundario">Reps máx.</span>
                  <Paso
                    etiqueta="reps máximas"
                    valor={ej.repsMax}
                    min={1}
                    max={50}
                    alCambiar={(n) => set({ repsMax: n, repsMin: Math.min(n, ej.repsMin) })}
                  />
                  <span class="secundario">Descanso</span>
                  <Paso etiqueta="descanso" valor={ej.descansoSeg} min={15} max={600} paso={15} formato={mmss} alCambiar={(n) => set({ descansoSeg: n })} />
                </div>
              </div>
            );
          })}

          <button class="boton ancho" onClick={() => setEligiendo(i)}>
            <Icono nombre="mas" /> Añadir ejercicio
          </button>
        </section>
      ))}

      <button
        class="boton ancho"
        onClick={() => cambiar({ ...rutina, dias: [...rutina.dias, { nombre: `Día ${rutina.dias.length + 1}`, ejercicios: [] }] })}
      >
        <Icono nombre="mas" /> Añadir día
      </button>

      <div class="fila-botones" style={{ marginTop: "24px" }}>
        <button
          class="boton principal"
          onClick={async () => {
            await servicio.activarRutina(rutina.id);
            ir("/");
          }}
        >
          Usar esta rutina
        </button>
        <button
          class="boton peligro"
          onClick={async () => {
            if (!confirm(`¿Borrar la rutina «${rutina.nombre}»? Tu historial se conserva.`)) return;
            await repo.borrarRutina(rutina.id);
            volver("/rutinas");
          }}
        >
          Borrar rutina
        </button>
      </div>
    </div>
  );
}
