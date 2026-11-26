import type { DevLeaderRow } from "@/components/entity/dev-leaderboard";
import type { DevGem } from "@/components/entity/org-development";
import { leaderboard, picksById } from "@/lib/data";
import type { DevGrade } from "@/lib/types";

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
