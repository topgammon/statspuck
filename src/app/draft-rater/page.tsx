import Link from "next/link";
import { Board } from "@/components/board";
import { TeamLogo } from "@/components/team-logo";
import { lotteryLuck } from "@/lib/lottery";
import { teamHref } from "@/lib/routes";
import { gmReportsLite } from "@/lib/gm-grades";
import { assertGradesMatch, eras, leaderboard, meta, picks, teams } from "@/lib/data";

export default function HomePage() {
  assertGradesMatch();

  return (
    <div>
      <p className="text-sm tracking-[0.18em] text-[#E11D48] uppercase">NHL drafts since 2005</p>
      <h1 className="display mt-2 max-w-3xl text-5xl leading-[0.95] font-bold sm:text-6xl">
        Who Actually Wins the NHL Draft?
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-zinc-400">
        Every NHL pick since 2005 graded by the quality of hockey they&apos;ve played compared to their draft slot—separating true scouting skill from lottery luck.
      </p>

      <LotteryLuckStrip />

      <Board
        picks={picks}
        teams={teams}
        eras={eras}
        gmReports={gmReportsLite()}
        official={leaderboard}
        firstYear={meta.curveFirstYear}
        latestYear={meta.latestDraftYear}
      />
    </div>
  );
}

/** Draft grades measure scouting. This strip shows the part that was pure ping-pong-ball luck. */
function LotteryLuckStrip() {
  const lucky = lotteryLuck.slice(0, 3);
  const unlucky = [...lotteryLuck].reverse().slice(0, 3);
  const row = (team: (typeof lotteryLuck)[number]) => (
    <li key={team.abbr}>
      <Link href={teamHref(team.abbr, "draft-dev")} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/[0.04]">
        <TeamLogo abbr={team.abbr} className="h-5 w-6" />
        <span className="min-w-0 flex-1 truncate">{team.name}</span>
        <span className={`text-xs font-bold tabular-nums ${team.netImpact >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
          {team.netImpact >= 0 ? "+" : ""}
          {team.netImpact.toFixed(0)}
        </span>
      </Link>
    </li>
  );
  return (
    <section className="mt-6 grid gap-3 rounded-2xl border border-[#262B36] bg-[#14171F] p-4 md:grid-cols-[1.2fr_1fr_1fr]">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#F59E0B] uppercase">Scouting skill vs. lottery luck</p>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Draft grades judge what teams did with their picks. Where those picks landed in the lottery was ping-pong balls. Impact luck is the expected value the balls added or took away.
        </p>
        <p className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/leaderboards?board=lottery" className="text-[#38BDF8] hover:underline">
            Lottery Luck leaderboard →
          </Link>
          <Link href="/lottery" className="text-[#38BDF8] hover:underline">
            Run the lottery →
          </Link>
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#10B981] uppercase">Luckiest since 2006</p>
        <ol className="mt-1">{lucky.map(row)}</ol>
      </div>
      <div>
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#EF4444] uppercase">Unluckiest since 2006</p>
        <ol className="mt-1">{unlucky.map(row)}</ol>
      </div>
    </section>
  );
}
