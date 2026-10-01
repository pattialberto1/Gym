// Número grande que se ajusta con − / + (mantener para repetir) o deslizando el dedo arriba/abajo.
import { useRef, useState } from "preact/hooks";
import { useMantener } from "./comunes";

const PIXELES_POR_PASO = 22;

export function Ajustador({
  valor,
  paso,
  min = 0,
  unidad,
  etiqueta,
  formato,
  alCambiar,
}: {
  valor: number;
  paso: number;
  min?: number;
  unidad: string;
  etiqueta: string;
  formato: (n: number) => string;
  alCambiar: (n: number) => void;
}) {
  const ajustar = (n: number) => alCambiar(Math.max(min, Math.round(n * 1000) / 1000));
  const menos = useMantener(() => ajustar(valorRef.current - paso));
  const mas = useMantener(() => ajustar(valorRef.current + paso));
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const arrastre = useRef<{ y: number; base: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  return (
    <div class="ajustador" role="group" aria-label={etiqueta}>
      <button type="button" aria-label={`Menos ${etiqueta}`} {...menos}>
        −
      </button>
      <div
        class={`valor ${arrastrando ? "arrastrando" : ""}`}
        role="spinbutton"
        aria-label={etiqueta}
        aria-valuenow={valor}
        aria-valuetext={`${formato(valor)} ${unidad}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") ajustar(valor + paso);
          if (e.key === "ArrowDown") ajustar(valor - paso);
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          arrastre.current = { y: e.clientY, base: valor };
          setArrastrando(true);
        }}
        onPointerMove={(e) => {
          const a = arrastre.current;
          if (!a) return;
          const pasos = Math.trunc((a.y - e.clientY) / PIXELES_POR_PASO);
          const nuevo = Math.max(min, a.base + pasos * paso);
          if (nuevo !== valorRef.current) {
            ajustar(nuevo);
            navigator.vibrate?.(5);
          }
        }}
        onPointerUp={() => {
          arrastre.current = null;
          setArrastrando(false);
        }}
        onPointerCancel={() => {
          arrastre.current = null;
          setArrastrando(false);
        }}
      >
        <span class="numero">{formato(valor)}</span>
        <span class="unidad">{unidad}</span>
      </div>
      <button type="button" aria-label={`Más ${etiqueta}`} {...mas}>
        +
      </button>
    </div>
  );
}
