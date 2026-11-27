// Today's NHL regular-season games plus the referees once the NHL posts them (usually near puck drop).
// Same-origin so the Ref Watch and Game Edge pages can read it (api-web.nhle.com sends no CORS headers).
// Free Cloudflare Pages Function, cached at the edge for 10 minutes.
export async function onRequest(context) {
  const cache = caches.default;
  const key = new Request(new URL("/api/nhl-today", context.request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const headers = { "user-agent": "StatsPuck/1.0 (pregame ref edge)", accept: "application/json" };
  let games = [];
  let date = null;
  try {
    const sched = await fetch("https://api-web.nhle.com/v1/schedule/now", { headers }).then((r) => r.json());
    const day = (sched.gameWeek || []).find((d) => (d.games || []).length);
    date = day ? day.date : null;
    const list = day ? day.games.filter((g) => g.gameType === 2) : [];
    games = await Promise.all(
      list.map(async (g) => {
        let refs = [];
        try {
          const rail = await fetch(`https://api-web.nhle.com/v1/gamecenter/${g.id}/right-rail`, { headers }).then((r) => r.json());
          refs = ((rail.gameInfo || {}).referees || []).map((r) => (r.fullName || {}).default).filter(Boolean);
        } catch {
          refs = [];
        }
        return { id: g.id, start: g.startTimeUTC, away: g.awayTeam.abbrev, home: g.homeTeam.abbrev, refs };
      }),
    );
  } catch {
    return new Response(JSON.stringify({ games: [] }), { status: 502, headers: { "content-type": "application/json" } });
  }
  const response = new Response(JSON.stringify({ date, games }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=600" },
  });
  context.waitUntil(cache.put(key, response.clone()));
  return response;
}
