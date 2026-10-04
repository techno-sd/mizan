// Server-side proxy to the Mizan API. The browser never sees the API URL or the internal key.

const API_URL = process.env.MIZAN_API_URL ?? "http://localhost:8000";
const INTERNAL_KEY = process.env.MIZAN_INTERNAL_API_KEY ?? "";
const MAX_CHARS = 20_000;

// Simple per-IP limit. Per-instance only: good enough for a demo link; use Upstash Redis in production.
const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS = 15;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { text?: unknown; debug?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return Response.json({ error: "empty_text" }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: "too_long" }, { status: 413 });

  try {
    const res = await fetch(`${API_URL}/v1/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ text, debug: body.debug === true }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json({ error: "upstream_error", status: res.status }, { status: 502 });
    }
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "upstream_unreachable" }, { status: 503 });
  }
}
