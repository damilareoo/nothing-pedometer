import { ImageResponse } from "next/og";
import { dotTextDots } from "@/components/nothing-pedometer/dot-matrix";
import { parseStepsPayload } from "@/lib/steps";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Today's step count in dot-matrix";
/** Fresh hourly: link unfurls should carry the day being shared. */
export const revalidate = 3600;

/**
 * Social card: nothing but the day's count, drawn as dot-matrix.
 * Live today over the same fixtures seam as the widget — the feed resolves
 * in the usual case, fixtures stand in only when it cannot.
 */
async function todayCount(): Promise<string> {
  try {
    const url = process.env.STEPS_API_URL ?? "https://damilareoo-xyz.vercel.app/api/steps";
    const secret = process.env.STEPS_API_SECRET;
    if (!secret) throw new Error("no secret");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("feed rejected");
    const snap = parseStepsPayload(await res.json().catch(() => null));
    if (!snap) throw new Error("feed malformed");
    return snap.today.toLocaleString("en-US");
  } catch {
    return (7284).toLocaleString("en-US");
  }
}

export default async function OGImage() {
  const count = await todayCount();
  const pitch = 28;
  const width = (count.length * 6 - 1) * pitch;
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0B0D",
        }}
      >
        <svg width={width} height={7 * pitch} viewBox={`0 0 ${width} ${7 * pitch}`}>
          {dotTextDots(count, { pitch }).map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={pitch * 0.34} fill="#FFFFFF" opacity={p.lit ? 1 : 0.08} />
          ))}
        </svg>
      </div>
    ),
    { ...size },
  );
}
