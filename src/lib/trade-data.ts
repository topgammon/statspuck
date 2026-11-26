import headshotsJson from "../../data/draft-rater/headshots.json";
import { classify, prospectTier, type Archetype } from "./archetypes";
import { capCeiling, capFloor, contracts } from "./cap";
import { picks, teams as teamList } from "./data";
import { draftCapital } from "./draft-capital";
import { nhlersFile } from "./nhlers";
import { DISCOUNT, FIRST_PICK_YEAR, assets, defaultTier, pickValuesUsd, scale, tiersForRound, TIER_LABEL, type PickTierId } from "./valuation";
import { ageOn } from "./vitals";

// Everything the interactive Trade Machine needs, flattened into plain numbers so it can ship to the browser.

export type TradePlayer = {
  id: number;
  name: string;
  team: string;
  pos: string;
  group: "F" | "D" | "G";
  age: number | null;
  headshot: boolean;
  aav: number;
  expires: number;
  yearsLeft: number;
  elc: boolean;
  archetype: Archetype | null;
  /** Projection pill for DEVELOPING prospects. */
  tier: { label: string; level: 0 | 1 | 2 | 3; tip: string } | null;
  /** Contract surplus + control value in $M. */
  usd: number;
  /** Discounted salary over the term in $M: what retained money is worth to the receiving team. */
  aavPv: number;
  rating: number;
  trajectory: number;
};

export type TradeTeam = {
  abbr: string;
  name: string;
  short: string;
  color: string;
  capHit: number;
  capSpace: number;
};

/** `team` owns it today. `from` is the team that originally held the slot. */
export type TradePick = { team: string; year: number; round: number; from: string; cond: boolean; defaultTier: PickTierId; tiers: PickTierId[] };

/** A team's own pick that now belongs to someone else. */
export type TradeAway = { team: string; year: number; round: number; to: string };

export type TradeData = {
  season: string;
  ceiling: number;
  floor: number;
  asOf: string | null;
  teams: TradeTeam[];
  players: TradePlayer[];
  picks: TradePick[];
  away: TradeAway[];
  /** Value of each projected pick tier in $M, for the first draft year. */
  pickUsd: Record<string, number>;
  pickLabel: Record<string, string>;
  scale: { uref: number; exponent: number };
  discount: number;
  firstPickYear: number;
};

const headshots = headshotsJson as Record<string, boolean>;
const pickByPlayerId = new Map(picks.filter((pick) => pick.playerId != null).map((pick) => [pick.playerId as number, pick]));

export function buildTradeData(): TradeData {
  const players: TradePlayer[] = [];
  for (const [key, contract] of Object.entries(contracts.players)) {
    const id = Number(key);
    const asset = assets.get(id);
    const team = contract.team;
    if (!asset || !team) continue;
    const record = nhlersFile.players[key];
    const pick = pickByPlayerId.get(id);
    const name = record?.n ?? pick?.name;
    if (!name) continue;
    const tier = pick ? prospectTier(pick) : null;
    players.push({
      id,
      name,
      team,
      pos: record?.pos || pick?.pos || asset.group,
      group: asset.group,
      age: record?.bd ? ageOn(record.bd, nhlersFile.asOf) : null,
      headshot: headshots[key] ?? true,
      aav: contract.aav,
      expires: contract.expires,
      yearsLeft: asset.yearsLeft,
      elc: asset.elc,
      archetype: classify(record ?? null),
      tier: tier ? { label: tier.label, level: tier.level, tip: tier.tip } : null,
      usd: asset.value / 1_000_000,
      aavPv: asset.aavPv / 1_000_000,
      rating: asset.rating,
      trajectory: asset.trajectory,
    });
  }
  players.sort((a, b) => b.rating - a.rating);

  // The real inventory: each pick sits with its current owner, tagged with the team it came from.
  const tradePicks: TradePick[] = draftCapital.map((pick) => ({
    team: pick.owner,
    year: pick.y,
    round: pick.r,
    from: pick.orig,
    cond: !!pick.cond,
    defaultTier: defaultTier(pick.r),
    tiers: tiersForRound(pick.r),
  }));
  tradePicks.sort((a, b) => a.year - b.year || a.round - b.round || a.from.localeCompare(b.from));
  const away: TradeAway[] = draftCapital.filter((pick) => pick.owner !== pick.orig).map((pick) => ({ team: pick.orig, year: pick.y, round: pick.r, to: pick.owner }));

  return {
    season: contracts.season,
    ceiling: capCeiling,
    floor: capFloor,
    asOf: contracts.asOf,
    teams: teamList.map((team) => {
      const cap = contracts.teams[team.abbr];
      return { abbr: team.abbr, name: team.name, short: team.short, color: team.color, capHit: cap?.capHit ?? 0, capSpace: cap?.capSpace ?? 0 };
    }),
    players,
    picks: tradePicks,
    away,
    pickUsd: Object.fromEntries(Object.entries(pickValuesUsd).map(([tier, value]) => [tier, value / 1_000_000])),
    pickLabel: TIER_LABEL,
    scale: { uref: scale.uref / 1_000_000, exponent: scale.exponent },
    discount: DISCOUNT,
    firstPickYear: FIRST_PICK_YEAR,
  };
}
