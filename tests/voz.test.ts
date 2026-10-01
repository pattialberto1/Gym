import { describe, expect, it } from "vitest";
import { interpretarDictado, textoANumero } from "../src/logica/voz";

describe("textoANumero", () => {
  it.each([
    ["doce", 12],
    ["sesenta", 60],
    ["sesenta y dos", 62],
    ["sesenta y dos y medio", 62.5],
    ["ciento veinte", 120],
    ["veintidós", 22],
    ["62,5", 62.5],
    ["sesenta coma cinco", 60.5],
    ["cien", 100],
  ])("%s → %d", (texto, n) => {
    expect(textoANumero(texto)).toBe(n);
  });

  it("sin números devuelve null", () => {
    expect(textoANumero("hola")).toBeNull();
  });
});

describe("interpretarDictado", () => {
  it("reps con peso", () => {
    expect(interpretarDictado("doce con sesenta")).toEqual({ reps: 12, pesoKg: 60 });
    expect(interpretarDictado("8 con 62,5")).toEqual({ reps: 8, pesoKg: 62.5 });
    expect(interpretarDictado("diez con ciento dos y medio")).toEqual({ reps: 10, pesoKg: 102.5 });
  });

  it("solo reps", () => {
    expect(interpretarDictado("nueve")).toEqual({ reps: 9 });
    expect(interpretarDictado("once repeticiones")).toEqual({ reps: 11 });
  });

  it("solo peso", () => {
    expect(interpretarDictado("setenta kilos")).toEqual({ pesoKg: 70 });
  });

  it("nada reconocible", () => {
    expect(interpretarDictado("qué tal")).toBeNull();
  });
});
