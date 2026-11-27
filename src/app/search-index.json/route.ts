import { draftClasses, leaderboard, picks, undrafted } from "@/lib/data";
import { allGmCareers, teamOverall } from "@/lib/overall-grades";
import type { SearchIndex } from "@/lib/search";
import { skillsFor } from "@/lib/skills";

// Built once at deploy time into /search-index.json. The header search loads it on first use.
// Players carry their Overall Skill Rating; teams and GMs their Overall grade.
export const dynamic = "force-static";

function skill(playerId: number | null): string {
  const s = skillsFor(playerId);
  return s ? String(s.overall) : "";
}

export function GET() {
  const index: SearchIndex = {
    p: [
      ...picks
        .filter((pick) => !pick.forfeited)
        .sort((a, b) => b.year - a.year || a.overall - b.overall)
        .map((pick): SearchIndex["p"][number] => [
          pick.id,
          pick.name,
          pick.year,
          pick.overall,
          pick.franchise,
          pick.playerId != null && pick.hasHeadshot ? pick.playerId : 0,
          skill(pick.playerId),
          pick.stamps.find((stamp) => stamp !== "RETIRED") ?? pick.stamps[0] ?? "",
        ]),
      // Undrafted graduates: year is the NHL debut season, overall 0 means undrafted.
      ...undrafted.map((player): SearchIndex["p"][number] => [
        player.id,
        player.name,
        player.debut,
        0,
        player.franchise ?? "",
        player.playerId,
        skill(player.playerId),
        "UNDRAFTED",
      ]),
    ],
    t: leaderboard.map((team) => {
      const overall = teamOverall(team.abbr);
      return [team.abbr, team.name, team.short, overall?.letter ?? "", overall?.rank ?? 99];
    }),
    // One entry per GM career, linking to his newest tenure (which opens on All Teams).
    g: allGmCareers().map((career) => [
      career.latest.slug,
      career.person,
      career.latest.team,
      career.latest.teamName,
      career.firstYear,
      career.current ? null : Math.max(...career.stops.map((era) => era.endYear ?? 0)),
      career.overall?.letter ?? "",
    ]),
    y: draftClasses.map((row) => [row.year, row.letter]),
  };
  return Response.json(index);
}
