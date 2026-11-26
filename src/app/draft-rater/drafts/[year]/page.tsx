import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftYearBoard } from "@/components/draft-year-board";
import { ShareLauncher } from "@/components/share-modal";
import { draftClasses, picks } from "@/lib/data";
import { scoreClass, signed } from "@/lib/format";

type Params = { year: string };

export function generateStaticParams() {
  return draftClasses.map((row) => ({ year: String(row.year) }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { year } = await params;
  const row = draftClasses.find((item) => item.year === Number(year));
  if (!row) return {};
  const title = `${row.year} draft class`;
  const description = `The ${row.year} NHL draft grades ${row.letter}, ${signed(row.avg)} Impact versus the slot.`;
  const image = `/og/classes/${row.year}.png`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function DraftYearPage({ params }: { params: Promise<Params> }) {
  const { year } = await params;
  const row = draftClasses.find((item) => item.year === Number(year));
  if (!row) notFound();
  const owned = picks.filter((pick) => pick.year === row.year).sort((a, b) => a.overall - b.overall);
  const captions = Object.fromEntries(
    row.teams.map((team) => [
      team.franchise,
      {
        label: team.franchiseName,
        letter: team.letter,
        avg: team.avg,
        n: team.n,
        developing: team.developing,
      },
    ]),
  );

  return (
    <div>
      <p className="text-sm text-zinc-500">
        <Link href="/draft-rater/drafts" className="hover:text-white">
          Draft classes
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-5xl font-bold">{row.year} draft</h1>
          <p className="mt-2 text-zinc-400">
            {signed(row.avg)} vs the slot · {row.n} graded
            {row.developing > 0 ? ` · ${row.developing} ${row.developing === 1 ? "prospect" : "prospects"}` : ""}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Redraft order follows total Impact, not the score versus the slot. The class grade weighs earlier picks more heavily.
          </p>
        </div>
        <div className="text-right">
          <p className={`display text-7xl leading-none font-bold ${scoreClass(row.avg)}`}>{row.letter}</p>
          <p className="mt-1 text-sm text-zinc-500">{row.rating} / 100</p>
          <div className="mt-3">
            <ShareLauncher
              fileSlug={`${row.year}-draft`}
              title={`${row.year} draft class`}
              summary={`The ${row.year} NHL draft grades ${row.letter ?? "incomplete"}, ${signed(row.avg)} versus the slot.`}
              path={`/draft-rater/drafts/${row.year}`}
              card={{
                kind: "class",
                year: row.year,
                early: owned.length > 0 && row.n / owned.length < 0.5,
                letter: row.letter,
                rating: row.rating,
                avg: row.avg,
                regulars: owned.filter((pick) => pick.qg >= 100).length,
                leader: owned.filter((pick) => !pick.forfeited).sort((a, b) => a.redraft - b.redraft)[0] ?? null,
                steal: owned.filter((pick) => !pick.developing && pick.overall >= 20 && (pick.score ?? 0) > 0).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null,
                bust: owned.filter((pick) => pick.stamps.includes("BUST")).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0] ?? null,
                bestTeam: row.teams.filter((team) => team.avg != null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0]?.franchiseName ?? "—",
                top: owned.filter((pick) => !pick.forfeited).sort((a, b) => a.redraft - b.redraft).slice(0, 5),
              }}
            />
          </div>
        </div>
      </div>
      <DraftYearBoard
        picks={owned}
        teams={row.teams}
        captions={captions}
        idleCaption={{
          label: "Whole draft",
          letter: row.letter,
          avg: row.avg,
          n: row.n,
          developing: row.developing,
        }}
      />
    </div>
  );
}
