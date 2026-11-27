"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { TogglePill } from "@/components/toggle-pill";
import type { Board, BoardColumn, BoardId, BoardRow } from "@/lib/leaderboards";
import { playerHref } from "@/lib/routes";
import type { SeasonFile } from "@/lib/season-leaders";

// /leaderboards: category pills on top, one sortable board below. The open board lives in
// the URL (?board=teams) so links from anywhere on the site can open a specific one.

const SEASONS_ID = "seasons";

/** Boards grouped so every option fits without sideways scrolling. */
const TAB_GROUPS: { label: string; ids: string[] }[] = [
  { label: "Players", ids: ["players", "contracts", "steals", "milestones", SEASONS_ID] },
  { label: "Teams & GMs", ids: ["teams", "gms", "lottery"] },
  { label: "Awards", ids: ["trophies"] },
];

export function LeaderboardsHub({ boards, seasons }: { boards: Board[]; seasons: number[] }) {
  const tabs = [...boards.map((board) => ({ id: board.id as string, label: board.label })), { id: SEASONS_ID, label: "Season Leaders" }];
  // ?board=teams or ?view=teams (the nav's Teams / Players links). Read live, so a nav click
  // while already on this page switches the board too.
  const params = useSearchParams();
  const fromUrl = params.get("board") ?? params.get("view");
  const urlBoard = fromUrl && tabs.some((tab) => tab.id === fromUrl) ? fromUrl : null;
  // A tab click wins until the address changes from somewhere else (e.g. the nav's Teams link).
  const [picked, setPicked] = useState<{ id: string; from: string | null } | null>(null);
  const active = picked && (picked.from === urlBoard || picked.id === urlBoard) ? picked.id : (urlBoard ?? boards[0].id);
  const [query, setQuery] = useState("");

  function pick(id: string) {
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    if (id === boards[0].id) url.searchParams.delete("board");
    else url.searchParams.set("board", id);
    setPicked({ id, from: urlBoard });
    window.history.replaceState(window.history.state, "", url);
  }

  const board = boards.find((item) => item.id === active);

  return (
    <div>
      <div role="tablist" aria-label="Leaderboard categories" className="grid gap-3 rounded-2xl border border-[#262B36] bg-[#14171F] p-3 sm:grid-cols-[repeat(3,auto)] sm:justify-start sm:gap-x-8">
        {TAB_GROUPS.map((group) => {
          const items = group.ids.map((id) => tabs.find((tab) => tab.id === id)).filter((tab): tab is { id: string; label: string } => Boolean(tab));
          if (!items.length) return null;
          return (
            <div key={group.label}>
              <p className="mb-1.5 text-[10px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const on = item.id === active;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => pick(item.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                        on ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]" : "border-[#262B36] bg-[#0B0D10]/60 text-[#94A3B8] hover:border-[#38BDF8]/60 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {board ? <BoardView key={board.id} board={board} query={query} setQuery={setQuery} /> : <SeasonLeaders seasons={seasons} query={query} setQuery={setQuery} />}
      <p className="mt-3 text-xs text-[#94A3B8]">Click any column to sort (lowest first, click again for highest first). Click any row to open the full profile.</p>
    </div>
  );
}

/** Applies the board's switches (ELC, active GMs, Skaters | Goalies) before the table sees the rows. */
function BoardView({ board, query, setQuery, extra }: { board: Board; query: string; setQuery: (value: string) => void; extra?: React.ReactNode }) {
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => Object.fromEntries((board.toggles ?? []).map((toggle) => [toggle.tag, toggle.on])));
  const [segment, setSegment] = useState<string>(board.segments?.[0]?.tag ?? "");
  const [selected, setSelected] = useState<Record<string, string>>({});

  const shown = useMemo(() => {
    let rows: BoardRow[] = board.rows;
    if (segment) rows = rows.filter((row) => row.tags?.includes(segment));
    for (const select of board.selects ?? []) {
      const value = selected[select.id];
      if (value && (!select.segment || select.segment === segment)) rows = rows.filter((row) => row.tags?.includes(value));
    }
    for (const toggle of board.toggles ?? []) {
      const on = toggles[toggle.tag];
      if (toggle.onlyWhenOn && on) rows = rows.filter((row) => row.tags?.includes(toggle.tag));
      if (!toggle.onlyWhenOn && !on) rows = rows.filter((row) => !row.tags?.includes(toggle.tag));
    }
    return { ...board, rows };
  }, [board, segment, toggles, selected]);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="display text-2xl font-bold">{board.label}</h2>
          <p className="mt-1 text-sm text-[#94A3B8]">{board.blurb}</p>
        </div>
        <Filter label={board.label} query={query} setQuery={setQuery} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {extra}
        {board.segments ? (
          <TogglePill value={segment} options={board.segments.map((item) => ({ id: item.tag, label: item.label }))} onChange={setSegment} label="Position group" />
        ) : null}
        {(board.selects ?? [])
          .filter((select) => !select.segment || select.segment === segment)
          .map((select) => (
            <label key={select.id} className="inline-flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
              {select.label}
              <select
                value={selected[select.id] ?? ""}
                onChange={(event) => setSelected((current) => ({ ...current, [select.id]: event.target.value }))}
                className="rounded-lg border border-[#262B36] bg-[#14171F] px-2 py-1.5 text-sm text-[#F8FAFC] outline-none focus:border-[#38BDF8]"
              >
                <option value="">All</option>
                {select.options.map((option) => (
                  <option key={option.tag} value={option.tag}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        {(board.toggles ?? []).map((toggle) => (
          <Switch key={toggle.tag} label={toggle.label} on={toggles[toggle.tag]} onChange={(on) => setToggles((current) => ({ ...current, [toggle.tag]: on }))} />
        ))}
        <span className="text-xs text-[#94A3B8]">{shown.rows.length} shown</span>
      </div>
      <div className="mt-4">
        <LeaderboardTable board={shown} search={query} />
      </div>
    </>
  );
}

function Filter({ label, query, setQuery }: { label: string; query: string; setQuery: (value: string) => void }) {
  return (
    <label className="flex w-full items-center gap-2 rounded-xl border border-[#262B36] bg-[#14171F] px-3 sm:w-64">
      <span className="sr-only">Filter this board</span>
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" strokeLinecap="round" />
      </svg>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Filter ${label.toLowerCase()}…`}
        className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[#94A3B8]/80"
      />
    </label>
  );
}

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        on ? "border-[#38BDF8]/60 bg-[#38BDF8]/10 text-[#F8FAFC]" : "border-[#262B36] text-[#94A3B8] hover:text-white"
      }`}
    >
      <span className={`relative h-4 w-7 rounded-full transition ${on ? "bg-[#38BDF8]" : "bg-[#262B36]"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

// ---- Season Leaders ----------------------------------------------------------------------

const SKATER_COLUMNS: BoardColumn[] = [
  { key: "pts", label: "PTS", format: "int", desc: true },
  { key: "g", label: "G", format: "int", desc: true },
  { key: "a", label: "A", format: "int", desc: true },
  { key: "ppg", label: "PPG", format: "dec2", desc: true, tip: "Points per game" },
  { key: "gp", label: "GP", format: "int", desc: true },
  { key: "pm", label: "+/-", format: "int", desc: true, tip: "Goal differential while he is on the ice" },
  { key: "sog", label: "SOG", format: "int", desc: true, tip: "Shots on goal" },
  { key: "shPct", label: "S%", format: "dec1", desc: true, tip: "Goals per shot on goal" },
  { key: "foPct", label: "FO%", format: "dec1", desc: true, tip: "Faceoff win %, shown with 50+ draws" },
  { key: "toi", label: "TOI/GP", format: "toi", desc: true, tip: "Average ice time per game" },
];

const GOALIE_COLUMNS: BoardColumn[] = [
  { key: "svPct", label: "SV%", format: "svpct", desc: true, tip: "Save percentage" },
  { key: "gaa", label: "GAA", format: "dec2", tip: "Goals against per 60 minutes (lower is better)" },
  { key: "gp", label: "GP", format: "int", desc: true },
  { key: "gs", label: "GS", format: "int", desc: true, tip: "Games started" },
  { key: "sa", label: "SA", format: "int", desc: true, tip: "Shots against" },
  { key: "sv", label: "Saves", format: "int", desc: true },
  { key: "so", label: "SO", format: "int", desc: true, tip: "Shutouts" },
];

function seasonLabel(season: number): string {
  return `${season}-${String(season + 1).slice(2)}`;
}

function SeasonLeaders({ seasons, query, setQuery }: { seasons: number[]; query: string; setQuery: (value: string) => void }) {
  const [season, setSeason] = useState(seasons[0]);
  const [data, setData] = useState<Record<number, SeasonFile>>({});
  const [failed, setFailed] = useState(false);
  const file = data[season];

  useEffect(() => {
    if (data[season]) return;
    let alive = true;
    fetch(`/season-leaders/${season}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<SeasonFile>;
      })
      .then((json) => {
        if (alive) setData((current) => ({ ...current, [season]: json }));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [season, data]);

  const board = useMemo<Board | null>(() => {
    if (!file) return null;
    const maxGp = Math.max(1, ...file.skaters.map((row) => row[5]));
    const maxGoalieGp = Math.max(1, ...file.goalies.map((row) => row[4]));
    const skaterRows: BoardRow[] = file.skaters.map(([routeId, playerId, name, pos, headshot, gp, g, a, pts, pm, sog, foPct, toi]) => ({
      href: routeId ? playerHref(routeId, "stats") : null,
      tags: ["skater", ...(gp >= maxGp * 0.25 ? ["qualified"] : [])],
      name,
      sub: `${pos} · ${gp} GP`,
      image: { kind: "player", playerId, headshot: Boolean(headshot) },
      values: { pts, g, a, ppg: gp ? Math.round((pts / gp) * 100) / 100 : null, gp, pm, sog, shPct: sog ? Math.round((g / sog) * 1000) / 10 : null, foPct, toi },
    }));
    const goalieRows: BoardRow[] = file.goalies.map(([routeId, playerId, name, headshot, gp, gs, svPct, gaa, sa, sv, so]) => ({
      href: routeId ? playerHref(routeId, "stats") : null,
      tags: ["goalie", ...(gp >= maxGoalieGp * 0.25 ? ["qualified"] : [])],
      name,
      sub: `G · ${gp} GP`,
      image: { kind: "player", playerId, headshot: Boolean(headshot) },
      values: { svPct, gaa, gp, gs, sa, sv, so },
    }));
    return {
      id: "seasons" as BoardId,
      label: "Season Leaders",
      blurb: `NHL regular-season leaders for ${seasonLabel(season)}${file.inProgress ? " (season in progress)" : ""}. Skaters rank by points, goalies by save percentage.`,
      rankBy: "pts",
      columns: [...SKATER_COLUMNS, ...GOALIE_COLUMNS.filter((col) => !SKATER_COLUMNS.some((s) => s.key === col.key))],
      rows: [...skaterRows, ...goalieRows.sort((a, b) => Number(b.tags?.includes("qualified")) - Number(a.tags?.includes("qualified")) || (Number(b.values.svPct) || 0) - (Number(a.values.svPct) || 0))],
      segments: [
        { tag: "skater", label: "Skaters" },
        { tag: "goalie", label: "Goalies" },
      ],
      toggles: [{ tag: "qualified", label: "Qualified only (25%+ of games)", on: true, onlyWhenOn: true }],
    };
  }, [file, season]);

  const seasonPicker = (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
      Season
      <select
        value={season}
        onChange={(event) => setSeason(Number(event.target.value))}
        className="rounded-lg border border-[#262B36] bg-[#14171F] px-2 py-1.5 text-sm text-[#F8FAFC] outline-none focus:border-[#38BDF8]"
      >
        {seasons.map((item) => (
          <option key={item} value={item}>
            {seasonLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );

  if (!board) {
    return (
      <div className="mt-5">
        <div className="flex items-center gap-3">{seasonPicker}</div>
        <p className="mt-6 text-sm text-[#94A3B8]">{failed ? "Season data is unavailable right now." : "Loading season…"}</p>
      </div>
    );
  }
  return <SeasonBoard key={season} board={board} query={query} setQuery={setQuery} picker={seasonPicker} />;
}

/** Season board: columns switch with Skaters | Goalies. */
function SeasonBoard({ board, query, setQuery, picker }: { board: Board; query: string; setQuery: (value: string) => void; picker: React.ReactNode }) {
  const [group, setGroup] = useState("skater");
  const view = useMemo<Board>(
    () => ({ ...board, columns: group === "goalie" ? GOALIE_COLUMNS : SKATER_COLUMNS, segments: undefined, rows: board.rows.filter((row) => row.tags?.includes(group)) }),
    [board, group],
  );
  return (
    <BoardView
      key={group}
      board={view}
      query={query}
      setQuery={setQuery}
      extra={
        <>
          {picker}
          <TogglePill
            value={group}
            options={[
              { id: "skater", label: "Skaters" },
              { id: "goalie", label: "Goalies" },
            ]}
            onChange={setGroup}
            label="Position group"
          />
        </>
      }
    />
  );
}
