"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { letterRank, scoreClass, signed } from "@/lib/format";
import { publicPath } from "@/lib/site";

export type ClassSummary = {
  year: number;
  letter: string | null;
  rating: number | null;
  avg: number | null;
  graded: number;
  developing: number;
  total: number;
  regulars: number;
};

type SortKey = "year" | "letter" | "avg" | "graded" | "developing" | "regulars";

const tips: Partial<Record<SortKey, string>> = {
  letter: "Where this draft class’s weighted score sits among the other years since 2005.",
  avg: "Weighted average of Score vs Slot. Earlier picks count more: the weight is 1 divided by the square root of the pick number.",
  graded: "Picks that have a letter. A player stays a prospect until 25 Impact.",
  developing: "Picks still inside the prospect window and under 25 Impact. They are left out of the class average.",
  regulars: "Picks with at least 100 Impact, a full NHL regular’s body of work.",
};

export function ClassBoard({ rows }: { rows: ClassSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDesc, setSortDesc] = useState(true);
  const mature = rows.filter((row) => row.total > 0 && row.graded / row.total >= 0.5 && row.avg != null);
  const deepest = [...mature].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const weakest = [...mature].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
  const mostRegulars = [...rows].sort((a, b) => b.regulars - a.regulars || b.year - a.year)[0];

  function toggle(key: SortKey) {
    if (sortKey === key) setSortDesc((value) => !value);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  const sorted = useMemo(() => {
    const direction = sortDesc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const value = (row: ClassSummary) => {
        if (sortKey === "letter") return letterRank(row.letter);
        return row[sortKey];
      };
      const av = value(a);
      const bv = value(b);
      if (av == null && bv == null) return b.year - a.year;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av !== bv) return (Number(av) - Number(bv)) * direction;
      return b.year - a.year;
    });
  }, [rows, sortKey, sortDesc]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "year", label: "Year" },
    { key: "letter", label: "Grade" },
    { key: "avg", label: "Score" },
    { key: "graded", label: "Graded" },
    { key: "developing", label: "Prospect" },
    { key: "regulars", label: "NHL Regulars" },
  ];

  return (
    <div>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Callout title="Deepest draft class" row={deepest} detail="Highest score vs the slot among classes at least half graded." />
        <Callout title="Weakest draft class" row={weakest} detail="Lowest score vs the slot among classes at least half graded." />
        <Callout title="Most NHL regulars" row={mostRegulars} detail={`${mostRegulars?.regulars ?? 0} picks with 100 or more Impact.`} count />
      </div>
      <ClassChart rows={rows} />
      <div className="mt-8 hidden md:block">
        <table className="sheet w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              {columns.map((column) => (
                <Header
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
            {sorted.map((row) => (
              <tr key={row.year}>
                <td className="border-t border-white/10 py-2.5 pr-3">
                  <Link href={`/draft-rater/drafts/${row.year}`} className="font-medium hover:text-white">
                    {row.year}
                  </Link>
                </td>
                <td className="border-t border-white/10 py-2.5 pr-3">
                  <span className={`display text-lg font-bold ${row.avg == null ? "text-zinc-500" : scoreClass(row.avg)}`}>
                    {row.letter ?? "—"}
                  </span>
                  {row.total > 0 && row.graded / row.total < 0.5 ? (
                    <span className="ml-2 rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] tracking-wide text-zinc-400">
                      EARLY SAMPLE
                    </span>
                  ) : null}
                </td>
                <td className={`border-t border-white/10 py-2.5 pr-3 font-semibold ${row.avg == null ? "text-zinc-500" : scoreClass(row.avg)}`}>
                  {row.avg == null || row.graded === 0 ? "—" : signed(row.avg)}
                </td>
                <td className="border-t border-white/10 py-2.5 pr-3 text-zinc-300">{row.graded}</td>
                <td className="border-t border-white/10 py-2.5 pr-3 text-zinc-400">{row.developing}</td>
                <td className="border-t border-white/10 py-2.5 text-zinc-300">{row.regulars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8 grid gap-2 md:hidden">
        {sorted.map((row) => (
          <Link key={row.year} href={`/draft-rater/drafts/${row.year}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{row.year}</span>
              <span className={`display text-lg font-bold ${row.avg == null ? "text-zinc-500" : scoreClass(row.avg)}`}>{row.letter ?? "—"}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {row.avg == null || row.graded === 0 ? "No graded picks yet" : `${signed(row.avg)} vs the slot`} · {row.graded} graded · {row.regulars} NHL regulars
            </p>
            {row.total > 0 && row.graded / row.total < 0.5 ? <p className="mt-1 text-[10px] tracking-wide text-zinc-500">EARLY SAMPLE</p> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Callout({ title, row, detail, count = false }: { title: string; row?: ClassSummary; detail: string; count?: boolean }) {
  if (!row) return null;
  return (
    <Link href={`/draft-rater/drafts/${row.year}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className="mt-2 text-lg font-semibold">{row.year}</p>
      <p className={`display mt-1 text-3xl font-bold ${count || row.avg == null ? "text-zinc-100" : scoreClass(row.avg)}`}>
        {count ? row.regulars : row.avg == null ? "—" : signed(row.avg)}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {row.letter ?? "—"} · {detail}
      </p>
    </Link>
  );
}

function ClassChart({ rows }: { rows: ClassSummary[] }) {
  const points = [...rows].sort((a, b) => a.year - b.year);
  const width = 760;
  const height = 280;
  const padL = 46;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const peak = Math.max(20, ...points.map((row) => Math.abs(row.avg ?? 0)));
  const yFor = (value: number) => padT + ((peak - value) / (peak * 2)) * innerH;
  const zero = yFor(0);
  const slot = innerW / Math.max(points.length, 1);
  const barW = Math.min(18, slot * 0.62);

  return (
    <figure className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <figcaption className="text-sm font-semibold text-zinc-200">Draft class strength</figcaption>
      <p className="mt-1 text-sm text-zinc-500">Score vs the slot for every class since 2005. Faded bars are early samples, under half the class graded.</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label="Score versus slot by draft year">
        <line x1={padL} x2={width - padR} y1={zero} y2={zero} stroke="#3f3f46" />
        {points.map((row, index) => {
          const value = row.avg ?? 0;
          const early = row.total > 0 && row.graded / row.total < 0.5;
          const x = padL + (index + 0.5) * slot - barW / 2;
          const y = yFor(value);
          const top = Math.min(y, zero);
          const h = Math.max(2, Math.abs(y - zero));
          return (
            <a key={row.year} href={(`/draft-rater/drafts/${row.year}`)}>
              <rect x={x} y={top} width={barW} height={h} rx="2" fill={value >= 0 ? "#3ddc97" : "#ff4d4d"} opacity={early ? 0.35 : 1} />
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" fill="#71717a" fontSize="10">
                {String(row.year).slice(2)}
              </text>
              <title>{`${row.year}: ${row.graded === 0 || row.avg == null ? "no graded picks" : `${row.avg > 0 ? "+" : ""}${row.avg.toFixed(1)} vs the slot`}`}</title>
            </a>
          );
        })}
      </svg>
    </figure>
  );
}

function Header({
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
