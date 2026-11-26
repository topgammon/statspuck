import type { DevLeaderRow } from "@/components/entity/dev-leaderboard";
import type { DevGem, UndraftedGem } from "@/components/entity/org-development";
import { leaderboard, picksById, undrafted } from "@/lib/data";
import type { DevGrade } from "@/lib/types";

/** Undrafted signings who debuted with a franchise (or under a GM era), best first. */
export function undraftedGems(filter: { franchise?: string; era?: string }): UndraftedGem[] {
  return undrafted
    .filter((player) => player.debut >= 2005)
    .filter((player) => (filter.era ? player.creditEra === filter.era : player.franchise === filter.franchise))
    .sort((a, b) => b.qg - a.qg)
    .map((player) => ({
      id: player.id,
      name: player.name,
      pos: player.pos,
      debut: player.debut,
      qg: player.qg,
      gp: player.gpCareer,
      devCredit: player.devCredit,
      origin: player.origin?.league ?? null,
    }));
}

/** Team Development leaderboard rows, best first. Teams with no mature picks (e.g. Seattle) are left off. */
export const devBoard: DevLeaderRow[] = leaderboard
  .filter((team) => team.dev)
  .map((team) => ({
    abbr: team.abbr,
    name: team.name,
    rank: team.dev!.rank ?? 0,
    letter: team.dev!.letter,
    avg: team.dev!.avg,
    n: team.dev!.n,
    draftLetter: team.letter,
  }))
  .sort((a, b) => a.rank - b.rank);

export function devGems(dev: DevGrade | null | undefined): DevGem[] {
  return (dev?.gems ?? []).flatMap((gem) => {
    const pick = picksById.get(gem.id);
    return pick ? [{ id: gem.id, name: pick.name, year: pick.year, overall: pick.overall, q6: gem.q6, dev: gem.dev }] : [];
  });
}
