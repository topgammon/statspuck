import type { Metadata } from "next";
import Link from "next/link";
import { LotterySim, type SeedTeam } from "@/components/lottery-sim";
import { TeamLogo } from "@/components/team-logo";
import { leaderboard, picks } from "@/lib/data";
import { liveLottery, lotteryAsOf, lotteryJumps, lotteryYears } from "@/lib/lottery";
import { playerHref, teamHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "NHL Draft Lottery Simulator",
  description: "Run the real NHL draft lottery: 1,001 ping-pong ball combinations, two draws, the 10-spot jump limit and the two-wins-in-five-years rule. Plus every lottery since 2006.",
  alternates: { canonical: "/lottery" },
};

export default function LotteryPage() {
  const names = new Map(leaderboard.map((t) => [t.abbr, t.name]));
  const initial: SeedTeam[] = liveLottery.map((row) => ({ team: row.team, name: names.get(row.team) ?? row.team, ineligible: row.recentWins >= 2 }));
  const allTeams = [...leaderboard].map((t) => ({ abbr: t.abbr, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
  const years = Object.keys(lotteryYears).map(Number).sort((a, b) => b - a);
  const routeByPlayer = new Map(picks.filter((p) => p.playerId != null).map((p) => [p.playerId as number, p.id]));
  const jumps = lotteryJumps().slice(0, 8);

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Draft Lottery</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Run the NHL Draft Lottery</h1>
      <p className="mt-2 max-w-3xl text-[#94A3B8]">
        The real math: 14 balls, 4 drawn, 1,001 combinations split by the official odds (18.5% for the worst team down to 0.5%), two draws for picks #1 and #2, a 10-spot limit on any
        jump, and no jumping for a club that already won two lotteries in five years. The order starts from today&apos;s standings ({lotteryAsOf}); change it to test anything.
      </p>

      <div className="mt-6">
        {initial.length ? <LotterySim initial={initial} allTeams={allTeams} /> : <p className="text-sm text-[#94A3B8]">Standings are not available right now.</p>}
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="display text-xl font-bold">Recent lotteries</h2>
            <Link href="/leaderboards?board=lottery" className="text-xs font-semibold text-[#38BDF8] hover:underline">
              Franchise Lottery Luck →
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {years.slice(0, 6).map((year) => {
              const top = lotteryYears[String(year)].filter((p) => p.overall <= 3).sort((a, b) => a.overall - b.overall);
              return (
                <li key={year} className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3">
                  <p className="text-xs font-semibold text-[#94A3B8]">{year} draft</p>
                  <ol className="mt-1.5 space-y-1">
                    {top.map((p) => (
                      <li key={p.overall} className="flex items-center gap-2 text-sm">
                        <span className="display w-6 font-bold">#{p.overall}</span>
                        <TeamLogo abbr={p.team} className="h-5 w-6" />
                        <Link href={teamHref(p.team, "draft-dev")} className="font-semibold hover:text-[#38BDF8]">
                          {names.get(p.team) ?? p.team}
                        </Link>
                        <span className="text-xs text-[#94A3B8]">from seed {p.seed}</span>
                        {p.moved > 0 ? <span className="text-xs font-bold text-[#10B981]">▲{p.moved}</span> : p.moved < 0 ? <span className="text-xs font-bold text-[#EF4444]">▼{-p.moved}</span> : null}
                        {p.name ? (
                          p.playerId && routeByPlayer.get(p.playerId) ? (
                            <Link href={playerHref(routeByPlayer.get(p.playerId)!)} className="ml-auto truncate text-xs text-[#94A3B8] hover:text-white">
                              {p.name}
                            </Link>
                          ) : (
                            <span className="ml-auto truncate text-xs text-[#94A3B8]">{p.name}</span>
                          )
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <h2 className="display text-xl font-bold">Biggest lottery jumps since 2006</h2>
          <ol className="mt-3 divide-y divide-[#262B36]">
            {jumps.map((p) => (
              <li key={`${p.year}-${p.team}`} className="flex items-center gap-2 py-2 text-sm">
                <span className="display w-10 text-lg font-bold text-[#10B981]">▲{p.moved}</span>
                <TeamLogo abbr={p.team} className="h-6 w-7" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {names.get(p.team) ?? p.team} <span className="text-[#94A3B8]">· {p.year}</span>
                  </span>
                  <span className="block text-xs text-[#94A3B8]">
                    Seed {p.seed} → pick #{p.overall}
                    {p.name ? ` · ${p.name}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-[#94A3B8]">2005 is left out: the post-lockout lottery weighted all 30 teams. 2020 includes the qualifying-round phase.</p>
        </section>
      </div>
    </div>
  );
}
