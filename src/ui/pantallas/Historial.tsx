import { useEffect, useState } from "preact/hooks";
import { obtenerEjercicio } from "../../datos/biblioteca";
import * as repo from "../../datos/repositorio";
import { pesoDeSesion, type SesionHistorial } from "../../logica/progresion";
import { Cabecera } from "../componentes/comunes";
import { Grafica, type Punto } from "../componentes/Grafica";
import { fechaCorta, kg } from "../formato";

export function Historial() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [ultimos, setUltimos] = useState<Record<string, SesionHistorial | undefined>>({});

  useEffect(() => {
    (async () => {
      const lista = await repo.ejerciciosConHistorial();
      const datos: Record<string, SesionHistorial | undefined> = {};
      for (const id of lista) datos[id] = (await repo.historialEjercicio(id)).at(-1);
      setUltimos(datos);
      setIds(lista.sort((a, b) => (datos[b]?.fecha ?? "").localeCompare(datos[a]?.fecha ?? "")));
    })();
  }, []);

  return (
    <div class="pantalla">
      <Cabecera titulo="Historial" />
      {ids?.length === 0 && <p class="vacio">Aquí verás tu progreso cuando marques tus primeras series.</p>}
      <ul class="lista">
        {ids?.map((id) => {
          const u = ultimos[id];
          return (
            <li key={id}>
              <a class="fila" href={`#/historial/${id}`}>
                <div class="crece">
                  <div>{obtenerEjercicio(id)?.nombre ?? id}</div>
                  {u && <div class="terciario">Última vez {fechaCorta(u.fecha)}</div>}
                </div>
                {u && (
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                    {kg(pesoDeSesion(u))} kg × {Math.max(...u.series.map((s) => s.reps))}
                  </strong>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const DIFICULTAD: Record<string, string> = { facil: "Fácil", justo: "Justo", "no-pude": "No pude" };

export function HistorialEjercicio({ id }: { id: string }) {
  const [historial, setHistorial] = useState<SesionHistorial[] | null>(null);
  useEffect(() => {
    repo.historialEjercicio(id).then(setHistorial);
  }, [id]);
  const e = obtenerEjercicio(id);
  if (!historial) return <div class="pantalla" />;

  // Récord de peso: la primera sesión en alcanzar un máximo nuevo.
  let tope = -Infinity;
  const peso: Punto[] = historial.map((s, i) => {
    const v = pesoDeSesion(s);
    const destacado = i > 0 && v > tope;
    tope = Math.max(tope, v);
    return { etiqueta: fechaCorta(s.fecha), valor: v, destacado };
  });
  const reps: Punto[] = historial.map((s) => {
    const p = pesoDeSesion(s);
    return { etiqueta: fechaCorta(s.fecha), valor: s.series.filter((x) => x.pesoKg === p).reduce((t, x) => t + x.reps, 0) };
  });

  return (
    <div class="pantalla">
      <Cabecera titulo={e?.nombre ?? "Historial"} atras="/historial" />
      {historial.length === 0 ? (
        <p class="vacio">Todavía no hay series de este ejercicio.</p>
      ) : (
        <>
          <div class="tarjeta">
            <Grafica titulo="Peso de trabajo (kg)" puntos={peso} formato={kg} />
            <p class="terciario" style={{ margin: "6px 0 0" }}>
              Los puntos amarillos son marcas personales de peso.
            </p>
          </div>
          <div class="tarjeta">
            <Grafica titulo="Reps totales con ese peso" puntos={reps} formato={(n) => kg(Math.round(n))} />
          </div>
          <h3 class="seccion">Sesiones</h3>
          <div class="tarjeta" style={{ padding: "8px 12px" }}>
            <table class="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Series (kg × reps)</th>
                  <th>Sensación</th>
                </tr>
              </thead>
              <tbody>
                {[...historial].reverse().map((s) => (
                  <tr key={s.fecha}>
                    <td>{fechaCorta(s.fecha)}</td>
                    <td>{s.series.map((x) => `${kg(x.pesoKg)}×${x.reps}`).join("  ")}</td>
                    <td class="secundario">{s.dificultad ? DIFICULTAD[s.dificultad] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <a class="boton ancho" style={{ marginTop: "12px" }} href={`#/ejercicio/${id}`}>
        Ver técnica
      </a>
    </div>
  );
}
