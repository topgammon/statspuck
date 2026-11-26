import contractsJson from "../../data/contracts.json";

// Salary cap and contract data, synced nightly from public roster tables
// (pipelines/draft-rater/fetch_contracts.py). If a sync is throttled the last saved
// data/contracts.json stays in place, so the site never loses its numbers.

export type PlayerContract = {
  /** Average annual value in dollars. */
  aav: number;
  /** Year the contract ends in (2028 = last paid season is 2027-28). */
  expires: number;
  elc?: boolean;
  /** Team that holds the contract today. */
  team?: string;
};

export type TeamCap = {
  /** Cap hit used today. */
  capHit: number;
  capSpace: number;
  ltir: number;
  deadCap: number;
};

export type ContractsFile = {
  season: string;
  /** NHL Salary Cap Ceiling (upper limit). */
  capCeiling: number;
  /** NHL Salary Cap Floor (lower limit). */
  capFloor?: number;
  source: string | null;
  asOf: string | null;
  players: Record<string, PlayerContract>;
  teams: Record<string, TeamCap>;
};

export const contracts = contractsJson as unknown as ContractsFile;

/** First calendar year of the current cap season: "2026-27" -> 2026. */
export const capSeasonStart = Number(contracts.season.slice(0, 4));

/** Fallback floor if a sync ever predates the floor field: about 74% of the ceiling. */
export const capFloor = contracts.capFloor ?? Math.round((contracts.capCeiling * 0.74) / 100_000) * 100_000;
export const capCeiling = contracts.capCeiling;

export function playerContract(playerId: number | null): PlayerContract | null {
  if (playerId == null) return null;
  return contracts.players[String(playerId)] ?? null;
}

export function teamCap(abbr: string): TeamCap | null {
  return contracts.teams[abbr] ?? null;
}

export function teamCapHit(abbr: string): number | null {
  return contracts.teams[abbr]?.capHit ?? null;
}

/** Seasons left on a deal, counting the current one. */
export function yearsLeft(contract: PlayerContract): number {
  return Math.max(1, contract.expires - capSeasonStart);
}

/** Share of the NHL salary cap ceiling, e.g. 0.089. */
export function capShare(aav: number): number {
  return aav / capCeiling;
}

export function money(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

export function pctCap(aav: number): string {
  return `${(capShare(aav) * 100).toFixed(1)}%`;
}

/** "$8.50M AAV · 8.9% Cap · 4 yrs left" or "ELC · 1.0% Cap". */
export function contractLine(contract: PlayerContract): string {
  const left = yearsLeft(contract);
  const term = `${left} ${left === 1 ? "yr" : "yrs"} left`;
  if (contract.elc) return `ELC · ${pctCap(contract.aav)} Cap`;
  return `${money(contract.aav)} AAV · ${pctCap(contract.aav)} Cap · ${term}`;
}
