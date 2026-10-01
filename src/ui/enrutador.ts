// Enrutado por hash (funciona en GitHub Pages sin configuración de servidor).
import { useEffect, useState } from "preact/hooks";

export interface Ruta {
  partes: string[];
  query: URLSearchParams;
}

function leer(): Ruta {
  const [camino, q = ""] = location.hash.replace(/^#\/?/, "").split("?");
  return { partes: camino.split("/").filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const alCambiar = () => {
      setRuta(leer());
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", alCambiar);
    return () => removeEventListener("hashchange", alCambiar);
  }, []);
  return ruta;
}

export function ir(ruta: string, reemplazar = false): void {
  const hash = "#" + ruta;
  if (reemplazar) history.replaceState(null, "", hash);
  else history.pushState(null, "", hash);
  dispatchEvent(new HashChangeEvent("hashchange"));
}

export function volver(porDefecto = "/"): void {
  if (history.length > 1) history.back();
  else ir(porDefecto, true);
}
