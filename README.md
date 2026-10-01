# Gym

PWA personal de entrenamiento de fuerza: rutina del día con pesos ya calculados, registro de series con un toque, progresión automática y fichas de técnica con una figura 3D.

Funciona sin conexión y guarda todo en el navegador (IndexedDB). Se despliega como web estática en GitHub Pages.

## Rutina

Una sola rutina de **cuerpo completo**, la misma los **lunes, miércoles y viernes** (editable). 8 ejercicios × 3 series (≈70 min):

| # | Ejercicio | Series × reps | Descanso |
|---|---|---|---|
| 1 | Sentadilla profunda | 3 × 6–10 | 3 min |
| 2 | Press de banca | 3 × 6–10 | 3 min |
| 3 | Jalón al pecho | 3 × 8–12 | 2,5 min |
| 4 | Curl femoral sentado | 3 × 8–12 | 2 min |
| 5 | Extensión de tríceps por encima de la cabeza | 3 × 10–15 | 2 min |
| 6 | Curl predicador | 3 × 10–15 | 2 min |
| 7 | Elevación lateral en polea | 3 × 12–20 | 1,5 min |
| 8 | Elevación de talones con pausa | 3 × 10–15 | 1,5 min |

Por qué: cada músculo 3 veces por semana con 48 h de descanso (≥2 veces/semana supera a 1: Schoenfeld et al., 2016), 9 series directas por músculo y semana más las indirectas (≈10+, Schoenfeld et al., 2017; Pelland et al., 2026), descansos largos entre series (3 min > 1 min: Schoenfeld et al., 2016) y series a 1–3 repeticiones del fallo (Refalo et al., 2023). Las citas completas están en la pantalla «Rutina».

## Uso diario

1. **Hoy** muestra si toca entrenar o descansar, la semana y la sesión con series, reps y peso. «Empezar entreno».
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

- `public/modelos/maniqui.glb` se genera con `npm run modelo`: maniquí neutro con huesos de nombre tipo Mixamo (`mixamorigHips`, `mixamorigLeftLeg`…), los objetos del gimnasio (barra, mancuernas, bancos, poleas con cable, máquinas) y **un clip por cada uno de los 29 ejercicios**, más 4 errores comunes (sentadilla con rodillas hacia dentro, peso muerto rumano con la espalda redondeada, press de banca con los codos abiertos y curl con balanceo). No usa recursos de terceros.
- Cada ejercicio se define en `scripts/maniqui/ejercicios.mjs` con su pose en función del recorrido (cinemática inversa en `scripts/maniqui/kit.mjs`), los objetos que se ven, la vista general y los puntos clave de la guía. El script también escribe la ficha técnica en `src/datos/ejercicios.json`.
- La guía va despacio: la animación se ralentiza mientras explica cada punto (mínimo 4,5 s por punto) y la cámara se mueve suave.
- Sin modelo o sin WebGL, la ficha muestra los puntos clave en texto.
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
