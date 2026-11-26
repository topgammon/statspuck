import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EraProfile } from "@/components/era-profile";
import { eras, erasBySlug, meta, og, picks } from "@/lib/data";
import { scoutingReport } from "@/lib/scouting";

type Params = { slug: string };

export function generateStaticParams() {
  return eras.map((era) => ({ slug: era.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const era = erasBySlug.get(slug);
  if (!era) return {};
  const title = `${era.person} draft grade`;
  const description = era.letter
    ? `${era.person}, ${era.role} of the ${era.teamName}, grades ${era.letter} on drafts from ${era.startYear}.`
    : `${era.person}, ${era.role} of the ${era.teamName}. Not enough graded drafts for a letter yet.`;
  const image = og.eras[era.slug];
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [{ url: image, width: 1200, height: 630 }] : undefined },
    twitter: { card: "summary_large_image", images: image ? [image] : undefined },
  };
}

export default async function EraPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const era = erasBySlug.get(slug);
  if (!era) notFound();
  const latest = meta.latestDraftYear;
  const samePerson = eras.filter((item) => item.person === era.person);
  const teamPicks = picksFor(era, latest);
  const careerPicks = dedupe(samePerson.flatMap((item) => picksFor(item, latest)));
  const pool = eras.filter((item) => item.avg != null && item.n >= 5).map((item) => item.avg as number);
  return (
    <EraProfile
      era={era}
      teamPicks={teamPicks}
      careerPicks={careerPicks}
      pool={pool}
      multiTeam={samePerson.length > 1}
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
