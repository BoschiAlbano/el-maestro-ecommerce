"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js) solo en producción. En desarrollo
 * molesta más de lo que ayuda (interfiere con el hot-reload de Turbopack).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar el service worker:", error);
    });
  }, []);

  return null;
}
