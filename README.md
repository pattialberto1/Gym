# Gym

PWA personal de entrenamiento de fuerza: rutina del día con pesos ya calculados, registro de series con un toque, progresión automática y fichas de técnica con una figura 3D.

Funciona sin conexión y guarda todo en el navegador (IndexedDB). Se despliega como web estática en GitHub Pages.

## Uso diario

1. **Hoy** muestra el día que toca, con series, reps y peso. «Empezar entreno».
2. Cada serie aparece prellenada. Si la hiciste tal cual: **un toque en «Marcar serie»**. Eso guarda, arranca el descanso y deja lista la siguiente.
3. Si fue distinta: − / + (o desliza el número arriba/abajo) y marca. Cambiar el peso de una serie lo cambia en las siguientes.
4. Al acabar un ejercicio aparece una pregunta opcional: fácil / justo / no pude.
5. La primera vez con un ejercicio ajustas el peso; a partir de ahí lo calcula la app.

Extras: «Ocupada» cambia el ejercicio por un sustituto (con su propio historial), calentamiento automático antes del primer ejercicio con carga, aviso de récords, notificación con botón «Hecha» (Android), dictado por voz («doce con sesenta»), propuesta de descarga cuando te estancas, copia de seguridad en JSON.

## Progresión (doble progresión)

Evalúa la última sesión del ejercicio (sin calentamientos ni descargas):

- Todas las series al tope de reps → sube 2,5 kg (tren superior) o 5 kg (inferior), redondeado al salto del equipo. «Fácil» → sube el doble. «No pude» → no sube.
- Todas al menos en el mínimo → mismo peso, se busca una rep más por serie.
- Dos sesiones seguidas por debajo del mínimo, o dos «no pude» → baja un 5–10 %.
- Tres o más ejercicios con 3 sesiones sin progresar → propone una sesión al 60 % del peso y la mitad de series.

Lógica pura en `src/logica/progresion.ts`, con tests en `tests/progresion.test.ts`.

## Biblioteca y evidencia

`src/datos/ejercicios.json`. Criterio: crecimiento muscular medido (ecografía o resonancia en estudios de varias semanas), no activación EMG. Niveles: `fuerte`, `moderada`, `principio`. Todas las referencias se han comprobado (autores, año, conclusión); donde la evidencia no respaldaba el nivel propuesto se ha bajado (por ejemplo, el curl inclinado pasa a `principio` porque en Zabaleta-Korta et al., 2023 creció menos que el predicador).

## Figura 3D

- `public/modelos/maniqui.glb` se genera con `npm run modelo` (`scripts/generar-maniqui.mjs`): maniquí neutro con huesos de nombre tipo Mixamo (`mixamorigHips`, `mixamorigLeftLeg`…) y los clips `sentadilla` y `sentadilla-valgo`. No usa recursos de terceros.
- Para añadir un ejercicio: un clip nuevo sobre el mismo esqueleto (puede venir de Mixamo; revisa sus condiciones antes de publicarlo), y en la ficha `modelo`, `clipCorrecto`, opcionalmente `clipError` + `huesosError`, y `puntosClave` con hueso, momento del bucle, distancia y ángulo de cámara.
- Sin modelo, la ficha muestra los puntos clave en texto.
- Con `prefers-reduced-motion` la cámara salta entre puntos en lugar de interpolar.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm test           # tests unitarios (progresión, plan, repositorio, voz, flujo de entreno)
npm run build      # build en dist/ + service worker con precarga
```

Estructura:

- `src/datos/` tipos, biblioteca, esquema Dexie y `repositorio.ts` (único acceso al almacenamiento; aquí iría una futura sincronización).
- `src/logica/` progresión, plan de sesión, dictado por voz (puros) y `servicio.ts` (orquesta repositorio + lógica).
- `src/visor/` visor Three.js con cámara guiada.
- `src/ui/` pantallas Preact.
- `src/sw.js` plantilla del service worker; `vite.config.ts` la rellena con la lista de archivos del build.

## Despliegue

`.github/workflows/pages.yml` prueba, construye y publica `dist/` en GitHub Pages al hacer push a `main`. En el repositorio: Settings → Pages → Source: «GitHub Actions».
