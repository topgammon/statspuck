import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BioCard, CapBar, ComingSoonPanel, DnaPills, ModulePreviews, ORG_TABS, PillarGrades, SectionLabel } from "@/components/entity/bio";
import { AssetMgmtSoon, AssetRankMini, DraftCapitalMatrix, FranchiseAssetCard, TradeRecord } from "@/components/entity/trades-cap";
import { teamTradeReport } from "@/lib/gm-grades";
import { OrgDevelopment } from "@/components/entity/org-development";
import { devBoard, devGems, undraftedGems } from "@/lib/dev-board";
import { development } from "@/lib/development";
import { EntityTabs, TabLink } from "@/components/entity/entity-tabs";
import { ShareLauncher } from "@/components/share-modal";
import { ScoutingPanels } from "@/components/scouting-panels";
import { TeamBreakdown } from "@/components/team-breakdown";
import { TeamLogo } from "@/components/team-logo";
import { eras, leaderboard, og, picks } from "@/lib/data";
import { DEV_SCORE_TIP, DRAFT_SCORE_TIP, scoreClass, signed } from "@/lib/format";
import { gmHref, playerHref, teamHref } from "@/lib/routes";
import { scoutingReport } from "@/lib/scouting";
import type { BriefPick, Era, TeamGrade } from "@/lib/types";

type Params = { team: string };

export function generateStaticParams() {
  return leaderboard.map((team) => ({ team: team.abbr.toLowerCase() }));
}

export const dynamicParams = false;

function findTeam(slug: string): TeamGrade | undefined {
  return leaderboard.find((row) => row.abbr === slug.toUpperCase());
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { team: slug } = await params;
  const team = findTeam(slug);
  if (!team) return {};
  const title = team.name;
  const description = `${team.name} draft grade ${team.letter} (${team.rating}/100), Draft Score ${signed(team.avg)} versus the NHL average.`;
  const image = og.teams[team.abbr];
  return {
    title,
    description,
    alternates: { canonical: teamHref(team.abbr) },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function TeamPage({ params }: { params: Promise<Params> }) {
  const { team: slug } = await params;
  const team = findTeam(slug);
  if (!team) notFound();
  const owned = picks.filter((pick) => pick.franchise === team.abbr).sort((a, b) => a.year - b.year || a.overall - b.overall);
  const teamEras = eras.filter((era) => era.team === team.abbr);
  const currentGm = teamEras.filter((era) => era.endYear == null).sort((a, b) => b.startYear - a.startYear)[0] ?? null;
  const report = scoutingReport(owned, picks);
  const trades = teamTradeReport(team.abbr);

  const share = (
    <ShareLauncher
      fileSlug={team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
      title={`${team.name} draft grade`}
      summary={`${team.name} grade ${team.letter}, Draft Score ${signed(team.avg)}.`}
      path={teamHref(team.abbr)}
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
  );

  const left = (
    <div className="flex items-center gap-4">
      <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-[#262B36] bg-[#0B0D10]/60 sm:h-28 sm:w-28">
        <TeamLogo abbr={team.abbr} name={team.name} className="h-16 w-20 sm:h-20 sm:w-24" />
      </span>
      <div className="min-w-0">
        <h1 className="display text-3xl leading-tight font-bold sm:text-4xl">{team.name}</h1>
        {currentGm ? (
          <p className="mt-2 text-sm text-[#94A3B8]">
            GM{" "}
            <Link href={gmHref(currentGm.slug)} className="font-semibold text-[#F8FAFC] underline decoration-[#38BDF8]/50 underline-offset-4 hover:decoration-[#38BDF8]">
              {currentGm.person}
            </Link>{" "}
            · since {currentGm.startYear}
          </p>
        ) : null}
      </div>
    </div>
  );

  const middle = (
    <div className="flex h-full flex-col gap-4">
      <CapBar abbr={team.abbr} />
      <AssetRankMini abbr={team.abbr} />
      <DnaPills report={report} />
    </div>
  );

  const right = (
    <PillarGrades
      assetMgmt
      pillars={[
        { label: "Draft", letter: team.letter, score: signed(team.avg), tone: scoreClass(team.avg), title: DRAFT_SCORE_TIP },
        { label: "Dev", letter: team.dev?.letter ?? null, score: team.dev ? signed(team.dev.avg) : "too new", tone: team.dev ? scoreClass(team.dev.avg) : undefined, title: DEV_SCORE_TIP },
        trades
          ? { label: "Trades", letter: trades.letter, score: signed(trades.score), tone: scoreClass(trades.score), title: "Net Impact from every trade since 2005-06, five seasons out, shrunk for sample size. Ranked against the other franchises." }
          : { label: "Trades", letter: null, soon: true },
      ]}
      stats={[
        { label: "Draft rank", value: `#${team.rank} of ${leaderboard.length}` },
        { label: "Dev rank", value: team.dev?.rank ? `#${team.dev.rank} of ${devBoard.length}` : "—" },
      ]}
      action={share}
    />
  );

  const panels: Record<string, ReactNode> = {
    overview: <Overview team={team} currentGm={currentGm} eraCount={teamEras.length} />,
    draft: (
      <div>
        <p className="text-sm text-[#94A3B8]">
          <Link href="/draft-rater" className="hover:text-white">
            Draft Rater
          </Link>{" "}
          · The letter compares this franchise with the other {leaderboard.length - 1}. Every graduated pick counts equally, with a #1 overall hit capped at +250. Prospects under 25 Impact are not in the average. Draft Score 0.0 is the average NHL franchise.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PickCard title="Best pick" pick={team.best} />
          <PickCard title="Worst pick" pick={team.worst} />
        </div>
        <ScoutingPanels report={report} />
        <TeamBreakdown eras={teamEras} color={team.color} byYear={team.byYear} picks={owned} />
      </div>
    ),
    development: (
      <OrgDevelopment
        subject={team.name}
        dev={team.dev}
        gems={devGems(team.dev)}
        undrafted={undraftedGems({ franchise: team.abbr })}
        board={devBoard}
        highlight={team.abbr}
        matureThrough={development.matureThrough}
      />
    ),
    "trades-cap": (
      <div className="grid gap-5">
        <FranchiseAssetCard abbr={team.abbr} />
        <DraftCapitalMatrix abbr={team.abbr} teamName={team.name} />
        {trades ? <TradeRecord report={trades} subject={team.name} /> : null}
        <AssetMgmtSoon subject={team.name} />
      </div>
    ),
    luck: <ComingSoonPanel tab="luck" subject={team.name} />,
    matchups: <ComingSoonPanel tab="matchups" subject={team.name} />,
  };

  return (
    <div>
      <BioCard left={left} middle={middle} right={right} />
      <EntityTabs tabs={ORG_TABS} panels={panels} />
    </div>
  );
}

function Overview({ team, currentGm, eraCount }: { team: TeamGrade; currentGm: Era | null; eraCount: number }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Draft Rater</SectionLabel>
          <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">Live</span>
        </div>
        <p className="mt-3 text-[#F8FAFC]">
          <span className="display text-3xl font-bold">#{team.rank}</span>
          <span className="text-[#94A3B8]"> of {leaderboard.length} drafting franchises since 2005</span>
        </p>
        <p className="mt-1 text-sm text-[#94A3B8]">
          {team.n} graded picks · {team.developing} prospects still developing · {eraCount} GM {eraCount === 1 ? "era" : "eras"}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <PickCard title="Best pick" pick={team.best} compact />
          <PickCard title="Worst pick" pick={team.worst} compact />
        </div>
        <TabLink tab="draft" className="mt-4 text-sm font-semibold text-[#38BDF8] hover:underline">
          Open the full Draft breakdown →
        </TabLink>
      </div>
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>Front office</SectionLabel>
        {currentGm ? (
          <Link href={gmHref(currentGm.slug)} className="mt-3 block rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-4 hover:border-[#38BDF8]/60">
            <p className="text-xs text-[#94A3B8]">General manager since {currentGm.startYear}</p>
            <p className="display text-2xl font-bold">{currentGm.person}</p>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {currentGm.letter ? `GM draft grade ${currentGm.letter} · Draft Score ${signed(currentGm.avg)}` : "Not enough graded picks for a GM letter yet"}
            </p>
          </Link>
        ) : (
          <p className="mt-3 text-sm text-[#94A3B8]">No current GM on file.</p>
        )}
      </div>
      <div className="rounded-2xl border border-[#38BDF8]/40 bg-[#14171F] p-5 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Development</SectionLabel>
          <span className="rounded-full bg-[#38BDF8]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#38BDF8] uppercase">Live</span>
        </div>
        <p className="mt-3 text-[#F8FAFC]">
          {team.dev ? (
            <>
              <span className="display text-3xl font-bold">{team.dev.letter}</span>
              <span className="text-[#94A3B8]">
                {" "}
                · Dev Score <span className={scoreClass(team.dev.avg)}>{signed(team.dev.avg)}</span> · #{team.dev.rank} at turning picks into NHL players
              </span>
            </>
          ) : (
            <span className="text-[#94A3B8]">Too new for a Development Grade. Picks need six full seasons.</span>
          )}
        </p>
        <TabLink tab="development" className="mt-3 text-sm font-semibold text-[#38BDF8] hover:underline">
          Open the Development breakdown →
        </TabLink>
      </div>
      <div className="lg:col-span-2">
        <div className="mb-3 rounded-xl border border-[#E11D48]/40 bg-[#14171F] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="display text-lg font-bold">Trades &amp; Cap</p>
            <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">Live</span>
          </div>
          <p className="mt-1 text-sm text-[#94A3B8]">Franchise asset rank, draft capital for 2027–2029 and the trade record.</p>
          <TabLink tab="trades-cap" className="mt-2 text-sm font-semibold text-[#38BDF8] hover:underline">
            Open Trades &amp; Cap →
          </TabLink>
        </div>
        <ModulePreviews tabs={["luck", "matchups"]} />
      </div>
    </div>
  );
}

function PickCard({ title, pick, compact = false }: { title: string; pick: BriefPick; compact?: boolean }) {
  return (
    <Link href={playerHref(pick.id, "draft")} className={`block rounded-2xl border border-[#262B36] hover:border-[#38BDF8]/60 ${compact ? "bg-[#0B0D10]/60 p-3" : "p-4"}`}>
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className={`mt-1 font-semibold ${compact ? "" : "text-lg"}`}>{pick.name}</p>
      <p className={`display font-bold ${compact ? "text-2xl" : "text-3xl"} ${scoreClass(pick.score)}`}>{signed(pick.score)}</p>
      <p className="text-sm text-zinc-500">
        {pick.year} · #{pick.overall}
      </p>
    </Link>
  );
}
