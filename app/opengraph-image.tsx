import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card: the artifact's identity — black ground, white dot-matrix
 * distance, one red live dot, mono instrument caption. Static by design:
 * OG images render at share time, never per-viewer.
 */
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: "#0B0B0D",
          color: "#FFFFFF",
          fontFamily: "monospace",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 8, opacity: 0.6 }}>
          NOTHING · PEDOMETER
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 24 }}>
          <div style={{ fontSize: 220, lineHeight: 1 }}>5.2</div>
          <div style={{ fontSize: 40, letterSpacing: 12 }}>KM</div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "#E11A1B",
              marginLeft: 8,
            }}
          />
        </div>
        <div style={{ fontSize: 30, letterSpacing: 4, opacity: 0.6, marginTop: 24 }}>
          MORNING RUN · 32:14 · 268 KCAL
        </div>
        <div style={{ fontSize: 24, letterSpacing: 4, opacity: 0.4, marginTop: 40 }}>
          UNOFFICIAL CONCEPT — NOT AFFILIATED WITH NOTHING
        </div>
      </div>
    ),
    { ...size },
  );
}
