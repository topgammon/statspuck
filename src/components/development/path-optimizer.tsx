"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Bucket, CohortRow, Tier } from "@/lib/development";
import { playerHref } from "@/lib/routes";
import { FilterPills } from "./filter-pills";
import { pct, summarize, toRows, type Row } from "./shared";

type TierChoice = Tier | "undrafted";
const LEAGUES: Bucket[] = ["CHL", "NCAA", "USHL", "AHL", "SHL", "Liiga", "KHL"];
const LEAGUE_NAME: Partial<Record<Bucket, string>> = { USHL: "USHL / Jr. A", Other: "Other Pro/Euro", None: "Not playing" };
const MIN_COHORT = 15;
const MIN_OPTION = 3;

function nameOf(bucket: Bucket): string {
  return LEAGUE_NAME[bucket] ?? bucket;
}

function optionTitle(current: Bucket, next: Bucket): string {
  if (next === current) return `Stay in the ${nameOf(current)}`;
  if (next === "NHL") return "Make the NHL jump";
  if (next === "AHL") return "Turn pro in the AHL";
  if (next === "None") return "Out of tracked hockey";
  return `Move to the ${nameOf(next)}`;
}

/** "Make The Show": for a prospect's draft range, position, stage, and league, what did past players do next, and how did it work out? */
export function PathOptimizer({ cohort, buckets }: { cohort: CohortRow[]; buckets: Bucket[] }) {
  const all = useMemo(() => toRows(cohort, buckets), [cohort, buckets]);
  const [tier, setTier] = useState<TierChoice>("r23");
  const [pos, setPos] = useState<"F" | "D" | "G">("F");
  const [stage, setStage] = useState<"1" | "2" | "3" | "4">("1");
  const [league, setLeague] = useState<Bucket>("CHL");

  const result = useMemo(() => {
    const step = Number(stage);
    const effectiveTier: Tier = tier === "undrafted" ? "r47" : tier;
    const match = (row: Row, anyPos: boolean) =>
      row.tier === effectiveTier && (anyPos || row.group === pos) && row.path[step] === league;
    let rows = all.filter((row) => match(row, false));
    let broadened = false;
    if (rows.length < MIN_COHORT) {
      rows = all.filter((row) => match(row, true));
      broadened = true;
    }
    const groups = new Map<Bucket, Row[]>();
    for (const row of rows) {
      const next = row.path[step + 1] ?? "None";
      groups.set(next, [...(groups.get(next) ?? []), row]);
    }
    const options = [...groups.entries()]
      .map(([next, members]) => ({ next, members, summary: summarize(members) }))
      .filter((option) => option.members.length >= MIN_OPTION)
      .sort((a, b) => b.summary.rate25 - a.summary.rate25 || b.members.length - a.members.length);
    return { rows, broadened, options, overall: summarize(rows), step };
  }, [all, tier, pos, stage, league]);

  return (
    <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5">
      <div className="grid gap-2.5">
        <FilterPills
          label="Draft tier"
          value={tier}
          options={[
            { id: "top10", label: "Top 10" },
            { id: "r1", label: "Round 1" },
            { id: "r23", label: "Rounds 2–3" },
            { id: "r47", label: "Rounds 4–7" },
            { id: "undrafted", label: "Undrafted" },
          ]}
          onChange={setTier}
        />
        <div className="flex flex-wrap gap-x-6 gap-y-2.5">
          <FilterPills
            label="Position"
            value={pos}
            options={[
              { id: "F", label: "F" },
              { id: "D", label: "D" },
              { id: "G", label: "G" },
            ]}
            onChange={setPos}
          />
          <FilterPills
            label="Now in"
            value={stage}
            options={[
              { id: "1", label: "D+1" },
              { id: "2", label: "D+2" },
              { id: "3", label: "D+3" },
              { id: "4", label: "D+4" },
            ]}
            onChange={setStage}
          />
        </div>
        <FilterPills label="Current league" value={league} options={LEAGUES.map((id) => ({ id, label: nameOf(id) }))} onChange={setLeague} />
      </div>

      <div className="mt-5 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-4 py-3 text-sm text-[#94A3B8]">
        {result.rows.length ? (
          <>
            <span className="text-[#F8FAFC]">{result.rows.length} past players</span> matched this profile in D+{result.step}. Overall,{" "}
            <span className="text-[#38BDF8]">{pct(result.overall.rate25)}</span> made the NHL and{" "}
            <span className="text-[#10B981]">{pct(result.overall.rate100)}</span> became regulars.
            {result.broadened ? " Few players matched this exact position, so all positions are included." : ""}
            {tier === "undrafted" ? " We only track drafted players, so Rounds 4–7 picks stand in as the closest comparison for undrafted prospects." : ""}
          </>
        ) : (
          "No past players match this profile. Try a different league or stage."
        )}
      </div>

      {result.options.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {result.options.slice(0, 4).map((option, index) => {
            const s = option.summary;
            const small = option.members.length < 8;
            return (
              <div
                key={option.next}
                className={`flex flex-col rounded-xl border p-4 ${index === 0 ? "border-[#38BDF8]/60 bg-[#38BDF8]/[0.05]" : "border-[#262B36] bg-[#0B0D10]/60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">Next: D+{result.step + 1}</p>
                  {index === 0 ? <span className="rounded-full bg-[#38BDF8]/15 px-2 py-0.5 text-[10px] font-bold text-[#38BDF8] uppercase">Best odds</span> : null}
                </div>
                <p className="display mt-1 text-xl leading-tight font-bold">{optionTitle(league, option.next)}</p>
                <p className="text-xs text-[#94A3B8]">
                  {option.members.length} players{small ? " · small sample" : ""}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <Stat label="NHL odds" value={pct(s.rate25)} tone="text-[#38BDF8]" />
                  <Stat label="Regular 100+" value={pct(s.rate100)} tone="text-[#10B981]" />
                  <Stat label="Exp. Impact" value={s.avgImpact.toFixed(0)} />
                  <Stat label="Bust risk" value={pct(1 - s.rate25)} tone="text-[#EF4444]" />
                </dl>
                {s.examples.length ? (
                  <p className="mt-3 text-xs text-[#94A3B8]">
                    e.g.{" "}
                    {s.examples.slice(0, 2).map((row, i) => (
                      <span key={row.id}>
                        {i > 0 ? ", " : ""}
                        <Link href={playerHref(row.id, "development")} className="text-[#F8FAFC] hover:underline">
                          {row.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      <p className="mt-4 text-xs text-[#94A3B8]">
        Historical odds, not a guarantee. Players who moved up early were often already the stronger prospects, so these numbers show what happened after each
        move, not what the move itself causes. NHL odds = share who reached 25+ career Impact; Regular = 100+; Bust risk = share who never reached 25. Expected Impact is
        the average career Impact of players who made that move.
      </p>
    </section>
  );
}

function Stat({ label, value, tone = "text-[#F8FAFC]" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</dt>
      <dd className={`display text-lg font-bold ${tone}`}>{value}</dd>
    </div>
  );
}
