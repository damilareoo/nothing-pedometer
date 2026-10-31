import { ImageResponse } from "next/og";
import { dotTextDots } from "@/components/nothing-pedometer/dot-matrix";
import { parseStepsPayload } from "@/lib/steps";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Step count in dot-matrix";
/** Fresh hourly: link unfurls should carry the day being shared. */
export const revalidate = 3600;

/**
 * Social card: the count inside the product's own widget card — TOTAL TODAY
 * with the one red dot. If today has no report, the card carries the last
 * reported day and says so; if the feed is down it shows a dash, never a
 * fixture number pretending to be today's walk.
 */
async function todayCard(): Promise<{ count: string; caption: string }> {
  try {
    const url = process.env.STEPS_API_URL ?? "https://damilare.works/api/steps";
    const secret = process.env.STEPS_API_SECRET;
    if (!secret) throw new Error("no secret");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("feed rejected");
    const snap = parseStepsPayload(await res.json().catch(() => null));
    if (!snap) throw new Error("feed malformed");
    if (snap.today !== null) {
      return { count: snap.today.toLocaleString("en-US"), caption: "TOTAL TODAY" };
    }
    if (snap.lastReported) {
      const day = new Date(`${snap.lastReported.date}T12:00:00+01:00`)
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        .toUpperCase();
      return { count: snap.lastReported.steps.toLocaleString("en-US"), caption: `LAST STEP ${day}` };
    }
    return { count: "--", caption: "NO SYNC" };
  } catch {
    return { count: "--", caption: "NO SYNC" };
  }
}

export default async function OGImage() {
  const { count, caption } = await todayCard();
  const pitch = 26;
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
          background: "#101014",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "#1B1A1F",
            borderRadius: 48,
            padding: "64px 96px",
          }}
        >
          <svg width={width} height={7 * pitch} viewBox={`0 0 ${width} ${7 * pitch}`}>
            {dotTextDots(count, { pitch }).map((p, i) => (
              <circle key={i} cx={p.cx} cy={p.cy} r={pitch * 0.34} fill="#FFFFFF" opacity={p.lit ? 1 : 0.08} />
            ))}
          </svg>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 28,
              fontSize: 28,
              letterSpacing: 8,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "monospace",
            }}
          >
            {caption}&nbsp;&nbsp;
            <span style={{ width: 18, height: 18, borderRadius: 9, background: "#E11A1B" }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
