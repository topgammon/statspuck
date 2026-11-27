import type { Metadata } from "next";
import { RefEdgeCalculator, type EdgeTeam } from "@/components/ref-watch/ref-edge";
import { RefTable } from "@/components/ref-watch/ref-table";
import { teamsByAbbr } from "@/lib/data";
import { allTeamEdges, todaysGames } from "@/lib/game-edge";
import { activeRefs, allRefs, refAsOf, refGames, refLeague, refSeasons, seasonLabel } from "@/lib/ref-watch";

export const metadata: Metadata = {
  title: "Ref Watch",
  description: "Every NHL referee graded on consistency, whistle volume, home bias and game management, plus tonight's Pregame Ref Edge. Built from free NHL play-by-play.",
  alternates: { canonical: "/ref-watch" },
};

export default function RefWatchPage() {
  const active = activeRefs();
  const edges = allTeamEdges();
  const teams: EdgeTeam[] = Object.entries(edges)
    .map(([abbr, t]) => ({
      abbr,
      name: teamsByAbbr.get(abbr)?.name ?? abbr,
      taken: t.taken,
      drawn: t.drawn,
      ppPct: t.ppPct,
      pkPct: t.pkPct,
      refs: t.refs.all,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const today = todaysGames();
  const pool = allRefs().filter((r) => r.active || r.currentGames > 0);

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Ref Watch</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">How every crew actually calls the game</h1>
      <p className="mt-2 max-w-3xl text-[#94A3B8]">
        {refGames.toLocaleString()} NHL games ({seasonLabel(refSeasons[0])} to now) of public play-by-play. Refs work in rotating pairs, so a ridge regression across every
        pairing isolates each referee&apos;s own whistle from his partner and the teams on the ice. No opinions, just the calls.
      </p>

      <section className="mt-6">
        <RefEdgeCalculator
          teams={teams}
          refs={pool.map((r) => ({ slug: r.slug, name: r.name, rate: r.rate, delta: r.delta, home: r.home, style: r.style, grade: r.grade, games: r.games }))}
          games={today.games}
          date={today.date}
          leagueRate={refLeague.rate}
        />
      </section>

      <section className="mt-8">
        <h2 className="display text-2xl font-bold">Referee leaderboard</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          {active.length} referees worked a game this season. Click any row for the full profile. Updated {refAsOf}.
        </p>
        <div className="mt-3">
          <RefTable
            rows={active.map((r) => ({
              slug: r.slug,
              name: r.name,
              photo: r.photo ?? null,
              games: r.games,
              low: r.low,
              grade: r.grade,
              score: r.score,
              style: r.style,
              rate: r.rate,
              delta: r.delta,
              home: r.home,
              mgmt: r.mgmt,
              signature: r.signature,
            }))}
            leagueRate={refLeague.rate}
            leagueMgmt={refLeague.mgmt}
          />
        </div>
      </section>

      <section className="mt-8 grid gap-3 text-sm text-[#94A3B8] sm:grid-cols-2">
        <Note title="Consistency grade">
          Rewards referees whose standard does not move with the game: little home/away lean, few even-up or against-the-leader calls, and the same rate in a tight third
          period as in periods 1-2. Ranked against every referee with 15+ games.
        </Note>
        <Note title="Fine print">
          A call = a minor, bench minor, non-fighting major or penalty shot. Linesmen calls (too many men, delay of game) count toward the crew. Ice location is where the
          offending player was. Small samples are shrunk toward league average.
        </Note>
      </section>
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
      <p className="font-semibold text-[#F8FAFC]">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
