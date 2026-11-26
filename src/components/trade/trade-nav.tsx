import Link from "next/link";

type Active = "mock" | "rater" | "trees" | "rankings";

/** Section switcher for the Trade Machine module: Mock Trade, Trade Rater, Trade Trees, Rankings. */
export function TradeNav({ active }: { active: Active }) {
  const base = "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition";
  const on = "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]";
  const off = "border-[#262B36] text-[#94A3B8] hover:border-[#38BDF8]/60 hover:text-white";
  return (
    <nav aria-label="Trade Machine sections" className="mb-6 flex flex-wrap items-center gap-2">
      <Link href="/trade-machine" className={`${base} ${active === "mock" ? on : off}`}>
        Mock Trade
      </Link>
      <Link href="/trade-machine/rater" className={`${base} ${active === "rater" ? on : off}`}>
        Trade Rater
      </Link>
      <Link href="/trade-machine/trees" className={`${base} ${active === "trees" ? on : off}`}>
        Trade Trees
      </Link>
      <Link href="/trade-machine/rankings" className={`${base} ${active === "rankings" ? on : off}`}>
        Franchise Rankings
      </Link>
    </nav>
  );
}
