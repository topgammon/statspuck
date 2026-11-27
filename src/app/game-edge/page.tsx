import type { Metadata } from "next";
import { GameEdgeHub, type HubTeam } from "@/components/game-edge/game-edge-hub";
import { teamsByAbbr } from "@/lib/data";
import { allGoalieEdges, allTeamEdges, edgeAsOf, leagueEdge, leagueGoalie, playerIdHref, todaysGames, topLines, topPairs } from "@/lib/game-edge";
import { allRefs, refLeague } from "@/lib/ref-watch";

export const metadata: Metadata = {
  title: "Game Edge",
  description: "Tonight's pregame matchup reports from NHL play-by-play: how each team scores and gets scored on, goalie start recommendations, PP vs PK and the referee edge.",
  alternates: { canonical: "/game-edge" },
};

export default function GameEdgePage() {
  const teams: HubTeam[] = Object.entries(allTeamEdges())
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
  const goalies = allGoalieEdges();
  const lines = topLines();
  const pairs = topPairs();
  const hrefs: Record<number, string> = {};
  for (const id of [...goalies.map((g) => g.id), ...lines.flatMap((l) => l.ids), ...pairs.flatMap((p) => p.ids)]) {
    const href = playerIdHref(id, "game-edge");
    if (href) hrefs[id] = href;
  }
  const today = todaysGames();
  const refs = allRefs()
    .filter((r) => r.active)
    .map((r) => ({ slug: r.slug, name: r.name, rate: r.rate, delta: r.delta, home: r.home, style: r.style, grade: r.grade, games: r.games }));

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Game Edge</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Tonight&apos;s pregame matchup reports</h1>
      <p className="mt-2 max-w-3xl text-[#94A3B8]">
        Every shot, goal and shift since 2024-25 from free NHL play-by-play and shift charts, sorted into rebounds, rush chances, tips, royal-road passes and point shots. Pick a
        game to see where each side scores, which goalie fits the matchup, and how the power plays line up. This season counts in full, last season at half weight.
      </p>
      <div className="mt-6">
        <GameEdgeHub
          teams={teams}
          goalies={goalies}
          league={{ for: leagueEdge.for, shot: leagueEdge.shot, teamGames: leagueEdge.teamGames, goalie: leagueGoalie, sv: leagueGoalie.sv }}
          games={today.games}
          date={today.date}
          refs={refs}
          leagueRate={refLeague.rate}
          lines={lines}
          pairs={pairs}
          hrefs={hrefs}
        />
      </div>
      <p className="mt-6 text-xs text-[#94A3B8]">
        Chance types are derived from event timing and coordinates (the NHL feed has no pass data), so Rush and Royal-Road are proxies. Updated {edgeAsOf}.
      </p>
    </div>
  );
}
