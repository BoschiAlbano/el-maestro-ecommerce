// Service worker mínimo, escrito a mano (sin Workbox/Serwist).
//
// Por qué a mano: Next.js 16 usa Turbopack por defecto (dev y build), y el
// adaptador de Serwist para Turbopack es, según su propio código fuente, un
// "workaround" mientras Turbopack no soporta plugins — agrega esbuild/esbuild-wasm
// y una ruta dinámica solo para servir el service worker. El alcance real que
// pide la spec 001 es modesto ("PWA instalable... sin modo offline"), así que
// no vale la pena esa complejidad todavía. Ver specs/001-base-del-proyecto/plan.md.
//
// Qué hace: cachea el shell de navegación y los assets estáticos de /_next/static
// a medida que se piden (no hay precache con lista de hashes, porque eso es
// justamente lo que resuelve Workbox/Serwist). No hay soporte offline real.
// Cuando exista el catálogo (spec 004) se revisa una estrategia específica para esos datos.

const CACHE_NAME = "importadora-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegación (HTML): red primero, cae a la última versión cacheada si no hay conexión.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Assets estáticos de Next: cache primero, se actualizan en segundo plano.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
        return cached || network;
      }),
    );
  }
});
