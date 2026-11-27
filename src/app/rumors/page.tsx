import type { Metadata } from "next";
import { RumorsFeed } from "@/components/rumors-feed";
import { rumorCardHref, rumors, rumorsAreSample, rumorsUpdated, rumorTradeHref } from "@/lib/rumors";

export const metadata: Metadata = {
  title: "Rumor & Buzz Tracker",
  description: "NHL trade, extension, buyout and offer sheet rumors with each player's live Skill rating, cap hit, trade clause and Asset Value. Test any rumor in the Trade Machine in one click.",
  alternates: { canonical: "/rumors" },
};

export default function RumorsPage() {
  const list = rumors();
  const tradeHrefs = Object.fromEntries(list.map((rumor) => [rumor.id, rumorTradeHref(rumor)]));
  const cardHrefs = Object.fromEntries(list.map((rumor) => [rumor.id, rumorCardHref(rumor)]));
  const [y, m, d] = rumorsUpdated.split("-").map(Number);
  const updated = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <div>
      <section className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Rumor & Buzz Tracker</p>
        <h1 className="display mt-2 text-5xl leading-[0.95] font-bold sm:text-6xl">Hear a rumor? Run the numbers.</h1>
        <p className="mt-4 text-lg text-[#94A3B8]">
          Trade block names, extension talks, buyout candidates and offer sheet targets, each with the player&rsquo;s live Skill rating, cap hit, trade clause and Asset Value. One click
          tests the deal in the Trade Machine.
        </p>
        <p className="mt-2 text-xs text-[#94A3B8]">Updated {updated}</p>
      </section>

      {rumorsAreSample ? (
        <div className="mt-6 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] px-4 py-3 text-sm text-[#FCD34D]">
          <span className="font-semibold">Sample feed.</span> These entries use real players, teams and contracts but are illustrative examples, not sourced reports. Sourced rumors with
          links are coming.
        </div>
      ) : null}

      <div className="mt-6">
        <RumorsFeed rumors={list} tradeHrefs={tradeHrefs} cardHrefs={cardHrefs} />
      </div>
    </div>
  );
}
