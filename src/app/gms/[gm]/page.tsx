import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EraProfile, type GmView } from "@/components/era-profile";
import { AssetRankMini, GmTradesPanel } from "@/components/entity/trades-cap";
import { devBoard, devGems, undraftedGems } from "@/lib/dev-board";
import { development } from "@/lib/development";
import { eras, erasBySlug, meta, og, picks } from "@/lib/data";
import { gmReport } from "@/lib/gm-grades";
import { gmCareer } from "@/lib/overall-grades";
import { gmHref } from "@/lib/routes";
import { scoutingReport } from "@/lib/scouting";

type Params = { gm: string };

export function generateStaticParams() {
  return eras.map((era) => ({ gm: era.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { gm } = await params;
  const era = erasBySlug.get(gm);
  if (!era) return {};
  const career = gmCareer(era.person);
  const title = era.person;
  const description = career?.overall
    ? `${era.person}: ${career.overall.letter} Overall GM Grade across ${career.stops.length} ${career.stops.length === 1 ? "team" : "teams"} since 2005 (drafting, development and trades).`
    : `${era.person}, ${era.role} of the ${era.teamName}. Not enough data for an overall grade yet.`;
  const image = og.eras[era.slug];
  return {
    title,
    description,
    alternates: { canonical: gmHref(era.slug) },
    openGraph: { title, description, images: image ? [{ url: image, width: 1200, height: 630 }] : undefined },
    twitter: { card: "summary_large_image", images: image ? [image] : undefined },
  };
}

export default async function GmPage({ params }: { params: Promise<Params> }) {
  const { gm } = await params;
  const era = erasBySlug.get(gm);
  if (!era) notFound();
  const career = gmCareer(era.person)!;
  const current = career.current;
  const latestEnd = Math.max(...career.stops.map((stop) => stop.endYear ?? 0));

  const all: GmView = {
    id: "all",
    label: "All teams",
    team: null,
    teamName: null,
    tenure: `${career.firstYear}–${current ? "present" : latestEnd}`,
    color: career.latest.color,
    report: career,
    draft: { avg: career.draftAvg, letter: career.draft.letter, rating: career.draft.rating, n: career.draftN, developing: career.picks.filter((pick) => pick.developing).length },
    scouting: scoutingReport(career.picks, picks),
    dev: null,
    devGems: [],
    undraftedGems: [],
    tradesPanel: <GmTradesPanel person={era.person} team={career.latest.team} teamName={career.latest.teamName} current={current} report={career} />,
  };

  const stopViews: GmView[] = career.stops.map((stop) => {
    const end = stop.endYear ?? meta.latestDraftYear;
    const own = picks.filter((pick) => pick.franchise === stop.team && pick.year >= stop.startYear && pick.year <= end && !pick.forfeited);
    const report = gmReport(stop.slug);
    return {
      id: stop.slug,
      label: `${stop.team} ${stop.startYear}–${stop.endYear == null ? "now" : String(stop.endYear).slice(2)}`,
      team: stop.team,
      teamName: stop.teamName,
      tenure: `${stop.startYear}–${stop.endYear ?? "present"}`,
      color: stop.color,
      report,
      draft: { avg: stop.avg, letter: stop.letter, rating: stop.rating, n: stop.n, developing: stop.developing },
      scouting: scoutingReport(own, picks),
      dev: stop.dev ?? null,
      devGems: devGems(stop.dev),
      undraftedGems: undraftedGems({ era: stop.slug }),
      tradesPanel: <GmTradesPanel person={stop.person} team={stop.team} teamName={stop.teamName} current={stop.endYear == null} report={report} />,
      note: stop.note,
    };
  });

  return (
    <EraProfile
      era={era}
      views={[all, ...stopViews]}
      careerPicks={career.picks}
      assetMini={current ? <AssetRankMini abbr={career.latest.team} /> : null}
      devBoard={devBoard}
      matureThrough={development.matureThrough}
    />
  );
}
