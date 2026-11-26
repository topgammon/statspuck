// Same-origin copy of NHL headshots so share cards can be exported as PNGs.
// Only assets.nhle.com/mugs/ is allowed.
export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }
  const target = requestUrl.searchParams.get("url") || "";
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Bad url", { status: 400, headers: cors() });
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "assets.nhle.com" || !parsed.pathname.startsWith("/mugs/")) {
    return new Response("Host not allowed", { status: 403, headers: cors() });
  }
  const upstream = await fetch(parsed.toString(), {
    headers: { "user-agent": "StatsPuck/1.0 (share card image)" },
  });
  if (!upstream.ok) return new Response("Upstream failed", { status: 502, headers: cors() });
  const bytes = await upstream.arrayBuffer();
  const headers = cors();
  headers["content-type"] = upstream.headers.get("content-type") || "image/png";
  headers["cache-control"] = "public, max-age=86400";
  return new Response(bytes, { headers });
}

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  };
}
