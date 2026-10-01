export function kg(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function mmss(seg: number): string {
  const s = Math.max(0, Math.ceil(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function rangoReps(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}
