import { renderAppIcon } from "@/lib/app-icon";

export const dynamic = "force-static";

// Android recorta este ícono (círculo, cuadrado redondeado…): lleva el mismo
// fondo oscuro que theme_color y el logo dentro de la zona segura (~60%).
export function GET() {
  return renderAppIcon(512, { logoColor: "#ffffff", background: "#0f172a", logoScale: 0.6 });
}
