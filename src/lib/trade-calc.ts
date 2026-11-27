import { gradeForMargin, ratingFill, toRating } from "./rating";
import type { TradeData, TradePick, TradePlayer, TradeTeam } from "./trade-data";
import type { PickTierId } from "./valuation";

// The Trade Machine's math, shared by /trade-machine and Card Studio's Trade Proposal card.
// Client-safe: works only on the TradeData the page ships.

export type TradeItem = {
  key: string;
  kind: "player" | "pick";
  id: string;
  from: string;
  to: string;
  /** Share of salary the sending team keeps, 0 to 0.5. Players only. */
  retain: number;
  tier?: PickTierId;
  /** The player agreed to waive his NMC / no-trade clause for this deal. */
  waived?: boolean;
};

export type TradeRow = { label: string; sub: string; rating: number; color: string };

export type TradeCalc = {
  team: TradeTeam;
  incoming: number;
  outgoing: number;
  net: number;
  capAfter: number;
  capDelta: number;
  grade: string;
  margin: number;
  rowsIn: TradeRow[];
  issues: string[];
};

export type TradeResult = {
  calcs: TradeCalc[];
  issues: string[];
  empty: boolean;
  fair: boolean;
  headline: string;
  sub: string;
};

export type TradeIndex = {
  teams: Map<string, TradeTeam>;
  players: Map<string, TradePlayer>;
  picks: Map<string, TradePick>;
};

export const tradeMoney = (value: number) => `$${(Math.abs(value) / 1_000_000).toFixed(2)}M`;

export function pickKey(pick: TradePick): string {
  return `k:${pick.team}:${pick.year}:${pick.round}:${pick.from}`;
}

export function indexTrade(data: TradeData): TradeIndex {
  return {
    teams: new Map(data.teams.map((team) => [team.abbr, team])),
    players: new Map(data.players.map((player) => [String(player.id), player])),
    picks: new Map(data.picks.map((pick) => [pickKey(pick), pick])),
  };
}

export function playerRating(data: TradeData, player: TradePlayer, retain: number): number {
  return toRating(player.usd + retain * player.aavPv, data.scale.uref, data.scale.exponent);
}

export function pickRating(data: TradeData, pick: TradePick, tier: PickTierId): number {
  return toRating(data.pickUsd[tier] * Math.pow(data.discount, Math.max(0, pick.year - data.firstPickYear)), data.scale.uref, data.scale.exponent);
}

export function itemValue(data: TradeData, index: TradeIndex, item: TradeItem): number {
  if (item.kind === "player") {
    const player = index.players.get(item.id);
    return player ? playerRating(data, player, item.retain) : 0;
  }
  const pick = index.picks.get(item.id);
  return pick ? pickRating(data, pick, item.tier ?? pick.defaultTier) : 0;
}

export function computeTrade(data: TradeData, index: TradeIndex, slots: string[], items: TradeItem[]): TradeResult {
  const values = items.map((item) => ({ item, value: itemValue(data, index, item) }));
  const moved = values.reduce((sum, row) => sum + Math.abs(row.value), 0);
  const size = Math.max(12, moved / 2);
  const calcs: TradeCalc[] = slots.map((abbr) => {
    const team = index.teams.get(abbr)!;
    let incoming = 0;
    let outgoing = 0;
    let capDelta = 0;
    const rowsIn: TradeRow[] = [];
    for (const { item, value } of values) {
      const retained = item.kind === "player" ? item.retain : 0;
      const player = item.kind === "player" ? index.players.get(item.id) : null;
      const hit = player ? player.aav * (1 - retained) : 0;
      if (item.to === abbr) {
        incoming += value;
        capDelta += hit;
        rowsIn.push(rowFor(data, index, item, value));
      }
      if (item.from === abbr) {
        outgoing += value;
        capDelta -= hit;
      }
    }
    const net = incoming - outgoing;
    const capAfter = team.capHit + capDelta;
    const issues: string[] = [];
    if (items.length) {
      if (capAfter > data.ceiling) issues.push(`${team.short} would be ${tradeMoney(capAfter - data.ceiling)} over the cap ceiling`);
      if (capAfter < data.floor) issues.push(`${team.short} would be ${tradeMoney(data.floor - capAfter)} under the cap floor`);
    }
    // Trade protection: a clause blocks the deal until the player waives it.
    for (const item of items) {
      if (item.kind !== "player" || item.from !== abbr || item.waived) continue;
      const player = index.players.get(item.id);
      if (player?.clauseWarning) issues.push(`${player.name}: ${player.clauseWarning}`);
    }
    const margin = net / size;
    return { team, incoming, outgoing, net, capAfter, capDelta, grade: gradeForMargin(margin), margin, rowsIn, issues };
  });

  const empty = items.length === 0;
  const issues = calcs.flatMap((calc) => calc.issues);
  const best = [...calcs].sort((a, b) => b.margin - a.margin)[0];
  const fair = !empty && Math.abs(best.margin) < 0.06 && calcs.every((calc) => Math.abs(calc.margin) < 0.06);
  const degree = best.margin >= 0.25 ? "Lopsided win" : best.margin >= 0.12 ? "Clear win" : "Narrow win";
  const headline = empty ? "Build a trade" : fair ? "Fair trade" : `${best.team.short} win this trade`;
  const sub = empty ? "Add players or picks from either roster." : fair ? "Both sides come out about even." : `${degree} · ${best.net >= 0 ? "+" : "−"}${Math.abs(Math.round(best.net))} Asset Value net`;
  return { calcs, issues, empty, fair, headline, sub };
}

function rowFor(data: TradeData, index: TradeIndex, item: TradeItem, value: number): TradeRow {
  if (item.kind === "player") {
    const player = index.players.get(item.id)!;
    return { label: player.name, sub: player.pos, rating: Math.round(value), color: ratingFill(value) };
  }
  const pick = index.picks.get(item.id)!;
  const tier = item.tier ?? pick.defaultTier;
  return { label: `${pick.year} Round ${pick.round}`, sub: data.pickLabel[tier], rating: Math.round(value), color: ratingFill(value) };
}

/* ------------------------------------------------------------------ */
/* Sharing a trade through the address bar                             */
/*   ?t=TOR,EDM&i=p8478402_EDM_25,kTOR.2027.1.TOR_EDM_Lottery          */
/*   ?player=ID[,ID]&to=ABBR   (rumor / profile shortcut)              */
/* ------------------------------------------------------------------ */

export function encodeTrade(slots: string[], items: TradeItem[]): string {
  const parts = items.map((item) => {
    if (item.kind === "player") {
      const bits = [`p${item.id}`, item.to];
      if (item.retain || item.waived) bits.push(String(Math.round(item.retain * 100)));
      if (item.waived) bits.push("w");
      return bits.join("_");
    }
    const [, team, year, round, from] = item.id.split(":");
    return [`k${team}.${year}.${round}.${from}`, item.to, item.tier ?? ""].join("_");
  });
  const params = new URLSearchParams();
  params.set("t", slots.join(","));
  if (parts.length) params.set("i", parts.join(","));
  return params.toString();
}

export function decodeTrade(search: string, data: TradeData, index: TradeIndex): { slots: string[]; items: TradeItem[] } | null {
  const params = new URLSearchParams(search);
  const t = params.get("t");
  if (t) {
    const slots = t.split(",").filter((abbr) => index.teams.has(abbr)).slice(0, 3);
    if (slots.length < 2 || new Set(slots).size !== slots.length) return null;
    const items: TradeItem[] = [];
    for (const raw of (params.get("i") ?? "").split(",").filter(Boolean)) {
      const [head, to, a, b] = raw.split("_");
      if (!slots.includes(to)) continue;
      if (head.startsWith("p")) {
        const player = index.players.get(head.slice(1));
        if (!player || !slots.includes(player.team) || player.team === to) continue;
        items.push({ key: `p:${player.id}`, kind: "player", id: String(player.id), from: player.team, to, retain: Math.min(0.5, Math.max(0, Number(a ?? 0) / 100 || 0)), waived: b === "w" });
      } else if (head.startsWith("k")) {
        const [team, year, round, from] = head.slice(1).split(".");
        const key = `k:${team}:${year}:${round}:${from}`;
        const pick = index.picks.get(key);
        if (!pick || !slots.includes(pick.team) || pick.team === to) continue;
        const tier = pick.tiers.includes(a as PickTierId) ? (a as PickTierId) : pick.defaultTier;
        items.push({ key, kind: "pick", id: key, from: pick.team, to, retain: 0, tier });
      }
    }
    return { slots, items };
  }

  const ids = (params.get("player") ?? "").split(",").filter(Boolean);
  const players = ids.map((id) => index.players.get(id)).filter((player): player is TradePlayer => Boolean(player));
  if (!players.length) return null;
  const home = players[0].team;
  const sorted = [...data.teams].sort((x, y) => x.name.localeCompare(y.name));
  const wanted = params.get("to");
  const to = wanted && index.teams.has(wanted) && wanted !== home ? wanted : sorted.find((team) => team.abbr !== home)!.abbr;
  const slots = [home, to];
  const items: TradeItem[] = players
    .filter((player) => slots.includes(player.team))
    .map((player) => ({ key: `p:${player.id}`, kind: "player", id: String(player.id), from: player.team, to: player.team === home ? to : home, retain: 0 }));
  return { slots, items };
}
