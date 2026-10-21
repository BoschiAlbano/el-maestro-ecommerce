import { renderAppIcon } from "@/lib/app-icon";

export const dynamic = "force-static";

// Logo negro sobre fondo blanco: se ve bien en el escritorio (claro) y en la
// barra oscura de la PWA instalada (theme_color).
export function GET() {
  return renderAppIcon(512, { background: "#ffffff", logoScale: 0.8 });
}
