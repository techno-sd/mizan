// Server-side proxy: the text in a screenshot, for the writer to review before checking. The image is not stored.

const API_URL = process.env.MIZAN_API_URL ?? "http://localhost:8000";
const INTERNAL_KEY = process.env.MIZAN_INTERNAL_API_KEY ?? "";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BASE64 = 6_000_000; // ≈ 4.5 MB of image; the browser shrinks screenshots well below this

const WINDOW_MS = 10 * 60_000;
const MAX_IMAGES = 12;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_IMAGES;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let b: { media_type?: unknown; data?: unknown };
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof b.media_type !== "string" || !TYPES.has(b.media_type)) return Response.json({ error: "unsupported_image" }, { status: 415 });
  if (typeof b.data !== "string" || !b.data) return Response.json({ error: "empty_image" }, { status: 400 });
  if (b.data.length > MAX_BASE64) return Response.json({ error: "image_too_large" }, { status: 413 });

  try {
    const res = await fetch(`${API_URL}/v1/image-text`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ media_type: b.media_type, data: b.data }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ error: res.status === 503 ? "model_disabled" : res.status === 404 ? "not_deployed" : "upstream_error" }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "upstream_unreachable" }, { status: 503 });
  }
}
