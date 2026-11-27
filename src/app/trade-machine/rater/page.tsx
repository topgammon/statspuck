import type { Metadata } from "next";
import { TradeRater } from "@/components/trade/trade-rater";
import { ratedFrom, ratedTrades, teamOptions } from "@/lib/trade-rater";

export const metadata: Metadata = {
  title: "Trade Rater",
  description: "Every NHL trade since 2005-06, graded on what the players and picks actually became. Who really won the deal?",
  alternates: { canonical: "/trade-machine/rater" },
};

export default function TradeRaterPage() {
  const latest = ratedTrades[0]?.d ?? new Date().toISOString().slice(0, 10);
  const cutoff = new Date(latest);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return (
    <div>
      <section className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Trade Machine · Trade Rater</p>
        <h1 className="display mt-2 text-5xl leading-[0.95] font-bold sm:text-6xl">Who actually won the trade?</h1>
        <p className="mt-4 text-lg text-[#94A3B8]">
          Every NHL trade since {ratedFrom}, graded on what the players and picks became. Every piece is listed, players first, each with the Impact it produced.
        </p>
      </section>
      <div className="mt-8">
        <TradeRater trades={ratedTrades} teams={teamOptions} earlyAfter={cutoff.toISOString().slice(0, 10)} from={ratedFrom} />
      </div>
      <p className="mt-6 max-w-3xl text-xs text-[#94A3B8]">
        A player counts for the five seasons after the trade (seasons not played yet are projected from his latest full year). A pick counts for the first five seasons of the player taken with it, or the expected value
        of its slot if the draft has not happened. Grades compare what each team got with what it gave up. Trades from the last year are marked Early read because their pieces are still developing. Source: public NHL trade logs.
      </p>
    </div>
  );
}
