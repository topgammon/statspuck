import availabilityJson from "../../data/draft-rater/availability.json";

// Injury & availability history: NHL games played vs his team's games, season by season,
// counted from his first 40+ GP NHL season (so junior / AHL years never count against him).
// Built nightly by pipelines/game-edge/build.py from season box scores.
// "Missed" includes injuries, healthy scratches and time in the minors: the NHL feed does not
// say why a player sat.

type File = { asOf: string; current: number; players: Record<string, [number, number, number][]> };
const data = availabilityJson as unknown as File;

export type AvailabilitySeason = { season: number; gp: number; games: number; missed: number; live: boolean };

export type Availability = {
  seasons: AvailabilitySeason[];
  gp: number;
  games: number;
  /** Career availability, 0-1. */
  pct: number;
  /** Multiplier on projected value: 1.00 for 95%+ availability, down to 0.80 for a player who never plays. */
  durability: number;
};

export function availabilityFor(playerId: number | null | undefined): Availability | null {
  if (playerId == null) return null;
  const rows = data.players[String(playerId)];
  if (!rows?.length) return null;
  const seasons = rows.map(([season, gp, games]) => ({ season, gp, games, missed: Math.max(0, games - gp), live: season === data.current }));
  const gp = seasons.reduce((s, r) => s + r.gp, 0);
  const games = seasons.reduce((s, r) => s + r.games, 0);
  const pct = games ? gp / games : 1;
  // Finished seasons only for durability, so a slow October never moves the needle.
  const done = seasons.filter((r) => !r.live);
  const donePct = done.length ? done.reduce((s, r) => s + r.gp, 0) / Math.max(1, done.reduce((s, r) => s + r.games, 0)) : 1;
  const durability = Math.min(1, 0.8 + (0.2 * donePct) / 0.95);
  return { seasons, gp, games, pct, durability: Math.round(durability * 1000) / 1000 };
}
