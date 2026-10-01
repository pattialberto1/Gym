// Esquema de IndexedDB (Dexie). Solo el repositorio debe importar este módulo.
import Dexie, { type Table } from "dexie";
import type { Ajuste, RegistroEjercicio, RegistroSerie, Rutina, Sesion } from "./tipos";

export class BaseDatos extends Dexie {
  rutinas!: Table<Rutina, string>;
  sesiones!: Table<Sesion, string>;
  series!: Table<RegistroSerie, string>;
  registrosEjercicio!: Table<RegistroEjercicio, [string, string]>;
  ajustes!: Table<Ajuste, string>;

  constructor(nombre = "gym") {
    super(nombre);
    this.version(1).stores({
      rutinas: "id",
      sesiones: "id, fecha",
      series: "id, sesionId, ejercicioId, fecha",
      registrosEjercicio: "[sesionId+ejercicioId], ejercicioId",
      ajustes: "clave",
    });
  }
}
