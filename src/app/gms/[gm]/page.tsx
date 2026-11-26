import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EraProfile } from "@/components/era-profile";
import { AssetRankMini, GmTradesPanel } from "@/components/entity/trades-cap";
import { gmReport } from "@/lib/gm-grades";
import { devBoard, devGems, undraftedGems } from "@/lib/dev-board";
import { development } from "@/lib/development";
import { eras, erasBySlug, meta, og, picks } from "@/lib/data";
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
  const title = era.person;
  const description = era.letter
    ? `${era.person}, ${era.role} of the ${era.teamName}, grades ${era.letter} on drafts from ${era.startYear}.`
    : `${era.person}, ${era.role} of the ${era.teamName}. Not enough graded drafts for a letter yet.`;
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
  const latest = meta.latestDraftYear;
  const samePerson = eras.filter((item) => item.person === era.person);
  const teamPicks = picksFor(era, latest);
  const careerPicks = dedupe(samePerson.flatMap((item) => picksFor(item, latest)));
  const pool = eras.filter((item) => item.avg != null && item.n >= 5).map((item) => item.avg as number);
  const otherStops = samePerson
    .filter((item) => item.slug !== era.slug)
    .map((item) => ({ slug: item.slug, team: item.team, teamName: item.teamName, startYear: item.startYear, endYear: item.endYear }));
  const report = gmReport(era.slug);
  const current = era.endYear == null;
  return (
    <EraProfile
      era={era}
      gm={report}
      tradesPanel={<GmTradesPanel person={era.person} team={era.team} teamName={era.teamName} current={current} report={report} />}
      assetMini={current ? <AssetRankMini abbr={era.team} /> : null}
      teamPicks={teamPicks}
      careerPicks={careerPicks}
      pool={pool}
      league={meta.leagueAvg}
      multiTeam={samePerson.length > 1}
      otherStops={otherStops}
      devGems={devGems(era.dev)}
      undraftedGems={undraftedGems({ era: era.slug })}
      devBoard={devBoard}
      matureThrough={development.matureThrough}
      teamReport={scoutingReport(teamPicks, picks)}
      careerReport={scoutingReport(careerPicks, picks)}
    />
  );
}

function picksFor(era: { team: string; startYear: number; endYear: number | null }, latest: number): typeof picks {
  const end = era.endYear ?? latest;
  return picks
    .filter((pick) => pick.franchise === era.team && pick.year >= era.startYear && pick.year <= end)
    .sort((a, b) => a.year - b.year || a.overall - b.overall);
}

function dedupe(rows: typeof picks): typeof picks {
  const seen = new Set<number>();
  return rows.filter((pick) => {
    if (seen.has(pick.id)) return false;
    seen.add(pick.id);
    return true;
  });
}
