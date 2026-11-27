"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClauseBadge } from "@/components/clause-badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { TeamLogo } from "@/components/team-logo";
import { formatRating, ratingTone } from "@/lib/rating";
import type { Rumor } from "@/lib/rumors";

// Rumor feed with filter pills (type / Tier 1) and a team filter. Every card shows the
// rumored player's live StatsPuck numbers and jumps straight into the Trade Machine or Card Studio.

type Filter = "all" | "block" | "ext" | "tier1";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All Rumors" },
  { id: "block", label: "Trade Block" },
  { id: "ext", label: "Extensions" },
  { id: "tier1", label: "Tier 1 Insiders" },
];

const TYPE_TONE: Record<string, string> = {
  "Trade Block": "border-[#E11D48]/50 bg-[#E11D48]/10 text-[#FDA4AF]",
  "Extension Talks": "border-[#10B981]/50 bg-[#10B981]/10 text-[#6EE7B7]",
  "Buyout Candidate": "border-[#F97316]/50 bg-[#F97316]/10 text-[#FDBA74]",
  "Offer Sheet Watch": "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-[#C4B5FD]",
};

function skillTone(value: number | null): string {
  if (value == null) return "text-[#94A3B8]";
  if (value >= 90) return "text-[#F59E0B]";
  if (value >= 80) return "text-[#10B981]";
  if (value >= 65) return "text-[#38BDF8]";
  return "text-[#F8FAFC]";
}

const money = (value: number) => `$${(value / 1_000_000).toFixed(2)}M`;

function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function RumorsFeed({ rumors, tradeHrefs, cardHrefs }: { rumors: Rumor[]; tradeHrefs: Record<string, string>; cardHrefs: Record<string, string> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [team, setTeam] = useState("ALL");

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const rumor of rumors) {
      map.set(rumor.teamCode, rumor.teamName);
      for (const other of rumor.interested) map.set(other.abbr, other.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rumors]);

  const shown = rumors.filter((rumor) => {
    if (filter === "block" && rumor.rumorType !== "Trade Block") return false;
    if (filter === "ext" && rumor.rumorType !== "Extension Talks") return false;
    if (filter === "tier1" && rumor.credibility !== "Tier 1 Insider") return false;
    if (team !== "ALL" && rumor.teamCode !== team && !rumor.interested.some((other) => other.abbr === team)) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rumors">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                filter === item.id ? "border-[#38BDF8] bg-[#38BDF8]/15 text-[#F8FAFC]" : "border-[#262B36] bg-[#14171F] text-[#94A3B8] hover:border-[#38BDF8]/50 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-[#94A3B8]">
          Team
          <select
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            className="rounded-xl border border-[#262B36] bg-[#14171F] px-3 py-1.5 text-sm font-semibold text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
          >
            <option value="ALL">All teams</option>
            {teamOptions.map(([abbr, name]) => (
              <option key={abbr} value={abbr}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-[#94A3B8]">
        {shown.length} of {rumors.length} rumors
      </p>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {shown.length === 0 ? <p className="rounded-2xl border border-dashed border-[#262B36] p-6 text-center text-sm text-[#94A3B8] lg:col-span-2">No rumors match these filters.</p> : null}
        {shown.map((rumor) => (
          <article key={rumor.id} id={rumor.id} className="flex scroll-mt-24 flex-col rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className={`rounded-full border px-2 py-0.5 tracking-wide uppercase ${TYPE_TONE[rumor.rumorType] ?? ""}`}>{rumor.rumorType}</span>
              <span
                className={`rounded-full px-2 py-0.5 tracking-wide uppercase ${
                  rumor.credibility === "Tier 1 Insider" ? "bg-[#F59E0B]/15 text-[#FCD34D]" : "bg-white/5 text-[#94A3B8]"
                }`}
                title={rumor.credibility === "Tier 1 Insider" ? "Attributed to a top national insider" : "General league chatter, less certain"}
              >
                {rumor.credibility === "Tier 1 Insider" ? "★ " : ""}
                {rumor.credibility}
              </span>
              <span className="ml-auto text-[#94A3B8]">{dateLabel(rumor.date)}</span>
            </div>

            <h2 className="display mt-3 text-xl leading-tight font-bold">{rumor.headline}</h2>
            <p className="mt-1.5 text-sm text-[#94A3B8]">{rumor.summary}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#F8FAFC]">
                <TeamLogo abbr={rumor.teamCode} name={rumor.teamName} className="h-5 w-6" />
                {rumor.teamName}
              </span>
              {rumor.interested.length ? (
                <>
                  <span aria-hidden>→</span>
                  {rumor.interested.map((other) => (
                    <span key={other.abbr} className="inline-flex items-center gap-1 rounded-full border border-[#262B36] bg-[#0B0D10]/60 py-0.5 pr-2 pl-1" title={`Rumored interest: ${other.name}`}>
                      <TeamLogo abbr={other.abbr} name={other.name} className="h-4 w-5" />
                      {other.abbr}
                    </span>
                  ))}
                </>
              ) : null}
              {rumor.sourceName ? (
                <span className="ml-auto">
                  Source:{" "}
                  {rumor.sourceUrl ? (
                    <a href={rumor.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#38BDF8] hover:underline">
                      {rumor.sourceName}
                    </a>
                  ) : (
                    rumor.sourceName
                  )}
                </span>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              {rumor.players.map((player) => (
                <div key={player.playerId} className="flex items-center gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-2.5">
                  <PlayerHeadshot playerId={player.playerId} name={player.name} available={player.headshot} color={rumor.teamColor} className="h-12 w-12 !rounded-xl !border" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {player.routeId ? (
                        <Link href={`/players/${player.routeId}`} className="truncate hover:underline">
                          {player.name}
                        </Link>
                      ) : (
                        <span className="truncate">{player.name}</span>
                      )}
                      <span className="shrink-0 text-[10px] text-[#94A3B8]">{player.pos}</span>
                      <ClauseBadge clause={player.clause} text={player.clauseText} small />
                    </p>
                    <p className="truncate text-[11px] text-[#94A3B8]">
                      {player.aav != null ? `${player.elc ? "ELC · " : ""}${money(player.aav)} AAV · ${player.capPct?.toFixed(1)}% Cap · Exp ${player.expires}${player.status ? ` ${player.status}` : ""}` : "No NHL contract on file"}
                    </p>
                  </div>
                  <dl className="flex shrink-0 gap-3 text-center">
                    <div title="Overall Skill (0–99)">
                      <dt className="text-[9px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Skill</dt>
                      <dd className={`display text-xl leading-none font-bold ${skillTone(player.skill)}`}>{player.skill ?? "—"}</dd>
                    </div>
                    <div title="Asset Value (0–100), the Trade Machine scale">
                      <dt className="text-[9px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Asset</dt>
                      <dd className={`display text-xl leading-none font-bold ${player.asset == null ? "text-[#94A3B8]" : ratingTone(player.asset)}`}>{player.asset == null ? "—" : formatRating(player.asset)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 pt-1 sm:mt-auto sm:grid-cols-2 sm:pt-4">
              <Link
                href={tradeHrefs[rumor.id]}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E11D48] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F43F5E]"
              >
                Test in Trade Machine →
              </Link>
              <Link
                href={cardHrefs[rumor.id]}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#38BDF8]/50 bg-[#38BDF8]/[0.06] px-3 py-2.5 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8]"
              >
                Create Rumor Graphic →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
