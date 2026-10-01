import { Icono } from "./componentes/comunes";
import { useRuta } from "./enrutador";
import { Ajustes } from "./pantallas/Ajustes";
import { Biblioteca } from "./pantallas/Biblioteca";
import { Entreno } from "./pantallas/Entreno";
import { Ficha } from "./pantallas/Ficha";
import { Historial, HistorialEjercicio } from "./pantallas/Historial";
import { Hoy } from "./pantallas/Hoy";
import { EditarRutina, Rutinas } from "./pantallas/Rutinas";

const SECCIONES = [
  { ruta: "", texto: "Hoy", icono: "hoy" },
  { ruta: "rutinas", texto: "Rutina", icono: "rutinas" },
  { ruta: "biblioteca", texto: "Ejercicios", icono: "biblioteca" },
  { ruta: "historial", texto: "Historial", icono: "historial" },
  { ruta: "ajustes", texto: "Ajustes", icono: "ajustes" },
];

export function App() {
  const { partes, query } = useRuta();
  const [seccion = "", param] = partes;

  // El entreno ocupa toda la pantalla: sin barra de navegación.
  if (seccion === "entreno") return <Entreno hechaDesdeNotificacion={query.get("hecha") === "1"} />;

  let pantalla;
  switch (seccion) {
    case "rutinas":
      pantalla = <Rutinas />;
      break;
    case "rutina":
      pantalla = <EditarRutina id={param} />;
      break;
    case "biblioteca":
      pantalla = <Biblioteca />;
      break;
    case "ejercicio":
      pantalla = <Ficha id={param} />;
      break;
    case "historial":
      pantalla = param ? <HistorialEjercicio id={param} /> : <Historial />;
      break;
    case "ajustes":
      pantalla = <Ajustes />;
      break;
    default:
      pantalla = <Hoy />;
  }

  const activa = seccion === "rutina" ? "rutinas" : seccion === "ejercicio" ? "biblioteca" : seccion;
  return (
    <>
      <main key={partes.join("/")}>{pantalla}</main>
      <nav class="navegacion" aria-label="Secciones">
        {SECCIONES.map((s) => (
          <a key={s.ruta} href={`#/${s.ruta}`} aria-current={activa === s.ruta ? "page" : undefined}>
            <Icono nombre={s.icono} />
            {s.texto}
          </a>
        ))}
      </nav>
    </>
  );
}
