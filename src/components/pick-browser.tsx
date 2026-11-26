"use client";

import { useMemo, useState } from "react";
import { PickTable } from "@/components/pick-table";
import { signed } from "@/lib/format";
import type { PickRow } from "@/lib/types";

export type GradeCaption = {
  label: string;
  letter: string | null;
  avg: number | null;
  n: number;
  developing: number;
};

export function PickBrowser({
  picks,
  years,
  teams,
  captions,
  idleCaption,
  year: controlledYear,
  onYearChange,
  team: controlledTeam,
  onTeamChange,
  showYear = true,
  showTeam = false,
  showOrigin = false,
  sortNonce = 0,
  sortOverride,
}: {
  picks: PickRow[];
  years?: number[];
  teams?: { id: string; label: string }[];
  captions?: Record<string, GradeCaption>;
  idleCaption?: GradeCaption | null;
  year?: string;
  onYearChange?: (year: string) => void;
  team?: string;
  onTeamChange?: (team: string) => void;
  showYear?: boolean;
  showTeam?: boolean;
  /** Adds Drafted From and Nationality columns. */
  showOrigin?: boolean;
  sortNonce?: number;
  sortOverride?: "year" | "overall" | "redraft" | "franchise" | "name" | "pos" | "gp" | "qg" | "expected" | "score" | "letter";
}) {
  const [internalYear, setInternalYear] = useState("all");
  const year = controlledYear ?? internalYear;
  const setYear = onYearChange ?? setInternalYear;
  const [internalTeam, setInternalTeam] = useState("all");
  const team = controlledTeam ?? internalTeam;
  const setTeam = onTeamChange ?? setInternalTeam;
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const shown = useMemo(
    () =>
      picks.filter((pick) => {
        if (year !== "all" && String(pick.year) !== year) return false;
        if (team !== "all" && pick.franchise !== team) return false;
        if (needle && !pick.name.toLowerCase().includes(needle)) return false;
        return true;
      }),
    [picks, year, team, needle],
  );

  const captionKey = year !== "all" ? year : team !== "all" ? team : "";
  const caption = captionKey ? captions?.[captionKey] : idleCaption;
  const developing = shown.filter((pick) => pick.developing).length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {years && years.length > 0 ? (
          <label className="text-xs text-zinc-400">
            Draft year
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="all">All years</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {teams && teams.length > 0 ? (
          <label className="text-xs text-zinc-400">
            Team
            <select
              className="mt-1 block max-w-full rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white"
              value={team}
              onChange={(event) => setTeam(event.target.value)}
            >
              <option value="all">All teams</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="min-w-48 flex-1 text-xs text-zinc-400">
          Player search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player"
            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
        </label>
      </div>
      {caption ? (
        <p className="mt-3 text-sm text-zinc-300">
          {caption.label}{" "}
          <span className="display text-xl font-bold">{caption.letter ?? "—"}</span>
          {caption.avg != null ? ` · ${signed(caption.avg)} vs the slot · ${caption.n} graded` : ""}
          {caption.developing > 0 ? ` · ${caption.developing} ${caption.developing === 1 ? "prospect" : "prospects"}` : ""}
        </p>
      ) : null}
      {developing > 0 ? <p className="mt-2 text-sm text-sky-200/80">{developing} still {developing === 1 ? "a prospect" : "prospects"}</p> : null}
      <div className="mt-3">
        <PickTable picks={shown} showYear={showYear} showTeam={showTeam} showOrigin={showOrigin} sortNonce={sortNonce} sortOverride={sortOverride} />
      </div>
    </div>
  );
}
