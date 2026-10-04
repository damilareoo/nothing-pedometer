import { NextResponse } from "next/server";
import { parseStepsPayload } from "@/lib/steps";

/**
 * Proxy to the owner's live Health Connect feed. The Bearer secret lives
 * in STEPS_API_SECRET (server env only) — never in the repo, never in
 * client code. No secret configured → 503, not a leak.
 */
export async function GET() {
  const url = process.env.STEPS_API_URL ?? "https://damilareoo-xyz.vercel.app/api/steps";
  const secret = process.env.STEPS_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "steps feed not configured" }, { status: 503 });
  }
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "steps feed unreachable" }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "steps feed rejected" }, { status: 502 });
  }
  const snapshot = parseStepsPayload(await res.json().catch(() => null));
  if (!snapshot) {
    return NextResponse.json({ error: "steps feed malformed" }, { status: 502 });
  }
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
