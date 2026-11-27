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
  const gap = actual != null && fair.actual ? fair.actual.todayAav - fair.aav : null;
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
        <Box label="Actual contract" value={actual != null ? money(actual) : contract?.elc ? `${money(contract.aav)} ELC` : "None"} note={
            fair.actual && actual != null
              ? `Signed ${fair.actual.estimated ? "≈" : ""}${fair.actual.signingYear}: ${fair.actual.capPct.toFixed(1)}% of that cap ≈ ${money(fair.actual.todayAav)} today · exp ${contract!.expires}`
              : contract
                ? `${((contract.aav / capCeiling) * 100).toFixed(1)}% cap · exp ${contract.expires}`
                : "Not under contract"
          }
        />
        <Box label="Fair-market AAV" value={money(fair.aav)} note={`${fair.capPct.toFixed(1)}% of today's ${money(capCeiling)} cap`} accent />
        <Box label="Expected term" value={`${fair.term} ${fair.term === 1 ? "year" : "years"}`} note="Median length of the comparable deals" />
      </div>
      {gap != null ? (
        <p className="mt-3 text-sm text-[#94A3B8]">
          {name} is paid{" "}
          <span className={`font-semibold ${gap > 0 ? "text-[#EF4444]" : "text-[#10B981]"}`}>
            {money(Math.abs(gap))} {gap > 0 ? "more" : "less"}
          </span>{" "}
          per season than comparable players, in today&apos;s cap dollars ({Math.round((fair.ratio ?? 1) * 100)}% of fair value).
        </p>
      ) : null}

      <p className="mt-5 text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">The 5 closest comparables</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {fair.comps.map((comp) => {
          const body = (
            <>
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
                    {comp.pos} · age {comp.age} at signing
                  </span>
                </span>
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span
                  className={`rounded px-1.5 py-0.5 font-bold ${comp.historical ? "bg-[#8B5CF6]/15 text-[#C4B5FD]" : "bg-white/5 text-[#94A3B8]"}`}
                  title={comp.estimated ? "Signing year estimated: the free cap feed lists only a deal's remaining seasons" : undefined}
                >
                  Signed {comp.estimated ? "≈" : ""}
                  {comp.signingYear}
                </span>
                {comp.term ? <span className="text-[#94A3B8]">{comp.term} yrs</span> : null}
                <ClauseBadge clause={comp.clause} small />
              </span>
              <span className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="display text-lg font-bold">{money(comp.aav)}</span>
                <span className="text-[11px] text-[#94A3B8]" title={`Share of the ${comp.signingYear}-${String(comp.signingYear + 1).slice(2)} cap`}>
                  {comp.capPct.toFixed(1)}% cap
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] text-[#10B981]" title="The same share of today's cap">
                ≈ {money(comp.todayAav)} today
              </span>
              <span className="mt-auto grid grid-cols-3 gap-1 pt-2 text-center text-[10px] text-[#94A3B8]">
                <span title="Impact per 82 games over the two seasons before the deal (recent form if unknown)">
                  <span className="block font-semibold text-[#F8FAFC]">{comp.rate.toFixed(0)}</span>Imp/82
                </span>
                <span>
                  <span className="block font-semibold text-[#F8FAFC]">{comp.skill ?? "—"}</span>Skill
                </span>
                <span>
                  <span className="block font-semibold text-[#38BDF8]">{comp.similarity}</span>Match
                </span>
              </span>
            </>
          );
          const cls = "flex h-full flex-col rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 transition hover:border-[#38BDF8]/60";
          return (
            <li key={`${comp.playerId}-${comp.signingYear}`}>
              {comp.routeId ? (
                <Link href={playerHref(comp.routeId, "asset")} className={cls}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-[#94A3B8]">
        Matched on position, age at signing (within 1.5 years), and Impact per 82 and Skill before the deal, across today&apos;s contracts and an archive of notable signings since
        2005. Each deal counts as its share of the cap in the year it was signed, nudged for the gap in Impact between him and the comparable; fair value is the average of the five, times today&apos;s {money(capCeiling)} cap. His own deal is judged the same way. Purple tags are
        past deals; &quot;≈&quot; marks a signing year we had to estimate. Bargain under 85% of fair value, Overpaid above 115%.
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