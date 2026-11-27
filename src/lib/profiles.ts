import { playerContract, capShare, type PlayerContract } from "./cap";
import { picks, undrafted } from "./data";
import { nhlerFor, nhlersFile } from "./nhlers";
import { skillsFor, type SkillProfile } from "./skills";
import type { PickGroup, Stamp } from "./types";
import { assetFor } from "./valuation";

// One row per player profile page (drafted picks and undrafted graduates), so the
// leaderboards and the home page can rank every player on one list.

export type ProfileRow = {
  /** /players/[routeId] */
  routeId: number;
  playerId: number;
  name: string;
  pos: string;
  group: PickGroup;
  team: string | null;
  active: boolean;
  stamps: Stamp[];
  skills: SkillProfile | null;
  contract: PlayerContract | null;
  assetRating: number | null;
  /** Impact per 82 games over the last two seasons (current one counts for its share). */
  recentRate: number | null;
  hasHeadshot: boolean;
};

function recentRate(playerId: number): number | null {
  const player = nhlerFor(playerId);
  if (!player) return null;
  let impact = 0;
  let gp = 0;
  for (const [year, games, value] of player.ss) {
    if (year < nhlersFile.season - 1) continue;
    impact += value;
    gp += games;
  }
  if (gp < 30) return null;
  return player.g === "G" ? impact / Math.max(1, player.ss.filter(([year]) => year >= nhlersFile.season - 1).length) : (impact / gp) * 82;
}

function build(): ProfileRow[] {
  const rows: ProfileRow[] = [];
  const seen = new Set<number>();
  for (const pick of picks) {
    if (pick.forfeited || pick.playerId == null || seen.has(pick.playerId)) continue;
    seen.add(pick.playerId);
    const retired = pick.active === false || pick.stamps.includes("RETIRED");
    const contract = retired ? null : playerContract(pick.playerId);
    rows.push({
      routeId: pick.id,
      playerId: pick.playerId,
      name: pick.name,
      pos: pick.pos,
      group: pick.group,
      team: pick.currentTeam ?? null,
      active: !retired,
      stamps: pick.stamps,
      skills: skillsFor(pick.playerId),
      contract,
      assetRating: contract ? (assetFor(pick.playerId)?.rating ?? null) : null,
      recentRate: recentRate(pick.playerId),
      hasHeadshot: pick.hasHeadshot,
    });
  }
  for (const player of undrafted) {
    if (seen.has(player.playerId)) continue;
    seen.add(player.playerId);
    const retired = player.active === false;
    const contract = retired ? null : playerContract(player.playerId);
    rows.push({
      routeId: player.id,
      playerId: player.playerId,
      name: player.name,
      pos: player.pos,
      group: player.group,
      team: player.currentTeam,
      active: !retired,
      stamps: player.stamps,
      skills: skillsFor(player.playerId),
      contract,
      assetRating: contract ? (assetFor(player.playerId)?.rating ?? null) : null,
      recentRate: recentRate(player.playerId),
      hasHeadshot: true,
    });
  }
  return rows;
}

let cache: ProfileRow[] | null = null;

export function profileRows(): ProfileRow[] {
  if (!cache) cache = build();
  return cache;
}

/** Recent Impact per 82 games for every 1% of the cap he takes. */
export function impactPerCap(row: ProfileRow): number | null {
  if (!row.contract || row.recentRate == null || row.recentRate <= 0) return null;
  const share = capShare(row.contract.aav) * 100;
  return share > 0 ? row.recentRate / share : null;
}
