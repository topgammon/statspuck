import { prospectTier } from "./archetypes";
import { contracts, playerContract } from "./cap";
import { picks, teams } from "./data";
import { draftCapitalFor } from "./draft-capital";
import { toRating } from "./rating";
import { assets, prospectUsd, scale } from "./valuation";

// Total Franchise Asset Value: what each of the 32 franchises holds, in three buckets.
//   Roster    - positive Asset Value across players under NHL contract today
//   Prospects - drafted prospects the team holds rights to who are not in the NHL yet
//   Picks     - the 2027-2029 draft picks it owns
// All three use the same 0-100 Asset Value scale as the Trade Machine, so they add up.

export type FranchiseAssets = {
  abbr: string;
  name: string;
  short: string;
  color: string;
  roster: number;
  prospects: number;
  picks: number;
  total: number;
  rank: number;
  rosterCount: number;
  prospectCount: number;
  pickCount: number;
  capSpace: number;
  capHit: number;
};

function build(): FranchiseAssets[] {
  const roster = new Map<string, { value: number; n: number }>();
  for (const [key, contract] of Object.entries(contracts.players)) {
    const asset = assets.get(Number(key));
    if (!asset || !contract.team) continue;
    const bucket = roster.get(contract.team) ?? { value: 0, n: 0 };
    bucket.n += 1;
    bucket.value += Math.max(0, asset.rating);
    roster.set(contract.team, bucket);
  }

  const prospects = new Map<string, { value: number; n: number }>();
  for (const pick of picks) {
    if (pick.forfeited || !pick.stamps.includes("DEVELOPING") || pick.active === false) continue;
    // Anyone already on an NHL contract is counted in the roster bucket.
    if (playerContract(pick.playerId)) continue;
    if (pick.currentTeam && pick.currentTeam !== pick.franchise) continue;
    const tier = prospectTier(pick);
    if (!tier) continue;
    const bucket = prospects.get(pick.franchise) ?? { value: 0, n: 0 };
    bucket.n += 1;
    bucket.value += Math.max(0, toRating(prospectUsd(pick.overall, tier.level, pick.draftPlus), scale.uref));
    prospects.set(pick.franchise, bucket);
  }

  const rows: FranchiseAssets[] = teams.map((team) => {
    const r = roster.get(team.abbr) ?? { value: 0, n: 0 };
    const p = prospects.get(team.abbr) ?? { value: 0, n: 0 };
    const capital = draftCapitalFor(team.abbr);
    const cap = contracts.teams[team.abbr];
    return {
      abbr: team.abbr,
      name: team.name,
      short: team.short,
      color: team.color,
      roster: r.value,
      prospects: p.value,
      picks: capital.total,
      total: r.value + p.value + capital.total,
      rank: 0,
      rosterCount: r.n,
      prospectCount: p.n,
      pickCount: capital.held,
      capSpace: cap?.capSpace ?? 0,
      capHit: cap?.capHit ?? 0,
    };
  });
  [...rows].sort((a, b) => b.total - a.total).forEach((row, index) => (row.rank = index + 1));
  return rows;
}

export const franchiseAssets = build();
const byAbbr = new Map(franchiseAssets.map((row) => [row.abbr, row]));

export function franchiseAssetsFor(abbr: string): FranchiseAssets | null {
  return byAbbr.get(abbr) ?? null;
}
