"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClauseBadge } from "@/components/clause-badge";
import type { ContractRow } from "@/lib/team-contracts";

// Every contract on the books, grouped Forwards / Defense / Goalies, with the cap hit
// each season through expiry and the free-agent status when the deal ends.

type Key = "name" | "age" | "aav" | "capPct" | "expires" | "asset";

const GROUPS: { id: ContractRow["group"]; label: string }[] = [
  { id: "F", label: "Forwards" },
  { id: "D", label: "Defense" },
  { id: "G", label: "Goalies" },
];

function money(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

function label(season: number): string {
  return `${String(season).slice(2)}-${String(season + 1).slice(2)}`;
}

export function TeamContractsTable({ rows, seasons, teamName, ceiling }: { rows: ContractRow[]; seasons: number[]; teamName: string; ceiling: number }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "aav", dir: -1 });

  const grouped = useMemo(() => {
    const value = (row: ContractRow) => (sort.key === "name" ? row.name : (row[sort.key] ?? -1));
    return GROUPS.map((group) => ({
      ...group,
      rows: rows
        .filter((row) => row.group === group.id)
        .sort((a, b) => {
          const x = value(a);
          const y = value(b);
          return (typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number)) * sort.dir;
        }),
    })).filter((group) => group.rows.length);
  }, [rows, sort]);

  function onSort(key: Key) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  const totalFor = (season: number, list: ContractRow[]) => list.filter((row) => season < row.expires).reduce((sum, row) => sum + row.aav, 0);

  const head = (key: Key, text: string, tip?: string, left = false) => (
    <th scope="col" className={`sticky top-0 z-10 bg-[#0B0D10] px-2.5 py-2 font-semibold ${left ? "text-left" : "text-right"}`}>
      <button
        type="button"
        onClick={() => onSort(key)}
        title={tip}
        className={`inline-flex items-center gap-1 text-[10px] tracking-[0.12em] uppercase ${sort.key === key ? "text-[#38BDF8]" : "text-[#94A3B8] hover:text-white"} ${tip ? "underline decoration-dotted underline-offset-4" : ""}`}
      >
        {text}
        {sort.key === key ? <span aria-hidden>{sort.dir === 1 ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );

  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Contracts · {teamName}</p>
        <p className="text-xs text-[#94A3B8]">
          {rows.length} contracts · cap hit by season · <span className="rounded bg-[#10B981]/15 px-1 text-[#10B981]">UFA</span> /{" "}
          <span className="rounded bg-[#38BDF8]/15 px-1 text-[#38BDF8]">RFA</span> when the deal ends
        </p>
      </div>
      <div className="mt-3 max-h-[40rem] overflow-auto rounded-xl border border-[#262B36]">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr>
              {head("name", "Player", undefined, true)}
              {head("age", "Age", "Age this season")}
              {head("aav", "Cap hit", "Average annual value")}
              {head("capPct", "% Cap", "Share of the cap ceiling")}
              {head("asset", "Asset", "Asset Value on the 0-100 Trade Machine scale")}
              {head("expires", "Exp", "Year the contract ends")}
              {seasons.map((season) => (
                <th key={season} scope="col" className="sticky top-0 z-10 bg-[#0B0D10] px-2.5 py-2 text-right text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                  {label(season)}
                </th>
              ))}
            </tr>
          </thead>
          {grouped.map((group) => (
            <tbody key={group.id} className="divide-y divide-[#262B36]">
              <tr className="bg-white/[0.02]">
                <td colSpan={6} className="px-2.5 py-1.5 text-[10px] font-bold tracking-[0.16em] text-[#94A3B8] uppercase">
                  {group.label} · {group.rows.length}
                </td>
                {seasons.map((season) => (
                  <td key={season} className="px-2.5 py-1.5 text-right text-[11px] font-semibold text-[#94A3B8] tabular-nums">
                    {money(totalFor(season, group.rows))}
                  </td>
                ))}
              </tr>
              {group.rows.map((row) => (
                <tr key={row.playerId} className="hover:bg-white/[0.03]">
                  <td className="px-2.5 py-1.5">
                    <span className="flex items-center gap-2">
                      <img
                        src={row.headshot ? `https://assets.nhle.com/mugs/nhl/latest/${row.playerId}.png` : "/player-silhouette.svg"}
                        onError={(event) => {
                          event.currentTarget.src = "/player-silhouette.svg";
                        }}
                        alt=""
                        loading="lazy"
                        className="h-7 w-7 shrink-0 rounded-full border border-[#262B36] bg-[#0B0D10] object-cover object-top"
                      />
                      {row.routeId ? (
                        <Link href={`/players/${row.routeId}?tab=asset`} className="font-semibold hover:text-[#38BDF8]">
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{row.name}</span>
                      )}
                      <span className="text-xs text-[#94A3B8]">{row.pos}</span>
                      {row.elc ? <span className="rounded bg-white/5 px-1 text-[9px] font-bold tracking-wider text-[#94A3B8] uppercase">ELC</span> : null}
                      <ClauseBadge clause={row.clause} text={row.clauseText} small />
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-[#94A3B8]">{row.age ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{money(row.aav)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-[#94A3B8]">{row.capPct.toFixed(1)}%</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{row.asset ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-[#94A3B8]">{row.expires}</td>
                  {seasons.map((season) => {
                    if (season < row.expires) {
                      return (
                        <td key={season} className="px-2.5 py-1.5 text-right tabular-nums">
                          <span className="rounded bg-[#38BDF8]/[0.07] px-1.5 py-0.5 text-xs text-[#F8FAFC]/90">{money(row.aav)}</span>
                        </td>
                      );
                    }
                    if (season === row.expires && row.status) {
                      return (
                        <td key={season} className="px-2.5 py-1.5 text-right">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${row.status === "UFA" ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#38BDF8]/15 text-[#38BDF8]"}`}
                          >
                            {row.status}
                          </span>
                        </td>
                      );
                    }
                    return <td key={season} />;
                  })}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-[#262B36] bg-[#0B0D10]/80">
              <td colSpan={6} className="px-2.5 py-2 text-xs font-bold tracking-[0.12em] uppercase">
                Committed cap
              </td>
              {seasons.map((season) => {
                const total = totalFor(season, rows);
                return (
                  <td key={season} className="px-2.5 py-2 text-right tabular-nums">
                    <span className="block font-bold">{money(total)}</span>
                    <span className="block text-[10px] text-[#94A3B8]">{((total / ceiling) * 100).toFixed(0)}% of today&apos;s cap</span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-[#94A3B8]">Future seasons use today&apos;s cap ceiling for the percentage. Buyouts and retained salary are not tracked yet.</p>
    </div>
  );
}
