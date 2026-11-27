import type { Metadata } from "next";
import { GameEdgeHub, type HubTeam, type HubView } from "@/components/game-edge/game-edge-hub";
import { teamsByAbbr } from "@/lib/data";
import { allGoalieEdges, allTeamEdges, edgeAsOf, edgeCurrentSeason, leagueEdgeFor, leagueGoalieFor, playerIdHref, todaysGames, topLines, topPairs, type EdgeView } from "@/lib/game-edge";
import { allRefs, refLeague } from "@/lib/ref-watch";

export const metadata: Metadata = {
  title: "Game Edge",
  description: "Tonight's pregame matchup reports from NHL play-by-play: how each team scores and gets scored on, goalie start recommendations, PP vs PK and the referee edge.",
  alternates: { canonical: "/game-edge" },
};

function viewData(view: EdgeView, hrefs: Record<number, string>): HubView {
  const teams: HubTeam[] = Object.entries(allTeamEdges(view))
    .map(([abbr, t]) => ({
      abbr,
      name: teamsByAbbr.get(abbr)?.name ?? abbr,
      taken: t.taken,
      drawn: t.drawn,
      ppPct: t.ppPct,
      pkPct: t.pkPct,
      refs: t.refs.all,
      weightGames: t.weightGames,
      for: t.for,
      against: t.against,
      shotFor: t.shotFor,
      shotAgainst: t.shotAgainst,
      pp: t.pp,
      pk: t.pk,
      goalies: t.goalies,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const goalies = allGoalieEdges(view);
  const lines = topLines(view);
  const pairs = topPairs(view);
  for (const id of [...goalies.map((g) => g.id), ...lines.flatMap((l) => l.ids), ...pairs.flatMap((p) => p.ids)]) {
    if (hrefs[id]) continue;
    const href = playerIdHref(id, "game-edge");
    if (href) hrefs[id] = href;
  }
  const league = leagueEdgeFor(view);
  const goalie = leagueGoalieFor(view);
  return { teams, goalies, lines, pairs, league: { for: league.for, shot: league.shot, teamGames: league.teamGames, goalie, sv: goalie.sv } };
}

export default function GameEdgePage() {
  const hrefs: Record<number, string> = {};
  const views = { season: viewData("season", hrefs), two: viewData("two", hrefs) };
  const today = todaysGames();
  const refs = allRefs()
    .filter((r) => r.active)
    .map((r) => ({ slug: r.slug, name: r.name, rate: r.rate, delta: r.delta, home: r.home, style: r.style, grade: r.grade, games: r.games }));
  const season = `${edgeCurrentSeason}-${String(edgeCurrentSeason + 1).slice(2)}`;

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Game Edge</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Tonight&apos;s pregame matchup reports</h1>
      <p className="mt-2 max-w-3xl text-[#94A3B8]">
        Every shot, goal and shift of the {season} season from free NHL play-by-play and shift charts, sorted into rebounds, rush chances, tips, royal-road passes and point
        shots. Pick a game to see where each side scores, which goalie fits the matchup, and how the power plays line up. Switch on last season for a bigger sample.
      </p>
      <div className="mt-6">
        <GameEdgeHub views={views} games={today.games} date={today.date} refs={refs} leagueRate={refLeague.rate} hrefs={hrefs} season={season} />
      </div>
      <p className="mt-6 text-xs text-[#94A3B8]">
        Chance types are derived from event timing and coordinates (the NHL feed has no pass data), so Rush and Royal-Road are proxies. Referee numbers use every game since
        2024-25. Updated {edgeAsOf}.
      </p>
    </div>
  );
}
