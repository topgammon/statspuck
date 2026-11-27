import type { Metadata } from "next";
import Link from "next/link";
import { PathOptimizer } from "@/components/development/path-optimizer";
import { PathwayFlow } from "@/components/development/pathway-flow";
import { DevLeaderboard } from "@/components/entity/dev-leaderboard";
import { undrafted } from "@/lib/data";
import { devBoard } from "@/lib/dev-board";
import { development } from "@/lib/development";
import { playerHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Development Path",
  description: "How NHL draft picks actually get to the NHL: league-by-league pathways, graduation odds by draft slot, and the Make The Show path optimizer.",
};

export default function DevelopmentPage() {
  const graduates = [...undrafted].sort((a, b) => b.qg - a.qg);
  const gems = graduates.filter((player) => player.qg >= 100).length;
  const tally = new Map<string, number>();
  for (const player of graduates) {
    const league = player.origin?.league;
    if (league) tally.set(league, (tally.get(league) ?? 0) + 1);
  }
  const routes = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <div>
      <section className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Development Path</p>
        <h1 className="display mt-2 text-5xl leading-[0.95] font-bold sm:text-6xl">How prospects actually make the show.</h1>
        <p className="mt-4 text-lg text-[#94A3B8]">
          Every pick from 2005 to {development.matureThrough}, traced league by league from draft day through year four, then to how their career turned out. Pick a
          lane, click a ribbon, and see who made it.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="display text-2xl font-bold">Pathway flow</h2>
        <div className="mt-3">
          <PathwayFlow cohort={development.cohort} buckets={development.buckets} matureThrough={development.matureThrough} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl font-bold">Make The Show optimizer</h2>
        <p className="mt-1 max-w-2xl text-sm text-[#94A3B8]">
          For prospects, parents, and agents: pick where a player is today and compare the next steps past players took, with their historical NHL odds.
        </p>
        <div className="mt-3">
          <PathOptimizer cohort={development.cohort} buckets={development.buckets} />
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-[#38BDF8]/40 bg-[#14171F] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl font-bold">Undrafted graduates</h2>
          <p className="text-sm text-[#94A3B8]">
            {graduates.length} players went undrafted and still played 25+ NHL games since 2005-06 · {gems} reached 100+ Impact
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {routes.map(([league, count]) => (
            <span key={league} className="rounded-full border border-[#262B36] bg-[#0B0D10]/60 px-3 py-1 text-xs text-[#94A3B8]">
              From <span className="font-semibold text-[#F8FAFC]">{league}</span> · {count}
            </span>
          ))}
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {graduates.slice(0, 10).map((player) => (
            <li key={player.id}>
              <Link href={playerHref(player.id, "career")} className="block rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 hover:border-[#38BDF8]/60">
                <span className="display inline-block border-2 border-[#38BDF8] px-1 py-0.5 text-[9px] leading-none font-bold tracking-[0.14em] text-[#bae6fd]">UNDRAFTED</span>
                <span className="mt-2 block truncate font-semibold">{player.name}</span>
                <span className="block truncate text-xs text-[#94A3B8]">
                  {player.origin?.league ?? "—"} → {player.firstTeam ?? "NHL"} ({player.debut})
                </span>
                <span className="mt-1 block text-xs text-[#94A3B8]">
                  <span className="display text-lg font-bold text-[#F8FAFC]">{player.qg.toFixed(0)}</span> Impact
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-[#94A3B8]">
          Undrafted players never count in Draft Rater. A signing who reaches 100+ Impact adds a half-weight bonus to the Development Grade of the team that gave him his NHL debut.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl font-bold">Best developing franchises</h2>
          <p className="text-sm text-[#94A3B8]">Development Grade · picks turned into NHL players vs their draft slots</p>
        </div>
        <div className="mt-4">
          <DevLeaderboard rows={devBoard} />
        </div>
        <p className="mt-3 text-xs text-[#94A3B8]">All 32 franchises. Click any column to sort, or any team to open its Draft &amp; Dev tab.</p>
      </section>
    </div>
  );
}
