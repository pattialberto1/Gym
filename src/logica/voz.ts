// Interpreta frases dictadas como "doce con sesenta" → 12 reps con 60 kg. Módulo puro.

const VALORES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2");
}

/** Convierte una expresión numérica en español (o en cifras) a número. */
export function textoANumero(texto: string): number | null {
  const tokens = normalizar(texto).split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let hay = false;
  let decimal = false;
  for (const t of tokens) {
    if (/^\d+(\.\d+)?$/.test(t)) {
      total = decimal ? total + Number(`0.${t}`) : total + Number(t);
      hay = true;
      decimal = false;
    } else if (t === "medio" || t === "media") {
      total += 0.5;
      hay = true;
    } else if (t === "coma" || t === "punto") {
      decimal = true;
    } else if (t in VALORES) {
      const v = VALORES[t];
      total = decimal ? total + v / (v < 10 ? 10 : 100) : total + v;
      hay = true;
      decimal = false;
    }
    // "y", "kilos", "repeticiones"… se ignoran
  }
  return hay ? Math.round(total * 100) / 100 : null;
}

export interface Dictado {
  reps?: number;
  pesoKg?: number;
}

export function interpretarDictado(texto: string): Dictado | null {
  const t = normalizar(texto);
  const partes = t.split(/\s+con\s+/);
  if (partes.length >= 2) {
    const reps = textoANumero(partes[0]);
    const peso = textoANumero(partes[1]);
    if (reps === null && peso === null) return null;
    return {
      ...(reps !== null ? { reps: Math.round(reps) } : {}),
      ...(peso !== null ? { pesoKg: peso } : {}),
    };
  }
  const n = textoANumero(t);
  if (n === null) return null;
  if (/kilo|kg/.test(t)) return { pesoKg: n };
  return { reps: Math.round(n) };
}
