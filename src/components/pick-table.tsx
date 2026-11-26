"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CountryBadge } from "@/components/country-badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { countryName } from "@/lib/countries";
import { StampRow } from "@/components/stamps";
import { TeamLogo } from "@/components/team-logo";
import { letterRank, scoreClass, signed } from "@/lib/format";
import type { PickRow, YearPoint } from "@/lib/types";
import { playerHref, teamHref } from "@/lib/routes";

type SortKey = "year" | "overall" | "redraft" | "franchise" | "name" | "pos" | "from" | "nat" | "gp" | "qg" | "expected" | "score" | "letter";

const tips: Partial<Record<SortKey, string>> = {
  redraft: "Where this player ranks in their draft class based on total Impact produced.",
  franchise: "The franchise that made the pick.",
  from: "The junior, college, or European club and league the player was drafted from.",
  nat: "Country of birth.",
  gp: "Total career NHL regular-season games played. Impact counts every season since the draft.",
  qg: "Total Impact across every post-draft season. 1.0 is about one average NHL game: skaters earn a base per game plus two-way box-score events and minutes trust; goalies earn 1.35 per start plus goals saved above average. The current season is prorated.",
  expected: "Historical average Impact produced by this exact draft slot at the same career stage. The current season is prorated.",
  score: "Impact above or below expected for draft position.",
  letter: "Letter grade (A+ to D-) based on how this pick's Score ranks by percentile against all graded picks since 2005.",
};

const columns: { key: SortKey; label: string }[] = [
  { key: "year", label: "Year" },
  { key: "overall", label: "Pick" },
  { key: "redraft", label: "Redraft" },
  { key: "franchise", label: "Team" },
  { key: "name", label: "Player" },
  { key: "pos", label: "Position" },
  { key: "from", label: "Drafted From" },
  { key: "nat", label: "Nat." },
  { key: "gp", label: "GP" },
  { key: "qg", label: "Impact" },
  { key: "expected", label: "Expected" },
  { key: "score", label: "Score" },
  { key: "letter", label: "Grade" },
];

function gapClass(pick: PickRow): string {
  if (pick.developing) return "text-zinc-300";
  return scoreClass(pick.score);
}

function sortValue(pick: PickRow, key: SortKey): string | number | null {
  // Forfeited slots keep their place by year and pick number, and sort last on every stat.
  if (pick.forfeited && key !== "year" && key !== "overall") return null;
  if (key === "letter") return pick.developing ? null : letterRank(pick.letter);
  if (key === "gp") return pick.gpCareer;
  if (key === "franchise") return pick.franchise;
  if (key === "from") return pick.league ? `${pick.league} ${pick.amateur ?? ""}` : (pick.amateur ?? null);
  if (key === "nat") return pick.country ? countryName(pick.country) : null;
  if (key === "expected" || key === "score") return pick[key];
  return pick[key];
}

export function PickTable({
  picks,
  showYear = true,
  showTeam = false,
  showOrigin = false,
  sortNonce = 0,
  sortOverride,
}: {
  picks: PickRow[];
  showYear?: boolean;
  showTeam?: boolean;
  showOrigin?: boolean;
  sortNonce?: number;
  sortOverride?: SortKey;
}) {
  const visible = columns.filter(
    (column) =>
      (column.key !== "year" || showYear) &&
      (column.key !== "franchise" || showTeam) &&
      ((column.key !== "from" && column.key !== "nat") || showOrigin),
  );
  const [sortKey, setSortKey] = useState<SortKey>(showYear ? "year" : "overall");
  const [sortDesc, setSortDesc] = useState(false);

  useEffect(() => {
    if (!sortNonce || !sortOverride) return;
    setSortKey(sortOverride);
    setSortDesc(false);
  }, [sortNonce, sortOverride]);

  function toggle(key: SortKey) {
    if (sortKey === key) setSortDesc((value) => !value);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  const rows = useMemo(() => {
    const direction = sortDesc ? -1 : 1;
    return [...picks].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av == null && bv == null) return a.year - b.year || a.overall - b.overall;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        const compared = av.localeCompare(bv);
        if (compared !== 0) return compared * direction;
      } else if (av !== bv) {
        return (Number(av) - Number(bv)) * direction;
      }
      return a.year - b.year || a.overall - b.overall;
    });
  }, [picks, sortKey, sortDesc]);

  if (picks.length === 0) {
    return <p className="text-sm text-zinc-500">No picks in this view.</p>;
  }

  return (
    <>
      <div className="grid gap-2 md:hidden">
        {rows.map((pick) =>
          pick.forfeited ? (
            <div key={pick.id} className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-zinc-500">
              <p className="display text-sm font-bold tracking-[0.14em]">FORFEITED PICK</p>
              <p className="mt-1 text-xs">
                {showYear ? `${pick.year} · ` : ""}
                {showTeam ? `${pick.franchise} · ` : ""}R{pick.round} · #{pick.overall} · not graded
              </p>
            </div>
          ) : (
          <Link
            key={pick.id}
            href={playerHref(pick.id, "draft")}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-3">
                <PlayerHeadshot playerId={pick.playerId} name={pick.name} available={pick.hasHeadshot} className="h-12 w-12" />
                <span className="font-medium">{pick.name}</span>
              </span>
              <GradeCell pick={pick} />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {showYear ? `${pick.year} · ` : ""}
              {showTeam ? `${pick.franchise} · ` : ""}#{pick.overall} · redraft #{pick.redraft}{" "}
              {pick.overall === pick.redraft ? "—" : pick.overall > pick.redraft ? `▲ +${pick.overall - pick.redraft}` : `▼ ${pick.overall - pick.redraft}`} · {pick.pos} · {pick.gpCareer} GP
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {pick.qg.toFixed(1)} Impact · {pick.expected == null ? "—" : pick.expected.toFixed(1)} expected ·{" "}
              <span className={gapClass(pick)}>{signed(pick.score)}</span>
            </p>
            {showOrigin && (pick.amateur || pick.league || pick.country) ? (
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
                {pick.country ? <CountryBadge code={pick.country} name={countryName(pick.country)} /> : null}
                <span className="truncate">{[pick.amateur, pick.league].filter(Boolean).join(" · ")}</span>
              </p>
            ) : null}
          </Link>
          ),
        )}
      </div>
      <div className="hidden md:block">
        <table className="sheet w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              {visible.map((column) => (
                <SortHeader
                  key={column.key}
                  label={column.label}
                  tip={tips[column.key]}
                  active={sortKey === column.key}
                  desc={sortDesc}
                  onClick={() => toggle(column.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((pick) => (
              <tr key={pick.id} className={pick.forfeited ? "text-zinc-600" : undefined}>
                {visible.map((column) => (
                  <td key={column.key} className={`border-t border-white/10 py-2.5 pr-3 ${column.key === "score" ? `font-semibold ${gapClass(pick)}` : ""}`}>
                    <Cell pick={pick} column={column.key} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RedraftCell({ pick }: { pick: PickRow }) {
  const delta = pick.overall - pick.redraft;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-300">
      <span>#{pick.redraft}</span>
      {delta === 0 ? (
        <span className="text-zinc-600">—</span>
      ) : delta > 0 ? (
        <span className="text-xs font-semibold text-[#3ddc97]">▲ +{delta}</span>
      ) : (
        <span className="text-xs font-semibold text-[#ff4d4d]">▼ {delta}</span>
      )}
    </span>
  );
}

function Cell({ pick, column }: { pick: PickRow; column: SortKey }) {
  if (column === "year") return <span className="text-zinc-400">{pick.year}</span>;
  if (column === "overall") return <span className="text-zinc-400">R{pick.round} · #{pick.overall}</span>;
  if (pick.forfeited) {
    if (column === "name") return <span className="display text-xs font-bold tracking-[0.14em] text-zinc-500">FORFEITED PICK</span>;
    if (column === "franchise") {
      return (
        <span className="inline-flex items-center gap-2 opacity-50">
          <TeamLogo abbr={pick.franchise} name={pick.franchiseName} className="h-6 w-9" />
          <span>{pick.franchise}</span>
        </span>
      );
    }
    return <span className="text-zinc-600">—</span>;
  }
  if (column === "redraft") return <RedraftCell pick={pick} />;
  if (column === "franchise") {
    return (
      <Link href={teamHref(pick.franchise, "draft")} className="inline-flex items-center gap-2 text-zinc-200 hover:text-white">
        <TeamLogo abbr={pick.franchise} name={pick.franchiseName} className="h-6 w-9" />
        <span>{pick.franchise}</span>
      </Link>
    );
  }
  if (column === "name") {
    return (
      <Link href={playerHref(pick.id, "draft")} className="font-medium hover:text-white">
        {pick.name}
      </Link>
    );
  }
  if (column === "pos") return <span className="text-zinc-400">{pick.pos}</span>;
  if (column === "from") {
    return (
      <span className="block max-w-48 truncate text-zinc-300" title={[pick.amateur, pick.league].filter(Boolean).join(" · ")}>
        {pick.amateur ?? "—"}
        {pick.league && pick.league !== pick.amateur ? <span className="text-zinc-500"> · {pick.league}</span> : null}
      </span>
    );
  }
  if (column === "nat") return pick.country ? <CountryBadge code={pick.country} name={countryName(pick.country)} /> : <span className="text-zinc-600">—</span>;
  if (column === "gp") return <span className="text-zinc-300">{pick.gpCareer}</span>;
  if (column === "qg") return <span className="text-zinc-200">{pick.qg.toFixed(1)}</span>;
  if (column === "expected") return <span className="text-zinc-400">{pick.expected == null ? "—" : pick.expected.toFixed(1)}</span>;
  if (column === "score") return <>{signed(pick.score)}</>;
  return <GradeCell pick={pick} />;
}

function GradeCell({ pick }: { pick: PickRow }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="display text-lg font-bold">{pick.developing ? "—" : (pick.letter ?? "—")}</span>
      <StampRow stamps={pick.stamps} />
    </span>
  );
}

function SortHeader({
  label,
  tip,
  active,
  desc,
  onClick,
}: {
  label: string;
  tip?: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
}) {
  return (
    <th className="group relative py-2 pr-3 font-medium">
      <button type="button" className="hover:text-white" onClick={onClick}>
        <span className={tip ? "border-b border-dotted border-zinc-600" : undefined}>{label}</span>
        {active ? (desc ? " ↓" : " ↑") : ""}
      </button>
      {tip ? (
        <span className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-56 rounded-lg border border-white/10 bg-[#0B0D10] px-2.5 py-2 text-left text-xs font-normal tracking-normal text-zinc-200 normal-case shadow-lg group-hover:block">
          {tip}
        </span>
      ) : null}
    </th>
  );
}

export function Trend({
  points,
  selected,
  onSelect,
}: {
  points: YearPoint[];
  selected?: string;
  onSelect?: (year: number) => void;
}) {
  if (points.length === 0) return null;
  const width = 720;
  const height = 220;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const values = points.map((point) => point.avg);
  const rolling = rollingAverage(values, 3);
  const plotted = [...values, ...rolling.filter((value): value is number => value != null)];
  const min = Math.min(0, ...plotted);
  const max = Math.max(0, ...plotted);
  const span = max - min || 1;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yFor = (value: number) => padT + ((max - value) / span) * innerH;
  const zero = yFor(0);
  const slot = innerW / points.length;
  const barW = Math.min(18, slot - 4);
  const line = smoothPath(
    rolling.flatMap((value, index) =>
      value == null ? [] : [{ x: padL + (index + 0.5) * slot, y: yFor(value) }],
    ),
  );

  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Weighted pick score by draft year, with a 3-year rolling average">
        <line x1={padL} x2={width - padR} y1={zero} y2={zero} stroke="#3f3f46" />
        {points.map((point, index) => {
          const x = padL + (index + 0.5) * slot - barW / 2;
          const y = yFor(point.avg);
          const top = Math.min(y, zero);
          const h = Math.max(2, Math.abs(y - zero));
          const active = selected === String(point.year);
          return (
            <g
              key={point.year}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-pressed={onSelect ? active : undefined}
              aria-label={onSelect ? `Show the ${point.year} draft` : undefined}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={() => onSelect?.(point.year)}
              onKeyDown={(event) => {
                if (!onSelect) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(point.year);
                }
              }}
            >
              <rect x={padL + index * slot} y={padT} width={slot} height={innerH} fill="transparent" />
              <rect
                x={x}
                y={top}
                width={barW}
                height={h}
                rx="2"
                fill={point.avg >= 0 ? "#3ddc97" : "#ff4d4d"}
                stroke={active ? "#f4f4f5" : "transparent"}
                strokeWidth="1.5"
                opacity={selected && selected !== "all" && !active ? 0.4 : 1}
              />
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" fill={active ? "#f4f4f5" : "#71717a"} fontSize="10">
                {String(point.year).slice(2)}
              </text>
            </g>
          );
        })}
        {line ? <path d={line} fill="none" stroke="#f4f4f5" strokeWidth="2.25" strokeLinejoin="round" pointerEvents="none" /> : null}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-[#3ddc97]" />
          Draft class
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-zinc-100" />
          3-year rolling average
        </span>
      </figcaption>
    </figure>
  );
}

function rollingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, index) => {
    if (index < window - 1) return null;
    const slice = values.slice(index - window + 1, index + 1);
    return slice.reduce((total, value) => total + value, 0) / slice.length;
  });
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const c1x = current.x + (next.x - previous.x) / 6;
    const c1y = current.y + (next.y - previous.y) / 6;
    const c2x = next.x - (after.x - current.x) / 6;
    const c2y = next.y - (after.y - current.y) / 6;
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return path;
}
