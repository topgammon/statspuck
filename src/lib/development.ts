import developmentJson from "../../data/draft-rater/development.json";

// Development Path data (Pillar 2), built nightly by pipelines/draft-rater/development.py.
// Server-side only: the file is large. Pages pass the slices they need to client components.

export type Bucket = "NHL" | "AHL" | "CHL" | "NCAA" | "USHL" | "SHL" | "Liiga" | "KHL" | "Other" | "None";

export type PlayerPath = {
  /** Primary league bucket for D+0 (draft origin) through D+6. */
  b: Bucket[];
  /** Games in that primary league each season. */
  gp: number[];
  /** NHL games each season. */
  nhl: number[];
  /** Raw league name with the most games each season. */
  lg: (string | null)[];
  /** Development value for picks with a complete D+6 window. */
  dev: number | null;
};

/** [id, name, overall, round, group, franchise, year, careerImpact, bucketIndexes D+0..D+6] */
export type CohortRow = [number, string, number, number, "F" | "D" | "G", string, number, number, number[]];

export type DevelopmentFile = {
  buckets: Bucket[];
  horizon: number;
  league: number;
  matureThrough: number;
  slot: Record<"S" | "G", { p25: number[]; p100: number[] }>;
  cohort: CohortRow[];
  paths: Record<string, PlayerPath>;
};

export const development = developmentJson as unknown as DevelopmentFile;

export function pathFor(pickId: number): PlayerPath | null {
  return development.paths[String(pickId)] ?? null;
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  NHL: "NHL",
  AHL: "AHL",
  CHL: "CHL",
  NCAA: "NCAA",
  USHL: "USHL / Jr. A",
  SHL: "SHL",
  Liiga: "Liiga",
  KHL: "KHL",
  Other: "Other Pro/Euro",
  None: "Not playing",
};

export const BUCKET_COLOR: Record<Bucket, string> = {
  NHL: "#E11D48",
  AHL: "#38BDF8",
  CHL: "#F59E0B",
  NCAA: "#8B5CF6",
  USHL: "#A78BFA",
  SHL: "#10B981",
  Liiga: "#34D399",
  KHL: "#F97316",
  Other: "#94A3B8",
  None: "#475569",
};

export type Tier = "top10" | "r1" | "r23" | "r47";

export function tierOf(overall: number, round: number): Tier {
  if (overall <= 10) return "top10";
  if (round === 1) return "r1";
  if (round <= 3) return "r23";
  return "r47";
}

export const TIER_LABEL: Record<Tier, string> = {
  top10: "Top 10",
  r1: "Round 1 (#11–32)",
  r23: "Rounds 2–3",
  r47: "Rounds 4–7",
};
