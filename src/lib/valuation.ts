import { capCeiling, capSeasonStart, contracts, yearsLeft, type PlayerContract } from "./cap";
import { curves } from "./data";
import { ageAtSeason, nhlersFile, type AgePoint, type Group, type Nhler } from "./nhlers";
import { RATING_EXPONENT, toRating } from "./rating";
import { availabilityFor } from "./availability";

export { RATING_EXPONENT, toRating, ratingTone } from "./rating";

// Asset Value engine. One scale for every active NHL player and every draft pick.
//
//   1. Current form: Impact per 82 games over the last two seasons, weighted toward the
//      most recent one, then blended with the league average for his age so a small
//      sample cannot swing the number.
//   2. Age curve: the empirical Impact-by-age curve (see pipelines/draft-rater/asset_data.py)
//      moves that form forward year by year. Players in their early 20s project up,
//      players past 29 project down.
//   3. Market price: what NHL teams actually pay for Impact (fitted from today's contracts).
//      Contract surplus = what a player's projected Impact is worth, minus his AAV, summed
//      over the years left on his deal. Bargain deals with term are rewarded. Overpaid
//      deals go negative.
//   4. Draft picks are valued from the Draft Rater's expected Impact curves by slot and
//      put on the same scale.

/** Each later year is worth 8% less than the one before. */
export const DISCOUNT = 0.92;
/** A point of Impact is worth more to a trade partner than its market price: cap room and roster spots are scarce. */
export const PREMIUM = 1.9;
/** Players still on an entry-level deal give their team extra years of control at market prices. */
export const ELC_CONTROL_YEARS = 2;
export const ELC_CONTROL_WEIGHT = 0.75;
/** Everyone else: three years of re-sign rights, counted at 35% because he may leave or price himself out. */
export const EXTENSION_YEARS = 3;
export const EXTENSION_WEIGHT = 0.35;
/** Years used for the trajectory multiplier. */
export const TRAJECTORY_YEARS = 5;
/** Share of a pick's expected Impact that counts as value above a free replacement. */
export const PICK_SHARE = 0.8;
/** Draft years after the first one are worth less, one DISCOUNT step per year. */
export const FIRST_PICK_YEAR = capSeasonStart + 1;
const PRIOR_WEIGHT: Record<Group, number> = { F: 25, D: 25, G: 12 };
const MAX_MARKET_VALUE = capCeiling * 0.25;

// ---- Age curve ---------------------------------------------------------------------------

export function ageCurve(group: Group): AgePoint[] {
  return nhlersFile.ageCurve[group] ?? [];
}

/** Average Impact per 82 games (per season for goalies) at an age, extended past the sampled range. */
export function curveAt(group: Group, age: number): number {
  const points = ageCurve(group);
  if (!points.length) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  if (age <= first.age) return first.per82;
  if (age <= last.age) return points.find((point) => point.age === age)?.per82 ?? last.per82;
  const tail = points.slice(-4);
  const slope = Math.min(-1, (tail[tail.length - 1].per82 - tail[0].per82) / Math.max(1, tail.length - 1));
  const peak = Math.max(...points.map((point) => point.per82));
  return Math.max(peak * 0.3, last.per82 + slope * (age - last.age));
}

/** Ages within 3% of the peak, plus the single best age. */
export function primeWindow(group: Group): { from: number; to: number; peakAge: number; peak: number } {
  const points = ageCurve(group);
  const best = points.reduce((a, b) => (b.per82 > a.per82 ? b : a), points[0]);
  const near = points.filter((point) => point.per82 >= best.per82 * 0.97);
  return { from: near[0].age, to: near[near.length - 1].age, peakAge: best.age, peak: best.per82 };
}

// ---- Current form ------------------------------------------------------------------------

export type Form = {
  /** Blended rate: Impact per 82 games (goalies: per season). */
  rate: number;
  /** Rate from his own games only, or null when he has none in the last two seasons. */
  raw: number | null;
  /** Games (goalies: starts) behind the raw rate. */
  sample: number;
};

export function currentForm(player: Nhler | null, group: Group, age: number): Form {
  const prior = curveAt(group, age);
  const season = nhlersFile.season;
  const inProgress = nhlersFile.lastComplete < season;
  let num = 0;
  let den = 0;
  let sample = 0;
  const take = (year: number, recency: number) => {
    for (const [s, gp, impact, starts] of player?.ss ?? []) {
      if (s !== year) continue;
      const share = year === season && inProgress ? nhlersFile.progress : 1;
      const games = group === "G" ? starts : gp;
      if (games <= 0) continue;
      const rate = group === "G" ? impact / share : (impact / gp) * 82;
      num += recency * games * rate;
      den += recency * games;
      sample += games;
    }
  };
  take(season, 1.5);
  take(season - 1, 1.0);
  if (sample < 15) take(season - 2, 0.6);
  const raw = den > 0 ? num / den : null;
  const p0 = PRIOR_WEIGHT[group];
  // A player with no recent games starts from 85% of the average for his age.
  const rate = (num + p0 * prior * (raw == null ? 0.85 : 1)) / (den + p0);
  return { rate, raw, sample };
}

/** Average of next-five-year Impact relative to today. Above 1 means still climbing, below 1 means regressing. */
export function trajectory(group: Group, age: number): number {
  const base = curveAt(group, age);
  if (base <= 0) return 1;
  let sum = 0;
  for (let k = 0; k < TRAJECTORY_YEARS; k++) sum += curveAt(group, age + k) / base;
  return Math.max(0.5, Math.min(1.5, sum / TRAJECTORY_YEARS));
}

// ---- Market price ------------------------------------------------------------------------

export type Market = { r: number; p: number; b: number };

export type Candidate = { id: number; group: Group; age: number; form: Form; contract: PlayerContract; player: Nhler | null };

/** The lowest salary teams actually pay: the 3rd percentile of non-entry-level AAVs. */
function minSalary(): number {
  const aavs = Object.values(contracts.players)
    .filter((c) => !c.elc)
    .map((c) => c.aav)
    .sort((a, b) => a - b);
  return aavs[Math.floor(aavs.length * 0.03)] ?? 775_000;
}

export const MIN_SALARY = minSalary();

/** Fit salary = min + b * (rate - r)^p across veterans on non-entry-level deals. */
function fitMarket(rows: { x: number; aav: number }[]): Market {
  let best: (Market & { sse: number }) | null = null;
  const mean = rows.reduce((sum, row) => sum + row.x, 0) / Math.max(1, rows.length);
  for (let r = mean * 0.3; r <= mean * 1.05; r += mean * 0.025) {
    // Salaries are capped by the max contract, so true production value rises faster than pay does.
    // The exponent stays at 1.3 or higher so stars keep their surplus.
    for (let p = 1.3; p <= 1.7001; p += 0.1) {
      let sxy = 0;
      let sxx = 0;
      const xs = rows.map((row) => Math.pow(Math.max(0, row.x - r), p));
      rows.forEach((row, i) => {
        sxy += xs[i] * (row.aav - MIN_SALARY);
        sxx += xs[i] * xs[i];
      });
      if (sxx <= 0) continue;
      const b = sxy / sxx;
      let sse = 0;
      rows.forEach((row, i) => {
        sse += (MIN_SALARY + b * xs[i] - row.aav) ** 2;
      });
      if (!best || sse < best.sse) best = { r, p, b, sse };
    }
  }
  return best ? { r: best.r, p: best.p, b: best.b } : { r: mean * 0.6, p: 1, b: 100_000 };
}

export function marketValue(market: Market, rate: number): number {
  const value = MIN_SALARY + market.b * Math.pow(Math.max(0, rate - market.r), market.p);
  return Math.min(MAX_MARKET_VALUE, value);
}

// ---- Player assets -----------------------------------------------------------------------

export type YearRow = {
  season: number;
  age: number;
  /** Projected Impact per 82 games (goalies: per season). */
  rate: number;
  /** What that production costs on the open market. */
  market: number;
  /** What he is paid. Zero once the deal is over. */
  aav: number;
  /** Premium-priced value minus AAV, discounted back to today. */
  surplus: number;
  kind: "term" | "control";
};

export type PlayerAsset = {
  id: number;
  group: Group;
  age: number;
  aav: number;
  yearsLeft: number;
  elc: boolean;
  form: Form;
  trajectory: number;
  /** Market value of his current form per year, in dollars. */
  marketNow: number;
  years: YearRow[];
  /** Contract surplus over the term, in dollars. Negative when underwater. */
  termSurplus: number;
  /** Extra value from team control after an entry-level deal. */
  control: number;
  /** termSurplus + control, in dollars. */
  value: number;
  /** Discounted AAV over the term: what retained salary is worth to the team that receives him. */
  aavPv: number;
  /** 0-100 trade value (can be negative). */
  rating: number;
  /** Availability multiplier applied to projected value (1 = fully durable). */
  durability: number;
};

export type ValuationScale = {
  /** The value in dollars that rates 100. */
  uref: number;
  exponent: number;
  markets: Record<Group, Market>;
  minSalary: number;
};

const candidates: Candidate[] = [];
for (const [key, contract] of Object.entries(contracts.players)) {
  const id = Number(key);
  const player = nhlersFile.players[key] ?? null;
  const group: Group = player?.g ?? "F";
  const age = ageAtSeason(player?.bd, nhlersFile.season) ?? 26;
  candidates.push({ id, group, age, form: currentForm(player, group, age), contract, player });
}

const markets = {} as Record<Group, Market>;
for (const group of ["F", "D", "G"] as Group[]) {
  const rows = candidates
    .filter((c) => c.group === group && !c.contract.elc && c.form.raw != null && c.form.sample >= (group === "G" ? 20 : 41))
    .map((c) => ({ x: c.form.rate, aav: c.contract.aav }));
  markets[group] = fitMarket(rows);
}

function buildAsset(c: Candidate, uref: number): PlayerAsset {
  const market = markets[c.group];
  const base = curveAt(c.group, c.age);
  const left = yearsLeft(c.contract);
  const years: YearRow[] = [];
  let termSurplus = 0;
  let aavPv = 0;
  // Durability: players who miss lots of games deliver less of their per-game value.
  const durability = availabilityFor(c.id)?.durability ?? 1;
  for (let k = 0; k < left; k++) {
    const rate = durability * c.form.rate * (base > 0 ? curveAt(c.group, c.age + k) / base : 1);
    const mv = marketValue(market, rate);
    const surplus = Math.pow(DISCOUNT, k) * (PREMIUM * mv - c.contract.aav);
    termSurplus += surplus;
    aavPv += Math.pow(DISCOUNT, k) * c.contract.aav;
    years.push({ season: capSeasonStart + k, age: c.age + k, rate, market: mv, aav: c.contract.aav, surplus, kind: "term" });
  }
  // Years after the deal ends: the team holds re-sign rights. He would be paid market price, so only
  // the scarcity premium counts, and only for the share of cases where the team actually keeps him.
  let control = 0;
  const extra = c.contract.elc ? ELC_CONTROL_YEARS : EXTENSION_YEARS;
  const weight = c.contract.elc ? ELC_CONTROL_WEIGHT : EXTENSION_WEIGHT;
  for (let j = 0; j < extra; j++) {
    const k = left + j;
    const rate = durability * c.form.rate * (base > 0 ? curveAt(c.group, c.age + k) / base : 1);
    const mv = marketValue(market, rate);
    const surplus = weight * Math.pow(DISCOUNT, k) * (PREMIUM - 1) * mv;
    control += surplus;
    years.push({ season: capSeasonStart + k, age: c.age + k, rate, market: mv, aav: mv, surplus, kind: "control" });
  }
  const value = termSurplus + control;
  return {
    id: c.id,
    group: c.group,
    age: c.age,
    aav: c.contract.aav,
    yearsLeft: left,
    elc: !!c.contract.elc,
    form: c.form,
    trajectory: trajectory(c.group, c.age),
    marketNow: marketValue(market, c.form.rate),
    years,
    termSurplus,
    control,
    value,
    aavPv,
    rating: toRating(value, uref),
    durability,
  };
}

// ---- Draft picks -------------------------------------------------------------------------

export type PickTierId = "Top-5" | "Lottery" | "Mid-1st" | "Late-1st" | "Round 2" | "Round 3" | "Round 4" | "Round 5" | "Round 6" | "Round 7";

/** Slots each projected tier covers. */
const TIER_SLOTS: Record<PickTierId, [number, number]> = {
  "Top-5": [1, 5],
  Lottery: [6, 16],
  "Mid-1st": [17, 24],
  "Late-1st": [25, 32],
  "Round 2": [33, 64],
  "Round 3": [65, 96],
  "Round 4": [97, 128],
  "Round 5": [129, 160],
  "Round 6": [161, 192],
  "Round 7": [193, 224],
};

export const TIER_LABEL: Record<PickTierId, string> = {
  "Top-5": "Top-5",
  Lottery: "Lottery",
  "Mid-1st": "Mid-1st",
  "Late-1st": "Late-1st",
  "Round 2": "Round 2",
  "Round 3": "Round 3",
  "Round 4": "Rounds 4–7",
  "Round 5": "Rounds 4–7",
  "Round 6": "Rounds 4–7",
  "Round 7": "Rounds 4–7",
};

export function tiersForRound(round: number): PickTierId[] {
  if (round === 1) return ["Top-5", "Lottery", "Mid-1st", "Late-1st"];
  return [`Round ${round}` as PickTierId];
}

export function defaultTier(round: number): PickTierId {
  return round === 1 ? "Mid-1st" : (`Round ${round}` as PickTierId);
}

const PICK_HORIZON = 7;

/** Expected Impact the Draft Rater curves give a slot in each of its first seven NHL years. */
function expectedSeasons(slot: number): number[] {
  const out: number[] = [];
  const index = Math.min(slot, curves.maxPick);
  for (let h = 1; h <= PICK_HORIZON; h++) {
    const mix = (set: Record<string, number[]>) => {
      const now = set[String(h)]?.[index] ?? 0;
      const before = h === 1 ? 0 : (set[String(h - 1)]?.[index] ?? 0);
      return Math.max(0, now - before);
    };
    out.push(0.9 * mix(curves.skater) + 0.1 * mix(curves.goalie));
  }
  return out;
}

/** Dollar value of owning the pick at a slot, for the first draft year. */
function slotValue(slot: number, price: number): number {
  return expectedSeasons(slot).reduce((sum, impact, i) => sum + PICK_SHARE * PREMIUM * price * Math.pow(DISCOUNT, i + 1) * impact, 0);
}

export type PickTable = Record<PickTierId, number>;

// ---- Build everything ----------------------------------------------------------------------

// $ per Impact point near a typical first-line forward: the secant between a replacement-level and a good player.
const priceF = (marketValue(markets.F, markets.F.r + 40) - marketValue(markets.F, markets.F.r + 5)) / 35;

/** Dollar value of each projected pick tier (average over its slots). */
export const pickValuesUsd = {} as PickTable;
for (const [tier, [from, to]] of Object.entries(TIER_SLOTS) as [PickTierId, [number, number]][]) {
  let sum = 0;
  for (let slot = from; slot <= to; slot++) sum += slotValue(slot, priceF);
  pickValuesUsd[tier] = sum / (to - from + 1);
}

const rawValues = candidates.map((c) => buildAsset(c, 1).value);
const topValue = Math.max(...rawValues, pickValuesUsd["Top-5"]);

/** Everything on one scale. The top asset, player or pick, rates 100. */
export const scale: ValuationScale = { uref: topValue, exponent: RATING_EXPONENT, markets, minSalary: MIN_SALARY };

export const assets = new Map<number, PlayerAsset>(candidates.map((c) => [c.id, buildAsset(c, scale.uref)]));

export function assetFor(playerId: number | null | undefined): PlayerAsset | null {
  if (playerId == null) return null;
  return assets.get(playerId) ?? null;
}

const candidatesById = new Map(candidates.map((c) => [c.id, c]));

/**
 * Asset Value if this player signed a different contract: same form, age curve and market,
 * a new AAV and term starting next season. Used for "projected next contract" values.
 */
export function projectedAsset(playerId: number, aav: number, term: number): PlayerAsset | null {
  const base = candidatesById.get(playerId);
  if (!base) return null;
  const contract: PlayerContract = { aav, expires: capSeasonStart + 1 + Math.max(1, term), team: base.contract.team };
  return buildAsset({ ...base, age: base.age + 1, contract }, scale.uref);
}

export const pickRatings = Object.fromEntries(
  (Object.entries(pickValuesUsd) as [PickTierId, number][]).map(([tier, value]) => [tier, toRating(value, scale.uref)]),
) as PickTable;

const PROSPECT_MULTIPLIER: Record<0 | 1 | 2 | 3, number> = { 3: 1.35, 2: 1.0, 1: 0.7, 0: 0.4 };

/**
 * Value of a drafted prospect who is not in the NHL yet, in dollars. It starts from what his draft slot
 * is worth, scales by his projection tier, and shrinks as his seven-year window runs out.
 */
export function prospectUsd(overall: number, level: 0 | 1 | 2 | 3, draftPlus: number): number {
  const remaining = Math.max(0.3, (PICK_HORIZON - draftPlus) / PICK_HORIZON);
  return slotValue(Math.min(overall, 224), priceF) * PROSPECT_MULTIPLIER[level] * remaining;
}

/** A pick's value for a given draft year, in dollars. */
export function pickUsd(tier: PickTierId, year: number): number {
  return pickValuesUsd[tier] * Math.pow(DISCOUNT, Math.max(0, year - FIRST_PICK_YEAR));
}

export function pickRating(tier: PickTierId, year: number): number {
  return toRating(pickUsd(tier, year), scale.uref);
}
