"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PickBrowser, type GradeCaption } from "@/components/pick-browser";
import { TeamName } from "@/components/team-logo";
import { countryName } from "@/lib/countries";
import { scoreClass, signed } from "@/lib/format";
import type { ClassTeam, Feeder, PickGroup, PickRow } from "@/lib/types";
import { playerHref } from "@/lib/routes";

const FEEDERS: Feeder[] = ["OHL", "WHL", "QMJHL", "USHL/NCAA", "Sweden", "Finland", "Russia", "Other"];

const FEEDER_COLOR: Record<Feeder, string> = {
  OHL: "#E11D48",
  WHL: "#F97316",
  QMJHL: "#F59E0B",
  "USHL/NCAA": "#8B5CF6",
  Sweden: "#10B981",
  Finland: "#38BDF8",
  Russia: "#3B82F6",
  Other: "#64748B",
};

const FEEDER_TIP: Record<Feeder, string> = {
  OHL: "Ontario Hockey League",
  WHL: "Western Hockey League",
  QMJHL: "Quebec Maritimes Junior Hockey League",
  "USHL/NCAA": "USHL, US National Team Development Program, NCAA, US high school and other US junior leagues",
  Sweden: "SHL, Allsvenskan and Swedish junior leagues",
  Finland: "Liiga, Mestis and Finnish junior leagues",
  Russia: "KHL, VHL and the MHL junior league",
  Other: "Canadian Junior A, Czechia, Slovakia, Switzerland, Germany and everywhere else",
};

function countBy(values: string[]): [string, number][] {
  const tally = new Map<string, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function OriginFilters({
  picks,
  feeder,
  onFeeder,
  group,
  onGroup,
  nation,
  onNation,
  nations,
  shown,
}: {
  picks: PickRow[];
  feeder: Feeder | "all";
  onFeeder: (value: Feeder | "all") => void;
  group: "all" | PickGroup;
  onGroup: (value: "all" | PickGroup) => void;
  nation: string;
  onNation: (value: string) => void;
  nations: [string, number][];
  shown: number;
}) {
  const counts = new Map(countBy(picks.map((pick) => pick.feeder ?? "Other")));
  const total = picks.length || 1;
  const present = FEEDERS.filter((key) => counts.get(key));
  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition ${
      on ? "border-[#38BDF8] bg-[#38BDF8]/15 text-[#F8FAFC]" : "border-[#262B36] bg-[#0B0D10]/60 text-[#94A3B8] hover:text-white"
    }`;
  return (
    <div className="mt-4 rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Picks by feeder league</p>
        <p className="text-xs text-[#94A3B8]">Click a segment or pill to filter</p>
      </div>
      <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]" role="img" aria-label="Share of picks by feeder league">
        {present.map((key) => {
          const count = counts.get(key) ?? 0;
          const dim = feeder !== "all" && feeder !== key;
          return (
            <button
              key={key}
              type="button"
              title={`${key}: ${count} picks (${((count / total) * 100).toFixed(1)}%)`}
              onClick={() => onFeeder(feeder === key ? "all" : key)}
              className="h-full transition-opacity"
              style={{ width: `${(count / total) * 100}%`, backgroundColor: FEEDER_COLOR[key], opacity: dim ? 0.3 : 1 }}
            >
              <span className="sr-only">{`Show ${key} picks`}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onFeeder("all")} className={pill(feeder === "all")}>
          All Leagues
        </button>
        {present.map((key) => (
          <button key={key} type="button" title={FEEDER_TIP[key]} onClick={() => onFeeder(feeder === key ? "all" : key)} className={pill(feeder === key)}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: FEEDER_COLOR[key] }} />
            {key} <span className="font-normal opacity-70">{counts.get(key)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-zinc-400">
          Position
          <select
            className="mt-1 block rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white"
            value={group}
            onChange={(event) => onGroup(event.target.value as "all" | PickGroup)}
          >
            <option value="all">All positions</option>
            <option value="F">Forwards</option>
            <option value="D">Defense</option>
            <option value="G">Goalies</option>
          </select>
        </label>
        <label className="text-xs text-zinc-400">
          Nationality
          <select
            className="mt-1 block rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white"
            value={nation}
            onChange={(event) => onNation(event.target.value)}
          >
            <option value="all">All nations</option>
            {nations.map(([code, count]) => (
              <option key={code} value={code}>
                {countryName(code)} ({count})
              </option>
            ))}
          </select>
        </label>
        {feeder !== "all" || group !== "all" || nation !== "all" ? (
          <button
            type="button"
            onClick={() => {
              onFeeder("all");
              onGroup("all");
              onNation("all");
            }}
            className="mb-1 text-xs font-semibold text-[#38BDF8] hover:underline"
          >
            Clear filters · {shown} of {picks.length} picks
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
  const [feeder, setFeeder] = useState<Feeder | "all">("all");
  const [group, setGroup] = useState<"all" | PickGroup>("all");
  const [nation, setNation] = useState("all");
  // Links like /draft-rater/drafts/2015?sort=redraft (from a player's Redraft #) open the table sorted by Redraft.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sort") !== "redraft") return;
    const timer = window.setTimeout(() => {
      setSortNonce((value) => value + 1);
      document.getElementById("picks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, []);
  const real = picks.filter((pick) => !pick.forfeited);
  const nations = countBy(real.map((pick) => pick.country ?? "")).filter(([code]) => code);
  const filtering = feeder !== "all" || group !== "all" || nation !== "all";
  const shown = filtering
    ? real.filter(
        (pick) =>
          (feeder === "all" || (pick.feeder ?? "Other") === feeder) &&
          (group === "all" || pick.group === group) &&
          (nation === "all" || pick.country === nation),
      )
    : picks;
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
        <OriginFilters
          picks={real}
          feeder={feeder}
          onFeeder={setFeeder}
          group={group}
          onGroup={setGroup}
          nation={nation}
          onNation={setNation}
          nations={nations}
          shown={shown.filter((pick) => !pick.forfeited).length}
        />
        <div className="mt-3">
          <PickBrowser
            picks={shown}
            showOrigin
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
