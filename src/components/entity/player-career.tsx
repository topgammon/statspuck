import Link from "next/link";
import type { ReactNode } from "react";
import { SectionLabel } from "@/components/entity/bio";
import { InfoTip } from "@/components/info-tip";
import { PlayerCharts } from "@/components/player-charts";
import { TeamName } from "@/components/team-logo";
import { meta, picks, picksById } from "@/lib/data";
import { scoreClass, seasonLabel, signed } from "@/lib/format";
import { playerHref, teamHref } from "@/lib/routes";
import type { PickRow } from "@/lib/types";

// Career tab pieces for drafted players: the Draft Rater breakdown with its trajectory
// charts, plus the NHL debut box and the milestones placeholder shared with undrafted players.

export function DraftPanel({ pick, color }: { pick: PickRow; color: string }) {
  const others = pick.alsoDrafted.map((otherId) => picksById.get(otherId)).filter((other) => other != null);
  const moved = pick.overall - pick.redraft;
  const seriesCoversNow = (pick.seasons?.length ?? 0) >= pick.milestone;
  const partial = pick.active !== false && meta.seasonInProgress != null && pick.draftPlus === pick.milestone && pick.milestone > 0 && seriesCoversNow;
  const peers = picks
    .filter((other) => other.year === pick.year && !other.forfeited)
    .map((other) => ({ id: other.id, name: other.name, qg: other.qg, redraft: other.redraft, overall: other.overall }));

  return (
    <div>
      <p className="text-sm text-[#94A3B8]">
        <Link href="/draft-rater" className="hover:text-white">
          Draft Rater
        </Link>
        <span className="px-2">/</span>
        <Link href={teamHref(pick.franchise, "draft-dev")} className="hover:text-white">
          <TeamName abbr={pick.franchise} name={pick.franchiseName} logoClassName="h-5 w-8" />
        </Link>
        <span className="px-2">/</span>
        <Link href={`/draft-rater/drafts/${pick.year}`} className="hover:text-white">
          {pick.year} draft
        </Link>
      </p>

      <div className="mt-5 grid grid-cols-2 items-stretch gap-3 lg:grid-cols-3">
        <Stat label="Redraft" hero={`#${pick.redraft}`} sub={<Move moved={moved} />} href={`/draft-rater/drafts/${pick.year}?sort=redraft`} />
        <Stat label="Draft slot" hero={`#${pick.overall}`} sub={`Round ${pick.round} · ${pick.teamName}`} />
        <Stat label="Expected Impact" hero={pick.expected == null ? "—" : pick.expected.toFixed(1)} sub={`What pick #${pick.overall} usually has by now`} />
        <Stat
          label="Impact"
          tip="Impact puts skaters and goalies on one scale where 1.0 is about one average NHL game. Every NHL season since the draft counts. The current season is only the share the league has played."
          tipAlign="center"
          hero={pick.qg.toFixed(1)}
        />
        <Stat
          label="Draft Score"
          tip={`The score is Impact versus what pick ${pick.overall} usually has by year ${pick.milestone}. Redraft #${pick.redraft} is where he ranks in the ${pick.year} class by Impact alone.`}
          tipAlign="end"
          hero={signed(pick.score)}
          heroClass={pick.developing ? "text-zinc-200" : scoreClass(pick.score)}
        />
        <Stat label="Draft grade" hero={pick.developing ? "—" : (pick.letter ?? "—")} sub={pick.developing ? "Still a prospect" : "Against every pick since 2005"} />
      </div>

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
              <Link href={playerHref(other.id, "career")} className="underline hover:text-white">
                {other.year} #{other.overall} by <TeamName abbr={other.team} name={other.teamName} logoClassName="h-5 w-8" />
              </Link>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** NHL debut box plus the franchise records and milestones placeholder. */
export function DebutAndMilestones({ debut, team, gp }: { debut: number | null; team: { abbr: string; name: string } | null; gp: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>NHL debut</SectionLabel>
        {debut != null ? (
          <>
            <p className="display mt-2 text-3xl font-bold">{seasonLabel(debut)}</p>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {team ? (
                <>
                  First NHL games with the{" "}
                  <Link href={teamHref(team.abbr)} className="font-semibold text-[#F8FAFC] hover:underline">
                    {team.name}
                  </Link>
                  .{" "}
                </>
              ) : null}
              {gp.toLocaleString("en-US")} regular-season games since.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#94A3B8]">No NHL games yet.</p>
        )}
      </div>
      <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-5">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Franchise records · Milestones · Trophies</SectionLabel>
          <span className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">Soon</span>
        </div>
        <p className="mt-2 text-sm text-[#94A3B8]">Where he ranks in his franchise&apos;s record book, career milestones (100th goal, 500th game) and NHL awards. Coming with the awards data feed.</p>
      </div>
    </div>
  );
}

function Move({ moved }: { moved: number }) {
  if (moved === 0) return <span className="font-semibold text-zinc-500">Even</span>;
  const up = moved > 0;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${up ? "text-[#10B981]" : "text-[#EF4444]"}`}>
      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
        {up ? <path d="M6 1.5 10.5 8.5H1.5Z" fill="currentColor" /> : <path d="M6 10.5 1.5 3.5h9Z" fill="currentColor" />}
      </svg>
      <span>{Math.abs(moved)}</span>
      <span className="sr-only">{up ? "spots higher than the original pick" : "spots lower than the original pick"}</span>
    </span>
  );
}

function Stat({
  label,
  tip,
  tipAlign = "start",
  hero,
  heroClass = "",
  sub = " ",
  href,
}: {
  label: string;
  tip?: string;
  tipAlign?: "start" | "center" | "end";
  hero: string;
  heroClass?: string;
  sub?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="flex min-h-8 items-start gap-2 text-[11px] leading-4 tracking-[0.16em] text-zinc-500 uppercase">
        <span>{label}</span>
        {tip ? <InfoTip text={tip} align={tipAlign} /> : null}
      </p>
      <div className="mt-3">
        <div className={`display text-4xl leading-none font-bold ${heroClass}`}>{hero}</div>
        <div className="mt-2 flex h-8 items-end text-xs leading-4 text-zinc-500">{sub}</div>
      </div>
    </>
  );
  const base = "flex h-full min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4";
  return href ? (
    <Link href={href} className={`${base} transition hover:border-[#38BDF8]/60`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
