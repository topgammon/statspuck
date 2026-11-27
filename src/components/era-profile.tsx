"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { BioCard, CapBar, DnaPills, PillarGrades, SectionLabel } from "@/components/entity/bio";
import type { DevLeaderRow } from "@/components/entity/dev-leaderboard";
import { OrgDevelopment, type DevGem, type UndraftedGem } from "@/components/entity/org-development";
import { EntityTabs, TabLink } from "@/components/entity/entity-tabs";
import { GmPhoto } from "@/components/entity/gm-photo";
import { PickBrowser } from "@/components/pick-browser";
import { ShareLauncher } from "@/components/share-modal";
import { ScoutingPanels } from "@/components/scouting-panels";
import { TeamLogo, TeamName } from "@/components/team-logo";
import { DEV_SCORE_TIP, DRAFT_SCORE_TIP, scoreClass, signed } from "@/lib/format";
import type { GmReport } from "@/lib/gm-grades";
import { letterTone } from "@/lib/search";
import { gmHref, playerHref, teamHref } from "@/lib/routes";
import type { ScoutingReport } from "@/lib/scouting";
import type { DevGrade, Era, PickRow } from "@/lib/types";

// GM profile. A GM is graded on his whole career by default ("All teams"). The team picker
// narrows every number on the page to one tenure. Arriving from a team page (?view=team)
// opens on that tenure, so people land where they meant to go with no extra clicks.

export type GmView = {
  /** "all" or the tenure's era slug. */
  id: string;
  label: string;
  team: string | null;
  teamName: string | null;
  tenure: string;
  color: string;
  report: GmReport | null;
  draft: { avg: number | null; letter: string | null; rating: number | null; n: number; developing: number };
  scouting: ScoutingReport;
  /** Single tenure: its Development Grade. */
  dev: DevGrade | null;
  devGems: DevGem[];
  undraftedGems: UndraftedGem[];
  tradesPanel: ReactNode;
  note?: string | null;
};

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

export function EraProfile({
  era,
  views,
  careerPicks,
  assetMini,
  devBoard,
  matureThrough,
}: {
  /** The tenure this URL belongs to (also the newest for career links). */
  era: Era;
  /** "all" first, then each tenure newest first. */
  views: GmView[];
  careerPicks: PickRow[];
  assetMini: ReactNode;
  devBoard: DevLeaderRow[];
  matureThrough: number;
}) {
  const urlView = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get("view"),
    () => null,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? (urlView === "team" ? era.slug : "all");
  const view = views.find((item) => item.id === selectedId) ?? views[0];
  const isAll = view.id === "all";

  function choose(id: string) {
    setPicked(id);
    const url = new URL(window.location.href);
    if (id === era.slug) url.searchParams.set("view", "team");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }

  const rows = useMemo(
    () =>
      isAll
        ? careerPicks
        : careerPicks.filter((pick) => {
            const stop = views.find((item) => item.id === view.id)!;
            const [from, to] = stop.tenure.split("–");
            return pick.franchise === stop.team && pick.year >= Number(from) && (to === "present" || pick.year <= Number(to));
          }),
    [careerPicks, isAll, view.id, views],
  );
  const ranked = useMemo(() => {
    const included = rows.filter((pick) => pick.included && pick.score != null);
    const byScore = [...included].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.overall - b.overall);
    return {
      best: byScore[0] ?? null,
      worst: byScore[byScore.length - 1] ?? null,
      notable: byScore.slice(0, 3),
      top5: byScore.filter((pick) => pick.playerId != null).slice(0, 5),
    };
  }, [rows]);
  const years = [...new Set(rows.map((pick) => pick.year))].sort((a, b) => b - a);
  const pickTeams = [...new Map(rows.map((pick) => [pick.franchise, pick.franchiseName])).entries()].map(([id, label]) => ({ id, label }));
  const fileSlug = era.person.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const current = views.some((item) => item.id !== "all" && item.tenure.endsWith("present"));
  const gm = view.report;
  const draft = view.draft;
  const stops = views.filter((item) => item.id !== "all");

  const share = (
    <ShareLauncher
      fileSlug={fileSlug}
      title={`${era.person} GM grade`}
      summary={`${era.person}: ${gm?.overall?.letter ?? "no overall grade yet"} Overall GM Grade (${view.label}).`}
      path={gmHref(era.slug)}
      card={{
        kind: "gm",
        person: era.person,
        team: view.team ?? era.team,
        teamName: view.teamName ?? era.teamName,
        color: view.color,
        tenure: isAll ? "All teams" : view.tenure,
        letter: draft.letter ?? "—",
        rating: draft.rating,
        avg: draft.avg,
        graded: draft.n,
        developing: draft.developing,
        report: view.scouting,
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
          {isAll ? (
            <>
              {stops.length} {stops.length === 1 ? "team" : "teams"} · {views[0].tenure}
            </>
          ) : (
            <>
              <Link href={teamHref(view.team!)} className="hover:text-white">
                <TeamName abbr={view.team!} name={view.teamName!} logoClassName="h-5 w-7" />
              </Link>{" "}
              · {view.tenure}
            </>
          )}
        </p>
        <Link
          href="/leaderboards?board=gms"
          title="Overall GM Grade. Click for the GM leaderboard."
          className="mt-3 inline-flex items-center gap-2.5 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 py-1.5 pr-3 pl-1.5 transition hover:border-[#38BDF8]/60"
        >
          <span className={`display flex h-10 min-w-12 items-center justify-center rounded-lg border px-1.5 text-2xl leading-none font-bold ${letterTone(gm?.overall?.letter ?? null)}`}>
            {gm?.overall?.letter ?? "—"}
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">Overall GM grade · {isAll ? "Career" : view.team}</span>
            <span className="block text-sm font-semibold">{gm?.overall ? `${gm.overall.rating}/100 · ${gm.overall.pillars} pillars` : "Needs 2 pillars"}</span>
          </span>
        </Link>
        {ranked.top5.length ? (
          <a
            href={`/card-studio?template=top5&preset=impact&players=${ranked.top5.map((pick) => pick.playerId).join(",")}&title=${encodeURIComponent(`${era.person}'s Best Draft Picks`)}`}
            className="mt-2 block text-xs font-semibold text-[#38BDF8] hover:underline"
          >
            Open in Card Studio →
          </a>
        ) : null}
        <div role="group" aria-label="Choose a team" className="mt-3 flex flex-wrap gap-1.5">
          {views.map((item) => {
            const on = item.id === view.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => choose(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                  on ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]" : "border-[#262B36] text-[#94A3B8] hover:border-[#38BDF8]/60 hover:text-white"
                }`}
              >
                {item.team ? <TeamLogo abbr={item.team} name={item.teamName ?? undefined} className="h-4 w-5" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const middle = (
    <div className="flex h-full flex-col gap-4">
      {current ? <CapBar abbr={era.team} /> : null}
      {current ? assetMini : null}
      <DnaPills report={view.scouting} graded={draft.n} />
    </div>
  );

  const right = (
    <PillarGrades
      pillars={[
        { label: "Draft", letter: draft.letter, score: signed(draft.avg), tone: scoreClass(draft.avg), title: DRAFT_SCORE_TIP },
        {
          label: "Dev",
          letter: gm?.dev.letter ?? null,
          score: gm?.dev.score != null ? signed(gm.dev.score) : "too new",
          tone: gm?.dev.score != null ? scoreClass(gm.dev.score) : undefined,
          title: DEV_SCORE_TIP,
        },
        gm?.asset
          ? { label: "Trades", letter: gm.asset.letter, score: signed(gm.asset.score), tone: scoreClass(gm.asset.score), title: ASSET_SCORE_TIP }
          : { label: "Trades", letter: null, soon: true },
      ]}
      assetMgmt
      hero={{
        label: isAll ? "Overall GM Grade · Career" : `Overall GM Grade · ${view.team}`,
        letter: gm?.overall?.letter ?? null,
        note: gm?.overall ? `${gm.overall.rating}/100 · ${gm.overall.pillars} pillars` : "Needs 2 pillars",
        title: "Average of the Drafting, Development and Trades ratings. A pillar with no data yet is left out. Asset Management is a separate grade that is coming soon.",
      }}
      stats={[
        { label: "Draft rating", value: draft.rating == null ? "—" : `${draft.rating}/100` },
        { label: "Graded picks", value: String(draft.n) },
      ]}
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
        {draft.letter
          ? `${draft.rating}/100 among general managers. ${isAll ? "Every franchise he has run." : `${view.teamName} drafts only.`} Every graduated pick counts equally, a #1 overall hit is capped at +250, and a short run is pulled toward the league average.`
          : "A letter needs at least five graded picks. Prospects under 25 Impact stay in the list below and out of the average."}
      </p>
      {view.note ? <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">{view.note}</p> : null}
      <ScoutingPanels report={view.scouting} />
      <section className="mt-10">
        <h2 className="display text-2xl font-bold">Picks</h2>
        <div className="mt-3">
          <PickBrowser picks={rows} years={years} teams={isAll ? pickTeams : undefined} showTeam={isAll} />
        </div>
      </section>
    </div>
  );

  const devPanel = isAll ? (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>Career Development Grade</SectionLabel>
        <p className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className={`display inline-flex min-w-14 justify-center rounded-xl border px-2 py-1 text-4xl leading-none font-bold ${letterTone(gm?.dev.letter ?? null)}`}>{gm?.dev.letter ?? "—"}</span>
          <span className="text-sm text-[#94A3B8]">
            {gm?.dev.score != null ? (
              <>
                Dev Score <span className={scoreClass(gm.dev.score)}>{signed(gm.dev.score)}</span> across every team, weighted by picks · {gm.dev.rating}/100 among GM careers
              </>
            ) : (
              "Not enough mature picks yet. Picks need six full seasons."
            )}
          </span>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stops.map((stop) => (
          <button key={stop.id} type="button" onClick={() => choose(stop.id)} className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4 text-left transition hover:border-[#38BDF8]/60">
            <p className="flex items-center gap-2 font-semibold">
              <TeamLogo abbr={stop.team!} name={stop.teamName ?? undefined} className="h-6 w-7" />
              {stop.teamName}
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">{stop.tenure}</p>
            <p className="mt-3 flex items-center gap-2">
              <span className={`display inline-flex min-w-10 justify-center rounded-lg border px-1.5 text-2xl font-bold ${letterTone(stop.dev?.letter ?? null)}`}>{stop.dev?.letter ?? "—"}</span>
              <span className="text-sm text-[#94A3B8]">{stop.dev ? `Dev Score ${signed(stop.dev.avg)} · ${stop.dev.n} picks` : "Too new"}</span>
            </p>
            <p className="mt-2 text-xs font-semibold text-[#38BDF8]">See this tenure →</p>
          </button>
        ))}
      </div>
    </div>
  ) : (
    <OrgDevelopment
      subject={`${era.person} · ${view.teamName}, ${view.tenure}`}
      dev={view.dev}
      gems={view.devGems}
      undrafted={view.undraftedGems}
      board={devBoard}
      highlight={view.team ?? era.team}
      matureThrough={matureThrough}
      note="The Development Grade covers this team's run only. GM letters are compared with other general managers; the leaderboard below ranks franchises."
    />
  );

  const panels: Record<string, ReactNode> = {
    report: (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>GM report card · {isAll ? "Career, all teams" : `${view.teamName}, ${view.tenure}`}</SectionLabel>
            <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">3 pillars</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <ReportTile label="Drafting" letter={gm?.draft.letter ?? null} note={gm?.draft.rating != null ? `${gm.draft.rating}/100` : "needs 5 graded picks"} tab="drafting" />
            <ReportTile label="Development" letter={gm?.dev.letter ?? null} note={gm?.dev.rating != null ? `${gm.dev.rating}/100` : "too new"} tab="development" />
            <ReportTile label="Trades" letter={gm?.asset?.letter ?? null} note={gm?.asset ? `${gm.asset.rating}/100 · ${gm.asset.trades} trades` : "no trade data"} tab="transactions" />
            <ReportTile label="Asset Management" letter={null} note="coming soon" soon />
            <ReportTile label="Overall GM Grade" letter={gm?.overall?.letter ?? null} note={gm?.overall ? `${gm.overall.rating}/100 · ${gm.overall.pillars} pillars` : "needs 2 pillars"} hero />
          </div>
          <p className="mt-3 text-xs text-[#94A3B8]">
            {isAll
              ? "Career grades count every team he has run since 2005 and are ranked against every other GM career."
              : "Single-team grades are ranked against every other GM tenure."}{" "}
            The overall grade averages the pillars that have data.{" "}
            <Link href="/leaderboards?board=gms" className="font-semibold text-[#38BDF8] hover:underline">
              GM leaderboard →
            </Link>
          </p>
        </div>
        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Draft Rater</SectionLabel>
            <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">Live</span>
          </div>
          <p className="mt-3 text-sm text-[#94A3B8]">
            {isAll ? "All teams" : `${view.teamName}, ${view.tenure}`} · {draft.n} graded picks{draft.developing > 0 ? ` · ${draft.developing} prospects` : ""}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ranked.best ? <PickLine title="Best pick" pick={ranked.best} /> : null}
            {ranked.worst && ranked.worst !== ranked.best ? <PickLine title="Worst pick" pick={ranked.worst} /> : null}
          </div>
          <TabLink tab="drafting" className="mt-4 text-sm font-semibold text-[#38BDF8] hover:underline">
            Open the full Drafting breakdown →
          </TabLink>
        </div>
        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>Career stops</SectionLabel>
          <ul className="mt-3 space-y-2">
            {stops.map((stop) => (
              <li key={stop.id}>
                <button
                  type="button"
                  onClick={() => choose(stop.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-[#0B0D10]/60 px-3 py-2 text-left text-sm transition hover:border-[#38BDF8]/60 ${
                    stop.id === view.id ? "border-[#38BDF8]/60" : "border-[#262B36]"
                  }`}
                >
                  <TeamName abbr={stop.team!} name={stop.teamName!} logoClassName="h-5 w-7" />
                  <span className="flex items-center gap-2 text-[#94A3B8]">
                    {stop.tenure}
                    <span className={`display rounded-md border px-1.5 text-xs font-bold ${letterTone(stop.report?.overall?.letter ?? null)}`}>{stop.report?.overall?.letter ?? "—"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
    drafting: draftPanel,
    development: devPanel,
    transactions: (
      <div className="grid gap-5">
        {view.tradesPanel}
        <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Signings · Buyouts · Waivers</SectionLabel>
            <span className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">Soon</span>
          </div>
          <p className="mt-2 text-sm text-[#94A3B8]">Free-agent signings, extensions, buyouts and waiver moves will join trades here and feed the Asset Management grade.</p>
        </div>
      </div>
    ),
  };

  return (
    <div>
      <BioCard left={left} middle={middle} right={right} />
      <EntityTabs tabs={GM_TABS} panels={panels} aliases={GM_ALIASES} />
    </div>
  );
}

const GM_TABS = [
  { id: "report", label: "Report Card" },
  { id: "drafting", label: "Drafting" },
  { id: "development", label: "Development" },
  { id: "transactions", label: "Transactions" },
];

const GM_ALIASES: Record<string, string> = { overview: "report", draft: "drafting", "trades-cap": "transactions", luck: "report", matchups: "report" };

const ASSET_SCORE_TIP =
  "Trades: net Impact (five seasons out) from the trades he made. 0.0 is the league-average GM, and short tenures are pulled toward it.";

function ReportTile({ label, letter, note, hero, soon, tab }: { label: string; letter: string | null; note: string; hero?: boolean; soon?: boolean; tab?: string }) {
  const body = (
    <>
      <span className="block text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{label}</span>
      <span className={`display mx-auto mt-1.5 flex h-14 w-20 items-center justify-center rounded-xl border text-4xl leading-none font-bold ${letterTone(letter)}`}>{letter ?? "—"}</span>
      <span className="mt-1.5 block text-[11px] text-[#94A3B8]">{note}</span>
    </>
  );
  const cls = `rounded-xl border bg-[#0B0D10]/60 px-3 py-3 text-center ${hero ? "border-[#F59E0B]/40" : soon ? "border-dashed border-[#262B36]" : "border-[#262B36]"}`;
  return tab ? (
    <TabLink tab={tab} className={`${cls} transition hover:border-[#38BDF8]/60`}>
      {body}
    </TabLink>
  ) : (
    <div
      title={soon ? "A separate grade for the whole picture: drafts, trades, signings, buyouts and waivers. Not live yet, and not part of the Overall GM Grade." : undefined}
      className={cls}
    >
      {body}
    </div>
  );
}

function PickLine({ title, pick }: { title: string; pick: PickRow }) {
  return (
    <Link href={playerHref(pick.id, "career")} className="block rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 hover:border-[#38BDF8]/60">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className="mt-1 font-semibold">{pick.name}</p>
      <p className={`display text-2xl font-bold ${scoreClass(pick.score)}`}>{signed(pick.score)}</p>
      <p className="text-sm text-zinc-500">
        {pick.year} · #{pick.overall}
      </p>
    </Link>
  );
}
