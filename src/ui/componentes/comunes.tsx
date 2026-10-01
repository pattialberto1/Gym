import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ETIQUETA_EVIDENCIA } from "../../datos/biblioteca";
import type { NivelEvidencia } from "../../datos/tipos";
import { volver } from "../enrutador";

const TRAZOS: Record<string, string> = {
  hoy: "M4 10h16M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M4 10v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M8 2v4M16 2v4",
  rutinas: "M4 6h16M4 12h16M4 18h10",
  biblioteca: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8-1 3.2 15.5-3.8 1z",
  historial: "M4 19V5M4 19h16M8 15l3-4 3 2 5-6",
  ajustes: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.5.3-2-3-1-1 1.8h-2L9 2.7l-3 1 .3 2L5 7.2 3 7l-1 3 2 1v2l-2 1 1 3 2-.2 1.3 1.5-.3 2 3 1 1-1.8h2l1 1.8 3-1-.3-2 1.3-1.5 2 .2 1-3-2-1z",
  check: "M4 12.5l5 5L20 6.5",
  cambiar: "M7 7h11l-3-3M17 17H6l3 3",
  tecnica: "M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 21l2-7-3-3 5-3 5 3-3 3 2 7",
  microfono: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  cerrar: "M6 6l12 12M18 6L6 18",
  mas: "M12 5v14M5 12h14",
  arriba: "M12 19V5M6 11l6-6 6 6",
  abajo: "M12 5v14M6 13l6 6 6-6",
  papelera: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
};

export function Icono({ nombre, class: clase = "icono" }: { nombre: keyof typeof TRAZOS | string; class?: string }) {
  return (
    <svg class={clase} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}

export function Insignia({ nivel }: { nivel: NivelEvidencia }) {
  return <span class={`insignia ${nivel}`}>{ETIQUETA_EVIDENCIA[nivel]}</span>;
}

export function Cabecera({ titulo, atras, children }: { titulo: string; atras?: string; children?: ComponentChildren }) {
  return (
    <header class="cabecera">
      {atras !== undefined && (
        <button class="atras" aria-label="Volver" onClick={() => volver(atras)}>
          ←
        </button>
      )}
      <h1>{titulo}</h1>
      {children}
    </header>
  );
}

/** Repite la acción mientras se mantiene pulsado (útil para fijar el peso la primera vez). */
export function useMantener(accion: () => void) {
  const ref = useRef(accion);
  ref.current = accion;
  const temporizador = useRef<number>();
  const parar = () => {
    clearTimeout(temporizador.current);
    clearInterval(temporizador.current);
  };
  useEffect(() => parar, []);
  return {
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      ref.current();
      parar();
      temporizador.current = window.setTimeout(() => {
        temporizador.current = window.setInterval(() => ref.current(), 90);
      }, 420);
    },
    onPointerUp: parar,
    onPointerLeave: parar,
    onPointerCancel: parar,
    onContextMenu: (e: Event) => e.preventDefault(),
  };
}

/** Control pequeño − valor + para formularios (rutinas). */
export function Paso({
  valor,
  alCambiar,
  min = 0,
  max = 999,
  paso = 1,
  etiqueta,
  formato = (n: number) => String(n),
}: {
  valor: number;
  alCambiar: (n: number) => void;
  min?: number;
  max?: number;
  paso?: number;
  etiqueta: string;
  formato?: (n: number) => string;
}) {
  const menos = useMantener(() => alCambiar(Math.max(min, valor - paso)));
  const mas = useMantener(() => alCambiar(Math.min(max, valor + paso)));
  return (
    <div class="paso" role="group" aria-label={etiqueta}>
      <button type="button" aria-label={`Menos ${etiqueta}`} {...menos}>
        −
      </button>
      <output aria-live="polite">{formato(valor)}</output>
      <button type="button" aria-label={`Más ${etiqueta}`} {...mas}>
        +
      </button>
    </div>
  );
}

export interface Aviso {
  texto: string;
  accion?: { texto: string; hacer: () => void };
  tipo?: "record";
}

export function Toast({ aviso, alCerrar }: { aviso: Aviso | null; alCerrar: () => void }) {
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(alCerrar, aviso.accion ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [aviso]);
  if (!aviso) return null;
  return (
    <div class={`toast ${aviso.tipo ?? ""}`} role="status">
      <span>{aviso.texto}</span>
      {aviso.accion && (
        <button
          onClick={() => {
            aviso.accion!.hacer();
            alCerrar();
          }}
        >
          {aviso.accion.texto}
        </button>
      )}
    </div>
  );
}
