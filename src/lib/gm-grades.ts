import tradesJson from "../../data/draft-rater/trades.json";
import { capCeiling, contracts } from "./cap";
import { eras, teams } from "./data";
import { letterFor, ratingAndLetter } from "./grade";
import type { Era } from "./types";
import { assets } from "./valuation";

// Pillar 3: Asset & Trade Grade, and the 3-pillar Overall GM Grade.
//
//   Trade Track Record  - net Impact over five seasons (what a team's trades brought in minus what they
//                         sent out), summed over the trades made while the GM held the job.
//                         Pipeline: pipelines/draft-rater/fetch_trades.py.
//   Contract Efficiency - for the current GM: how much more production the roster delivers than its
//                         salary would buy on the open market, as a share of the cap.
//
// Both are turned into scores around 0.0 (league average), shrunk for short tenures, then ranked
// against every other GM to get a percentile rating and a letter, the same way Draft and Development are.

/** One piece of a trade: label, Impact value over five seasons, and "p" for a player or "k" for a pick. Players come first. */
export type TradePiece = [string, number, "p" | "k"];

export type TradeSide = { id: string; d: string; t: string; net: number; in: TradePiece[]; out: TradePiece[] };

type TradesFile = { asOf: string; from: string; horizon: number; sides: TradeSide[] };

const file = tradesJson as unknown as TradesFile;
export const tradeSides = file.sides;
export const tradesFrom = file.from;

/** Trades count as 6 trades of zero before the real ones, so one lucky deal cannot make a grade. */
const TRADE_PRIOR = 6;
const MIN_TRADES = 2;
const TRADE_WEIGHT = 0.65;
const CONTRACT_WEIGHT = 0.35;

export type PillarLite = { letter: string | null; rating: number | null; score: number | null };

export type AssetGrade = {
  score: number;
  rating: number;
  letter: string;
  trades: number;
  /** Net Impact across all his trades, over five seasons. */
  net: number;
  /** Contract efficiency as % of the cap, current GMs only. */
  efficiency: number | null;
  best: TradeSide | null;
  worst: TradeSide | null;
  recent: TradeSide[];
};

export type GmReport = {
  draft: PillarLite;
  dev: PillarLite;
  asset: AssetGrade | null;
  overall: { letter: string; rating: number; pillars: number } | null;
};

function tenure(era: Era): { from: string; to: string } {
  return { from: `${era.startYear}-06-25`, to: era.endYear == null ? "9999-12-31" : `${era.endYear + 1}-06-25` };
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const sd = (values: number[]) => {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2))) || 1;
};

/** (market value of current production - salary) / cap, in percent, for every contracted player on a team. */
function contractEfficiency(abbr: string): number | null {
  let surplus = 0;
  let n = 0;
  for (const [key, contract] of Object.entries(contracts.players)) {
    if (contract.team !== abbr) continue;
    const asset = assets.get(Number(key));
    if (!asset) continue;
    surplus += asset.marketNow - contract.aav;
    n += 1;
  }
  return n ? (surplus / capCeiling) * 100 : null;
}

const efficiencyByTeam = new Map(teams.map((team) => [team.abbr, contractEfficiency(team.abbr)]));

type Row = { era: Era; sides: TradeSide[]; net: number; tradeScore: number; efficiency: number | null };

function summarize(side: TradeSide[]) {
  const sorted = [...side].sort((a, b) => b.net - a.net);
  return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null, recent: [...side].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 5) };
}

function build(): Map<string, GmReport> {
  const rows: Row[] = eras.map((era) => {
    const window = tenure(era);
    const sides = tradeSides.filter((side) => side.t === era.team && side.d >= window.from && side.d < window.to);
    const net = sides.reduce((sum, side) => sum + side.net, 0);
    return { era, sides, net, tradeScore: net / (sides.length + TRADE_PRIOR), efficiency: era.endYear == null ? (efficiencyByTeam.get(era.team) ?? null) : null };
  });

  const withTrades = rows.filter((row) => row.sides.length >= 1 && row.era.endYear !== undefined);
  const tradeMean = mean(withTrades.map((row) => row.tradeScore));
  const tradeSd = sd(withTrades.map((row) => row.tradeScore));
  const effPool = [...efficiencyByTeam.values()].filter((v): v is number => v != null);
  const effMean = mean(effPool);
  const effSd = sd(effPool);

  const scored = rows.map((row) => {
    const zTrade = row.sides.length >= 1 ? (row.tradeScore - tradeMean) / tradeSd : null;
    const years = row.era.endYear == null ? new Date().getFullYear() - row.era.startYear + 1 : row.era.endYear - row.era.startYear + 1;
    const zContract = row.efficiency != null ? ((row.efficiency - effMean) / effSd) * Math.min(1, years / 3) : null;
    let z: number | null = null;
    if (zTrade != null && zContract != null) z = TRADE_WEIGHT * zTrade + CONTRACT_WEIGHT * zContract;
    else if (zTrade != null && row.sides.length >= MIN_TRADES) z = zTrade;
    else if (zContract != null && zTrade == null) z = CONTRACT_WEIGHT * zContract;
    return { row, score: z == null ? null : Math.round(z * 100) / 10 };
  });

  const pool = scored.filter((s) => s.score != null).map((s) => s.score as number);
  const reports = new Map<string, GmReport>();
  for (const { row, score } of scored) {
    const era = row.era;
    let asset: AssetGrade | null = null;
    if (score != null) {
      const grade = ratingAndLetter(score, pool);
      asset = { score, rating: grade.rating, letter: grade.letter, trades: row.sides.length, net: Math.round(row.net), efficiency: row.efficiency, ...summarize(row.sides) };
    }
    const draft: PillarLite = { letter: era.letter, rating: era.rating, score: era.avg };
    const dev: PillarLite = { letter: era.dev?.letter ?? null, rating: era.dev?.rating ?? null, score: era.dev?.avg ?? null };
    const ratings = [draft.rating, dev.rating, asset?.rating ?? null].filter((v): v is number => v != null);
    const overall = ratings.length >= 2 ? (() => {
      const rating = Math.round(mean(ratings));
      return { rating, letter: letterFor(rating), pillars: ratings.length };
    })() : null;
    reports.set(era.slug, { draft, dev, asset, overall });
  }
  return reports;
}

const reports = build();

export function gmReport(slug: string): GmReport | null {
  return reports.get(slug) ?? null;
}

/** Just the letters and ratings, for the sortable GM leaderboard. */
export type GmReportLite = { overall: { letter: string; rating: number } | null; asset: { letter: string; rating: number; score: number } | null; dev: { letter: string; rating: number } | null };

export function gmReportsLite(): Record<string, GmReportLite> {
  const out: Record<string, GmReportLite> = {};
  for (const [slug, report] of reports) {
    out[slug] = {
      overall: report.overall ? { letter: report.overall.letter, rating: report.overall.rating } : null,
      asset: report.asset ? { letter: report.asset.letter, rating: report.asset.rating, score: report.asset.score } : null,
      dev: report.dev.letter && report.dev.rating != null ? { letter: report.dev.letter, rating: report.dev.rating } : null,
    };
  }
  return out;
}

// ---- Team trade record (all GMs since 2009-10) --------------------------------------------------

export type TeamTradeReport = { letter: string; rating: number; score: number; trades: number; net: number; best: TradeSide | null; worst: TradeSide | null; recent: TradeSide[] };

function buildTeams(): Map<string, TeamTradeReport> {
  const raw = teams.map((team) => {
    const sides = tradeSides.filter((side) => side.t === team.abbr);
    const net = sides.reduce((sum, side) => sum + side.net, 0);
    return { abbr: team.abbr, sides, net, score: net / (sides.length + TRADE_PRIOR) };
  });
  const pool = raw.map((row) => Math.round(row.score * 10) / 10);
  const out = new Map<string, TeamTradeReport>();
  for (const row of raw) {
    const score = Math.round(row.score * 10) / 10;
    const grade = ratingAndLetter(score, pool);
    out.set(row.abbr, { letter: grade.letter, rating: grade.rating, score, trades: row.sides.length, net: Math.round(row.net), ...summarize(row.sides) });
  }
  return out;
}

const teamReports = buildTeams();

export function teamTradeReport(abbr: string): TeamTradeReport | null {
  return teamReports.get(abbr) ?? null;
}
