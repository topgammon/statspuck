import type { Metadata } from "next";
import Link from "next/link";
import { PathOptimizer } from "@/components/development/path-optimizer";
import { PathwayFlow } from "@/components/development/pathway-flow";
import { TeamLogo } from "@/components/team-logo";
import { devBoard } from "@/lib/dev-board";
import { development } from "@/lib/development";
import { scoreClass, signed } from "@/lib/format";
import { teamHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Development Path",
  description: "How NHL draft picks actually get to the NHL: league-by-league pathways, graduation odds by draft slot, and the Make The Show path optimizer.",
};

export default function DevelopmentPage() {
  const top = devBoard.slice(0, 5);
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

      <section className="mt-12 rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl font-bold">Best developing franchises</h2>
          <p className="text-sm text-[#94A3B8]">Development Grade · picks turned into NHL players vs their draft slots</p>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {top.map((row) => (
            <li key={row.abbr}>
              <Link href={teamHref(row.abbr, "development")} className="flex items-center gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 hover:border-[#38BDF8]/60">
                <TeamLogo abbr={row.abbr} className="h-9 w-10" />
                <span className="min-w-0">
                  <span className="block text-xs text-[#94A3B8]">#{row.rank}</span>
                  <span className="display block text-xl font-bold">{row.letter}</span>
                  <span className={`block text-xs ${scoreClass(row.avg)}`}>{signed(row.avg)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-[#94A3B8]">Open any team page and choose the Development tab for the full league leaderboard.</p>
      </section>
    </div>
  );
}
