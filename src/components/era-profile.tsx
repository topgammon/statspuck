"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { BioCard, CapBar, ComingSoonPanel, DnaPills, ModulePreviews, ORG_TABS, PillarGrades, SectionLabel } from "@/components/entity/bio";
import type { DevLeaderRow } from "@/components/entity/dev-leaderboard";
import { OrgDevelopment, type DevGem, type UndraftedGem } from "@/components/entity/org-development";
import { EntityTabs, TabLink } from "@/components/entity/entity-tabs";
import { GmPhoto } from "@/components/entity/gm-photo";
import { PickBrowser } from "@/components/pick-browser";
import { ShareLauncher } from "@/components/share-modal";
import { ScoutingPanels } from "@/components/scouting-panels";
import { TeamName } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import { DEV_SCORE_TIP, DRAFT_SCORE_TIP, scoreClass, signed } from "@/lib/format";
import { gradeOwned } from "@/lib/grade";
import { gmHref, playerHref, teamHref } from "@/lib/routes";
import type { ScoutingReport } from "@/lib/scouting";
import type { Era, PickRow } from "@/lib/types";

type Stop = { slug: string; team: string; teamName: string; startYear: number; endYear: number | null };

export function EraProfile({
  era,
  teamPicks,
  careerPicks,
  pool,
  league,
  multiTeam,
  otherStops,
  capHit,
  devGems,
  undraftedGems,
  devBoard,
  matureThrough,
  teamReport,
  careerReport,
}: {
  era: Era;
  teamPicks: PickRow[];
  careerPicks: PickRow[];
  pool: number[];
  league: number;
  multiTeam: boolean;
  otherStops: Stop[];
  capHit: number | null;
  devGems: DevGem[];
  undraftedGems: UndraftedGem[];
  devBoard: DevLeaderRow[];
  matureThrough: number;
  teamReport: ScoutingReport;
  careerReport: ScoutingReport;
}) {
  const [scope, setScope] = useState<"team" | "career">("team");
  const rows = scope === "career" ? careerPicks : teamPicks;
  const stored = scope === "team";
  const computed = useMemo(() => gradeOwned(rows, pool, league), [rows, pool, league]);
  const avg = stored ? era.avg : computed.avg;
  const letter = stored ? era.letter : computed.letter;
  const rating = stored ? era.rating : computed.rating;
  const graded = stored ? era.n : computed.n;
  const developing = stored ? era.developing : computed.developing;
  const report = scope === "team" ? teamReport : careerReport;
  const ranked = useMemo(() => {
    const included = rows.filter((pick) => pick.included && pick.score != null);
    const byScore = [...included].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.overall - b.overall);
    return { best: byScore[0] ?? null, worst: byScore[byScore.length - 1] ?? null, notable: byScore.slice(0, 3) };
  }, [rows]);
  const years = [...new Set(rows.map((pick) => pick.year))].sort((a, b) => b - a);
  const teams = [...new Map(rows.map((pick) => [pick.franchise, pick.franchiseName])).entries()].map(([id, label]) => ({ id, label }));
  const tenure = `${era.startYear}–${era.endYear ?? "present"}`;
  const fileSlug = era.person.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const active = era.endYear == null;

  const share = (
    <ShareLauncher
      fileSlug={fileSlug}
      title={`${era.person} draft grade`}
      summary={`${era.person} ${letter ?? "has no letter yet"}, Draft Score ${signed(avg)}.`}
      path={gmHref(era.slug)}
      card={{
        kind: "gm",
        person: era.person,
        team: era.team,
        teamName: era.teamName,
        color: era.color,
        tenure: scope === "team" ? tenure : "All teams",
        letter: letter ?? "—",
        rating,
        avg,
        graded,
        developing,
        report,
        best: ranked.best,
        worst: ranked.worst,
        notable: ranked.notable,
      }}
    />
  );

  const left = (
    <div className="flex items-start gap-4">
      <div>
        <GmPhoto photoUrl={era.photoUrl} name={era.person} color={era.color} className="h-24 w-24 sm:h-28 sm:w-28" />
        {era.photoUrl && era.photoPage ? (
          <a href={era.photoPage} target="_blank" rel="noopener noreferrer" className="mt-1 block text-center text-[10px] text-[#94A3B8]/70 hover:text-white">
            Photo: Wikimedia
          </a>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">{era.role}</p>
        <h1 className="display text-3xl leading-tight font-bold sm:text-4xl">{era.person}</h1>
        <p className="mt-1 text-sm text-[#94A3B8]">
          <Link href={teamHref(era.team)} className="hover:text-white">
            <TeamName abbr={era.team} name={era.teamName} logoClassName="h-5 w-7" />
          </Link>{" "}
          · {tenure}
        </p>
        <div className="mt-3">
          <TogglePill
            value={scope}
            options={[
              { id: "team", label: "This Team Only" },
              { id: "career", label: "All Teams (Career)" },
            ]}
            onChange={setScope}
          />
        </div>
      </div>
    </div>
  );

  const middle = (
    <div className="flex h-full flex-col gap-4">
      {active ? <CapBar capHit={capHit} /> : null}
      <DnaPills report={report} graded={graded} />
    </div>
  );

  const dev = era.dev;
  const right = (
    <PillarGrades
      pillars={[
        { label: "Draft", letter, score: signed(avg), tone: scoreClass(avg), title: DRAFT_SCORE_TIP },
        { label: "Dev", letter: dev?.letter ?? null, score: dev ? signed(dev.avg) : "too new", tone: dev ? scoreClass(dev.avg) : undefined, title: DEV_SCORE_TIP },
        { label: "Trades", letter: null, soon: true },
      ]}
      stats={[{ label: "Draft rating", value: rating == null ? "—" : `${rating}/100` }, { label: "Dev picks", value: dev ? String(dev.n) : "—" }]}
      action={share}
    />
  );

  const draftPanel = (
    <div>
      <p className="text-sm text-[#94A3B8]">
        <Link href="/draft-rater?tab=gms" className="hover:text-white">
          Draft Rater
        </Link>{" "}
        ·{" "}
        {letter
          ? `${rating}/100 among general managers. ${scope === "team" ? `${era.teamName} drafts only.` : "Every franchise he has run."} Every graduated pick counts equally, a #1 overall hit is capped at +250, and a short run is pulled toward the league average.`
          : "A letter needs at least five graded picks. Prospects under 25 Impact stay in the list below and out of the average."}
      </p>
      {era.note && scope === "team" ? <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">{era.note}</p> : null}
      {!multiTeam && scope === "career" ? <p className="mt-3 text-sm text-zinc-500">This run is his only NHL stop in the book, so the career view matches {era.teamName}.</p> : null}
      <ScoutingPanels report={report} />
      <section className="mt-10">
        <h2 className="display text-2xl font-bold">Picks</h2>
        <div className="mt-3">
          <PickBrowser picks={rows} years={years} teams={scope === "career" ? teams : undefined} showTeam={scope === "career"} />
        </div>
      </section>
    </div>
  );

  const panels: Record<string, ReactNode> = {
    overview: (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Draft Rater</SectionLabel>
            <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">Live</span>
          </div>
          <p className="mt-3 text-sm text-[#94A3B8]">
            {scope === "team" ? `${era.teamName}, ${tenure}` : "All teams"} · {graded} graded picks{developing > 0 ? ` · ${developing} prospects` : ""}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ranked.best ? <PickLine title="Best pick" pick={ranked.best} /> : null}
            {ranked.worst && ranked.worst !== ranked.best ? <PickLine title="Worst pick" pick={ranked.worst} /> : null}
          </div>
          <TabLink tab="draft" className="mt-4 text-sm font-semibold text-[#38BDF8] hover:underline">
            Open the full Draft breakdown →
          </TabLink>
        </div>
        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>Career stops</SectionLabel>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center justify-between gap-3 rounded-xl border border-[#38BDF8]/40 bg-[#0B0D10]/60 px-3 py-2 text-sm">
              <TeamName abbr={era.team} name={era.teamName} logoClassName="h-5 w-7" />
              <span className="text-[#94A3B8]">{tenure}</span>
            </li>
            {otherStops.map((stop) => (
              <li key={stop.slug}>
                <Link href={gmHref(stop.slug)} className="flex items-center justify-between gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-3 py-2 text-sm hover:border-[#38BDF8]/60">
                  <TeamName abbr={stop.team} name={stop.teamName} logoClassName="h-5 w-7" />
                  <span className="text-[#94A3B8]">
                    {stop.startYear}–{stop.endYear ?? "present"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2">
          <ModulePreviews tabs={["trades", "luck", "matchups"]} />
        </div>
      </div>
    ),
    draft: draftPanel,
    development: (
      <OrgDevelopment
        subject={`${era.person} · ${era.teamName}, ${tenure}`}
        dev={dev}
        gems={devGems}
        undrafted={undraftedGems}
        board={devBoard}
        highlight={era.team}
        matureThrough={matureThrough}
        note="The Development Grade covers this team's run only. GM letters are compared with other general managers; the leaderboard below ranks franchises."
      />
    ),
    trades: <ComingSoonPanel tab="trades" subject={era.person} />,
    luck: <ComingSoonPanel tab="luck" subject={era.person} />,
    matchups: <ComingSoonPanel tab="matchups" subject={era.person} />,
  };

  return (
    <div>
      <BioCard left={left} middle={middle} right={right} />
      <EntityTabs tabs={ORG_TABS} panels={panels} />
    </div>
  );
}

function PickLine({ title, pick }: { title: string; pick: PickRow }) {
  return (
    <Link href={playerHref(pick.id, "draft")} className="block rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 hover:border-[#38BDF8]/60">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className="mt-1 font-semibold">{pick.name}</p>
      <p className={`display text-2xl font-bold ${scoreClass(pick.score)}`}>{signed(pick.score)}</p>
      <p className="text-sm text-zinc-500">
        {pick.year} · #{pick.overall}
      </p>
    </Link>
  );
}
