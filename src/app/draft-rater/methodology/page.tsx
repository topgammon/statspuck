import type { Metadata } from "next";
import Link from "next/link";
import { ExpectedChart, LetterScale, QualityScale, WindowTimeline } from "@/components/method-charts";
import { StampMark } from "@/components/stamps";
import { curves, meta, og } from "@/lib/data";
import { signed, yearLabel } from "@/lib/format";
import { publicPath } from "@/lib/site";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Draft Rater turns NHL seasons into a quality-games grade.",
  openGraph: {
    title: "How Draft Rater works",
    images: [{ url: og.method, width: 1200, height: 630 }],
  },
};

export default function MethodologyPage() {
  const progress = meta.seasonInProgress
    ? `The ${meta.seasonInProgress}–${String(meta.seasonInProgress + 1).slice(2)} season is about ${Math.round(meta.seasonProgress * 100)}% complete, so an unfinished year is only expected to have produced that much of a season.`
    : "The season is complete, so every open year is judged on a full season.";

  return (
    <article className="max-w-3xl">
      <h1 className="display text-5xl font-bold">How the grade works</h1>
      <p className="mt-4 text-lg text-zinc-400">
        A pick is judged on the NHL hockey it has produced, minus what players taken at that same slot usually produce by the same point in their career.
      </p>

      <h2 className="display mt-10 text-2xl font-bold">Quality games</h2>
      <p className="mt-3 leading-7 text-zinc-300">
        A game is not a game. A fourth-line shift and a first-line night should not count the same. Quality games start from games played, then move up or down for ice time and for what the player did with it. Forwards are compared with forwards, defensemen with defensemen. Points, and plus-minus when the league recorded it, nudge the total. The nudge stays inside a fixed range so one hot week cannot invent a career.
      </p>
      <p className="mt-3 leading-7 text-zinc-300">
        Goalies are scored on starts, adjusted for save percentage against that season’s league average. An ordinary start is about one quality game, so a goalie and a skater can sit on the same scale.
      </p>
      <QualityScale />

      <h2 className="display mt-10 text-2xl font-bold">What a slot usually produces</h2>
      <p className="mt-3 leading-7 text-zinc-300">
        Year 1 is the season that starts after the draft. Every NHL season after that counts, for as long as the player plays. There is no year-8 or year-10 cutoff. The expected line keeps rising, then flattens, so a long career still has to beat what that slot usually produces. The line for each year cannot rise as the pick gets later: a later pick is never expected to outproduce an earlier one.
      </p>
      <p className="mt-3 leading-7 text-zinc-300">
        The line on the chart is what the whole historical slot produced, including the picks who never played. A player who has already reached 25 quality games is held to a higher bar: other players who had also reached 25 by that same year. An early arrival is compared with early arrivals, not with prospects who had not played, so a recent class is not credited for beating a curve full of zeros. Later years, where only the oldest classes have a full season, extend the last completed step and then shrink it, so the expectation flattens instead of running away. An active player is graded through the current season, and that season is prorated by how many games the league has played. An inactive player is graded through every season since his draft, capped at year 21, even if he left the NHL early. His actual line stays flat and the expected line keeps going, so the final point matches the Expected and Score cards. The typical miss around year 8, where the sample is deepest, is {meta.skater.mae} quality games for skaters and {meta.goalie.mae} for goalies. {progress}
      </p>
      <div className="mt-6">
        <ExpectedChart curves={curves} />
      </div>
      <p className="mt-3 text-sm text-zinc-500">
        The same curves are also drawn as a larger chart.{" "}
        <a className="underline hover:text-white" href={"/draft-rater/charts/expected-gp.svg"}>
          Open the full chart
        </a>
        .
      </p>

      <h2 className="display mt-10 text-2xl font-bold">The development window</h2>
      <p className="mt-3 leading-7 text-zinc-300">
        Skaters are protected through year {meta.skaterWindow}. Goalies are protected through year {meta.goalieWindow}. Inside that window, a player with fewer than {meta.graduateQg} quality games is a prospect. There is no letter yet. The score is still shown, so you can see whether they are ahead or behind, and they are left out of team, GM, and draft-class averages.
      </p>
      <p className="mt-3 leading-7 text-zinc-300">
        The window ends early the moment a prospect reaches {meta.graduateQg} quality games, even if a top pick is still below what that slot usually produces. Once the window closes, every pick gets a letter.
      </p>
      <WindowTimeline />
      <p className="mt-3 text-sm text-zinc-500">
        First-round picks who are still below a C- in the next two years are Stalled, not yet a Bust. Skaters in years 4 and 5. Goalies in years 6 and 7.
      </p>

      <h2 className="display mt-10 text-2xl font-bold">The stamps</h2>
      <div className="mt-4 grid gap-3">
        <Rule stamp="DEVELOPING" text="Still inside the window, and under 25 quality games. No letter. Not in the averages." />
        <Rule stamp="STALLED" text="A graduated first-round pick, number 1 through 32, still at D+, D, or D- in the make-or-break years. Skaters in years 4 and 5. Goalies in years 6 and 7. The letter shows, and it counts in the averages. Later rounds never get this stamp." />
        <Rule stamp="BUST" text="A first-round pick who is still D+, D, or D- after those years. Skaters from year 6. Goalies from year 8. Later rounds never get this stamp." />
        <Rule stamp="STEAL" text="A graduated pick at number 20 or later who earns an A or A+, or finishes at least 200 quality games above the slot." />
        <Rule stamp="LATE BLOOMER" text="Behind the slot through all of the first four post-draft seasons. The score then turns positive for the first time in year 5 or later, and it is still positive today. A steal can wear this stamp too." />
        <Rule stamp="ELITE" text="A franchise peak, not just a long career. Forwards need three seasons of 105 quality games, a career points-per-game of at least 0.80, and either 850 career quality games or 1.15 quality games per game across 300 games. Defensemen use the same peak and volume, without the scoring-rate bar. Goalies need three seasons of 60 quality games, and either 450 career quality games or 1.05 quality games per start across 200 starts." />
        <Rule stamp="RETIRED" text="The NHL lists the player as inactive, they played at least 25 NHL games, and the draft was at least seven years ago. During the 2026–27 season that is the 2019 draft and earlier. A cup of coffee, or a prospect still in the NCAA or Europe, does not get this stamp." />
      </div>

      <h2 className="display mt-10 text-2xl font-bold">The letter</h2>
      <p className="mt-3 leading-7 text-zinc-300">
        A pick’s letter is where its score sits among graded picks since 2005. A+ is the 97th percentile. D- is the bottom. {meta.gradedPickCount.toLocaleString()} picks have a letter right now. {meta.developingCount.toLocaleString()} are still prospects.
      </p>
      <LetterScale />
      <h2 className="display mt-10 text-2xl font-bold">Team and GM grades</h2>
      <p className="mt-3 leading-7 text-zinc-300">
        A player’s score stays quality minus expected. Team grades, GM grades, and a team’s grade for one draft do not average those scores evenly, and they do not multiply a lottery pick by four or eight. The weight is about the scouting decision.
      </p>
      <p className="mt-3 leading-7 text-zinc-300">
        A top-15 pick who hits counts once. Hitting on a consensus star is the job, not a bonus. A top-20 pick who misses counts more: 2.5 times at number 1, about 2.1 times at number 6, and 1.75 times at number 11, easing back to a normal weight by number 21. A mid or late first-rounder counts 1.15 times. A hit from round 2 through 7 counts 1.35 times, because finding a regular there is a scouting win. A miss in those rounds counts 0.85 times, because most of those picks were never expected to play.
      </p>
      <p className="mt-3 leading-7 text-zinc-300">
        One generational score does not carry the franchise. Above +600, extra points count less: the average uses 600 plus 15 times the square root of whatever is left. A +1,583 season-eater still adds about +1,070, and then it stops climbing. A GM with a short sample is pulled toward zero. Six graded picks keep about 43 percent of the raw average. Sixty graded picks keep about 88 percent. A GM needs five graded picks for a letter on the era page, and 15 to appear on the board. Team letters are compared with the other franchises. GM letters are compared with the other general managers in the view.
      </p>
      <p className="mt-3 leading-7 text-zinc-300">
        A whole draft year’s letter is a different question. It still weighs earlier picks more, one divided by the square root of the pick number, because it asks how much value the class produced. That letter is compared with the other years.
      </p>

      <h2 className="display mt-10 text-2xl font-bold">A few real picks</h2>
      <div className="mt-4">
        <table className="sheet w-full text-left text-sm">
          <thead className="text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="py-2 pr-3 font-medium">Player</th>
              <th className="py-2 pr-3 font-medium">Slot</th>
              <th className="py-2 pr-3 font-medium">Year</th>
              <th className="py-2 pr-3 font-medium">Score</th>
              <th className="py-2 font-medium">Grade</th>
            </tr>
          </thead>
          <tbody>
            {meta.examples.map((pick) => (
              <tr key={pick.id}>
                <td className="border-t border-white/10 py-2 pr-3">
                  <Link href={`/draft-rater/picks/${pick.id}`} className="hover:text-white">
                    {pick.name}
                  </Link>
                </td>
                <td className="border-t border-white/10 py-2 pr-3 text-zinc-400">
                  {pick.year} #{pick.overall}
                </td>
                <td className="border-t border-white/10 py-2 pr-3 text-zinc-400">{yearLabel(pick.milestone)}</td>
                <td className="border-t border-white/10 py-2 pr-3">{signed(pick.score)}</td>
                <td className="border-t border-white/10 py-2">{pick.developing ? "—" : pick.letter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="display mt-10 text-2xl font-bold">What this misses</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-zinc-300">
        <li>Ice time and points are not the whole of defense. A shutdown defender can look quieter than he is.</li>
        <li>Shortened seasons stay as the games that were played. The curve is built from those same seasons.</li>
        <li>The team that made the pick gets the credit, including picks it acquired in a trade.</li>
        <li>Atlanta’s picks belong to Winnipeg. Phoenix and Arizona belong to Utah.</li>
        <li>
          A draft belongs to the general manager who held the job that day. Acting managers who never ran a draft are left off the list. {meta.eraNote}
        </li>
      </ul>
    </article>
  );
}

function Rule({ stamp, text }: { stamp: "DEVELOPING" | "STALLED" | "BUST" | "STEAL" | "LATE BLOOMER" | "ELITE" | "RETIRED"; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 px-4 py-3">
      <StampMark stamp={stamp} />
      <p className="text-sm leading-6 text-zinc-300">{text}</p>
    </div>
  );
}
