/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArchetypePill } from "@/components/entity/bio";
import { TeamLogo } from "@/components/team-logo";
import type { RosterPlayer } from "@/lib/perfect-roster";
import { playerHref } from "@/lib/routes";

// Player cards for the Perfect Roster page and the home page preview.

function skillTone(value: number): string {
  if (value >= 90) return "text-[#F59E0B]";
  if (value >= 80) return "text-[#10B981]";
  if (value >= 65) return "text-[#38BDF8]";
  return "text-[#F8FAFC]";
}

export function money(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

export function RosterCard({ player, label, compact = false }: { player: RosterPlayer; label: string; compact?: boolean }) {
  return (
    <Link
      href={playerHref(player.routeId, "skills")}
      className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-[#262B36] bg-[#0B0D10]/70 p-2.5 transition hover:border-[#38BDF8]/60"
    >
      <img
        src={player.headshot ? `https://assets.nhle.com/mugs/nhl/latest/${player.playerId}.png` : "/player-silhouette.svg"}
        alt=""
        loading="lazy"
        className={`${compact ? "h-9 w-9" : "h-12 w-12"} shrink-0 rounded-full border border-[#262B36] bg-[#14171F] object-cover object-top`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
          {label}
          {player.team ? <TeamLogo abbr={player.team} className="h-3.5 w-4" /> : null}
        </span>
        <span className="block truncate text-sm font-semibold group-hover:text-[#38BDF8]">{player.name}</span>
        {compact ? null : (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <ArchetypePill archetype={player.archetype} small />
          </span>
        )}
        <span className="block text-[11px] text-[#94A3B8]">
          {player.elc ? "ELC · " : ""}
          {money(player.aav)} · {player.capPct.toFixed(1)}%
        </span>
      </span>
      <span className={`display text-2xl font-bold ${skillTone(player.skill)}`} title="Overall Skill Rating">
        {player.skill}
      </span>
    </Link>
  );
}
