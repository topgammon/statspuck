import draftCapitalJson from "../../data/draft_capital.json";
import { pickRating as pickRatingFor, defaultTier } from "./valuation";

// Team Draft Capital Inventory: every franchise's 2027-2029 picks, Rounds 1-7, synced nightly
// (pipelines/draft-rater/fetch_contracts.py -> data/draft_capital.json).

export type CapitalPick = {
  y: number;
  r: number;
  /** Team that originally held the slot. */
  orig: string;
  /** Team that owns it today. */
  owner: string;
  cond?: boolean;
  note?: string;
};

type File = { asOf: string; years: number[]; picks: CapitalPick[] };

const file = draftCapitalJson as unknown as File;

export const draftCapital = file.picks;
export const capitalYears = file.years;
export const capitalAsOf = file.asOf;
export const ROUNDS = [1, 2, 3, 4, 5, 6, 7];

/** Asset Value of a pick at its default projected tier (Round 1 counts as a mid-first). */
export function capitalRating(pick: { y: number; r: number }): number {
  return pickRatingFor(defaultTier(pick.r), pick.y);
}

export type MatrixCell = {
  y: number;
  r: number;
  /** Picks the team holds in this slot: its own and any acquired. */
  held: { orig: string; rating: number; cond: boolean; own: boolean }[];
  /** Its own pick, if it was traded away, and who has it. */
  awayTo: string | null;
  note: string | null;
};

export type DraftCapitalSummary = {
  matrix: MatrixCell[];
  /** Sum of Asset Value across every pick held. */
  total: number;
  held: number;
  acquired: number;
  tradedAway: number;
};

export function draftCapitalFor(abbr: string): DraftCapitalSummary {
  const matrix: MatrixCell[] = [];
  let total = 0;
  let held = 0;
  let acquired = 0;
  let tradedAway = 0;
  for (const y of capitalYears) {
    for (const r of ROUNDS) {
      const mine = draftCapital.filter((pick) => pick.y === y && pick.r === r && pick.owner === abbr);
      const own = draftCapital.find((pick) => pick.y === y && pick.r === r && pick.orig === abbr);
      const away = own && own.owner !== abbr ? own : null;
      const cell: MatrixCell = {
        y,
        r,
        held: mine.map((pick) => ({ orig: pick.orig, rating: capitalRating(pick), cond: !!pick.cond, own: pick.orig === abbr })),
        awayTo: away ? away.owner : null,
        note: away?.note ?? null,
      };
      for (const pick of cell.held) {
        total += pick.rating;
        held += 1;
        if (!pick.own) acquired += 1;
      }
      if (away) tradedAway += 1;
      matrix.push(cell);
    }
  }
  return { matrix, total, held, acquired, tradedAway };
}
