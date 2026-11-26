import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BioCard, ComingSoonPanel, ContractPill, HeroGrade, ModulePreviews, PillGrid, PLAYER_TABS, QuickPill, SectionLabel } from "@/components/entity/bio";
import { EntityTabs, TabLink } from "@/components/entity/entity-tabs";
import { InfoTip } from "@/components/info-tip";
import { PlayerCharts } from "@/components/player-charts";
import { PlayerHeadshot } from "@/components/player-headshot";
import { ShareLauncher } from "@/components/share-modal";
import { StampRow, VeteranMark } from "@/components/stamps";
import { TeamLogo, TeamName } from "@/components/team-logo";
import { playerContract } from "@/lib/cap";
import { meta, pickImage, picks, picksById, teamsByAbbr } from "@/lib/data";
import { draftLabel, isVeteran, scoreClass, signed } from "@/lib/format";
import { playerHref, teamHref } from "@/lib/routes";
import type { PickRow } from "@/lib/types";

type Params = { id: string };

export function generateStaticParams() {
  return picks.map((pick) => ({ id: String(pick.id) }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const pick = picksById.get(Number(id));
  if (!pick) return {};
  const title = pick.name;
  const description = pick.developing
    ? `${pick.name}, ${pick.year} pick ${pick.overall}, still a prospect at ${signed(pick.score)} versus the slot.`
    : `${pick.name}, ${pick.year} pick ${pick.overall}, ${pick.letter} and ${signed(pick.score)} Impact versus the slot. Redraft ${pick.redraft}.`;
  const image = pickImage(pick.id, pick.franchise);
  return {
    title,
    description,
    alternates: { canonical: playerHref(pick.id) },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function PlayerPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const pick = picksById.get(Number(id));
  if (!pick) notFound();
  const color = teamsByAbbr.get(pick.franchise)?.color ?? "#E11D48";
  const grade = pick.developing ? null : pick.letter;
  const retired = pick.stamps.includes("RETIRED") || pick.active === false;
  const veteran = isVeteran(pick.draftPlus) && !pick.stamps.includes("RETIRED");
  const contract = playerContract(pick.playerId);
  const current = pick.currentTeam ? teamsByAbbr.get(pick.currentTeam) : null;

  const share = (
    <ShareLauncher
      fileSlug={pick.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
      title={`${pick.name} draft grade`}
      summary={`${pick.name}, ${pick.year} #${pick.overall}, ${grade ?? "prospect"}, ${signed(pick.score)} versus the slot.`}
      path={playerHref(pick.id)}
      card={{ kind: "player", pick, color }}
    />
  );

  const left = (
    <div className="flex items-start gap-4">
      <PlayerHeadshot playerId={pick.playerId} name={pick.name} available={pick.hasHeadshot} color={color} className="h-24 w-24 sm:h-28 sm:w-28" />
      <div className="min-w-0">
        <h1 className="display text-3xl leading-tight font-bold sm:text-4xl">{pick.name}</h1>
        <p className="mt-1 text-sm text-[#94A3B8]">
          <span className="font-semibold text-[#F8FAFC]">{pick.pos}</span> · {pick.year} · R{pick.round} #{pick.overall} · {pick.team}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {current ? (
            <Link href={teamHref(current.abbr)} className="inline-flex items-center gap-1.5 rounded-full border border-[#262B36] bg-[#0B0D10]/60 py-0.5 pr-2.5 pl-1 text-xs font-semibold hover:border-[#38BDF8]/60">
              <TeamLogo abbr={current.abbr} className="h-5 w-6" />
              {current.name}
            </Link>
          ) : retired ? (
            <span className="display rounded-full border border-[#64748B]/60 px-2.5 py-0.5 text-xs font-bold tracking-[0.14em] text-[#94A3B8]">RETIRED</span>
          ) : pick.active ? (
            <span className="rounded-full border border-[#262B36] px-2.5 py-0.5 text-xs text-[#94A3B8]">Not on an NHL roster</span>
          ) : null}
          <ContractPill contract={contract} />
        </div>
      </div>
    </div>
  );

  const middle = (
    <div className="flex h-full flex-col gap-3">
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        {pick.stamps.length > 0 || veteran ? (
          <>
            <StampRow stamps={pick.stamps} />
            {veteran ? <VeteranMark /> : null}
          </>
        ) : (
          <span className="text-xs text-[#94A3B8]">No stamps yet</span>
        )}
      </div>
      <PillGrid>
        <QuickPill label="Career Impact" value={pick.qg.toFixed(1)} title="Impact puts skaters and goalies on one scale where 1.0 is about one average NHL game." />
        <QuickPill label="Career GP" value={String(pick.gpCareer)} />
        {pick.group === "G" ? (
          <QuickPill label="SV%" value={pick.savePct == null ? "—" : pick.savePct.toFixed(3).replace(/^0/, "")} />
        ) : (
          <QuickPill label="PPG" value={pick.ppg == null ? "—" : pick.ppg.toFixed(2)} />
        )}
      </PillGrid>
    </div>
  );

  const right = (
    <HeroGrade
      letter={grade}
      stats={[
        { label: "Draft Score", value: signed(pick.score), tone: pick.developing ? "text-zinc-300" : scoreClass(pick.score), title: "Impact minus what this draft slot usually produces by now" },
        { label: "Redraft", value: `#${pick.redraft}`, title: `Where he ranks in the ${pick.year} class by Impact alone` },
      ]}
      action={share}
    />
  );

  const panels: Record<string, ReactNode> = {
    overview: <Overview pick={pick} />,
    draft: <DraftPanel pick={pick} color={color} />,
    development: <ComingSoonPanel tab="development" subject={pick.name} />,
    asset: <ComingSoonPanel tab="asset" subject={pick.name} />,
    luck: <ComingSoonPanel tab="luck" subject={pick.name} />,
    matchups: <ComingSoonPanel tab="matchups" subject={pick.name} />,
  };

  return (
    <div>
      <BioCard left={left} middle={middle} right={right} />
      <EntityTabs tabs={PLAYER_TABS} panels={panels} />
    </div>
  );
}

function Overview({ pick }: { pick: PickRow }) {
  const facts: [string, ReactNode][] = [
    ["Position", pick.pos],
    ["Drafted", `${pick.year} · Round ${pick.round} · #${pick.overall}`],
    ["Drafted by", <TeamName key="by" abbr={pick.team} name={pick.teamName} logoClassName="h-5 w-7" />],
    ["Career stage", draftLabel(pick.draftPlus)],
  ];
  if (pick.teamName !== pick.franchiseName) facts.push(["Franchise today", pick.franchiseName]);
  if (pick.amateur) facts.push(["Drafted from", pick.amateur]);
  if (pick.country) facts.push(["Country", pick.country]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>Bio</SectionLabel>
        <dl className="mt-3 divide-y divide-[#262B36]">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-[#94A3B8]">{label}</dt>
              <dd className="text-right text-[#F8FAFC]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Draft Rater</SectionLabel>
          <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">Live</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Mini label="Impact" value={pick.qg.toFixed(1)} />
          <Mini label="Expected" value={pick.expected == null ? "—" : pick.expected.toFixed(1)} />
          <Mini label="Draft Score" value={signed(pick.score)} tone={pick.developing ? "text-zinc-300" : scoreClass(pick.score)} />
        </div>
        <p className="mt-4 text-sm text-[#94A3B8]">
          {pick.developing
            ? "Still a prospect, so there is no letter yet. The score shows whether he is ahead of or behind his slot."
            : `Graded ${pick.letter} against every pick since 2005. In a redraft of the ${pick.year} class he would go #${pick.redraft}.`}
        </p>
        <TabLink tab="draft" className="mt-4 text-sm font-semibold text-[#38BDF8] hover:underline">
          Open the full Draft breakdown →
        </TabLink>
      </div>
      <div className="lg:col-span-2">
        <ModulePreviews tabs={["development", "asset", "luck", "matchups"]} />
      </div>
    </div>
  );
}

function Mini({ label, value, tone = "text-[#F8FAFC]" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-3">
      <p className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</p>
      <p className={`display mt-1 text-2xl leading-none font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function DraftPanel({ pick, color }: { pick: PickRow; color: string }) {
  const others = pick.alsoDrafted.map((otherId) => picksById.get(otherId)).filter((other) => other != null);
  const moved = pick.overall - pick.redraft;
  const seriesCoversNow = (pick.seasons?.length ?? 0) >= pick.milestone;
  const partial =
    pick.active !== false && meta.seasonInProgress != null && pick.draftPlus === pick.milestone && pick.milestone > 0 && seriesCoversNow;
  const peers = picks
    .filter((other) => other.year === pick.year)
    .map((other) => ({ id: other.id, name: other.name, qg: other.qg, redraft: other.redraft, overall: other.overall }));

  return (
    <div>
      <p className="text-sm text-[#94A3B8]">
        <Link href="/draft-rater" className="hover:text-white">
          Draft Rater
        </Link>
        <span className="px-2">/</span>
        <Link href={teamHref(pick.franchise, "draft")} className="hover:text-white">
          <TeamName abbr={pick.franchise} name={pick.franchiseName} logoClassName="h-5 w-8" />
        </Link>
        <span className="px-2">/</span>
        <Link href={`/draft-rater/drafts/${pick.year}`} className="hover:text-white">
          {pick.year} draft
        </Link>
      </p>

      <dl className="mt-5 grid grid-cols-2 items-stretch gap-3 lg:grid-cols-3">
        <Stat label="Redraft" hero={`#${pick.redraft}`} sub={<Move moved={moved} />} />
        <Stat label="Career GP" hero={String(pick.gpCareer)} sub="NHL regular season" />
        {pick.group === "G" ? <GoalieStat pick={pick} /> : <PointsStat pick={pick} />}
        <Stat label="Expected Impact" hero={pick.expected == null ? "—" : pick.expected.toFixed(1)} />
        <Stat
          label="Impact"
          tip="Impact puts skaters and goalies on one scale where 1.0 is about one average NHL game. Skaters earn a base per game plus two-way box-score events and minutes trust; goalies earn 1.35 per start plus goals saved above average. Every NHL season since the draft counts. The current season is only the share the league has played."
          tipAlign="center"
          hero={pick.qg.toFixed(1)}
        />
        <Stat
          label="Score"
          tip={`The score is Impact versus what pick ${pick.overall} usually has by year ${pick.milestone}. Redraft #${pick.redraft} is where he ranks in the ${pick.year} class by Impact alone.`}
          tipAlign="end"
          hero={signed(pick.score)}
          heroClass={pick.developing ? "text-zinc-200" : scoreClass(pick.score)}
        />
      </dl>

      <PlayerCharts
        id={pick.id}
        name={pick.name}
        year={pick.year}
        overall={pick.overall}
        group={pick.group}
        milestone={pick.milestone}
        partial={partial}
        active={pick.active}
        progress={meta.seasonProgress}
        games={pick.gpCareer}
        expected={pick.expected}
        seasons={pick.seasons ?? []}
        expectedPath={pick.expectedPath ?? []}
        qg={pick.qg}
        color={color}
        peers={peers}
      />

      {pick.developing ? (
        <p className="mt-6 rounded-xl border border-sky-300/20 bg-sky-300/[0.04] px-4 py-3 text-sm text-zinc-300">
          {pick.group === "G"
            ? `Goalies stay a prospect through year ${meta.goalieWindow} until they reach ${meta.graduateQg} Impact.`
            : `Skaters stay a prospect through year ${meta.skaterWindow} until they reach ${meta.graduateQg} Impact.`}{" "}
          The score stays visible. There is no letter yet, and this pick is left out of the team average.
        </p>
      ) : null}

      {others.length > 0 ? (
        <div className="mt-6 text-sm text-zinc-400">
          Also drafted:{" "}
          {others.map((other, index) => (
            <span key={other.id}>
              {index > 0 ? ", " : ""}
              <Link href={playerHref(other.id, "draft")} className="underline hover:text-white">
                {other.year} #{other.overall} by <TeamName abbr={other.team} name={other.teamName} logoClassName="h-5 w-8" />
              </Link>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PointsStat({ pick }: { pick: PickRow }) {
  const empty = pick.ppg == null;
  const line =
    pick.goals == null || pick.points == null
      ? "—"
      : `${pick.goals.toLocaleString("en-US")} G · ${(pick.assists ?? 0).toLocaleString("en-US")} A · ${pick.points.toLocaleString("en-US")} PTS`;
  return <Stat label="PPG" hero={empty ? "—" : pick.ppg!.toFixed(2)} sub={line} />;
}

function GoalieStat({ pick }: { pick: PickRow }) {
  const save = pick.savePct == null ? "—" : pick.savePct.toFixed(3).replace(/^0/, "");
  const gaa = pick.gaa == null ? "—" : `${pick.gaa.toFixed(2)} GAA`;
  return <Stat label="SV%" hero={save} sub={gaa} />;
}

function Move({ moved }: { moved: number }) {
  if (moved === 0) {
    return <span className="font-semibold text-zinc-500">Even</span>;
  }
  const up = moved > 0;
  const tone = up ? "text-[#3ddc97]" : "text-[#ff4d4d]";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
      <Arrow up={up} />
      <span>{Math.abs(moved)}</span>
      <span className="sr-only">{up ? "spots higher than the original pick" : "spots lower than the original pick"}</span>
    </span>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
      {up ? <path d="M6 1.5 10.5 8.5H1.5Z" fill="currentColor" /> : <path d="M6 10.5 1.5 3.5h9Z" fill="currentColor" />}
    </svg>
  );
}

function Stat({
  label,
  tip,
  tipAlign = "start",
  hero,
  heroClass = "",
  sub = " ",
}: {
  label: string;
  tip?: string;
  tipAlign?: "start" | "center" | "end";
  hero: string;
  heroClass?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <dt className="flex min-h-8 items-start gap-2 text-[11px] leading-4 tracking-[0.16em] text-zinc-500 uppercase">
        <span>{label}</span>
        {tip ? <InfoTip text={tip} align={tipAlign} /> : null}
      </dt>
      <dd className="mt-3">
        <div className={`display text-4xl leading-none font-bold ${heroClass}`}>{hero}</div>
        <div className="mt-2 flex h-8 items-end text-xs leading-4 text-zinc-500">{sub}</div>
      </dd>
    </div>
  );
}
