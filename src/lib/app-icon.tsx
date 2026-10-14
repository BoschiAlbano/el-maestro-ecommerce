import { ImageResponse } from "next/og";

/**
 * Ícono placeholder generado por código (sin assets de diseño todavía).
 * Reemplazar por el logo real de la importadora cuando esté disponible.
 */
export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
        <div
          style={{
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: size * 0.12,
            background: "#ffffff",
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
