import { skillWeightedMean } from "@/lib/grade";
import type { PickRow } from "@/lib/types";

const BUST_LETTERS = new Set(["D+", "D", "D-"]);

export type RateStat = {
  rate: number | null;
  count: number;
  n: number;
};

export type RoundStat = {
  label: string;
  hint: string;
  score: number | null;
  letter: string | null;
  n: number;
};

export type ScoutingReport = {
  bust: RateStat;
  late: RateStat;
  leagueBust: RateStat;
  leagueLate: RateStat;
  steals: number;
  bloomers: number;
  elites: number;
  gems: number;
  evaluated: number;
  gemRate: number | null;
  best: { label: string; score: number; n: number } | null;
  rounds: RoundStat[];
};

/** A late-round hit has to have become an NHL player. Aging out of the window is not enough. */
export const GRADUATE_QG = 25;

const GROUPS: { group: PickRow["group"]; label: string }[] = [
  { group: "F", label: "Forwards" },
  { group: "D", label: "Defensemen" },
  { group: "G", label: "Goalies" },
];

const ROUNDS: { label: string; hint: string; rounds: number[] }[] = [
  { label: "Round 1", hint: "Top-end execution", rounds: [1] },
  { label: "Rounds 2–3", hint: "Middle-round value", rounds: [2, 3] },
  { label: "Rounds 4–7", hint: "Late-round depth", rounds: [4, 5, 6, 7] },
];

export function scoutingReport(subject: PickRow[], league: PickRow[]): ScoutingReport {
  const pool = league
    .filter((pick) => pick.included && pick.score != null)
    .map((pick) => pick.score as number)
    .sort((a, b) => a - b);
  return {
    bust: rate(subject, inBustWindow, (pick) => BUST_LETTERS.has(pick.letter ?? "")),
    late: rate(subject, lateRoundPool, lateRoundHit),
    leagueBust: rate(league, inBustWindow, (pick) => BUST_LETTERS.has(pick.letter ?? "")),
    leagueLate: rate(league, lateRoundPool, lateRoundHit),
    steals: subject.filter((pick) => pick.stamps.includes("STEAL")).length,
    bloomers: subject.filter((pick) => pick.stamps.includes("LATE BLOOMER")).length,
    ...gemSummary(subject),
    best: bestGroup(subject),
    rounds: ROUNDS.map((bucket) => roundStat(subject, bucket, pool)),
  };
}

function inBustWindow(pick: PickRow): boolean {
  if (pick.overall > 32 || pick.developing || pick.letter == null) return false;
  return pick.group === "G" ? pick.milestone >= 8 : pick.milestone >= 6;
}

/** Every round 4–7 pick counts unless it still carries the prospect (DEVELOPING) badge. */
function lateRoundPool(pick: PickRow): boolean {
  return pick.round >= 4 && pick.round <= 7 && !pick.developing && !pick.stamps.includes("DEVELOPING");
}

/** A late-round hit beat its slot (positive score) and played 100+ NHL games. */
export const LATE_HIT_GP = 100;
function lateRoundHit(pick: PickRow): boolean {
  return (pick.score ?? 0) > 0 && Math.max(pick.gpCareer ?? 0, pick.gp ?? 0) >= LATE_HIT_GP;
}

export function isGemPick(pick: PickRow): boolean {
  return pick.stamps.includes("STEAL") || pick.stamps.includes("LATE BLOOMER") || pick.stamps.includes("ELITE");
}

function gemSummary(picks: PickRow[]): { elites: number; gems: number; evaluated: number; gemRate: number | null } {
  const evaluated = picks.filter((pick) => pick.included && pick.score != null);
  const gems = evaluated.filter(isGemPick);
  return {
    elites: evaluated.filter((pick) => pick.stamps.includes("ELITE")).length,
    gems: gems.length,
    evaluated: evaluated.length,
    gemRate: evaluated.length === 0 ? null : gems.length / evaluated.length,
  };
}

function rate(picks: PickRow[], pool: (pick: PickRow) => boolean, hit: (pick: PickRow) => boolean): RateStat {
  const rows = picks.filter(pool);
  const count = rows.filter(hit).length;
  return { rate: rows.length === 0 ? null : count / rows.length, count, n: rows.length };
}

function bestGroup(picks: PickRow[]): { label: string; score: number; n: number } | null {
  let best: { label: string; score: number; n: number } | null = null;
  for (const group of GROUPS) {
    const rows = picks.filter((pick) => pick.group === group.group && pick.included && pick.score != null);
    const score = weightedMean(rows);
    if (score == null) continue;
    if (best == null || score > best.score || (score === best.score && rows.length > best.n)) {
      best = { label: group.label, score, n: rows.length };
    }
  }
  return best;
}

function roundStat(
  picks: PickRow[],
  bucket: { label: string; hint: string; rounds: number[] },
  pool: number[],
): RoundStat {
  const rows = picks.filter((pick) => bucket.rounds.includes(pick.round) && pick.included && pick.score != null);
  const score = weightedMean(rows);
  return {
    label: bucket.label,
    hint: bucket.hint,
    score,
    letter: score == null ? null : letterFor(percentile(score, pool)),
    n: rows.length,
  };
}

function weightedMean(rows: PickRow[]): number | null {
  const graded = rows.filter((row) => row.score != null);
  if (graded.length === 0) return null;
  return skillWeightedMean(graded.map((row) => ({ overall: row.overall, score: row.score as number })));
}

function percentile(value: number, pool: number[]): number {
  const count = pool.length;
  if (count === 0) return 50;
  let below = 0;
  while (below < count && pool[below] < value) below += 1;
  let end = below;
  while (end < count && pool[end] === value) end += 1;
  if (below === end) return (100 * below) / count;
  return (100 * ((below + end) / 2)) / count;
}

function letterFor(rating: number): string {
  const rounded = Math.round(rating);
  const bands: [number, string][] = [
    [97, "A+"],
    [90, "A"],
    [82, "A-"],
    [72, "B+"],
    [60, "B"],
    [48, "B-"],
    [38, "C+"],
    [28, "C"],
    [18, "C-"],
    [10, "D+"],
    [4, "D"],
  ];
  for (const [threshold, letter] of bands) {
    if (rounded >= threshold) return letter;
  }
  return "D-";
}
