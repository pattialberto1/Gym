import { useState } from "preact/hooks";
import * as repo from "../../datos/repositorio";
import { Cabecera } from "../componentes/comunes";
import { notificacionesDisponibles, pedirPermisoNotificaciones } from "../feedback";

export function Ajustes() {
  const [mensaje, setMensaje] = useState("");
  const [permiso, setPermiso] = useState(notificacionesDisponibles() ? Notification.permission : "no-disponible");

  async function exportar() {
    const copia = await repo.exportarTodo();
    const blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gym-copia-${copia.fecha.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMensaje(`Copia descargada: ${copia.series.length} series, ${copia.rutinas.length} rutinas.`);
  }

  async function importar(e: Event) {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = "";
    if (!archivo) return;
    try {
      const datos = JSON.parse(await archivo.text());
      if (!repo.validarCopia(datos)) throw new Error("no válida");
      if (!confirm(`Esto sustituye todos tus datos por los de la copia del ${datos.fecha.slice(0, 10)}. ¿Seguir?`)) return;
      await repo.importarTodo(datos);
      setMensaje(`Copia restaurada: ${datos.series.length} series.`);
    } catch {
      setMensaje("Ese archivo no es una copia de seguridad de esta app.");
    }
  }

  return (
    <div class="pantalla">
      <Cabecera titulo="Ajustes" />

      <section class="tarjeta">
        <h2>Copia de seguridad</h2>
        <p class="secundario">Tus datos viven solo en este navegador. Guarda una copia de vez en cuando.</p>
        <div class="fila-botones">
          <button class="boton" onClick={exportar}>
            Exportar
          </button>
          <label class="boton">
            Importar
            <input type="file" accept="application/json,.json" class="sr" onChange={importar} />
          </label>
        </div>
        {mensaje && (
          <p class="secundario" role="status">
            {mensaje}
          </p>
        )}
      </section>

      <section class="tarjeta">
        <h2>Notificación del entreno</h2>
        <p class="secundario">
          Muestra la serie actual con un botón «Hecha» para marcarla sin abrir la app. Funciona bien en Android; en iPhone
          los botones de las notificaciones son limitados.
        </p>
        {permiso === "granted" ? (
          <p>Activada.</p>
        ) : permiso === "denied" ? (
          <p class="secundario">Bloqueada en el navegador. Actívala desde los ajustes del sitio.</p>
        ) : permiso === "no-disponible" ? (
          <p class="secundario">Este navegador no admite notificaciones.</p>
        ) : (
          <button class="boton" onClick={async () => setPermiso((await pedirPermisoNotificaciones()) ? "granted" : Notification.permission)}>
            Activar
          </button>
        )}
      </section>

      <section class="tarjeta">
        <h2>Cómo progresa el peso</h2>
        <p class="secundario">
          Doble progresión: si todas las series llegan al tope de reps, sube (+2,5 kg tren superior, +5 kg inferior, al salto
          de tu equipo). Si llegan al mínimo, mantiene para sumar reps. Dos sesiones por debajo del mínimo (o dos «no pude»)
          bajan un 5–10 %. Marcar «fácil» permite subir el doble; «no pude» frena la subida.
        </p>
      </section>

      <section class="tarjeta">
        <h2>Sobre la figura 3D</h2>
        <p class="secundario">
          El maniquí y sus animaciones se generan con código propio (scripts/generar-maniqui.mjs). El esqueleto usa nombres
          de hueso compatibles con Mixamo para poder cambiarlo por otro modelo más adelante.
        </p>
      </section>
    </div>
  );
}
