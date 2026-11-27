import capHistoryJson from "../../data/nhl-cap-history.json";
import historicalJson from "../../data/historical-contracts.json";
import { capCeiling, capSeasonStart, type PlayerContract } from "./cap";
import { ageAtSeason, nhlerFor, nhlersFile } from "./nhlers";
import { profileRows, type ProfileRow } from "./profiles";
import { projectedAsset } from "./valuation";

// Fair-Market Contract Comparables, in modern cap dollars.
//
// Comparable pool:
//   - every standard (non-entry-level) NHL contract on the books today, and
//   - a permanent archive of notable signings 2005-2026 (data/historical-contracts.json), each
//     with the player's age at signing and his two-season Impact pace and era-adjusted Skill
//     before the deal.
// Every deal is measured as a share of the cap in the season it started (data/nhl-cap-history.json).
// For today's contracts that are not in the archive, the free cap feed does not say when they
// were signed, so the start season is estimated and shown with "≈".
//
// Match: same position group, age at signing within 1.5 years (widened only if needed), then the
// closest pre-signing Impact per 82 and Skill. Projected AAV = average signing-year % of cap of the
// top 5 x today's cap ceiling. Expected term = median term of the comparables with a known term.

const CAPS: Record<number, number> = Object.fromEntries(
  Object.entries((capHistoryJson as unknown as { ceiling: Record<string, number> }).ceiling).map(([k, v]) => [Number(k), v]),
);

export function capInSeason(season: number): number {
  return CAPS[season] ?? (season < 2005 ? CAPS[2005] : capCeiling);
}

type Historical = {
  playerId: number;
  playerName: string;
  position: "F" | "D" | "G";
  signingYear: number;
  ageAtSigning: number | null;
  aav: number;
  term: number;
  signingCapPct: number;
  preImpact82: number | null;
  preSkill: number | null;
};

const archive = (historicalJson as unknown as { contracts: Historical[] }).contracts;

export type Comp = {
  playerId: number;
  routeId: number | null;
  name: string;
  pos: string;
  team: string | null;
  /** Age when the deal started. */
  age: number;
  rate: number;
  skill: number | null;
  aav: number;
  signingYear: number;
  /** Signing year estimated (today's contract not in the archive). */
  estimated: boolean;
  /** Share of the cap in the signing year. */
  capPct: number;
  /** The same share of today's cap. */
  todayAav: number;
  term: number | null;
  /** An archived deal (may have ended). */
  historical: boolean;
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
  /** His cap share at signing / the comparables' average. */
  ratio: number | null;
  /** His current deal measured the same way: signing year, cap share then, and that share of today's cap. */
  actual: { signingYear: number; estimated: boolean; capPct: number; todayAav: number } | null;
};

type PoolRow = {
  playerId: number;
  row: ProfileRow | null;
  name: string;
  group: "F" | "D" | "G";
  signAge: number;
  rate: number;
  skill: number | null;
  aav: number;
  signingYear: number;
  estimated: boolean;
  term: number | null;
  historical: boolean;
  clause: string | null;
};

function ageOf(playerId: number): number | null {
  return ageAtSeason(nhlerFor(playerId)?.bd, nhlersFile.season);
}

/** The archived deal that is this player's current contract, if any (same AAV, still running). */
function archivedCurrent(playerId: number, contract: PlayerContract): Historical | null {
  return (
    archive.find(
      (h) => h.playerId === playerId && Math.abs(h.aav - contract.aav) < 60_000 && h.signingYear <= capSeasonStart && h.signingYear + h.term >= contract.expires - 0,
    ) ?? null
  );
}

/**
 * When a current deal is not in the archive: assume it is a couple of seasons in, never longer
 * than 8 years in total (the NHL maximum). Shown with "≈" everywhere.
 */
function estimatedStart(contract: PlayerContract): number {
  const remaining = Math.max(1, contract.expires - capSeasonStart);
  return capSeasonStart - Math.min(2, Math.max(0, 8 - remaining));
}

let pool: PoolRow[] | null = null;
function marketPool(): PoolRow[] {
  if (pool) return pool;
  pool = [];
  const profiles = new Map(profileRows().map((row) => [row.playerId, row]));
  const usedArchive = new Set<Historical>();
  for (const row of profiles.values()) {
    if (!row.active || !row.contract || row.contract.elc || row.recentRate == null) continue;
    const age = ageOf(row.playerId);
    if (age == null) continue;
    const known = archivedCurrent(row.playerId, row.contract);
    if (known) usedArchive.add(known);
    const signingYear = known?.signingYear ?? estimatedStart(row.contract);
    pool.push({
      playerId: row.playerId,
      row,
      name: row.name,
      group: row.group,
      signAge: known?.ageAtSigning ?? age - (capSeasonStart - signingYear),
      // Before-the-deal form when we know it; otherwise his recent form.
      rate: known?.preImpact82 ?? row.recentRate,
      skill: known?.preSkill ?? (row.skills?.current ? row.skills.overall : null),
      aav: row.contract.aav,
      signingYear,
      estimated: !known,
      term: known?.term ?? null,
      historical: false,
      clause: row.contract.clause ?? null,
    });
  }
  for (const h of archive) {
    if (usedArchive.has(h) || h.ageAtSigning == null || h.preImpact82 == null) continue;
    pool.push({
      playerId: h.playerId,
      row: profiles.get(h.playerId) ?? null,
      name: h.playerName,
      group: h.position,
      signAge: h.ageAtSigning,
      rate: h.preImpact82,
      skill: h.preSkill,
      aav: h.aav,
      signingYear: h.signingYear,
      estimated: false,
      term: h.term,
      historical: true,
      clause: null,
    });
  }
  return pool;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Typical NHL contract length by age at signing, used only when no comparable has a known term. */
export function typicalTerm(age: number, skill: number | null): number {
  if (age <= 23) return skill != null && skill >= 85 ? 8 : 3;
  if (age <= 26) return skill != null && skill >= 80 ? 7 : 4;
  if (age <= 28) return 6;
  if (age === 29) return 5;
  if (age === 30) return 4;
  if (age === 31) return 3;
  if (age <= 33) return 2;
  return 1;
}

const share = (p: PoolRow) => p.aav / capInSeason(p.signingYear);

/**
 * Fair value for a player. `ageShift` projects a future signing (1 = next summer's contract).
 * Returns null when we cannot rate him (no recent NHL form).
 */
export function fairValue(playerId: number, ageShift = 0): FairValue | null {
  const me = profileRows().find((row) => row.playerId === playerId);
  const baseAge = ageOf(playerId);
  if (!me || me.recentRate == null || baseAge == null) return null;
  // Compare at signing: next summer for a projection; when the current deal began for a fairness check.
  const current = me.contract && !me.contract.elc ? me.contract : null;
  const known = current ? archivedCurrent(playerId, current) : null;
  const age = ageShift > 0 ? baseAge + ageShift : (known?.ageAtSigning ?? (current ? baseAge - (capSeasonStart - estimatedStart(current)) : baseAge));
  const rate = ageShift > 0 ? me.recentRate : (known?.preImpact82 ?? me.recentRate);
  const skill = ageShift > 0 ? (me.skills?.current ? me.skills.overall : null) : (known?.preSkill ?? (me.skills?.current ? me.skills.overall : null));
  const rateScale = me.group === "G" ? 8 : 18;

  let candidates: (PoolRow & { distance: number })[] = [];
  for (const window of [1.5, 2.5, 3.5]) {
    candidates = marketPool()
      .filter((p) => p.playerId !== playerId && p.group === me.group && Math.abs(p.signAge - age) <= window)
      .map((p) => {
        const dRate = (p.rate - rate) / rateScale;
        const dSkill = skill != null && p.skill != null ? (p.skill - skill) / 6 : 0.5;
        const dAge = (p.signAge - age) / 2;
        return { ...p, distance: Math.sqrt(dRate * dRate + dSkill * dSkill + dAge * dAge) };
      });
    if (candidates.length >= 8) break;
  }
  // One deal per player keeps a single star from filling all five spots.
  const seen = new Set<number>();
  const top = candidates
    .sort((a, b) => a.distance - b.distance)
    .filter((p) => (seen.has(p.playerId) ? false : (seen.add(p.playerId), true)))
    .slice(0, 5);
  if (top.length < 3) return null;

  // Each comparable's cap share, scaled for the production gap (a better player than the comp is
  // worth a bit more, a weaker one a bit less; capped at -25% / +35%), then averaged.
  const adjust = (p: PoolRow) => Math.max(0.75, Math.min(1.35, Math.pow(Math.max(1, rate) / Math.max(1, p.rate), 0.6)));
  const capPct = top.reduce((sum, p) => sum + share(p) * adjust(p), 0) / top.length;
  const aav = Math.round((capPct * capCeiling) / 10_000) * 10_000;
  const terms = top.map((p) => p.term).filter((t): t is number => t != null);
  // Older players rarely get long deals, whatever their comparables signed for.
  const ageCap = age >= 35 ? 2 : age >= 33 ? 3 : age >= 31 ? 5 : 8;
  const term = Math.min(ageCap, terms.length >= 2 ? Math.max(1, Math.min(8, Math.round(median(terms)))) : typicalTerm(age, skill));

  // Judge his own deal the same way: its share of the cap in the year it was signed.
  const mySigning = current ? (known?.signingYear ?? estimatedStart(current)) : null;
  const myShare = current && mySigning != null ? current.aav / capInSeason(mySigning) : null;
  const ratio = myShare != null && capPct > 0 ? myShare / capPct : null;
  const verdict = ratio == null ? null : ratio < 0.85 ? "Bargain" : ratio > 1.15 ? "Overpaid" : "Fair Market";

  return {
    aav,
    capPct: Math.round(capPct * 1000) / 10,
    term,
    verdict,
    ratio,
    actual: current && mySigning != null && myShare != null
      ? { signingYear: mySigning, estimated: !known, capPct: Math.round(myShare * 1000) / 10, todayAav: Math.round((myShare * capCeiling) / 10_000) * 10_000 }
      : null,
    comps: top.map((p) => ({
      playerId: p.playerId,
      routeId: p.row?.routeId ?? null,
      name: p.name,
      pos: p.row?.pos ?? p.group,
      team: p.historical ? null : (p.row?.team ?? null),
      age: p.signAge,
      rate: Math.round(p.rate * 10) / 10,
      skill: p.skill,
      aav: p.aav,
      signingYear: p.signingYear,
      estimated: p.estimated,
      capPct: Math.round(share(p) * 1000) / 10,
      todayAav: Math.round((share(p) * capCeiling) / 10_000) * 10_000,
      term: p.term,
      historical: p.historical,
      clause: p.clause,
      headshot: p.row?.hasHeadshot ?? true,
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
