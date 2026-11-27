import { tradeSides } from "./gm-grades";

// NHL trade history for one player, from the 2005-06+ trade file. Trades list players by
// name, so we match on the exact name the profile uses.

export type PlayerTrade = { id: string; date: string; to: string; from: string | null; gave: string[]; got: string[] };

export function playerTrades(name: string): PlayerTrade[] {
  const out: PlayerTrade[] = [];
  for (const side of tradeSides) {
    if (!side.in.some(([piece, , kind]) => kind === "p" && piece === name)) continue;
    const teams = side.id.slice(11).split("-");
    const from = teams.find((team) => team !== side.t) ?? null;
    out.push({
      id: side.id,
      date: side.d,
      to: side.t,
      from,
      // What the acquiring team sent away, and what else came with him.
      gave: side.out.map(([piece]) => piece),
      got: side.in.filter(([piece]) => piece !== name).map(([piece]) => piece),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
