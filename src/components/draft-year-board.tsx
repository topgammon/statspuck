"use client";

import Link from "next/link";
import { useState } from "react";
import { PickBrowser, type GradeCaption } from "@/components/pick-browser";
import { TeamName } from "@/components/team-logo";
import { scoreClass, signed } from "@/lib/format";
import type { ClassTeam, PickRow } from "@/lib/types";
import { playerHref } from "@/lib/routes";

export function DraftYearBoard({
  picks,
  teams,
  captions,
  idleCaption,
}: {
  picks: PickRow[];
  teams: ClassTeam[];
  captions: Record<string, GradeCaption>;
  idleCaption: GradeCaption;
}) {
  const [team, setTeam] = useState("all");
  const [sortNonce, setSortNonce] = useState(0);
  const redraft = picks.filter((pick) => !pick.forfeited).sort((a, b) => a.redraft - b.redraft || a.overall - b.overall)[0];
  const steals = picks.filter((pick) => !pick.developing && pick.overall >= 20 && (pick.score ?? 0) > 0);
  const steal = [...steals].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const busts = picks.filter((pick) => pick.overall <= 32 && pick.stamps.includes("BUST") && pick.score != null);
  const bust = [...busts].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const ranked = teams.filter((item) => item.n > 0 && item.avg != null).sort((a, b) => b.avg - a.avg);
  const best = ranked[0];
  const top = ranked.slice(0, 8);

  function choose(franchise: string) {
    setTeam((current) => (current === franchise ? "all" : franchise));
    document.getElementById("picks")?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  return (
    <div>
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PlayerCard
          title="#1 in redraft"
          pick={redraft}
          detail="Most Impact in this class. Click to sort the table."
          onOpen={() => {
            setSortNonce((value) => value + 1);
            document.getElementById("picks")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <PlayerCard title="Steal of the draft" pick={steal} empty="None yet" detail="Best score vs the slot from pick 20 on." />
        <PlayerCard title="Biggest bust" pick={bust} empty="None yet" detail="Worst score among graduated first-round busts." />
        {best ? (
          <button type="button" onClick={() => choose(best.franchise)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
            <p className="text-xs tracking-wide text-zinc-500 uppercase">Best team that year</p>
            <p className="mt-2 text-lg font-semibold">
              <TeamName abbr={best.franchise} name={best.franchiseName} />
            </p>
            <p className={`display mt-1 text-3xl font-bold ${scoreClass(best.avg)}`}>{signed(best.avg)}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {best.letter ?? "—"} · {best.n} graded. Click to filter the picks.
            </p>
          </button>
        ) : (
          <EmptyCard title="Best team that year" />
        )}
      </div>
      <TeamChart teams={top} selected={team} onSelect={choose} />
      <section id="picks" className="mt-10 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-2xl font-bold">Picks</h2>
          {team !== "all" ? (
            <button
              type="button"
              onClick={() => setTeam("all")}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.08]"
            >
              Showing {teams.find((item) => item.franchise === team)?.franchiseName ?? team}
              <span aria-hidden className="text-zinc-500">✕</span>
              <span className="sr-only">Clear team filter</span>
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <PickBrowser
            picks={picks}
            captions={captions}
            idleCaption={idleCaption}
            team={team}
            onTeamChange={setTeam}
            showYear={false}
            showTeam
            sortNonce={sortNonce}
            sortOverride="redraft"
          />
        </div>
      </section>
    </div>
  );
}

function PlayerCard({ title, pick, detail, empty, onOpen }: { title: string; pick?: PickRow; detail: string; empty?: string; onOpen?: () => void }) {
  if (!pick) return <EmptyCard title={title} note={empty} />;
  const body = (
    <>
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className="mt-2 text-lg font-semibold">{pick.name}</p>
      <p className={`display mt-1 text-3xl font-bold ${pick.developing ? "text-zinc-200" : scoreClass(pick.score)}`}>
        {title.startsWith("#1") ? `#${pick.redraft}` : signed(pick.score)}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        #{pick.overall} · {pick.franchise} · {detail}
      </p>
    </>
  );
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
        {body}
      </button>
    );
  }
  return (
    <Link href={playerHref(pick.id, "draft")} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      {body}
    </Link>
  );
}

function EmptyCard({ title, note = "None yet" }: { title: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-400">{note}</p>
    </div>
  );
}

function TeamChart({ teams, selected, onSelect }: { teams: ClassTeam[]; selected: string; onSelect: (franchise: string) => void }) {
  if (teams.length === 0) return null;
  const width = 720;
  const height = 36 + teams.length * 28;
  const padL = 118;
  const padR = 64;
  const innerW = width - padL - padR;
  const peak = Math.max(10, ...teams.map((team) => Math.abs(team.avg)));
  const xFor = (value: number) => padL + ((value + peak) / (peak * 2)) * innerW;
  const zero = xFor(0);

  return (
    <figure className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <figcaption className="text-sm font-semibold text-zinc-200">Top teams in this draft</figcaption>
      <p className="mt-1 text-sm text-zinc-500">Weighted score vs the slot. Click a bar to filter the picks below.</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label="Top teams by score versus slot">
        <line x1={zero} x2={zero} y1={8} y2={height - 8} stroke="#3f3f46" />
        {teams.map((team, index) => {
          const y = 16 + index * 28;
          const x = xFor(team.avg);
          const left = Math.min(x, zero);
          const active = selected === team.franchise;
          return (
            <g key={team.franchise} className="cursor-pointer" onClick={() => onSelect(team.franchise)}>
              <text x={padL - 10} y={y + 12} textAnchor="end" fill={active ? "#f4f4f5" : "#a1a1aa"} fontSize="12">
                {team.franchise}
              </text>
              <rect x={left} y={y} width={Math.max(2, Math.abs(x - zero))} height={16} rx="2" fill={team.avg >= 0 ? "#3ddc97" : "#ff4d4d"} opacity={selected !== "all" && !active ? 0.35 : 1} />
              <text x={team.avg >= 0 ? x + 6 : x - 6} y={y + 12} textAnchor={team.avg >= 0 ? "start" : "end"} fill="#d4d4d8" fontSize="11">
                {signed(team.avg)}
              </text>
              <title>{`${team.franchiseName}: ${signed(team.avg)}`}</title>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
