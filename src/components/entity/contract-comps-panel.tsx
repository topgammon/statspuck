/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ClauseBadge } from "@/components/clause-badge";
import { SectionLabel } from "@/components/entity/bio";
import { TeamLogo } from "@/components/team-logo";
import { capCeiling, money, type PlayerContract } from "@/lib/cap";
import type { FairValue } from "@/lib/contract-comps";
import { playerHref } from "@/lib/routes";

// "Contract Comparables & Market Value" on the player Asset Value tab.

const VERDICT_TONE: Record<string, string> = {
  Bargain: "border-[#10B981]/60 bg-[#10B981]/10 text-[#10B981]",
  "Fair Market": "border-[#38BDF8]/60 bg-[#38BDF8]/10 text-[#38BDF8]",
  Overpaid: "border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]",
};

export function ContractCompsPanel({ name, fair, contract }: { name: string; fair: FairValue | null; contract: PlayerContract | null }) {
  if (!fair) {
    return (
      <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-5">
        <SectionLabel>Contract comparables &amp; market value</SectionLabel>
        <p className="mt-2 text-sm text-[#94A3B8]">Needs 30+ NHL games over the last two seasons to match {name} with comparable contracts.</p>
      </div>
    );
  }
  const actual = contract && !contract.elc ? contract.aav : null;
  const gap = actual != null ? actual - fair.aav : null;
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Contract comparables &amp; market value</SectionLabel>
        {fair.verdict ? (
          <span className={`display rounded-full border px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase ${VERDICT_TONE[fair.verdict]}`}>{fair.verdict}</span>
        ) : contract?.elc ? (
          <span className="rounded-full border border-[#262B36] px-3 py-1 text-[11px] text-[#94A3B8]">Entry-level deal: salary is set by the CBA</span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Box label="Actual contract" value={actual != null ? money(actual) : contract?.elc ? `${money(contract.aav)} ELC` : "None"} note={contract ? `${((contract.aav / capCeiling) * 100).toFixed(1)}% cap · exp ${contract.expires}` : "Not under contract"} />
        <Box label="Fair-market AAV" value={money(fair.aav)} note={`${fair.capPct.toFixed(1)}% of today's ${money(capCeiling)} cap`} accent />
        <Box label="Expected term" value={`${fair.term} ${fair.term === 1 ? "year" : "years"}`} note="Typical NHL term at his signing age" />
      </div>
      {gap != null ? (
        <p className="mt-3 text-sm text-[#94A3B8]">
          {name} is paid{" "}
          <span className={`font-semibold ${gap > 0 ? "text-[#EF4444]" : "text-[#10B981]"}`}>
            {money(Math.abs(gap))} {gap > 0 ? "more" : "less"}
          </span>{" "}
          per season than comparable players earn ({Math.round((fair.ratio ?? 1) * 100)}% of fair value).
        </p>
      ) : null}

      <p className="mt-5 text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">The 5 closest comparables</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {fair.comps.map((comp) => (
          <li key={comp.playerId}>
            <Link href={playerHref(comp.routeId, "asset")} className="flex h-full flex-col rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 transition hover:border-[#38BDF8]/60">
              <span className="flex items-center gap-2">
                <img
                  src={comp.headshot ? `https://assets.nhle.com/mugs/nhl/latest/${comp.playerId}.png` : "/player-silhouette.svg"}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-full border border-[#262B36] bg-[#0B0D10] object-cover object-top"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{comp.name}</span>
                  <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                    {comp.team ? <TeamLogo abbr={comp.team} className="h-3.5 w-4" /> : null}
                    {comp.pos} · {comp.age}
                  </span>
                </span>
              </span>
              <span className="mt-2 flex items-baseline justify-between gap-2">
                <span className="display text-lg font-bold">{money(comp.aav)}</span>
                <span className="text-[11px] text-[#94A3B8]">{comp.capPct.toFixed(1)}%</span>
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                Through {comp.expires - 1}-{String(comp.expires).slice(2)}
                <ClauseBadge clause={comp.clause} small />
              </span>
              <span className="mt-auto grid grid-cols-3 gap-1 pt-2 text-center text-[10px] text-[#94A3B8]">
                <span>
                  <span className="block font-semibold text-[#F8FAFC]">{comp.rate.toFixed(0)}</span>Imp/82
                </span>
                <span>
                  <span className="block font-semibold text-[#F8FAFC]">{comp.skill ?? "—"}</span>Skill
                </span>
                <span>
                  <span className="block font-semibold text-[#38BDF8]">{comp.similarity}</span>Match
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[#94A3B8]">
        Matched on position, age (within a year), 2-year Impact per 82 games and Overall Skill, among standard NHL contracts on the books today. Fair value is their share of the cap, adjusted for the gap in Impact and weighted toward the closest matches, at today&apos;s cap ceiling; players signing at 32+ take 8% off per year past 31. Bargain under 85% of fair value, Overpaid above 115%.
      </p>
    </div>
  );
}

function Box({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-[#38BDF8]/40 bg-[#38BDF8]/[0.05]" : "border-[#262B36] bg-[#0B0D10]/60"}`}>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{label}</p>
      <p className="display mt-1 text-2xl leading-none font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-[#94A3B8]">{note}</p>
    </div>
  );
}
