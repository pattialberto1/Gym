// Service worker: precarga la app y los modelos 3D, y gestiona la acción "Hecha" de la notificación.
// Plantilla: el build rellena la versión y la lista de precarga (ver vite.config.ts).
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `gym-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((r) => new URL(r, self.registration.scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith("gym-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    // La app es una sola página: siempre index.html desde caché (funciona sin conexión).
    e.respondWith(
      caches.match(new URL("./", self.registration.scope).href).then((r) => r ?? fetch(req)),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (r) =>
        r ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener("notificationclick", (e) => {
  const hecha = e.action === "hecha";
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      const cliente = lista[0];
      if (cliente) {
        if (hecha) cliente.postMessage({ tipo: "serie-hecha" });
        else return cliente.focus();
        return;
      }
      const url = new URL(hecha ? "./#/entreno?hecha=1" : "./#/entreno", self.registration.scope).href;
      return self.clients.openWindow(url);
    }),
  );
});
