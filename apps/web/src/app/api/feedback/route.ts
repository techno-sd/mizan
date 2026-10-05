// Server-side proxy for readers' reports on a result. Same internal key as /api/verify.

const API_URL = process.env.MIZAN_API_URL ?? "http://localhost:8000";
const INTERNAL_KEY = process.env.MIZAN_INTERNAL_API_KEY ?? "";

const WINDOW_MS = 10 * 60_000;
const MAX_REPORTS = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REPORTS;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (b.verdict !== "correct" && b.verdict !== "wrong") return Response.json({ error: "invalid_verdict" }, { status: 400 });

  const body = {
    run_id: str(b.run_id, 64),
    finding_id: str(b.finding_id, 16),
    verdict: b.verdict,
    status: str(b.status, 32) || null,
    quoted_text: str(b.quoted_text, 600),
    suggested_reference: str(b.suggested_reference, 300) || null,
    comment: str(b.comment, 1000),
  };
  try {
    const res = await fetch(`${API_URL}/v1/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    return res.ok ? Response.json({ ok: true }) : Response.json({ error: "upstream_error" }, { status: 502 });
  } catch {
    return Response.json({ error: "upstream_unreachable" }, { status: 503 });
  }
}
