import type { Metadata } from "next";
import Link from "next/link";
import { FranchiseRankings } from "@/components/trade/franchise-rankings";
import { contracts } from "@/lib/cap";
import { franchiseAssets } from "@/lib/franchise-assets";

export const metadata: Metadata = {
  title: "Franchise Asset Rankings",
  description: "All 32 NHL franchises ranked by total asset value: active roster, prospect pipeline and 2027–2029 draft picks on one 0–100 scale.",
  alternates: { canonical: "/trade-machine/rankings" },
};

export default function RankingsPage() {
  return (
    <div>
      <section className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">
          <Link href="/trade-machine" className="hover:underline">
            Trade Machine
          </Link>{" "}
          · Rankings
        </p>
        <h1 className="display mt-2 text-5xl leading-[0.95] font-bold sm:text-6xl">Franchise Asset Rankings</h1>
        <p className="mt-4 text-lg text-[#94A3B8]">
          Who holds the most value? Every franchise&rsquo;s active roster, prospect pipeline and 2027–2029 draft picks, added up on the same 0–100 Asset Value scale the Trade Machine uses.
        </p>
      </section>
      <div className="mt-8">
        <FranchiseRankings rows={franchiseAssets} season={contracts.season} />
      </div>
      <p className="mt-4 max-w-3xl text-xs text-[#94A3B8]">
        Roster counts only positive Asset Value, so a bad contract never lowers a team&rsquo;s total (the Trade Machine still charges for it). Prospects are drafted players the team holds rights to who are not on an NHL
        contract, valued by draft slot and projection tier. Draft picks use each round&rsquo;s default projected tier. Contracts and picks synced {contracts.asOf}.
      </p>
    </div>
  );
}
