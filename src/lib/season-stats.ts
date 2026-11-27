import statsJson from "../../data/draft-rater/season_stats.json";

// Season-by-season NHL regular-season box scores, exported nightly by
// pipelines/draft-rater/season_stats.py. Server-side only: pages pass slices to client components.

/** [season, gp, g, a, pts, plusMinus, pim, shots, blocks, foWins, foLosses, toiPerGameSec, ppToiSec, shToiSec] */
export type SkaterSeason = [number, number, number, number, number, number, number, number, number, number, number, number, number, number];
/** [season, gp, starts, shotsAgainst, saves, goalsAgainst, toiSec] */
export type GoalieSeason = [number, number, number, number, number, number, number];

type StatsFile = { lastSeason: number; skaters: Record<string, SkaterSeason[]>; goalies: Record<string, GoalieSeason[]> };

const file = statsJson as unknown as StatsFile;

export const statsLastSeason = file.lastSeason;

export function skaterSeasons(playerId: number | null | undefined): SkaterSeason[] {
  return playerId == null ? [] : (file.skaters[String(playerId)] ?? []);
}

export function goalieSeasons(playerId: number | null | undefined): GoalieSeason[] {
  return playerId == null ? [] : (file.goalies[String(playerId)] ?? []);
}

export function allSkaterSeasons(): Record<string, SkaterSeason[]> {
  return file.skaters;
}

export function allGoalieSeasons(): Record<string, GoalieSeason[]> {
  return file.goalies;
}

/** Games each NHL team played in a season start year. Lockout and pandemic years were short. */
export function teamGames(season: number): number {
  if (season === 2012) return 48;
  if (season === 2019) return 70;
  if (season === 2020) return 56;
  if (season === 2004) return 0;
  return 82;
}

/** First NHL season on file for this player (start year), or null. */
export function debutSeason(playerId: number | null | undefined): number | null {
  const rows: { 0: number }[] = [...skaterSeasons(playerId), ...goalieSeasons(playerId)];
  if (!rows.length) return null;
  return Math.min(...rows.map((row) => row[0]));
}

/** Merge rows for the same season (traded players can show up once per club). */
function bySeason<T extends number[]>(rows: T[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const row of rows) out.set(row[0], (out.get(row[0]) ?? 0) + row[1]);
  return out;
}

/**
 * IRON MAN: 95%+ of his team's games in 5+ straight full seasons, or a run of
 * complete seasons (every game played) adding up to 300+ games. The season in
 * progress never counts, so the badge only moves after a season ends.
 */
export function ironMan(playerId: number | null | undefined, inProgress: number | null): { streak: number; games: number } | null {
  const seasons = bySeason([...skaterSeasons(playerId), ...goalieSeasons(playerId)] as number[][]);
  if (!seasons.size) return null;
  const years = [...seasons.keys()].filter((year) => year !== inProgress).sort((a, b) => a - b);
  let best: { streak: number; games: number } | null = null;
  let run = 0;
  let runGames = 0;
  let fullGames = 0;
  let prev = -1;
  for (const year of years) {
    const gp = seasons.get(year) ?? 0;
    const length = teamGames(year);
    const contiguous = prev === -1 || year === prev + 1 || (prev === 2003 && year === 2005);
    if (!contiguous) {
      run = 0;
      runGames = 0;
      fullGames = 0;
    }
    if (length > 0 && gp >= length * 0.95) {
      run += 1;
      runGames += gp;
      fullGames = gp >= length ? fullGames + gp : 0;
    } else {
      run = 0;
      runGames = 0;
      fullGames = 0;
    }
    if (run >= 5 || fullGames >= 300) {
      if (!best || runGames > best.games) best = { streak: run, games: runGames };
    }
    prev = year;
  }
  return best;
}
