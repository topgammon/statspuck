import type { Era, PickGroup, PickRow, TeamInfo } from "./types";

export type RoundFilter = "all" | "1" | "23" | "47";

export type GradeFilter = {
  minYear: number;
  maxYear: number;
  group: "ALL" | PickGroup;
  round?: RoundFilter;
};

export type FilteredTeam = {
  abbr: string;
  name: string;
  short: string;
  color: string;
  avg: number;
  total: number;
  n: number;
  developing: number;
  rating: number;
  letter: string;
};

/** Half away from zero, one decimal. Must match pipeline/model.py. */
export function round1(value: number): number {
  const scaled = value * 10;
  return value >= 0 ? Math.floor(scaled + 0.5) / 10 : Math.ceil(scaled - 0.5) / 10;
}

export function round0(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

export function letterFor(rating: number): string {
  if (rating >= 97) return "A+";
  if (rating >= 90) return "A";
  if (rating >= 82) return "A-";
  if (rating >= 72) return "B+";
  if (rating >= 60) return "B";
  if (rating >= 48) return "B-";
  if (rating >= 38) return "C+";
  if (rating >= 28) return "C";
  if (rating >= 18) return "C-";
  if (rating >= 10) return "D+";
  if (rating >= 4) return "D";
  return "D-";
}

/** Mid-rank percentile. Must match pipeline/grade_quality.py. */
export function percentileOf(value: number, pool: number[]): number {
  const ordered = [...pool].sort((a, b) => a - b);
  const count = ordered.length;
  if (count === 0) return 50;
  let below = 0;
  while (below < count && ordered[below] < value) below += 1;
  let end = below;
  while (end < count && ordered[end] === value) end += 1;
  if (below === end) return (100 * below) / count;
  return (100 * ((below + end) / 2)) / count;
}

export function ratingAndLetter(value: number, pool: number[]): { rating: number; letter: string } {
  const rating = round0(percentileOf(value, pool));
  return { rating, letter: letterFor(rating) };
}

export function inRound(pick: PickRow, round: RoundFilter | undefined): boolean {
  const choice = round ?? "all";
  if (choice === "all") return true;
  if (choice === "1") return pick.round === 1;
  if (choice === "23") return pick.round === 2 || pick.round === 3;
  return pick.round >= 4 && pick.round <= 7;
}

function inRange(pick: PickRow, filter: GradeFilter): boolean {
  if (pick.year < filter.minYear || pick.year > filter.maxYear) return false;
  if (filter.group !== "ALL" && pick.group !== filter.group) return false;
  if (!inRound(pick, filter.round)) return false;
  return true;
}

/** A draft year's own grade still uses this. Team and GM grades do not. */
export function pickWeight(overall: number): number {
  return 1 / Math.sqrt(overall);
}

export function weightedMean(rows: { overall: number; score: number }[]): number {
  let total = 0;
  let weightSum = 0;
  for (const row of rows) {
    const weight = pickWeight(row.overall);
    total += row.score * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : total / weightSum;
}

/** The one lottery-luck rule for team and GM averages: a #1 overall hit counts at most +250. A #1 bust counts in full. */
export const FIRST_OVERALL_CAP = 250;

export function effectiveScore(score: number, overall: number): number {
  return overall === 1 && score > 0 ? Math.min(score, FIRST_OVERALL_CAP) : score;
}

/** Plain, unweighted average of effective scores across graduated picks. */
/** Sum of effective scores in whole tenths, so the pipeline's math matches exactly. */
function scoutingTenths(rows: { overall: number; score: number }[]): number {
  return rows.reduce((sum, row) => sum + Math.round(effectiveScore(row.score, row.overall) * 10), 0);
}

export function scoutingAverage(rows: { overall: number; score: number }[]): number {
  if (rows.length === 0) return 0;
  return scoutingTenths(rows) / (10 * rows.length);
}

export function scoutingTotal(rows: { overall: number; score: number }[]): number {
  return scoutingTenths(rows) / 10;
}

/** A short GM sample moves toward the league average (0.0 once centered). Six graded picks keep half. Sixty keep about 91 percent. */
export function shrinkGm(avg: number, graded: number): number {
  if (graded <= 0) return 0;
  return avg * (graded / (graded + 6));
}

function gradedScores(rows: PickRow[]): { overall: number; score: number }[] {
  return rows
    .filter((pick) => pick.included && pick.score != null)
    .map((pick) => ({ overall: pick.overall, score: pick.score as number }));
}

/**
 * League-average team score for a filter: the plain mean of every franchise's raw average.
 * Draft Score = raw average minus this, so 0.0 is the average NHL franchise. Must match pipeline/grade_quality.py.
 */
export function leagueAverage(picks: PickRow[], filter: GradeFilter): number {
  const byTeam = new Map<string, PickRow[]>();
  for (const pick of picks) {
    if (!inRange(pick, filter)) continue;
    const list = byTeam.get(pick.franchise) ?? [];
    list.push(pick);
    byTeam.set(pick.franchise, list);
  }
  const raws: number[] = [];
  for (const rows of byTeam.values()) {
    const scores = gradedScores(rows);
    if (scores.length) raws.push(scoutingAverage(scores));
  }
  return raws.length ? raws.reduce((sum, value) => sum + value, 0) / raws.length : 0;
}

/** Team Draft Scores for a filter. Developing picks are left out. A plain average, with only the #1 overall upside capped, centered on the league. */
export function gradeTeams(
  picks: PickRow[],
  teams: { abbr: string; name: string; short: string; color: string }[],
  filter: GradeFilter,
): FilteredTeam[] {
  const league = leagueAverage(picks, filter);
  const rows: FilteredTeam[] = [];
  for (const team of teams) {
    const owned = picks.filter((pick) => pick.franchise === team.abbr && inRange(pick, filter));
    const weighted = gradedScores(owned);
    if (weighted.length === 0) continue;
    rows.push({
      ...team,
      avg: round1(scoutingAverage(weighted) - league),
      total: round1(scoutingTotal(weighted)),
      n: weighted.length,
      developing: owned.filter((pick) => pick.developing).length,
      rating: 0,
      letter: "D-",
    });
  }
  const pool = rows.map((row) => row.avg);
  for (const row of rows) {
    const graded = ratingAndLetter(row.avg, pool);
    row.rating = graded.rating;
    row.letter = graded.letter;
  }
  rows.sort((a, b) => b.rating - a.rating || b.avg - a.avg || a.name.localeCompare(b.name));
  return rows;
}

export type GmGrade = {
  slug: string;
  person: string;
  team: string;
  teamName: string;
  color: string;
  startYear: number;
  endYear: number | null;
  avg: number;
  n: number;
  developing: number;
  rating: number;
  letter: string;
};

/** All-time GM grades. Short runs under the minimum are left off so interims do not lead the list. */
export function gradeEras(picks: PickRow[], eras: Era[], filter: GradeFilter, minimum = 15): GmGrade[] {
  const league = leagueAverage(picks, filter);
  const rows: GmGrade[] = [];
  for (const era of eras) {
    const end = era.endYear ?? filter.maxYear;
    const owned = picks.filter(
      (pick) => pick.franchise === era.team && pick.year >= era.startYear && pick.year <= end && inRange(pick, filter),
    );
    const graded = owned.filter((pick) => pick.included && pick.score != null);
    if (graded.length < minimum) continue;
    rows.push({
      slug: era.slug,
      person: era.person,
      team: era.team,
      teamName: era.teamName,
      color: era.color,
      startYear: era.startYear,
      endYear: era.endYear,
      avg: round1(
        shrinkGm(
          scoutingAverage(graded.map((pick) => ({ overall: pick.overall, score: pick.score as number }))) - league,
          graded.length,
        ),
      ),
      n: graded.length,
      developing: owned.filter((pick) => pick.developing).length,
      rating: 0,
      letter: "D-",
    });
  }
  const pool = rows.map((row) => row.avg);
  for (const row of rows) {
    const graded = ratingAndLetter(row.avg, pool);
    row.rating = graded.rating;
    row.letter = graded.letter;
  }
  rows.sort((a, b) => b.rating - a.rating || b.avg - a.avg || a.person.localeCompare(b.person));
  return rows;
}

export type ClassHighlight = {
  franchise: string;
  franchiseName: string;
  color: string;
  year: number;
  avg: number;
  n: number;
  letter: string;
  rating: number;
};

export type GemLeader = {
  franchise: string;
  franchiseName: string;
  color: string;
  count: number;
  rate: number;
  evaluated: number;
};

export type BustLeader = {
  franchise: string;
  franchiseName: string;
  color: string;
  rate: number;
  count: number;
  n: number;
};

export type HeroSet = {
  bestClass: ClassHighlight | null;
  bust: PickRow | null;
  gems: GemLeader | null;
  bustRate: BustLeader | null;
};

const BUST_LETTERS = new Set(["D+", "D", "D-"]);

function evaluatedFirstRound(pick: PickRow): boolean {
  return pick.overall <= 32 && !pick.developing && pick.letter != null && pick.milestone >= 6;
}

function isGemStamp(pick: PickRow): boolean {
  return pick.stamps.includes("STEAL") || pick.stamps.includes("LATE BLOOMER") || pick.stamps.includes("ELITE");
}

/** Callout cards for the current year, position, and round filters. */
export function heroSet(picks: PickRow[], teams: TeamInfo[], filter: GradeFilter): HeroSet {
  const owned = picks.filter((pick) => inRange(pick, filter));
  const included = owned.filter((pick) => pick.included && pick.score != null);
  const byClass = new Map<string, { franchise: string; year: number; picks: PickRow[] }>();
  for (const pick of owned) {
    const key = `${pick.franchise}-${pick.year}`;
    const row = byClass.get(key) ?? { franchise: pick.franchise, year: pick.year, picks: [] };
    row.picks.push(pick);
    byClass.set(key, row);
  }
  const classes: ClassHighlight[] = [];
  for (const row of byClass.values()) {
    const graded = row.picks.filter((pick) => pick.included && pick.score != null);
    if (graded.length < 5) continue;
    const team = teams.find((item) => item.abbr === row.franchise);
    classes.push({
      franchise: row.franchise,
      franchiseName: team?.name ?? row.picks[0]?.franchiseName ?? row.franchise,
      color: team?.color ?? "#f4f4f5",
      year: row.year,
      avg: round1(scoutingAverage(graded.map((pick) => ({ overall: pick.overall, score: pick.score as number })))),
      n: graded.length,
      letter: "D-",
      rating: 0,
    });
  }
  const pool = classes.map((row) => row.avg);
  for (const row of classes) {
    const graded = ratingAndLetter(row.avg, pool);
    row.rating = graded.rating;
    row.letter = graded.letter;
  }
  classes.sort((a, b) => b.avg - a.avg || b.n - a.n);
  const firstRound = included.filter((pick) => pick.overall <= 32);
  const bust = [...firstRound].sort((a, b) => (a.score as number) - (b.score as number) || a.overall - b.overall)[0] ?? null;

  let gems: GemLeader | null = null;
  let bustRate: BustLeader | null = null;
  for (const team of teams) {
    const rows = owned.filter((pick) => pick.franchise === team.abbr);
    const evaluated = rows.filter((pick) => pick.included && pick.score != null);
    const gemRows = evaluated.filter(isGemStamp);
    if (evaluated.length > 0 && gemRows.length > 0) {
      const candidate: GemLeader = {
        franchise: team.abbr,
        franchiseName: team.name,
        color: team.color,
        count: gemRows.length,
        evaluated: evaluated.length,
        rate: gemRows.length / evaluated.length,
      };
      if (!gems || candidate.count > gems.count || (candidate.count === gems.count && candidate.rate > gems.rate)) gems = candidate;
    }
    const sample = rows.filter(evaluatedFirstRound);
    if (sample.length >= 5) {
      const misses = sample.filter((pick) => BUST_LETTERS.has(pick.letter ?? "")).length;
      const candidate: BustLeader = {
        franchise: team.abbr,
        franchiseName: team.name,
        color: team.color,
        count: misses,
        n: sample.length,
        rate: misses / sample.length,
      };
      if (!bustRate || candidate.rate > bustRate.rate || (candidate.rate === bustRate.rate && candidate.n > bustRate.n)) {
        bustRate = candidate;
      }
    }
  }
  return { bestClass: classes[0] ?? null, bust, gems, bustRate };
}

/** GM grade for an arbitrary set of picks. The pool is other GM Draft Scores, so the letter stays comparable. */
export function gradeOwned(
  rows: PickRow[],
  pool: number[],
  league: number,
): { avg: number | null; n: number; developing: number; rating: number | null; letter: string | null } {
  const graded = rows.filter((pick) => pick.included && pick.score != null);
  const developing = rows.filter((pick) => pick.developing).length;
  if (graded.length === 0) return { avg: null, n: 0, developing, rating: null, letter: null };
  const avg = round1(
    shrinkGm(
      scoutingAverage(graded.map((pick) => ({ overall: pick.overall, score: pick.score as number }))) - league,
      graded.length,
    ),
  );
  if (graded.length < 5 || pool.length === 0) return { avg, n: graded.length, developing, rating: null, letter: null };
  const gradedLetter = ratingAndLetter(avg, pool);
  return { avg, n: graded.length, developing, rating: gradedLetter.rating, letter: gradedLetter.letter };
}
