import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/info-tip";
import { PlayerCharts } from "@/components/player-charts";
import { PlayerHeadshot } from "@/components/player-headshot";
import { ShareLauncher } from "@/components/share-modal";
import { StampRow, VeteranMark } from "@/components/stamps";
import { TeamName } from "@/components/team-logo";
import { meta, pickImage, picks, picksById, teamsByAbbr } from "@/lib/data";
import { draftLabel, isVeteran, scoreClass, signed } from "@/lib/format";
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
  const title = `${pick.name} draft score`;
  const description = pick.developing
    ? `${pick.name}, ${pick.year} pick ${pick.overall}, still a prospect at ${signed(pick.score)} versus the slot.`
    : `${pick.name}, ${pick.year} pick ${pick.overall}, ${pick.letter} and ${signed(pick.score)} quality games versus the slot. Redraft ${pick.redraft}.`;
  const image = pickImage(pick.id, pick.franchise);
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function PickPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const pick = picksById.get(Number(id));
  if (!pick) notFound();
  const others = pick.alsoDrafted
    .map((otherId) => picksById.get(otherId))
    .filter((other) => other != null);
  const color = teamsByAbbr.get(pick.franchise)?.color ?? "#E11D48";
  const retired = pick.stamps.includes("RETIRED");
  const veteran = isVeteran(pick.draftPlus) && !retired;
  const grade = pick.developing ? "—" : (pick.letter ?? "—");
  const moved = pick.overall - pick.redraft;
  const seriesCoversNow = (pick.seasons?.length ?? 0) >= pick.milestone;
  const partial =
    pick.active !== false &&
    meta.seasonInProgress != null &&
    pick.draftPlus === pick.milestone &&
    pick.milestone > 0 &&
    seriesCoversNow;
  const peers = picks
    .filter((other) => other.year === pick.year)
    .map((other) => ({
      id: other.id,
      name: other.name,
      qg: other.qg,
      redraft: other.redraft,
      overall: other.overall,
    }));

  return (
    <div>
      <p className="text-sm text-zinc-500">
        <Link href="/draft-rater" className="hover:text-white">
          Board
        </Link>
        <span className="px-2">/</span>
        <Link href={`/draft-rater/teams/${pick.franchise.toLowerCase()}`} className="hover:text-white">
          <TeamName abbr={pick.franchise} name={pick.franchiseName} logoClassName="h-5 w-8" />
        </Link>
      </p>

      <header className="mt-6 grid items-center gap-x-6 gap-y-5 sm:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)_9.5rem]">
        <PlayerHeadshot
          playerId={pick.playerId}
          name={pick.name}
          available={pick.hasHeadshot}
          color={color}
          className="h-40 w-40 sm:h-44 sm:w-44"
        />
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{pick.name}</h1>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm tracking-[0.14em] text-zinc-400 uppercase">
            <span>{pick.year}</span>
            <span>Round {pick.round}</span>
            <span className="display text-2xl font-bold tracking-normal text-white normal-case">#{pick.overall}</span>
            <span>{pick.pos}</span>
            <span>{retired && isVeteran(pick.draftPlus) ? `Draft +${pick.draftPlus}` : draftLabel(pick.draftPlus)}</span>
          </p>
          <p className="mt-3 text-zinc-400">
            Drafted by <TeamName abbr={pick.team} name={pick.teamName} logoClassName="h-5 w-8" />
            {pick.teamName !== pick.franchiseName ? (
              <>
                , now <TeamName abbr={pick.franchise} name={pick.franchiseName} logoClassName="h-5 w-8" />
              </>
            ) : null}
            .
          </p>
          {pick.stamps.length > 0 || veteran ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StampRow stamps={pick.stamps} />
              {veteran ? <VeteranMark /> : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 sm:col-span-2 lg:col-span-1 lg:h-full lg:flex-col lg:justify-center lg:px-4 lg:text-center">
          <p className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">Draft grade</p>
          <p className={`display text-6xl leading-none font-bold ${pick.developing ? "text-zinc-300" : scoreClass(pick.score)}`}>
            {grade}
          </p>
          <ShareLauncher
            fileSlug={pick.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
            title={`${pick.name} draft grade`}
            summary={`${pick.name}, ${pick.year} #${pick.overall}, ${grade}, ${signed(pick.score)} versus the slot.`}
            path={`/picks/${pick.id}`}
            card={{ kind: "player", pick, color }}
          />
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 items-stretch gap-3 lg:grid-cols-3">
        <Stat label="Redraft" hero={`#${pick.redraft}`} sub={<Move moved={moved} />} />
        <Stat label="Career GP" hero={String(pick.gpCareer)} sub="NHL regular season" />
        {pick.group === "G" ? <GoalieStat pick={pick} /> : <PointsStat pick={pick} />}
        <Stat label="Expected quality games" hero={pick.expected == null ? "—" : pick.expected.toFixed(1)} />
        <Stat
          label="Quality games"
          tip="Quality games start from regular-season games, then scale for ice time and production. Every NHL season since the draft counts. The current season is only the share the league has played."
          tipAlign="center"
          hero={pick.qg.toFixed(1)}
        />
        <Stat
          label="Score"
          tip={`The score is quality games versus what pick ${pick.overall} usually has by year ${pick.milestone}. Redraft #${pick.redraft} is where he ranks in the ${pick.year} class by quality games alone.`}
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

      <div className="mt-8">
        <button
          type="button"
          disabled
          className="rounded-full border border-dashed border-white/25 px-5 py-2 text-sm tracking-[0.14em] text-zinc-200 uppercase disabled:cursor-default disabled:opacity-100"
        >
          Development path
        </button>
        <p className="mt-2 text-xs tracking-wide text-zinc-500">(coming soon)</p>
      </div>

      {pick.developing ? (
        <p className="mt-6 rounded-xl border border-sky-300/20 bg-sky-300/[0.04] px-4 py-3 text-sm text-zinc-300">
          {pick.group === "G"
            ? `Goalies stay a prospect through year ${meta.goalieWindow} until they reach ${meta.graduateQg} quality games.`
            : `Skaters stay a prospect through year ${meta.skaterWindow} until they reach ${meta.graduateQg} quality games.`}{" "}
          The score stays visible. There is no letter yet, and this pick is left out of the team average.
        </p>
      ) : null}

      {others.length > 0 ? (
        <div className="mt-6 text-sm text-zinc-400">
          Also drafted:{" "}
          {others.map((other, index) => (
            <span key={other.id}>
              {index > 0 ? ", " : ""}
              <Link href={`/draft-rater/picks/${other.id}`} className="underline hover:text-white">
                {other.year} #{other.overall} by{" "}
                <TeamName abbr={other.team} name={other.teamName} logoClassName="h-5 w-8" />
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
  sub = "\u00a0",
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
