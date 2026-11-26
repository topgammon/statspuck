import { Board } from "@/components/board";
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
