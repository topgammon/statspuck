"use client";

import { useMemo, useState } from "react";
import { TogglePill } from "@/components/toggle-pill";

// Season-by-season stats table on the player Stats tab. Sticky header, ascending-first
// click sorting, hover tips on the less obvious columns, and a Regular Season | Playoffs pill.

export type StatColumn = { key: string; label: string; tip?: string; digits?: number; signed?: boolean; text?: boolean };
export type StatRow = Record<string, number | string | null>;

export function StatsTable({ columns, rows, totals }: { columns: StatColumn[]; rows: StatRow[]; totals: StatRow | null }) {
  const [mode, setMode] = useState<"regular" | "playoffs">("regular");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "season", dir: 1 });

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * sort.dir;
      return (x - y) * sort.dir;
    });
    return out;
  }, [rows, sort]);

  function onSort(key: string) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Season by season</p>
        <TogglePill
          value={mode}
          options={[
            { id: "regular", label: "Regular Season" },
            { id: "playoffs", label: "Playoffs" },
          ]}
          onChange={setMode}
        />
      </div>
      {mode === "playoffs" ? (
        <div className="mt-4 rounded-xl border border-dashed border-[#262B36] bg-[#0B0D10]/60 px-4 py-8 text-center">
          <p className="display text-xl font-bold">Playoff splits are coming soon</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#94A3B8]">
            We are adding NHL playoff box scores (and Playoff Impact) to the nightly data pipeline. Regular-season numbers are complete back to 2005-06.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#94A3B8]">No NHL regular-season games on file yet.</p>
      ) : (
        <div className="mt-4 max-h-[34rem] overflow-auto rounded-xl border border-[#262B36]">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr>
                {columns.map((col) => {
                  const on = sort.key === col.key;
                  return (
                    <th key={col.key} scope="col" className={`sticky top-0 z-10 bg-[#0B0D10] px-2.5 py-2 font-semibold ${col.text ? "text-left" : "text-right"}`}>
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        title={col.tip}
                        className={`inline-flex items-center gap-1 text-[10px] tracking-[0.12em] uppercase transition ${on ? "text-[#38BDF8]" : "text-[#94A3B8] hover:text-white"} ${
                          col.tip ? "underline decoration-dotted underline-offset-4" : ""
                        }`}
                      >
                        {col.label}
                        {on ? <span aria-hidden>{sort.dir === 1 ? "▲" : "▼"}</span> : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262B36]">
              {sorted.map((row) => (
                <tr key={String(row.season)} className="hover:bg-white/[0.03]">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-2.5 py-1.5 whitespace-nowrap ${col.text ? "text-left font-semibold text-[#F8FAFC]" : "text-right tabular-nums text-[#F8FAFC]/90"}`}>
                      {format(row[col.key], col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot>
                <tr className="border-t-2 border-[#262B36] bg-[#0B0D10]/80">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-2.5 py-2 font-bold whitespace-nowrap ${col.text ? "text-left" : "text-right tabular-nums"}`}>
                      {col.key === "season" ? "Career" : format(totals[col.key], col)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}

function format(value: number | string | null | undefined, col: StatColumn): string {
  if (col.key === "season" && typeof value === "number") return `${value}-${String(value + 1).slice(2)}`;
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (col.key === "svPct") return value.toFixed(3).replace(/^0/, "");
  if (col.key === "toi") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const text = value.toFixed(col.digits ?? 0);
  return col.signed && value > 0 ? `+${text}` : text;
}
