"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";
import { teamLogoFile } from "@/components/team-logo";
import { letterRank } from "@/lib/format";
import type { Board, BoardColumn, BoardRow } from "@/lib/leaderboards";
import { letterTone } from "@/lib/search";

// Sortable leaderboard table. Sticky header, ascending-first click sorting, hover tips
// on metric headers. Every row links to the entity's canonical profile.

function sortValue(value: number | string | null, column: BoardColumn): number | string | null {
  if (value == null) return null;
  if (column.format === "letter") return letterRank(String(value)) ?? null;
  return value;
}

function skillClass(value: number): string {
  if (value >= 90) return "text-[#F59E0B]";
  if (value >= 80) return "text-[#10B981]";
  if (value >= 65) return "text-[#38BDF8]";
  if (value >= 50) return "text-[#F8FAFC]";
  return "text-[#F97316]";
}

export function Cell({ value, column }: { value: number | string | null; column: BoardColumn }) {
  if (value == null || value === "") return <span className="text-[#94A3B8]/60">—</span>;
  switch (column.format) {
    case "letter":
      return <span className={`display inline-flex min-w-9 justify-center rounded-md border px-1.5 py-0.5 text-sm font-bold ${letterTone(String(value))}`}>{value}</span>;
    case "skill":
      return <span className={`display text-lg font-bold ${skillClass(Number(value))}`}>{value}</span>;
    case "signed": {
      const n = Number(value);
      return <span className={`font-semibold ${n > 0 ? "text-[#10B981]" : n < 0 ? "text-[#EF4444]" : ""}`}>{`${n > 0 ? "+" : ""}${n.toFixed(1)}`}</span>;
    }
    case "money":
      return <>${(Number(value) / 1_000_000).toFixed(2)}M</>;
    case "pct":
      return <>{Number(value).toFixed(1)}%</>;
    case "dec1":
      return <>{Number(value).toFixed(1)}</>;
    case "dec2":
      return <>{Number(value).toFixed(2)}</>;
    case "rank":
      return <>#{value}</>;
    case "svpct":
      return <>{Number(value).toFixed(3).replace(/^0/, "")}</>;
    case "toi": {
      const seconds = Number(value);
      return <>{`${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`}</>;
    }
    case "int":
      return <>{typeof value === "number" ? Math.round(value) : value}</>;
    default:
      return <>{value}</>;
  }
}

export function RowImage({ image }: { image: BoardRow["image"] }) {
  if (!image) return null;
  if (image.kind === "team") return <img src={`/logos/teams/${teamLogoFile(image.abbr)}.svg`} alt="" className="h-7 w-8 shrink-0 object-contain" loading="lazy" />;
  return (
    <img
      src={image.headshot && image.playerId ? `https://assets.nhle.com/mugs/nhl/latest/${image.playerId}.png` : "/player-silhouette.svg"}
      onError={(event) => {
        event.currentTarget.src = "/player-silhouette.svg";
      }}
      alt=""
      loading="lazy"
      className="h-8 w-8 shrink-0 rounded-full border border-[#262B36] bg-[#0B0D10] object-cover object-top"
    />
  );
}

export function LeaderboardTable({ board, limit, search = "" }: { board: Board; limit?: number; search?: string }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const ranked = useMemo(() => board.rows.map((row, index) => ({ row, rank: index + 1 })), [board.rows]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let out = needle ? ranked.filter(({ row }) => `${row.name} ${row.sub}`.toLowerCase().includes(needle)) : ranked;
    if (sort) {
      const column = sort.key === "rank" || sort.key === "name" ? null : board.columns.find((col) => col.key === sort.key);
      out = [...out].sort((a, b) => {
        let x: number | string | null;
        let y: number | string | null;
        if (sort.key === "rank") {
          x = a.rank;
          y = b.rank;
        } else if (sort.key === "name") {
          x = a.row.name;
          y = b.row.name;
        } else {
          x = sortValue(a.row.values[sort.key], column!);
          y = sortValue(b.row.values[sort.key], column!);
        }
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * sort.dir;
        return (x - y) * sort.dir;
      });
    }
    return limit ? out.slice(0, limit) : out;
  }, [ranked, sort, board.columns, limit, search]);

  // Ascending first, then descending.
  function onSort(key: string) {
    setSort((current) => (current?.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  const header = (key: string, label: string, tip?: string, left = false) => {
    const on = sort?.key === key;
    return (
      <th key={key} scope="col" className={`sticky top-0 z-10 bg-[#0B0D10] px-3 py-2.5 font-semibold ${left ? "text-left" : "text-right"}`}>
        <button
          type="button"
          onClick={() => onSort(key)}
          title={tip}
          className={`inline-flex items-center gap-1 text-[10px] tracking-[0.12em] whitespace-nowrap uppercase transition ${on ? "text-[#38BDF8]" : "text-[#94A3B8] hover:text-white"} ${
            tip ? "underline decoration-dotted underline-offset-4" : ""
          }`}
        >
          {label}
          {on ? <span aria-hidden>{sort!.dir === 1 ? "▲" : "▼"}</span> : null}
        </button>
      </th>
    );
  };

  return (
    <div className="max-h-[75vh] overflow-auto rounded-2xl border border-[#262B36] bg-[#14171F]">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr>
            {header("rank", "#", "Rank on this board", true)}
            {header("name", board.id === "teams" || board.id === "lottery" ? "Team" : board.id === "gms" ? "General manager" : "Player", undefined, true)}
            {board.columns.map((col) => header(col.key, col.label, col.tip, col.format === "text"))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#262B36]">
          {rows.map(({ row, rank }) => {
            const who = (
              <>
                <RowImage image={row.image} />
                <span className="min-w-0">
                  <span className={`block truncate font-semibold text-[#F8FAFC] ${row.href ? "group-hover:text-[#38BDF8]" : ""}`}>{row.name}</span>
                  <span className="block truncate text-xs text-[#94A3B8]">{row.sub}</span>
                </span>
              </>
            );
            return (
              <tr key={`${row.href ?? row.name}-${rank}`} className="group transition hover:bg-[#38BDF8]/[0.05]">
                <td className="w-10 px-3 py-2 text-left text-xs font-semibold text-[#94A3B8] tabular-nums">{rank}</td>
                <td className="px-3 py-2">
                  {row.href ? (
                    <Link href={row.href} className="flex min-w-0 items-center gap-2.5">
                      {who}
                    </Link>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2.5" title="Debuted before 2005-06: no StatsPuck profile">
                      {who}
                    </span>
                  )}
                </td>
                {board.columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2 whitespace-nowrap tabular-nums ${col.format === "text" ? "text-left text-[#F8FAFC]/85" : "text-right"}`}>
                    {row.href ? (
                      <Link href={row.href} tabIndex={-1} className="block">
                        <Cell value={row.values[col.key]} column={col} />
                      </Link>
                    ) : (
                      <Cell value={row.values[col.key]} column={col} />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={board.columns.length + 2} className="px-3 py-6 text-center text-sm text-[#94A3B8]">
                No matches.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
