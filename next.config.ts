import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  /* config options here */
  // "Cache Components" (y "Partial Prefetching", que depende de él) vienen
  // activados por defecto en el template de Next 16, pero asumen un mix de
  // páginas estáticas y dinámicas. Acá casi todo está detrás de sesión
  // (constitución, regla 14), así que casi nada es prerenderizable y esa
  // característica solo agrega fricción de build sin beneficio real.
  // Ver specs/001-base-del-proyecto/plan.md, sección 7.
  //
  // Túnel de desarrollo (VS Code Ports / devtunnels.ms): Next 16 rechaza
  // por CSRF las Server Actions y bloquea los endpoints de dev cuando el
  // origen no es el host con el que arrancó el servidor. Acá pasa al
  // revés de lo esperado: el `x-forwarded-host` sí llega como el dominio
  // del túnel, pero el formulario manda `origin: localhost:3000` (el
  // host real del dev server) — por eso hace falta agregar `localhost:3000`
  // acá, no el dominio del túnel. `allowedDevOrigins` sigue haciendo
  // falta aparte, para los endpoints de desarrollo (HMR, assets).
  //
  // Túnel de ngrok para Mercado Libre (spec 019, plan sección 7): la
  // dirección de retorno y la de avisos tienen que ser públicas y con https.
  // Se acepta solo en desarrollo: en producción no se abre ningún origen más.
  allowedDevOrigins: ["**.devtunnels.ms", ...(isDev ? ["**.ngrok-free.dev"] : [])],
  experimental: {
    serverActions: {
      allowedOrigins: ["**.devtunnels.ms", "localhost:3000", ...(isDev ? ["**.ngrok-free.dev"] : [])],
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
