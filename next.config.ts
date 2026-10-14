import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // "Cache Components" (y "Partial Prefetching", que depende de él) vienen
  // activados por defecto en el template de Next 16, pero asumen un mix de
  // páginas estáticas y dinámicas. Acá casi todo está detrás de sesión
  // (constitución, regla 14), así que casi nada es prerenderizable y esa
  // característica solo agrega fricción de build sin beneficio real.
  // Ver specs/001-base-del-proyecto/plan.md, sección 7.
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
