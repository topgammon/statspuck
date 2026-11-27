"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InfoTip } from "@/components/info-tip";

// Ref Watch leaderboard: sortable (ascending first), searchable, sticky header, tooltips.

export type RefRow = {
  slug: string;
  name: string;
  photo?: string | null;
  games: number;
  low: boolean;
  grade: string;
  score: number;
  style: string;
  rate: number;
  delta: number;
  home: number;
  mgmt: number;
  signature: { label: string; pct: number }[];
};

type Key = "name" | "score" | "style" | "rate" | "home" | "mgmt" | "games";

const COLUMNS: { key: Key; label: string; tip?: string; align?: "right" }[] = [
  { key: "name", label: "Referee" },
  { key: "score", label: "Grade", tip: "Consistency & Objectivity Grade (A+ to D-) and 0-100 score: low home/away bias, low score-state make-up calls, and the same standard late in tight games as early on." },
  { key: "style", label: "Whistle style", tip: "Strict Whistle / Let Them Play = isolated call rate well above / below average. Game Manager = unusually many even-up or against-the-leader calls. Otherwise Balanced." },
  { key: "rate", label: "Calls/60", align: "right", tip: "Penalties called per 60 minutes, isolated from his partner and the teams playing with a ridge regression across every rotating ref pairing." },
  { key: "home", label: "Home bias", align: "right", tip: "Net home-team power plays per 60 vs the league baseline. Positive = the home side gets more power plays than usual." },
  { key: "mgmt", label: "Game-Mgmt", align: "right", tip: "How often his next call goes against the team that has drawn more power plays or is leading on the scoreboard. 50 = coin flip." },
  { key: "games", label: "Games", align: "right" },
];

function gradeColor(letter: string): string {
  if (letter.startsWith("A")) return "#F59E0B";
  if (letter.startsWith("B")) return "#10B981";
  if (letter.startsWith("C")) return "#38BDF8";
  return "#EF4444";
}

const STYLE_TONE: Record<string, string> = { "Strict Whistle": "#E11D48", Balanced: "#38BDF8", "Let Them Play": "#10B981", "Game Manager": "#8B5CF6" };

export function StyleBadge({ style }: { style: string }) {
  const tone = STYLE_TONE[style] ?? "#94A3B8";
  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase" style={{ color: tone, borderColor: `${tone}66`, background: `${tone}14` }}>
      {style}
    </span>
  );
}

/** Official NHL referee headshot (records.nhl.com), falling back to striped initials. */
export function RefPhoto({ name, photo, className = "h-9 w-9 text-xs" }: { name: string; photo?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) return <RefInitials name={name} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" loading="lazy" onError={() => setFailed(true)} className={`${className} shrink-0 rounded-full border border-[#262B36] bg-[#F8FAFC] object-cover object-top`} />
  );
}

export function RefInitials({ name, className = "h-9 w-9 text-xs" }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={`grid shrink-0 place-items-center rounded-full border border-[#262B36] bg-[repeating-linear-gradient(90deg,#F8FAFC_0_6px,#0B0D10_6px_12px)] font-bold ${className}`}>
      <span className="rounded bg-[#0B0D10]/85 px-1 text-[#F8FAFC]">{initials}</span>
    </span>
  );
}

const sign = (v: number, digits = 1) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;

export function RefTable({ rows, leagueRate, leagueMgmt }: { rows: RefRow[]; leagueRate: number; leagueMgmt: number }) {
  const [query, setQuery] = useState("");
  const [showLow, setShowLow] = useState(false);
  const [sort, setSort] = useState<{ key: Key; asc: boolean }>({ key: "score", asc: false });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => (showLow || !r.low) && (!q || r.name.toLowerCase().includes(q)));
    const dir = sort.asc ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return (typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number)) * dir;
    });
  }, [rows, query, showLow, sort]);

  function click(key: Key) {
    // Ascending first on a new column.
    setSort((cur) => (cur.key === key ? { key, asc: !cur.asc } : { key, asc: true }));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search referees…"
          className="w-full max-w-xs rounded-lg border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm outline-none focus:border-[#38BDF8]"
        />
        <label className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <input type="checkbox" checked={showLow} onChange={(e) => setShowLow(e.target.checked)} />
          Include call-ups under 15 games
        </label>
        <span className="ml-auto text-xs text-[#94A3B8]">{shown.length} referees</span>
      </div>
      <div className="mt-3 max-h-[70vh] overflow-auto rounded-2xl border border-[#262B36]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-[#14171F] text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className={`px-3 py-2.5 font-semibold ${col.align === "right" ? "text-right" : "text-left"}`}>
                  <span className={`inline-flex items-center gap-1 ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                    <button type="button" onClick={() => click(col.key)} className="uppercase hover:text-white">
                      {col.label}
                      {sort.key === col.key ? (sort.asc ? " ▲" : " ▼") : ""}
                    </button>
                    {col.tip ? <InfoTip text={col.tip} align={col.align === "right" ? "end" : "start"} /> : null}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-semibold">
                <span className="inline-flex items-center gap-1">
                  Signature call <InfoTip text="The penalty type he calls most above (or below) the league rate, shrunk toward average for small samples." align="end" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.slug} className="border-t border-[#262B36] bg-[#0B0D10]/40 transition hover:bg-[#38BDF8]/5">
                <td className="px-3 py-2">
                  <Link href={`/ref-watch/${r.slug}`} className="flex items-center gap-2.5 font-semibold hover:text-[#38BDF8]">
                    <RefPhoto name={r.name} photo={r.photo} />
                    <span>
                      {r.name}
                      {r.low ? <span className="ml-1 text-[10px] text-[#F97316]">low sample</span> : null}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className="display text-lg font-bold" style={{ color: gradeColor(r.grade) }}>
                    {r.grade}
                  </span>
                  <span className="ml-1.5 text-xs text-[#94A3B8]">{r.score}</span>
                </td>
                <td className="px-3 py-2">
                  <StyleBadge style={r.style} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.rate.toFixed(1)} <span className={`text-xs ${r.delta >= 0 ? "text-[#E11D48]" : "text-[#10B981]"}`}>{sign(r.delta)}</span>
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(r.home) >= 0.25 ? "font-semibold text-[#F97316]" : ""}`}>{sign(r.home, 2)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(r.mgmt - leagueMgmt) >= 3 ? "font-semibold text-[#8B5CF6]" : ""}`}>{r.mgmt.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#94A3B8]">{r.games}</td>
                <td className="px-3 py-2 text-xs">
                  {r.signature[0] ? (
                    <span className={r.signature[0].pct >= 0 ? "text-[#E11D48]" : "text-[#10B981]"}>
                      {r.signature[0].label} {r.signature[0].pct > 0 ? "+" : ""}
                      {r.signature[0].pct}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[#94A3B8]">League average: {leagueRate.toFixed(2)} calls/60 · Game-Mgmt {leagueMgmt.toFixed(1)}.</p>
    </div>
  );
}
