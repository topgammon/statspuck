"use client";

import { useMemo, useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { Board } from "@/lib/leaderboards";

// UFA & RFA Tracker: summer pills, then All | UFA | RFA | Forwards | Defense | Goalies.

const FILTERS = [
  { id: "all", label: "All" },
  { id: "ufa", label: "UFA" },
  { id: "rfa", label: "RFA" },
  { id: "pos:F", label: "Forwards" },
  { id: "pos:D", label: "Defense" },
  { id: "pos:G", label: "Goalies" },
];

export function UfaTracker({ board, summers }: { board: Board; summers: number[] }) {
  const [summer, setSummer] = useState(summers[0]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const shown = useMemo<Board>(
    () => ({
      ...board,
      rows: board.rows.filter((row) => row.tags?.includes(`y${summer}`) && (filter === "all" || row.tags?.includes(filter))),
    }),
    [board, summer, filter],
  );

  const pill = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]" : "border-[#262B36] bg-[#14171F] text-[#94A3B8] hover:border-[#38BDF8]/60 hover:text-white"}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {summers.map((year) => (
          <button key={year} type="button" onClick={() => setSummer(year)} className={pill(summer === year)}>
            Summer {year}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={pill(filter === item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex w-full items-center gap-2 rounded-xl border border-[#262B36] bg-[#14171F] px-3 sm:w-64">
          <span className="sr-only">Filter players</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter players or teams…" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[#94A3B8]/80" />
        </label>
      </div>
      <p className="mt-3 text-xs text-[#94A3B8]">{shown.rows.length} players</p>
      <div className="mt-2">
        <LeaderboardTable board={shown} search={query} />
      </div>
      <p className="mt-3 text-xs text-[#94A3B8]">
        Projections match each player with the 5 closest comparable contracts (today&apos;s deals plus notable signings since 2005) by position, age at signing, Impact pace and Skill, then apply their average share of the cap at signing to today&apos;s cap. Click a player for the full comparables on his Asset Value tab.
      </p>
    </div>
  );
}
