import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import preact from "@preact/preset-vite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Genera dist/sw.js con la lista de todos los archivos del build (app + modelos 3D). */
function serviceWorker(): Plugin {
  let salida = "dist";
  return {
    name: "gym-service-worker",
    apply: "build",
    configResolved(c) {
      salida = c.build.outDir;
    },
    closeBundle() {
      const archivos: string[] = [];
      const recorrer = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const ruta = join(dir, f);
          if (statSync(ruta).isDirectory()) recorrer(ruta);
          else archivos.push(relative(salida, ruta).split(sep).join("/"));
        }
      };
      recorrer(salida);
      const precache = ["./", ...archivos.filter((f) => f !== "sw.js" && !f.endsWith(".map"))];
      const hash = createHash("sha256");
      for (const f of precache.slice(1)) hash.update(f).update(readFileSync(join(salida, f)));
      const plantilla = readFileSync("src/sw.js", "utf8");
      writeFileSync(
        join(salida, "sw.js"),
        plantilla
          .replace("__VERSION__", hash.digest("hex").slice(0, 12))
          .replace("__PRECACHE__", JSON.stringify(precache, null, 2)),
      );
    },
  };
}

export default defineConfig({
  // Rutas relativas: funciona en https://usuario.github.io/<repo>/ sin configurar el nombre.
  base: "./",
  plugins: [preact(), serviceWorker()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
