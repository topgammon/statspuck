import { capCeiling, capShare, type PlayerContract } from "./cap";
import { ageAtSeason, nhlerFor, nhlersFile } from "./nhlers";
import { profileRows, type ProfileRow } from "./profiles";
import { projectedAsset } from "./valuation";

// Fair-Market Contract Comparables.
//
// For a player, find the 5 closest NHL players on standard (non-entry-level) contracts:
// same position group, age within a year (widened only if the pool is too small), and the
// nearest 2-year Impact per 82 pace and Overall Skill Rating. Their cap shares, adjusted for
// the Impact gap and weighted toward the closest matches, give a fair-market AAV at today's
// cap ceiling.
//
// Two honest limits of the free cap feed: it lists contracts on the books today (not ones that
// already ended), and only their remaining seasons (not when they were signed). So:
//   - players signing at 32+ get an age discount, since most comparable deals were signed younger;
//   - expected term follows the typical NHL term at that signing age.

export type Comp = {
  playerId: number;
  routeId: number;
  name: string;
  pos: string;
  team: string | null;
  age: number;
  rate: number;
  skill: number | null;
  aav: number;
  capPct: number;
  expires: number;
  clause: string | null;
  headshot: boolean;
  /** 0-100, how close the match is. */
  similarity: number;
};

export type FairValue = {
  aav: number;
  capPct: number;
  term: number;
  comps: Comp[];
  /** Actual AAV vs fair AAV. Null for players without a standard contract. */
  verdict: "Bargain" | "Fair Market" | "Overpaid" | null;
  /** Actual / fair. */
  ratio: number | null;
};

type PoolRow = { row: ProfileRow; age: number; rate: number; skill: number | null; contract: PlayerContract };

function ageOf(playerId: number): number | null {
  return ageAtSeason(nhlerFor(playerId)?.bd, nhlersFile.season);
}

let pool: PoolRow[] | null = null;
function marketPool(): PoolRow[] {
  if (pool) return pool;
  pool = [];
  for (const row of profileRows()) {
    if (!row.active || !row.contract || row.contract.elc || row.recentRate == null) continue;
    const age = ageOf(row.playerId);
    if (age == null) continue;
    pool.push({ row, age, rate: row.recentRate, skill: row.skills?.current ? row.skills.overall : null, contract: row.contract });
  }
  return pool;
}

/** Typical NHL contract length by age at signing (players and teams both price in decline). */
export function typicalTerm(age: number, skill: number | null): number {
  if (age <= 23) return skill != null && skill >= 85 ? 8 : 3; // stars lock in long-term; others bridge
  if (age <= 26) return skill != null && skill >= 80 ? 7 : 4;
  if (age <= 28) return 6;
  if (age === 29) return 5;
  if (age === 30) return 4;
  if (age === 31) return 3;
  if (age <= 33) return 2;
  return 1;
}

/**
 * Fair value for a player. `ageShift` projects a future signing (1 = next summer's contract).
 * Returns null when we cannot rate him (no recent NHL form).
 */
export function fairValue(playerId: number, ageShift = 0): FairValue | null {
  const me = profileRows().find((row) => row.playerId === playerId);
  const baseAge = ageOf(playerId);
  if (!me || me.recentRate == null || baseAge == null) return null;
  const age = baseAge + ageShift;
  const skill = me.skills?.current ? me.skills.overall : null;
  const rateScale = me.group === "G" ? 8 : 18;

  let candidates: (PoolRow & { distance: number })[] = [];
  for (const window of [1, 2, 3]) {
    candidates = marketPool()
      .filter((p) => p.row.playerId !== playerId && p.row.group === me.group && Math.abs(p.age - age) <= window)
      .map((p) => {
        const dRate = (p.rate - (me.recentRate as number)) / rateScale;
        const dSkill = skill != null && p.skill != null ? (p.skill - skill) / 6 : 0.5;
        const dAge = (p.age - age) / 2;
        return { ...p, distance: Math.sqrt(dRate * dRate + dSkill * dSkill + dAge * dAge) };
      });
    if (candidates.length >= 8) break;
  }
  const top = candidates.sort((a, b) => a.distance - b.distance).slice(0, 5);
  if (top.length < 3) return null;

  const weights = top.map((p) => 1 / (p.distance + 0.25));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  // Scale each comparable by the production gap, so a player better than every comp is not
  // dragged down to their level (and a weaker one is not lifted to it).
  const adjust = (p: PoolRow) => Math.max(0.75, Math.min(1.35, Math.pow(Math.max(1, me.recentRate as number) / Math.max(1, p.rate), 0.6)));
  const rawPct = top.reduce((sum, p, i) => sum + weights[i] * capShare(p.contract.aav) * adjust(p), 0) / totalWeight;
  // Signing at 32+: comparable deals were mostly signed years younger, so take 8% off per year past 31.
  const ageFactor = Math.max(0.55, 1 - 0.08 * Math.max(0, age - 31));
  const capPct = rawPct * ageFactor;
  const aav = Math.round((capPct * capCeiling) / 10_000) * 10_000;
  const term = typicalTerm(age, skill);

  const actual = me.contract && !me.contract.elc ? me.contract.aav : null;
  const ratio = actual != null && aav > 0 ? actual / aav : null;
  const verdict = ratio == null ? null : ratio < 0.85 ? "Bargain" : ratio > 1.15 ? "Overpaid" : "Fair Market";

  return {
    aav,
    capPct: Math.round(capPct * 1000) / 10,
    term,
    verdict,
    ratio,
    comps: top.map((p) => ({
      playerId: p.row.playerId,
      routeId: p.row.routeId,
      name: p.row.name,
      pos: p.row.pos,
      team: p.row.team,
      age: p.age,
      rate: Math.round(p.rate * 10) / 10,
      skill: p.skill,
      aav: p.contract.aav,
      capPct: Math.round(capShare(p.contract.aav) * 1000) / 10,
      expires: p.contract.expires,
      clause: p.contract.clause ?? null,
      headshot: p.row.hasHeadshot,
      similarity: Math.max(0, Math.min(100, Math.round(100 - p.distance * 30))),
    })),
  };
}

/** Next contract for a pending free agent, plus what that deal would be worth on the Asset Value scale. */
export function nextContract(playerId: number): { aav: number; capPct: number; term: number; asset: number | null } | null {
  const fair = fairValue(playerId, 1);
  if (!fair) return null;
  const asset = projectedAsset(playerId, fair.aav, fair.term);
  return { aav: fair.aav, capPct: fair.capPct, term: fair.term, asset: asset ? Math.round(asset.rating) : null };
}
