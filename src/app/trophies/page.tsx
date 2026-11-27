/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { nhlersFile } from "@/lib/nhlers";
import { playerHref } from "@/lib/routes";
import { trophyRaces } from "@/lib/trophies";

export const metadata: Metadata = {
  title: "Trophy Favorites",
  description: "Live top-5 favorites for the Hart, Norris, Vezina, Calder and Selke, from this season's luck-adjusted Impact pace and Overall Skill.",
  alternates: { canonical: "/trophies" },
};

export default function TrophiesPage() {
  const races = trophyRaces();
  const season = `${nhlersFile.season}-${String(nhlersFile.season + 1).slice(2)}`;
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#F59E0B] uppercase">Trophy Favorites · {season}</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Who wins the hardware?</h1>
      <p className="mt-2 max-w-3xl text-[#94A3B8]">
        Our live favorites, updated every night from this season only. Each race uses <b className="text-[#F8FAFC]">luck-adjusted Impact pace</b>: hot shooting (or a hot save %) beyond
        what a player&apos;s own history predicts is taken back out, so a lucky month does not buy a trophy. Data through {nhlersFile.asOf}.
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {races.map((race) => (
          <section key={race.id} className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="display text-2xl font-bold">{race.name}</h2>
              <span className="text-xs text-[#94A3B8]">{race.award}</span>
            </div>
            <p className="mt-1 text-xs text-[#94A3B8]">{race.blurb}</p>
            {race.favorites.length ? (
              <ol className="mt-3 divide-y divide-[#262B36]">
                {race.favorites.map((fav, i) => (
                  <li key={fav.playerId}>
                    <Link href={playerHref(fav.routeId, "stats")} className="flex items-center gap-3 py-2.5 transition hover:bg-white/[0.03]">
                      <span className={`display w-6 text-xl font-bold ${i === 0 ? "text-[#F59E0B]" : "text-[#94A3B8]"}`}>{i + 1}</span>
                      <img
                        src={fav.headshot ? `https://assets.nhle.com/mugs/nhl/latest/${fav.playerId}.png` : "/player-silhouette.svg"}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-full border border-[#262B36] bg-[#0B0D10] object-cover object-top"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-semibold">
                          {fav.name}
                          {fav.team ? <TeamLogo abbr={fav.team} className="h-4 w-5" /> : null}
                          <span className="text-xs font-normal text-[#94A3B8]">{fav.pos}</span>
                        </span>
                        <span className="block text-xs text-[#94A3B8]">
                          {fav.gp} GP · {fav.line}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="display block text-lg font-bold">{fav.pace.toFixed(0)}</span>
                        <span
                          className={`block text-[10px] ${fav.luck > 2 ? "text-[#F97316]" : fav.luck < -2 ? "text-[#10B981]" : "text-[#94A3B8]"}`}
                          title="Impact added (+) or removed (-) by the luck adjustment"
                        >
                          {fav.luck > 0 ? `−${fav.luck.toFixed(1)} luck` : fav.luck < 0 ? `+${(-fav.luck).toFixed(1)} unlucky` : "no luck adj."}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-[#94A3B8]">Not enough games played yet.</p>
            )}
          </section>
        ))}
      </div>
      <p className="mt-5 text-xs text-[#94A3B8]">
        Big number = luck-adjusted Impact per 82 games. Players need 8+ games. Rankings also weigh games played so far, so a hot 10-game start does not outrank a full season. These are
        StatsPuck projections, not the voters&apos; ballots.
      </p>
    </div>
  );
}
