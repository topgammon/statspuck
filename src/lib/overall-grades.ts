import { eras, leaderboard, meta, picks } from "./data";
import { letterFor, ratingAndLetter, gradeOwned } from "./grade";
import { summarize, teamTradeReport, tradeSides, type AssetGrade, type GmReport } from "./gm-grades";
import type { Era, PickRow } from "./types";

// Overall grades.
//
//   Team Overall Grade - average of the Draft, Development and Trades ratings (0-100), each
//                        already ranked against the other franchises.
//   GM Career Grade    - a GM is graded on his whole career, every team he ran since 2005:
//                        Drafting on every pick he made, Development weighted by picks, and
//                        Trades on every trade, each ranked against every other GM career.
//                        The Overall is the average of the pillars with data (2+ needed).
// Single-team grades still exist (gmReport in gm-grades.ts) for the "with this team" view.

export type OverallGrade = { rating: number; letter: string; pillars: number };

function overallOf(ratings: (number | null | undefined)[]): OverallGrade | null {
  const have = ratings.filter((value): value is number => value != null);
  if (have.length < 2) return null;
  const rating = Math.round(have.reduce((a, b) => a + b, 0) / have.length);
  return { rating, letter: letterFor(rating), pillars: have.length };
}

// ---- Teams -----------------------------------------------------------------------------

const teamOverallMap = new Map<string, OverallGrade | null>(
  leaderboard.map((team) => [team.abbr, overallOf([team.rating, team.dev?.rating, teamTradeReport(team.abbr)?.rating])]),
);
const teamOverallRank = new Map(
  [...teamOverallMap.entries()]
    .filter((entry): entry is [string, OverallGrade] => entry[1] != null)
    .sort((a, b) => b[1].rating - a[1].rating)
    .map(([abbr], index) => [abbr, index + 1]),
);

export function teamOverall(abbr: string): (OverallGrade & { rank: number }) | null {
  const grade = teamOverallMap.get(abbr);
  return grade ? { ...grade, rank: teamOverallRank.get(abbr) ?? 0 } : null;
}

// ---- GM careers ------------------------------------------------------------------------

export type GmCareer = GmReport & {
  person: string;
  /** Every tenure, newest first. */
  stops: Era[];
  /** Newest tenure: where career links point. */
  latest: Era;
  current: boolean;
  firstYear: number;
  picks: PickRow[];
  draftAvg: number | null;
  draftN: number;
  devAvg: number | null;
  devN: number;
};

const TRADE_PRIOR = 6;
const MIN_TRADES = 2;

function picksFor(era: Era): PickRow[] {
  const end = era.endYear ?? meta.latestDraftYear;
  return picks.filter((pick) => pick.franchise === era.team && pick.year >= era.startYear && pick.year <= end && !pick.forfeited);
}

function windowOf(era: Era) {
  return { from: `${era.startYear}-06-25`, to: era.endYear == null ? "9999-12-31" : `${era.endYear + 1}-06-25` };
}

function build(): Map<string, GmCareer> {
  const byPerson = new Map<string, Era[]>();
  for (const era of eras) byPerson.set(era.person, [...(byPerson.get(era.person) ?? []), era]);
  const draftPool = eras.filter((era) => era.avg != null && era.n >= 5).map((era) => era.avg as number);

  type Raw = { person: string; stops: Era[]; picks: PickRow[]; devAvg: number | null; devN: number; sides: typeof tradeSides; net: number; tradeScore: number };
  const raws: Raw[] = [...byPerson.entries()].map(([person, list]) => {
    const stops = [...list].sort((a, b) => b.startYear - a.startYear);
    const seen = new Set<number>();
    const own = stops.flatMap(picksFor).filter((pick) => (seen.has(pick.id) ? false : (seen.add(pick.id), true)));
    const devs = stops.filter((era) => era.dev && era.dev.n > 0);
    const devN = devs.reduce((sum, era) => sum + era.dev!.n, 0);
    const devAvg = devN > 0 ? Math.round((devs.reduce((sum, era) => sum + era.dev!.avg * era.dev!.n, 0) / devN) * 10) / 10 : null;
    const sides = tradeSides.filter((side) => stops.some((era) => side.t === era.team && side.d >= windowOf(era).from && side.d < windowOf(era).to));
    const net = sides.reduce((sum, side) => sum + side.net, 0);
    return { person, stops, picks: own, devAvg, devN, sides, net, tradeScore: net / (sides.length + TRADE_PRIOR) };
  });

  const devPool = raws.filter((raw) => raw.devAvg != null).map((raw) => raw.devAvg as number);
  const traders = raws.filter((raw) => raw.sides.length >= MIN_TRADES);
  const mean = traders.reduce((sum, raw) => sum + raw.tradeScore, 0) / Math.max(1, traders.length);
  const sd = Math.sqrt(traders.reduce((sum, raw) => sum + (raw.tradeScore - mean) ** 2, 0) / Math.max(1, traders.length)) || 1;
  const tradePool = traders.map((raw) => Math.round(((raw.tradeScore - mean) / sd) * 10) / 10);

  const out = new Map<string, GmCareer>();
  for (const raw of raws) {
    const draft = gradeOwned(raw.picks, draftPool, meta.leagueAvg);
    const dev = raw.devAvg != null ? ratingAndLetter(raw.devAvg, devPool) : null;
    let asset: AssetGrade | null = null;
    if (raw.sides.length >= MIN_TRADES) {
      const score = Math.round(((raw.tradeScore - mean) / sd) * 10) / 10;
      const grade = ratingAndLetter(score, tradePool);
      asset = { score, rating: grade.rating, letter: grade.letter, trades: raw.sides.length, net: Math.round(raw.net), efficiency: null, ...summarize(raw.sides) };
    }
    const latest = raw.stops[0];
    out.set(raw.person, {
      person: raw.person,
      stops: raw.stops,
      latest,
      current: raw.stops.some((era) => era.endYear == null),
      firstYear: Math.min(...raw.stops.map((era) => era.startYear)),
      picks: raw.picks,
      draftAvg: draft.avg,
      draftN: draft.n,
      devAvg: raw.devAvg,
      devN: raw.devN,
      draft: { letter: draft.letter, rating: draft.rating, score: draft.avg },
      dev: { letter: dev?.letter ?? null, rating: dev?.rating ?? null, score: raw.devAvg },
      asset,
      overall: overallOf([draft.rating, dev?.rating, asset?.rating]),
    });
  }
  return out;
}

const careers = build();

export function gmCareer(person: string): GmCareer | null {
  return careers.get(person) ?? null;
}

export function allGmCareers(): GmCareer[] {
  return [...careers.values()];
}
