"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { TeamLogo } from "@/components/team-logo";
import { DEV_SCORE_TIP, letterRank, scoreClass, signed } from "@/lib/format";
import { teamHref } from "@/lib/routes";
import { letterTone } from "@/lib/search";

export type DevLeaderRow = { abbr: string; name: string; rank: number; letter: string | null; avg: number; n: number; draftLetter: string };

type Key = "rank" | "name" | "letter" | "avg" | "n" | "draftLetter";

const COLUMNS: { key: Key; label: string; tip?: string }[] = [
  { key: "rank", label: "#" },
  { key: "name", label: "Team" },
  { key: "letter", label: "Dev Grade" },
  { key: "avg", label: "Dev Score", tip: DEV_SCORE_TIP },
  { key: "n", label: "Picks", tip: "Picks with six full NHL seasons since their draft." },
  { key: "draftLetter", label: "Draft Grade" },
];

/** Sortable team Development leaderboard. Clicking a header sorts ascending first. */
export function DevLeaderboard({ rows, highlight }: { rows: DevLeaderRow[]; highlight?: string }) {
  const [key, setKey] = useState<Key>("rank");
  const [desc, setDesc] = useState(false);
  const sorted = useMemo(() => {
    const value = (row: DevLeaderRow): number | string => {
      if (key === "letter") return letterRank(row.letter) ?? 99;
      if (key === "draftLetter") return letterRank(row.draftLetter) ?? 99;
      return row[key];
    };
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number);
      return (desc ? -cmp : cmp) || a.rank - b.rank;
    });
  }, [rows, key, desc]);

  return (
    <div className="max-h-[32rem] overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="text-[11px] tracking-wide text-[#94A3B8] uppercase">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className="sticky top-0 z-10 bg-[#14171F] py-2 pr-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    className="hover:text-white"
                    onClick={() => {
                      if (key === column.key) setDesc((value) => !value);
                      else {
                        setKey(column.key);
                        setDesc(false);
                      }
                    }}
                  >
                    {column.label}
                    {key === column.key ? (desc ? " ↓" : " ↑") : ""}
                  </button>
                  {column.tip ? <InfoTip text={column.tip} /> : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.abbr} className={row.abbr === highlight ? "bg-[#38BDF8]/10" : undefined}>
              <td className="border-t border-[#262B36] py-2 pr-3 text-[#94A3B8]">{row.rank}</td>
              <td className="border-t border-[#262B36] py-2 pr-3">
                <Link href={teamHref(row.abbr, "development")} className="inline-flex items-center gap-2 font-medium hover:text-white">
                  <TeamLogo abbr={row.abbr} className="h-6 w-8" />
                  {row.name}
                </Link>
              </td>
              <td className="border-t border-[#262B36] py-2 pr-3">
                <span className={`display rounded-md border px-1.5 py-0.5 text-sm font-bold ${letterTone(row.letter)}`}>{row.letter ?? "—"}</span>
              </td>
              <td className={`border-t border-[#262B36] py-2 pr-3 font-semibold ${scoreClass(row.avg)}`}>{signed(row.avg)}</td>
              <td className="border-t border-[#262B36] py-2 pr-3 text-[#94A3B8]">{row.n}</td>
              <td className="border-t border-[#262B36] py-2 pr-3 text-[#94A3B8]">{row.draftLetter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
