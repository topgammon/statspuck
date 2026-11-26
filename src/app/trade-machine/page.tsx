import type { Metadata } from "next";
import { TradeMachine } from "@/components/trade/trade-machine";
import { SectionLabel } from "@/components/entity/bio";
import { buildTradeData } from "@/lib/trade-data";
import { formatRating } from "@/lib/rating";
import { DISCOUNT, ELC_CONTROL_YEARS, EXTENSION_YEARS, PREMIUM, pickRatings, primeWindow, TIER_LABEL, type PickTierId } from "@/lib/valuation";

export const metadata: Metadata = {
  title: "Trade Machine",
  description: "EA-style NHL trade simulator. Every player and draft pick on one 0–100 Asset Value scale, with live salary cap floor and ceiling checks and an instant trade grade.",
  alternates: { canonical: "/trade-machine" },
};

const SHOWN_TIERS: PickTierId[] = ["Top-5", "Lottery", "Mid-1st", "Late-1st", "Round 2", "Round 3", "Round 4"];

export default function TradeMachinePage() {
  const data = buildTradeData();
  const forwards = primeWindow("F");
  const defense = primeWindow("D");
  return (
    <div>
      <TradeMachine data={data} />

      <section className="mt-14 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>How Asset Value works</SectionLabel>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-[#94A3B8]">
            <li>
              <span className="font-semibold text-[#F8FAFC]">Recent form.</span> Impact per 82 games over the last two seasons, weighted toward this year, then blended with the average for his age so a small sample cannot swing it.
            </li>
            <li>
              <span className="font-semibold text-[#F8FAFC]">Age curve.</span> Built from every NHL season since 2005-06. Forwards peak at {forwards.from}–{forwards.to}, defensemen at {defense.from}–{defense.to}. Younger players project up, older players project down.
            </li>
            <li>
              <span className="font-semibold text-[#F8FAFC]">Contract surplus.</span> What his projected Impact is worth ({PREMIUM.toFixed(1)}× the market price, because cap room is scarce) minus his AAV, for every year left, discounted {Math.round((1 - DISCOUNT) * 100)}% a year. Bargains with term score high. Overpaid deals go negative.
            </li>
            <li>
              <span className="font-semibold text-[#F8FAFC]">Control.</span> Re-sign rights add value after the deal: {ELC_CONTROL_YEARS} years for entry-level players, {EXTENSION_YEARS} for everyone else, counted at a discount.
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>Draft picks on the same scale</SectionLabel>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Priced from the Draft Rater&rsquo;s expected Impact for each slot over its first seven NHL years. Picks for later drafts are worth {Math.round((1 - DISCOUNT) * 100)}% less per year out.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {SHOWN_TIERS.map((tier) => (
              <div key={tier} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm">
                <dt className="text-[#94A3B8]">{TIER_LABEL[tier]}</dt>
                <dd className="display font-bold text-[#F8FAFC]">{formatRating(pickRatings[tier])}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>Reading the scoreboard</SectionLabel>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-[#94A3B8]">
            <li>
              <span className="font-semibold text-[#F8FAFC]">Balance meter.</span> Fills toward the team receiving more Asset Value.
            </li>
            <li>
              <span className="font-semibold text-[#F8FAFC]">Grade.</span> Net value as a share of everything that moved. B means even, A and up means a clear win.
            </li>
            <li>
              <span className="font-semibold text-[#F8FAFC]">Cap check.</span> Flags any team that would end up over the cap ceiling or under the cap floor.
            </li>
            <li>
              <span className="font-semibold text-[#F8FAFC]">Retention.</span> Retained salary lowers what the other team pays, so it raises the player&rsquo;s value to them.
            </li>
          </ul>
          <p className="mt-3 text-xs text-[#94A3B8]">
            Contracts and picks from public roster tables{data.asOf ? `, synced ${data.asOf}` : ""}. Impact ratings are StatsPuck estimates, not official valuations.
          </p>
        </div>
      </section>
    </div>
  );
}
