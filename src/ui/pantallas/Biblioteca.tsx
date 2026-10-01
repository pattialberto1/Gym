import { useState } from "preact/hooks";
import { EQUIPO, MUSCULOS, ejerciciosPorMusculo, musculosConEjercicios } from "../../datos/biblioteca";
import { Cabecera, Insignia } from "../componentes/comunes";

/**
 * Biblioteca por músculo, ordenada por nivel de evidencia.
 * Con `alElegir` funciona como selector al montar una rutina.
 */
export function Biblioteca({ alElegir, alCancelar }: { alElegir?: (id: string) => void; alCancelar?: () => void }) {
  const musculos = musculosConEjercicios();
  const [musculo, setMusculo] = useState(musculos[0]);
  const lista = ejerciciosPorMusculo(musculo);

  return (
    <div class="pantalla">
      {alElegir ? (
        <header class="cabecera">
          <button class="atras" aria-label="Cancelar" onClick={alCancelar}>
            ←
          </button>
          <h1>Añadir ejercicio</h1>
        </header>
      ) : (
        <Cabecera titulo="Biblioteca" />
      )}
      <p class="secundario" style={{ marginTop: "-8px" }}>
        Ordenados por evidencia de crecimiento muscular medido (ecografía o resonancia), no por activación.
      </p>
      <div class="chips" role="group" aria-label="Músculo">
        {musculos.map((m) => (
          <button key={m} class="chip" aria-pressed={m === musculo} onClick={() => setMusculo(m)}>
            {MUSCULOS[m]}
          </button>
        ))}
      </div>
      <ul class="lista" style={{ marginTop: "12px" }}>
        {lista.map((e) => {
          const contenido = (
            <>
              <div class="crece">
                <div>{e.nombre}</div>
                <div class="terciario">
                  {EQUIPO[e.equipo]}
                  {e.musculoPrincipal !== musculo ? ` · secundario` : ""}
                </div>
                <div class="secundario" style={{ marginTop: "4px" }}>
                  {e.evidencia.resumen}
                </div>
              </div>
              <Insignia nivel={e.evidencia.nivel} />
            </>
          );
          return (
            <li key={e.id}>
              {alElegir ? (
                <button class="fila" onClick={() => alElegir(e.id)}>
                  {contenido}
                </button>
              ) : (
                <a class="fila" href={`#/ejercicio/${e.id}`}>
                  {contenido}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
