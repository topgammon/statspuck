import contractsJson from "../../data/contracts.json";

// Salary cap and contract data.
// The cap ceiling is the NHL's published figure. Player contracts and team cap
// totals fill in once a licensed data source is connected (see data/contracts.json).

export type PlayerContract = {
  /** Average annual value in dollars. */
  aav: number;
  /** Season the contract ends, as the year it ends in (2028 = expires after 2027–28). */
  expires: number;
  elc?: boolean;
};

export type ContractsFile = {
  season: string;
  capCeiling: number;
  source: string | null;
  asOf: string | null;
  players: Record<string, PlayerContract>;
  teams: Record<string, { capHit: number }>;
};

export const contracts = contractsJson as ContractsFile;

export function playerContract(playerId: number | null): PlayerContract | null {
  if (playerId == null) return null;
  return contracts.players[String(playerId)] ?? null;
}

export function teamCapHit(abbr: string): number | null {
  return contracts.teams[abbr]?.capHit ?? null;
}

export function money(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}
