import { render } from "preact";
import "./estilos/app.css";
import { App } from "./ui/App";

render(<App />, document.getElementById("app")!);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {
      /* sin service worker la app sigue funcionando, solo sin modo offline */
    });
  });
}

// Pide almacenamiento persistente para que el navegador no borre el historial.
navigator.storage?.persist?.().catch(() => {});
