import type { Bucket, CohortRow, Tier } from "@/lib/development";

// Client-safe helpers for the /development page. No big data imports here.

export type Row = {
  id: number;
  name: string;
  overall: number;
  round: number;
  group: "F" | "D" | "G";
  franchise: string;
  year: number;
  qg: number;
  path: Bucket[];
  tier: Tier;
};

export function toRows(cohort: CohortRow[], buckets: Bucket[]): Row[] {
  return cohort.map(([id, name, overall, round, group, franchise, year, qg, path]) => ({
    id,
    name,
    overall,
    round,
    group,
    franchise,
    year,
    qg,
    path: path.map((index) => buckets[index]),
    tier: overall <= 10 ? "top10" : round === 1 ? "r1" : round <= 3 ? "r23" : "r47",
  }));
}

export type Summary = {
  n: number;
  rate25: number;
  rate100: number;
  avgImpact: number;
  yearsToNhl: number | null;
  reachedNhl: number;
  examples: Row[];
};

export function summarize(rows: Row[]): Summary {
  const n = rows.length;
  if (!n) return { n: 0, rate25: 0, rate100: 0, avgImpact: 0, yearsToNhl: null, reachedNhl: 0, examples: [] };
  const firstNhl = rows
    .map((row) => row.path.findIndex((bucket, index) => index >= 1 && bucket === "NHL"))
    .filter((index) => index >= 1);
  return {
    n,
    rate25: rows.filter((row) => row.qg >= 25).length / n,
    rate100: rows.filter((row) => row.qg >= 100).length / n,
    avgImpact: rows.reduce((sum, row) => sum + row.qg, 0) / n,
    yearsToNhl: firstNhl.length ? firstNhl.reduce((sum, value) => sum + value, 0) / firstNhl.length : null,
    reachedNhl: firstNhl.length,
    examples: [...rows].sort((a, b) => b.qg - a.qg).slice(0, 3),
  };
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Ribbon colour by share of players who made the NHL (25+ career Impact). */
export function rateColor(rate: number): string {
  if (rate >= 0.6) return "#10B981";
  if (rate >= 0.35) return "#38BDF8";
  if (rate >= 0.15) return "#5B7BA6";
  return "#3A4150";
}

export const TIERS: { id: "all" | Tier; label: string }[] = [
  { id: "all", label: "All" },
  { id: "top10", label: "Top 10" },
  { id: "r1", label: "Round 1 (#11–32)" },
  { id: "r23", label: "Rounds 2–3" },
  { id: "r47", label: "Rounds 4–7" },
];
