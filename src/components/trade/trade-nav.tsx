import Link from "next/link";

type Active = "mock" | "rater" | "rankings";

/** Section switcher for the Trade Machine module: Mock Trade, Trade Rater, Trade Trees (soon), Rankings. */
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
      <span className={`${base} cursor-default border-dashed border-[#262B36] text-[#94A3B8]/70`} title="Coming soon">
        Trade Trees <span className="ml-1 text-[10px] tracking-wider uppercase">Soon</span>
      </span>
      <Link href="/trade-machine/rankings" className={`${base} ${active === "rankings" ? on : off}`}>
        Franchise Rankings
      </Link>
    </nav>
  );
}
