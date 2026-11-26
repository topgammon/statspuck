import { draftClasses, eras, leaderboard, picks } from "@/lib/data";
import type { SearchIndex } from "@/lib/search";

// Built once at deploy time into /search-index.json. The header search loads it on first use.
export const dynamic = "force-static";

export function GET() {
  const index: SearchIndex = {
    p: picks
      .slice()
      .sort((a, b) => b.year - a.year || a.overall - b.overall)
      .map((pick) => [
        pick.id,
        pick.name,
        pick.year,
        pick.overall,
        pick.franchise,
        pick.playerId != null && pick.hasHeadshot ? pick.playerId : 0,
        pick.letter ?? "",
        pick.stamps.find((stamp) => stamp !== "RETIRED") ?? pick.stamps[0] ?? "",
      ]),
    t: leaderboard.map((team) => [team.abbr, team.name, team.short, team.letter, team.rank]),
    g: eras.map((era) => [era.slug, era.person, era.team, era.teamName, era.startYear, era.endYear, era.letter ?? ""]),
    y: draftClasses.map((row) => [row.year, row.letter]),
  };
  return Response.json(index);
}
