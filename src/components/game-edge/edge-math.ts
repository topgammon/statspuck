// Pure helpers shared by the Game Edge hub (client) and the team/player tabs (server).

export type SG = [number, number];
export type ChanceKey = "rebound" | "rush" | "royal" | "tip" | "netfront" | "slot" | "point";
export type ZoneKey = "netfront" | "highslot" | "leftcircle" | "rightcircle" | "point";

export const CHANCE_KEYS: ChanceKey[] = ["rebound", "rush", "royal", "tip", "netfront", "slot", "point"];
export const ZONE_KEYS: ZoneKey[] = ["netfront", "highslot", "leftcircle", "rightcircle", "point"];
export const SHOT_KEYS = ["wrist", "snap", "slap", "backhand", "tip-in", "deflected", "wrap-around"];

export const CHANCE_NAME: Record<ChanceKey, string> = {
  rebound: "Rebounds",
  rush: "Rush",
  royal: "Royal-Road",
  tip: "Tips & Deflections",
  netfront: "Net-Front",
  slot: "Slot / Mid-Range",
  point: "Point / Perimeter",
};

export const ZONE_NAME: Record<ZoneKey, string> = {
  netfront: "Net-Front",
  highslot: "High Slot",
  leftcircle: "Left Circle",
  rightcircle: "Right Circle",
  point: "Point",
};

export const SHOT_NAME: Record<string, string> = {
  wrist: "Wrist",
  snap: "Snap",
  slap: "Slap",
  backhand: "Backhand",
  "tip-in": "Tip-In",
  deflected: "Deflected",
  "wrap-around": "Wrap-Around",
};

/** Goals per game of one type. */
export function perGame(table: Partial<Record<string, SG>>, key: string, games: number, index: 0 | 1 = 1): number {
  return games > 0 ? (table[key]?.[index] ?? 0) / games : 0;
}

/** Share of all goals (index 1) or shots (index 0) that came from one type. */
export function shareOf(table: Partial<Record<string, SG>>, key: string, index: 0 | 1 = 1): number {
  const total = Object.values(table).reduce<number>((s, v) => s + (v?.[index] ?? 0), 0);
  return total > 0 ? (table[key]?.[index] ?? 0) / total : 0;
}

/** Save % shrunk toward the league rate for that type (k = shots of prior). */
export function shrunkSv(sg: SG | undefined, leagueSv: number, k = 40): number {
  const shots = sg?.[0] ?? 0;
  const goals = sg?.[1] ?? 0;
  return (shots - goals + k * leagueSv) / (shots + k);
}

export function leagueSvOf(table: Partial<Record<string, SG>>, key: string): number {
  const sg = table[key];
  return sg && sg[0] > 0 ? 1 - sg[1] / sg[0] : 0.9;
}

export function signed(v: number, digits = 1, suffix = ""): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}${suffix}`;
}

export type GoalieLike = { id: number; name: string; sa: number; ga: number; gp: number; chance: Partial<Record<string, SG>>; zone: Partial<Record<string, SG>>; type: Record<string, SG> };

/** Save % above (+) or below (−) league in each ice zone, shrunk for small samples. */
export function goalieZoneValues(g: { zone: Partial<Record<string, SG>> }, league: { zone: Partial<Record<string, SG>> }) {
  const out: Record<string, { delta: number | null; text: string }> = {};
  for (const z of ZONE_KEYS) {
    const sg = g.zone[z];
    if (!sg || sg[0] < 5) {
      out[z] = { delta: null, text: "–" };
      continue;
    }
    const lsv = leagueSvOf(league.zone, z);
    const sv = shrunkSv(sg, lsv, 30);
    out[z] = { delta: (sv - lsv) * 100, text: signed((sv - lsv) * 100, 1) };
  }
  return out;
}

/**
 * How well a goalie fits an opponent's offense: expected save % if he faced that team's
 * shot mix (by chance type), minus the league-average goalie's expected save % on the same mix.
 * In percentage points (+0.6 = saves 0.6% more of this opponent's shots than an average goalie).
 */
export function matchupFit(goalie: GoalieLike, oppFor: Partial<Record<string, SG>>, leagueChance: Partial<Record<string, SG>>): number {
  let mine = 0;
  let avg = 0;
  let total = 0;
  for (const key of CHANCE_KEYS) {
    const shots = oppFor[key]?.[0] ?? 0;
    if (!shots) continue;
    const lsv = leagueSvOf(leagueChance, key);
    mine += shots * shrunkSv(goalie.chance[key] as SG | undefined, lsv);
    avg += shots * lsv;
    total += shots;
  }
  return total ? (100 * (mine - avg)) / total : 0;
}
