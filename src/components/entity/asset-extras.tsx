import Link from "next/link";
import { SectionLabel } from "@/components/entity/bio";
import { TeamLogo } from "@/components/team-logo";
import { capCeiling, money, pctCap, type PlayerContract } from "@/lib/cap";
import { teamsByAbbr } from "@/lib/data";
import type { PlayerValue } from "@/lib/player-value";
import type { PlayerTrade } from "@/lib/player-trades";
import { teamHref } from "@/lib/routes";

// Extra Asset Value tab sections: contract & clause deep-dive, injury timeline (soon),
// and NHL trade history with a link into the Trade Machine.

function signedMoney(value: number): string {
  const text = money(Math.abs(value));
  return value < 0 ? `−${text}` : `+${text}`;
}

/** Net surplus as a 0-100 score: 50 is a fair deal, each $1M of surplus is about 2.5 points. */
export function surplusScore(value: PlayerValue): number | null {
  if (value.kind !== "contract") return null;
  return Math.max(0, Math.min(100, Math.round(50 + value.asset.value / 400_000)));
}

export function ContractDeepDive({ contract, value }: { contract: PlayerContract | null; value: PlayerValue }) {
  const score = surplusScore(value);
  const rows: [string, string, string?][] = contract
    ? [
        ["AAV", money(contract.aav), "Average annual value: the cap hit"],
        ["% of Cap", pctCap(contract.aav), `Share of the ${money(capCeiling)} cap ceiling`],
        ["Expiry", `${contract.expires - 1}-${String(contract.expires).slice(2)} (${contract.expires})`, "Last season of the deal"],
        ["Contract type", contract.elc ? "Entry-level (ELC)" : "Standard"],
        ["Trade protection", contract.clause ? `${contract.clause}${contract.clauseText ? ` · ${contract.clauseText}` : ""}` : "None", "No-Move (NMC), No-Trade (NTC) or Modified No-Trade (M-NTC) clause this season"],
        ["Status at expiry", contract.status ?? "—", "Free-agent status when the deal ends"],
        ["Contract Surplus Score", score == null ? "—" : `${score} / 100`, "50 is a fair deal. Higher means he gives more value than he costs over the contract."],
      ]
    : [];
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
      <SectionLabel>Contract &amp; clause deep-dive</SectionLabel>
      {contract ? (
        <>
          <dl className="mt-3 divide-y divide-[#262B36]">
            {rows.map(([label, text, tip]) => (
              <div key={label} title={tip} className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className={`text-[#94A3B8] ${tip ? "underline decoration-dotted underline-offset-4" : ""}`}>{label}</dt>
                <dd className="text-right font-semibold text-[#F8FAFC]">{text}</dd>
              </div>
            ))}
          </dl>
          {value.kind === "contract" ? (
            <p className="mt-3 text-xs text-[#94A3B8]">
              Net surplus <span className={value.asset.value < 0 ? "text-[#EF4444]" : "text-[#10B981]"}>{signedMoney(value.asset.value)}</span> over the deal, plus re-sign rights.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-[#94A3B8]">No current NHL contract on file.</p>
      )}
    </div>
  );
}

export function InjuryTimeline() {
  return (
    <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Injury history</SectionLabel>
        <span className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">Soon</span>
      </div>
      <p className="mt-2 text-sm text-[#94A3B8]">A season-by-season timeline of games missed to injury, feeding the injury-risk part of Asset Value. Coming with the Luck &amp; Variance data.</p>
    </div>
  );
}

export function TradeHistory({ trades, playerId, name }: { trades: PlayerTrade[]; playerId: number | null; name: string }) {
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>NHL trade history · since 2005-06</SectionLabel>
        <Link href="/trade-machine/trees" className="text-xs font-semibold text-[#38BDF8] hover:underline">
          Trade Trees →
        </Link>
      </div>
      {trades.length ? (
        <ol className="mt-3 space-y-2">
          {trades.map((trade) => (
            <li key={trade.id} className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#94A3B8]">{trade.date}</span>
                {trade.from ? (
                  <Link href={teamHref(trade.from, "history")} className="inline-flex items-center gap-1 font-semibold hover:underline">
                    <TeamLogo abbr={trade.from} className="h-5 w-6" />
                    {teamsByAbbr.get(trade.from)?.short ?? trade.from}
                  </Link>
                ) : null}
                <span className="text-[#94A3B8]">→</span>
                <Link href={teamHref(trade.to, "history")} className="inline-flex items-center gap-1 font-semibold hover:underline">
                  <TeamLogo abbr={trade.to} className="h-5 w-6" />
                  {teamsByAbbr.get(trade.to)?.short ?? trade.to}
                </Link>
              </div>
              {trade.gave.length ? (
                <p className="mt-1 text-xs text-[#94A3B8]">
                  For: <span className="text-[#F8FAFC]/85">{trade.gave.join(", ")}</span>
                  {trade.got.length ? <> · with {trade.got.join(", ")}</> : null}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-[#94A3B8]">{name} has not been traded since 2005-06.</p>
      )}
      <Link
        href={playerId ? `/trade-machine?player=${playerId}` : "/trade-machine"}
        className="display mt-4 flex items-center justify-center rounded-xl bg-[#E11D48] px-4 py-2.5 text-base font-bold tracking-wide text-white transition hover:bg-[#f43f5e]"
      >
        Test in Trade Machine →
      </Link>
    </div>
  );
}
