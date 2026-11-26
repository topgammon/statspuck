import nhlersJson from "../../data/draft-rater/nhlers.json";

// Raw ingredients for Archetypes and Asset Value, built nightly by pipelines/draft-rater/asset_data.py.
// Server-side only: the file is large. Pages pass the slices they need to client components.

export type Group = "F" | "D" | "G";

/** [season start year, games, Impact, starts (goalies)] */
export type NhlerSeason = [number, number, number, number];

/** Totals over a skater's last three played seasons. Times are seconds. */
export type BoxWindow = {
  gp: number;
  g: number;
  a: number;
  pts: number;
  sog: number;
  blk: number;
  pim: number;
  fw: number;
  fl: number;
  ev: number;
  pp: number;
  pk: number;
  pm: number;
};

export type Nhler = {
  g: Group;
  pos: string;
  /** Last three played seasons, oldest first. */
  ss: NhlerSeason[];
  /** Career NHL games since 2005-06. */
  cgp: number;
  n?: string;
  bd?: string;
  /** Height in inches. */
  h?: number;
  /** Weight in pounds. */
  w?: number;
  b?: BoxWindow;
};

export type AgePoint = { age: number; per82: number; n: number };

export type NhlersFile = {
  asOf: string;
  /** Season in progress (start year), or the last complete one. */
  season: number;
  /** Share of the in-progress season played. */
  progress: number;
  lastComplete: number;
  ageCurve: Record<Group, AgePoint[]>;
  players: Record<string, Nhler>;
};

export const nhlersFile = nhlersJson as unknown as NhlersFile;

export function nhlerFor(playerId: number | null | undefined): Nhler | null {
  if (playerId == null) return null;
  return nhlersFile.players[String(playerId)] ?? null;
}

/** Age on October 1 of a season's start year. */
export function ageAtSeason(birthDate: string | undefined, season: number): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month) return null;
  let age = season - year;
  if (month > 10 || (month === 10 && day > 1)) age -= 1;
  return age;
}
