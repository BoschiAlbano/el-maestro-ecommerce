import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const LOGO_RATIO = 11366 / 13600;
// El mismo SVG recortado que usa la pestaña del navegador (src/app/icon.svg).
const logoSvg = readFileSync(join(process.cwd(), "src", "app", "icon.svg"), "utf8");

type AppIconOptions = {
  /** Color del logo. Negro por defecto; blanco para fondos oscuros (barra de la PWA instalada). */
  logoColor?: string;
  /** Sin fondo (transparente) por defecto. iOS y los íconos "maskable" necesitan uno. */
  background?: string;
  /** Alto del logo respecto del lado del ícono. */
  logoScale?: number;
};

/** Ícono PNG de la app (PWA e iOS): el logo de El Maestro, en la variante que pida cada uso. */
export function renderAppIcon(
  size: number,
  { logoColor = "#000000", background = "transparent", logoScale = 0.86 }: AppIconOptions = {},
) {
  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(
    logoSvg.replace('fill="#000000"', `fill="${logoColor}"`),
  ).toString("base64")}`;
  const logoHeight = Math.round(size * logoScale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img src={logoDataUri} alt="" width={Math.round(logoHeight * LOGO_RATIO)} height={logoHeight} />
      </div>
    ),
    { width: size, height: size },
  );
}
