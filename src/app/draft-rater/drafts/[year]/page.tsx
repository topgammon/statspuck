import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftYearBoard } from "@/components/draft-year-board";
import { ShareLauncher } from "@/components/share-modal";
import { CountryBadge } from "@/components/country-badge";
import { countryName } from "@/lib/countries";
import { draftClasses, picks } from "@/lib/data";
import { scoreClass, signed } from "@/lib/format";
import type { PickRow } from "@/lib/types";

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

/** Most common values, ties broken alphabetically. */
function leaders(values: (string | null | undefined)[]): { value: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const value of values) if (value) tally.set(value, (tally.get(value) ?? 0) + 1);
  return [...tally.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Top feeder league, club, and nationality for a draft class. */
function OriginStrip({ picks: rows }: { picks: PickRow[] }) {
  if (rows.length === 0) return null;
  const leagues = leaders(rows.map((pick) => pick.league));
  const clubs = leaders(rows.map((pick) => (pick.amateur ? `${pick.amateur}${pick.league && pick.league !== pick.amateur ? ` (${pick.league})` : ""}` : null)));
  const nations = leaders(rows.map((pick) => pick.country));
  const topClubs = clubs.filter((club) => club.count === clubs[0]?.count).slice(0, 2);
  const share = (count: number) => `${((count / rows.length) * 100).toFixed(1)}%`;
  const cards = [
    {
      label: "Top feeder league",
      value: leagues[0]?.value ?? "—",
      detail: leagues[0] ? `${leagues[0].count} picks · ${share(leagues[0].count)}` : "",
      tip: leagues.slice(1, 4).map((league) => `${league.value} (${league.count})`).join(", ") || undefined,
    },
    {
      label: "Top feeder club",
      value: topClubs.map((club) => club.value).join(" / ") || "—",
      detail: topClubs[0] ? `${topClubs[0].count} picks${topClubs.length > 1 ? " each" : ""}` : "",
      tip: clubs.slice(topClubs.length, topClubs.length + 3).map((club) => `${club.value} (${club.count})`).join(", ") || undefined,
    },
    {
      label: "Top nationality",
      value: nations[0] ? countryName(nations[0].value) : "—",
      code: nations[0]?.value,
      detail: nations[0] ? `${nations[0].count} picks · ${share(nations[0].count)}` : "",
      tip: nations.slice(1, 4).map((nation) => `${countryName(nation.value)} (${nation.count})`).join(", ") || undefined,
    },
  ];
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} title={card.tip ? `Next: ${card.tip}` : undefined} className="rounded-xl border border-[#262B36] bg-[#14171F] px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">{card.label}</p>
          <p className="display mt-1 flex items-center gap-2 truncate text-xl leading-tight font-bold text-[#F8FAFC]">
            {"code" in card && card.code ? <CountryBadge code={card.code} name={card.value} /> : null}
            <span className="truncate">{card.value}</span>
          </p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">{card.detail}</p>
        </div>
      ))}
    </div>
  );
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
      <OriginStrip picks={owned.filter((pick) => !pick.forfeited)} />
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
