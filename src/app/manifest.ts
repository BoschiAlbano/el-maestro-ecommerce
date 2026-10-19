import type { MetadataRoute } from "next";

// Next.js descubre este archivo automáticamente y agrega el <link rel="manifest">.
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "El Maestro Ecommerce",
    short_name: "El Maestro",
    description: "Stock, ventas, pedidos y caja del negocio.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
