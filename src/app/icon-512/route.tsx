import { renderAppIcon } from "@/lib/app-icon";

export const dynamic = "force-static";

// Logo blanco sin fondo: la barra de la PWA instalada es oscura (theme_color).
export function GET() {
  return renderAppIcon(512, { logoColor: "#ffffff" });
}
