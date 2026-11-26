"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { ShareLauncher } from "@/components/share-modal";
import { TeamLogo } from "@/components/team-logo";
import { teamHref } from "@/lib/routes";

type Row = {
  abbr: string;
  name: string;
  color: string;
  roster: number;
  prospects: number;
  picks: number;
  total: number;
  rank: number;
  rosterCount: number;
  prospectCount: number;
  pickCount: number;
  capSpace: number;
};

type Key = "rank" | "name" | "total" | "roster" | "prospects" | "picks" | "capSpace";

const COLORS = { roster: "#38BDF8", prospects: "#8B5CF6", picks: "#F59E0B" };
const fmt = (value: number) => Math.round(value).toLocaleString("en-US");
const money = (value: number) => `${value < 0 ? "−" : ""}$${(Math.abs(value) / 1_000_000).toFixed(2)}M`;

const COLUMNS: { key: Key; label: string; tip?: string }[] = [
  { key: "rank", label: "#" },
  { key: "name", label: "Team" },
  { key: "total", label: "Total Value", tip: "Roster + Prospects + Picks, all on the 0–100 Asset Value scale used in the Trade Machine." },
  { key: "roster", label: "Roster", tip: "Positive Asset Value across every player under NHL contract. Underwater contracts do not subtract here." },
  { key: "prospects", label: "Prospects", tip: "Drafted prospects the team holds rights to who are not on an NHL contract yet, valued by draft slot and projection tier." },
  { key: "picks", label: "Draft Picks", tip: "Every 2027–2029 pick the team owns, Rounds 1–7, including picks acquired from other teams." },
  { key: "capSpace", label: "Cap Space", tip: "Room under the salary cap ceiling today." },
];

export function FranchiseRankings({ rows, season }: { rows: Row[]; season: string }) {
  const [key, setKey] = useState<Key>("rank");
  const [desc, setDesc] = useState(false);

  function toggle(next: Key) {
    if (next === key) setDesc((value) => !value);
    else {
      setKey(next);
      setDesc(false);
    }
  }

  const sorted = useMemo(() => {
    const direction = desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (key === "name") return a.name.localeCompare(b.name) * direction;
      return ((a[key] as number) - (b[key] as number)) * direction;
    });
  }, [rows, key, desc]);
  const top = Math.max(1, ...rows.map((row) => row.total));
  const byTotal = [...rows].sort((a, b) => a.rank - b.rank);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
          <Legend color={COLORS.roster} label="Roster" />
          <Legend color={COLORS.prospects} label="Prospects" />
          <Legend color={COLORS.picks} label="Picks" />
        </p>
        <ShareLauncher
          fileSlug="franchise-asset-rankings"
          title="Franchise Asset Rankings"
          summary={`${byTotal[0].name} lead the StatsPuck Franchise Asset Rankings.`}
          path="/trade-machine/rankings"
          card={{
            kind: "assets",
            subtitle: `NHL ${season}`,
            rows: byTotal.map((row) => ({ rank: row.rank, name: row.name, abbr: row.abbr, total: row.total, roster: row.roster, prospects: row.prospects, picks: row.picks })),
          }}
        />
      </div>

      <div className="mt-4">
        <table className="sheet w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] tracking-wide text-[#94A3B8] uppercase">
              {COLUMNS.map((column) => (
                <th key={column.key} className="border-b border-[#262B36] px-3 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <button type="button" className="hover:text-white" onClick={() => toggle(column.key)}>
                      {column.label}
                      {key === column.key ? (desc ? " ↓" : " ↑") : ""}
                    </button>
                    {column.tip ? <InfoTip text={column.tip} /> : null}
                  </span>
                </th>
              ))}
              <th className="border-b border-[#262B36] px-3 py-3 font-semibold">Mix</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.abbr} className="hover:bg-white/[0.02]">
                <td className="border-t border-[#262B36] px-3 py-2.5 text-[#94A3B8]">{row.rank}</td>
                <td className="border-t border-[#262B36] px-3 py-2.5">
                  <Link href={teamHref(row.abbr, "trades-cap")} className="flex items-center gap-3 font-medium hover:text-white">
                    <TeamLogo abbr={row.abbr} name={row.name} />
                    {row.name}
                  </Link>
                </td>
                <td className="display border-t border-[#262B36] px-3 py-2.5 text-lg font-bold">{fmt(row.total)}</td>
                <td className="border-t border-[#262B36] px-3 py-2.5 text-[#38BDF8]" title={`${row.rosterCount} players`}>
                  {fmt(row.roster)}
                </td>
                <td className="border-t border-[#262B36] px-3 py-2.5 text-[#A78BFA]" title={`${row.prospectCount} prospects`}>
                  {fmt(row.prospects)}
                </td>
                <td className="border-t border-[#262B36] px-3 py-2.5 text-[#F59E0B]" title={`${row.pickCount} picks`}>
                  {fmt(row.picks)}
                </td>
                <td className={`border-t border-[#262B36] px-3 py-2.5 ${row.capSpace < 0 ? "text-[#EF4444]" : "text-[#F8FAFC]"}`}>{money(row.capSpace)}</td>
                <td className="w-40 border-t border-[#262B36] px-3 py-2.5">
                  <span className="flex h-2.5 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]" style={{ width: `${Math.max(12, (row.total / top) * 100)}%` }}>
                    <span style={{ width: `${(row.roster / row.total) * 100}%`, background: COLORS.roster }} />
                    <span style={{ width: `${(row.prospects / row.total) * 100}%`, background: COLORS.prospects }} />
                    <span style={{ width: `${(row.picks / row.total) * 100}%`, background: COLORS.picks }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
