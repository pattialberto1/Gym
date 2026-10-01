// Gráfica de línea simple (una serie, un eje) con cruceta y valor al tocar.
// Peso y reps van en gráficas separadas: nunca dos escalas en el mismo eje.
import { useState } from "preact/hooks";

export interface Punto {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
}

const AN = 340;
const AL = 150;
const M = { izq: 36, der: 12, arr: 14, aba: 24 };

export function Grafica({
  titulo,
  puntos,
  formato,
  color = "var(--acento)",
}: {
  titulo: string;
  puntos: Punto[];
  formato: (n: number) => string;
  color?: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  if (puntos.length === 0) return null;

  const valores = puntos.map((p) => p.valor);
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const margen = (max - min) * 0.1;
  min = Math.max(0, min - margen);
  max += margen;
  const ancho = AN - M.izq - M.der;
  const alto = AL - M.arr - M.aba;
  const x = (i: number) => M.izq + (puntos.length === 1 ? ancho / 2 : (i / (puntos.length - 1)) * ancho);
  const y = (v: number) => M.arr + alto - ((v - min) / (max - min)) * alto;
  const d = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const marcas = [min, (min + max) / 2, max];
  const sel = activo ?? puntos.length - 1;

  function alMover(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * AN;
    let mejor = 0;
    puntos.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(mejor) - px)) mejor = i;
    });
    setActivo(mejor);
  }

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span class="secundario">{titulo}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          <strong>{formato(puntos[sel].valor)}</strong> <span class="terciario">{puntos[sel].etiqueta}</span>
        </span>
      </figcaption>
      <svg
        class="grafica"
        viewBox={`0 0 ${AN} ${AL}`}
        role="img"
        aria-label={`${titulo}: de ${formato(puntos[0].valor)} a ${formato(puntos.at(-1)!.valor)}`}
        onPointerMove={alMover}
        onPointerDown={alMover}
        onPointerLeave={() => setActivo(null)}
        style={{ touchAction: "pan-y" }}
      >
        {marcas.map((m) => (
          <g key={m}>
            <line class="eje" x1={M.izq} x2={AN - M.der} y1={y(m)} y2={y(m)} stroke-width="1" />
            <text x={M.izq - 6} y={y(m) + 4} text-anchor="end">
              {formato(Math.round(m * 10) / 10)}
            </text>
          </g>
        ))}
        <text x={M.izq} y={AL - 6}>
          {puntos[0].etiqueta}
        </text>
        {puntos.length > 1 && (
          <text x={AN - M.der} y={AL - 6} text-anchor="end">
            {puntos.at(-1)!.etiqueta}
          </text>
        )}
        <line class="eje" x1={x(sel)} x2={x(sel)} y1={M.arr} y2={M.arr + alto} stroke-dasharray="3 3" />
        <path d={d} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {puntos.map((p, i) =>
          p.destacado || i === sel ? (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.valor)}
              r={i === sel ? 5 : 4}
              fill={p.destacado ? "var(--aviso)" : color}
              stroke="var(--superficie)"
              stroke-width="2"
            />
          ) : null,
        )}
      </svg>
    </figure>
  );
}
