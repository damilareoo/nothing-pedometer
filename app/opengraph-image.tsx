import { ImageResponse } from "next/og";
import { dotTextDots } from "@/components/nothing-pedometer/dot-matrix";
import { ROUTE } from "@/lib/route";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card in the product's own voice: dot-matrix distance, dotted
 * route trace, one red finish dot, mono instrument labels on black.
 * Static by design: OG images render at share time, never per-viewer.
 */
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 96,
          paddingRight: 96,
          background: "#0B0B0D",
          color: "#FFFFFF",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 8, opacity: 0.55 }}>
            MORNING RUN · 06:42
          </div>
          <svg width={(3 * 6 - 1) * 40} height={7 * 40} viewBox={`0 0 ${(3 * 6 - 1) * 40} ${7 * 40}`}>
            {dotTextDots("5.2", { pitch: 40 }).map((p, i) => (
              <circle key={i} cx={p.cx} cy={p.cy} r={13.5} fill="#FFFFFF" opacity={p.lit ? 1 : 0.08} />
            ))}
          </svg>
          <div style={{ fontSize: 30, letterSpacing: 14, marginTop: 20 }}>
            KILOMETRES
          </div>
          <div style={{ fontSize: 28, letterSpacing: 3, opacity: 0.55, marginTop: 28 }}>
            32:14 · 6&apos;12&apos;&apos;/KM · 268 KCAL
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: "auto" }}>
          <svg width={380} height={265} viewBox="0 0 360 250">
            <path
              d={ROUTE}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.9}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="0.1 10"
            />
            <circle cx={44} cy={200} r={7} fill="#FFFFFF" />
            <circle cx={96} cy={200} r={7} fill="#E11A1B" />
          </svg>
          <div style={{ fontSize: 22, letterSpacing: 8, opacity: 0.4, marginTop: 16 }}>
            UNOFFICIAL CONCEPT
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
