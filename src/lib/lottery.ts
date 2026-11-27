import lotteryJson from "../../data/draft-rater/lottery.json";
import { curves, leaderboard, picks } from "./data";

// NHL Draft Lottery history (2006 on) and Franchise Lottery Luck.
// Built nightly by pipelines/draft-rater/fetch_lottery.py from free NHL APIs.
//
// Each lottery team has a pre-lottery seed (its place in the final standings, worst first)
// and the slot its own pick actually landed on. Seed minus slot = spots the ping-pong balls
// gave (+) or took (-). Impact luck = expected 7-year Impact of the slot it got minus the slot
// it had, from the Draft Rater's own pick curve.

export type LotteryPick = { team: string; seed: number; overall: number; moved: number; playerId: number | null; name: string | null };
export type LiveSeed = { seed: number; team: string; points: number | null; gp: number | null; pct: number; recentWins: number };

const file = lotteryJson as unknown as { asOf: string; years: Record<string, LotteryPick[]>; live: LiveSeed[] };

export const lotteryYears = file.years;
export const liveLottery = file.live;
export const lotteryAsOf = file.asOf;

const HORIZON = "7";

/** Expected Impact by year 7 for a draft slot (the Draft Rater curve). */
export function slotValue(overall: number): number {
  const curve = curves.skater[HORIZON] ?? [];
  return curve[Math.max(0, Math.min(curve.length - 1, overall - 1))] ?? 0;
}

export type TeamLuck = {
  abbr: string;
  name: string;
  /** Lotteries the team was in. */
  lotteries: number;
  /** Net spots gained (+) or lost (-) across every lottery. */
  netSpots: number;
  /** Times it jumped to #1, and into the top 3. */
  jumpsToFirst: number;
  jumpsTop3: number;
  /** Times it was pushed down by another team's jump. */
  drops: number;
  /** Expected Impact gained (+) or lost (-) from where the balls put its picks. */
  netImpact: number;
  biggest: { year: number; seed: number; overall: number; moved: number; name: string | null; routeId: number | null } | null;
  rank: number;
};

const routeByPlayer = new Map(picks.filter((p) => p.playerId != null).map((p) => [p.playerId as number, p.id]));

function build(): TeamLuck[] {
  const rows = leaderboard.map((team) => {
    const mine = Object.entries(lotteryYears).flatMap(([year, list]) => list.filter((p) => p.team === team.abbr).map((p) => ({ ...p, year: Number(year) })));
    const biggest = [...mine].sort((a, b) => b.moved - a.moved || a.overall - b.overall)[0];
    return {
      abbr: team.abbr,
      name: team.name,
      lotteries: mine.length,
      netSpots: mine.reduce((sum, p) => sum + p.moved, 0),
      jumpsToFirst: mine.filter((p) => p.moved > 0 && p.overall === 1).length,
      jumpsTop3: mine.filter((p) => p.moved > 0 && p.overall <= 3).length,
      drops: mine.filter((p) => p.moved < 0).length,
      netImpact: Math.round(mine.reduce((sum, p) => sum + slotValue(p.overall) - slotValue(p.seed), 0) * 10) / 10,
      biggest:
        biggest && biggest.moved > 0
          ? { year: biggest.year, seed: biggest.seed, overall: biggest.overall, moved: biggest.moved, name: biggest.name, routeId: biggest.playerId ? (routeByPlayer.get(biggest.playerId) ?? null) : null }
          : null,
      rank: 0,
    };
  });
  rows.sort((a, b) => b.netImpact - a.netImpact || b.netSpots - a.netSpots);
  rows.forEach((row, index) => (row.rank = index + 1));
  return rows;
}

export const lotteryLuck = build();
const byAbbr = new Map(lotteryLuck.map((row) => [row.abbr, row]));

export function teamLuck(abbr: string): TeamLuck | null {
  return byAbbr.get(abbr) ?? null;
}

/** Every lottery jump since 2006, biggest first. */
export function lotteryJumps(): (LotteryPick & { year: number })[] {
  return Object.entries(lotteryYears)
    .flatMap(([year, list]) => list.filter((p) => p.moved > 0).map((p) => ({ ...p, year: Number(year) })))
    .sort((a, b) => b.moved - a.moved || b.year - a.year);
}
