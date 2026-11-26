import type { Metadata } from "next";
import { TradeNav } from "@/components/trade/trade-nav";
import { TradeTrees } from "@/components/trade/trade-trees";
import { teamOptions } from "@/lib/trade-rater";
import { treeCallouts, treeList, treeSteps } from "@/lib/trade-trees";

export const metadata: Metadata = {
  title: "Trade Trees",
  description: "Follow one trade through everything it became. NHL trade trees since 2005-06: the longest chains, the biggest trees, and the players still on rosters today.",
  alternates: { canonical: "/trade-machine/trees" },
};

export default function TradeTreesPage() {
  return (
    <div>
      <TradeNav active="trees" />
      <section className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Trade Machine · Trade Trees</p>
        <h1 className="display mt-2 text-5xl leading-[0.95] font-bold sm:text-6xl">One trade. Everything it became.</h1>
        <p className="mt-4 text-lg text-[#94A3B8]">
          When a team trades away something it got in an earlier trade, the chain keeps growing. Pick a tree to follow a single deal through every trade that came after it, down to the
          players still on the roster today.
        </p>
      </section>
      <div className="mt-8">
        <TradeTrees trees={treeList} steps={treeSteps} teams={teamOptions} callouts={treeCallouts()} />
      </div>
      <p className="mt-6 max-w-3xl text-xs text-[#94A3B8]">
        Trees follow one team: its first trade of something it already owned, then every later trade of what came back. A player drafted with a pick it got in a trade counts as part of the tree. Trades from 2005-06 on (2005-09 from
        Wikipedia, 2009 on from public NHL trade logs). Active means the player is on that team&rsquo;s roster now; the number is his Asset Value.
      </p>
    </div>
  );
}
