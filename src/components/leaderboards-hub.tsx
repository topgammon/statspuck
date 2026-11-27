"use client";

import { useEffect, useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { Board, BoardId } from "@/lib/leaderboards";

// /leaderboards: category pills on top, one sortable board below. The open board lives in
// the URL (?board=teams) so links from anywhere on the site can open a specific one.

export function LeaderboardsHub({ boards }: { boards: Board[] }) {
  const [active, setActive] = useState<BoardId>(boards[0].id);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(window.location.search).get("board");
      if (id && boards.some((board) => board.id === id)) setActive(id as BoardId);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [boards]);

  function pick(id: BoardId) {
    setActive(id);
    setQuery("");
    const url = new URL(window.location.href);
    if (id === boards[0].id) url.searchParams.delete("board");
    else url.searchParams.set("board", id);
    window.history.replaceState(window.history.state, "", url);
  }

  const board = boards.find((item) => item.id === active) ?? boards[0];

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Leaderboard categories" className="flex min-w-max gap-2">
          {boards.map((item) => {
            const on = item.id === board.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pick(item.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  on ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]" : "border-[#262B36] bg-[#14171F] text-[#94A3B8] hover:border-[#38BDF8]/60 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="display text-2xl font-bold">{board.label}</h2>
          <p className="mt-1 text-sm text-[#94A3B8]">{board.blurb}</p>
        </div>
        <label className="flex w-full items-center gap-2 rounded-xl border border-[#262B36] bg-[#14171F] px-3 sm:w-64">
          <span className="sr-only">Filter this board</span>
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Filter ${board.label.toLowerCase()}…`}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[#94A3B8]/80"
          />
        </label>
      </div>

      <div className="mt-4">
        <LeaderboardTable key={board.id} board={board} search={query} />
      </div>
      <p className="mt-3 text-xs text-[#94A3B8]">Click any column to sort (lowest first, click again for highest first). Click any row to open the full profile.</p>
    </div>
  );
}
