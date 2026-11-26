import { teams } from "./data";
import { gmOn, tradeSides, tradesFrom, type TradePiece } from "./gm-grades";
import { gradeForMargin } from "./rating";

// Trade Rater: every NHL trade since 2009-10, graded by what the pieces became. Same numbers as the
// GM Asset & Trades grade (five seasons of Impact after the deal), shown trade by trade.

export type RatedSide = {
  t: string;
  /** The general manager running the team on the trade date. */
  gm: { slug: string; person: string } | null;
  net: number;
  grade: string;
  margin: number;
  in: TradePiece[];
  out: TradePiece[];
};

export type RatedTrade = {
  id: string;
  d: string;
  sides: RatedSide[];
  /** The team that came out ahead, or null when it was about even. */
  winner: string | null;
  margin: number;
  /** Whole-trade size: how much Impact changed hands. */
  moved: number;
};

/** Trades newer than this many days are still unfolding. */
export const EARLY_DAYS = 365;

function build(): RatedTrade[] {
  const byId = new Map<string, typeof tradeSides>();
  for (const side of tradeSides) byId.set(side.id, [...(byId.get(side.id) ?? []), side]);
  const out: RatedTrade[] = [];
  for (const [id, sides] of byId) {
    const moved = sides.reduce((sum, side) => sum + side.in.reduce((s, piece) => s + piece[1], 0), 0);
    // A floor keeps tiny deals from reading as lopsided.
    const size = Math.max(60, moved / 2);
    const rated: RatedSide[] = sides.map((side) => ({ t: side.t, gm: gmOn(side.t, side.d), net: side.net, margin: side.net / size, grade: gradeForMargin(side.net / size), in: side.in, out: side.out }));
    const best = [...rated].sort((a, b) => b.margin - a.margin)[0];
    out.push({ id, d: sides[0].d, sides: rated, winner: best.margin >= 0.06 ? best.t : null, margin: best.margin, moved: Math.round(moved) });
  }
  return out.sort((a, b) => b.d.localeCompare(a.d) || a.id.localeCompare(b.id));
}

export const ratedTrades = build();
export const ratedFrom = tradesFrom;

export const teamOptions = teams.map((team) => ({ abbr: team.abbr, name: team.name, short: team.short })).sort((a, b) => a.name.localeCompare(b.name));
