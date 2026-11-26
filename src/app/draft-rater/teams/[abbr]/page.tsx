import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareLauncher } from "@/components/share-modal";
import { ScoutingPanels } from "@/components/scouting-panels";
import { TeamBreakdown } from "@/components/team-breakdown";
import { TeamLogo } from "@/components/team-logo";
import { eras, leaderboard, og, picks } from "@/lib/data";
import { scoutingReport } from "@/lib/scouting";
import { scoreClass, signed } from "@/lib/format";

type Params = { abbr: string };

export function generateStaticParams() {
  return leaderboard.map((team) => ({ abbr: team.abbr.toLowerCase() }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { abbr } = await params;
  const team = leaderboard.find((row) => row.abbr === abbr.toUpperCase());
  if (!team) return {};
  const title = `${team.name} draft grade`;
  const description = `${team.name} grade ${team.letter} (${team.rating}/100), Draft Score ${signed(team.avg)} versus the NHL average.`;
  const image = og.teams[team.abbr];
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function TeamPage({ params }: { params: Promise<Params> }) {
  const { abbr } = await params;
  const team = leaderboard.find((row) => row.abbr === abbr.toUpperCase());
  if (!team) notFound();
  const owned = picks
    .filter((pick) => pick.franchise === team.abbr)
    .sort((a, b) => a.year - b.year || a.overall - b.overall);
  const teamEras = eras.filter((era) => era.team === team.abbr);
  const report = scoutingReport(owned, picks);

  return (
    <div>
      <p className="text-sm text-zinc-500">
        <Link href="/draft-rater" className="hover:text-white">
          Board
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <TeamLogo abbr={team.abbr} name={team.name} className="h-16 w-24" />
          <div>
            <h1 className="display text-4xl font-bold sm:text-5xl">{team.name}</h1>
            <p className="mt-2 text-zinc-400">
              Draft Score {signed(team.avg)} · {team.n} graded
              {team.developing > 0 ? ` · ${team.developing} ${team.developing === 1 ? "prospect" : "prospects"}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              The letter compares this franchise with the other 31. Every graduated pick counts equally, with a #1 overall hit capped at +250. Prospects under 25 Impact are not in the average. Draft Score 0.0 is the average NHL franchise.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="display text-7xl leading-none font-bold" style={{ color: team.color }}>
            {team.letter}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{team.rating} / 100</p>
        </div>
      </div>

      <div className="mt-6">
        <ShareLauncher
          fileSlug={team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
          title={`${team.name} draft grade`}
          summary={`${team.name} grade ${team.letter}, Draft Score ${signed(team.avg)}.`}
          path={`/teams/${team.abbr.toLowerCase()}`}
          card={{
            kind: "team",
            name: team.name,
            abbr: team.abbr,
            color: team.color,
            rank: team.rank,
            letter: team.letter,
            rating: team.rating,
            avg: team.avg,
            report,
            byYear: team.byYear,
          }}
        />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href={`/draft-rater/picks/${team.best.id}`} className="rounded-2xl border border-white/10 p-4">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">Best pick</p>
          <p className="mt-1 text-lg font-semibold">{team.best.name}</p>
          <p className={`display text-3xl font-bold ${scoreClass(team.best.score)}`}>{signed(team.best.score)}</p>
          <p className="text-sm text-zinc-500">
            {team.best.year} · #{team.best.overall}
          </p>
        </Link>
        <Link href={`/draft-rater/picks/${team.worst.id}`} className="rounded-2xl border border-white/10 p-4">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">Worst pick</p>
          <p className="mt-1 text-lg font-semibold">{team.worst.name}</p>
          <p className={`display text-3xl font-bold ${scoreClass(team.worst.score)}`}>{signed(team.worst.score)}</p>
          <p className="text-sm text-zinc-500">
            {team.worst.year} · #{team.worst.overall}
          </p>
        </Link>
      </div>

      <ScoutingPanels report={report} />
      <TeamBreakdown eras={teamEras} color={team.color} byYear={team.byYear} picks={owned} />
    </div>
  );
}
