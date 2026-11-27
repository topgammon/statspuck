import Link from "next/link";
import { SectionLabel } from "@/components/entity/bio";
import { lotteryLuck, teamLuck } from "@/lib/lottery";
import { playerHref } from "@/lib/routes";

/** Compact "Draft Lottery Luck" summary for a team's Draft & Dev tab. */
export function LotteryLuckCard({ abbr }: { abbr: string }) {
  const luck = teamLuck(abbr);
  if (!luck) return null;
  const tone = (value: number) => (value > 0 ? "text-[#10B981]" : value < 0 ? "text-[#EF4444]" : "text-[#F8FAFC]");
  return (
    <div className="rounded-2xl border border-[#F59E0B]/30 bg-[#14171F] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Draft lottery luck · since 2006</SectionLabel>
        <span className="flex gap-3 text-xs font-semibold">
          <Link href="/leaderboards?board=lottery" className="text-[#38BDF8] hover:underline">
            All 32 teams →
          </Link>
          <Link href="/lottery" className="text-[#38BDF8] hover:underline">
            Simulator →
          </Link>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Rank</dt>
          <dd className="display text-2xl font-bold">
            #{luck.rank} <span className="text-sm font-normal text-[#94A3B8]">of {lotteryLuck.length}</span>
          </dd>
        </div>
        <div title="Spots gained (+) or lost (-) versus the pre-lottery seed, across every lottery">
          <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Net spots</dt>
          <dd className={`display text-2xl font-bold ${tone(luck.netSpots)}`}>
            {luck.netSpots > 0 ? "+" : ""}
            {luck.netSpots}
          </dd>
        </div>
        <div title="Expected 7-year Impact of the slots it got minus the slots it had before the lottery">
          <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Impact luck</dt>
          <dd className={`display text-2xl font-bold ${tone(luck.netImpact)}`}>
            {luck.netImpact > 0 ? "+" : ""}
            {luck.netImpact.toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Biggest jump</dt>
          <dd className="text-sm font-semibold">
            {luck.biggest ? (
              <>
                {luck.biggest.year}: seed {luck.biggest.seed} → #{luck.biggest.overall}
                {luck.biggest.name ? (
                  <span className="block text-xs font-normal text-[#94A3B8]">
                    {luck.biggest.routeId ? (
                      <Link href={playerHref(luck.biggest.routeId)} className="hover:text-white">
                        {luck.biggest.name}
                      </Link>
                    ) : (
                      luck.biggest.name
                    )}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-[#94A3B8]">Never moved up</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[#94A3B8]">
        {luck.lotteries} lotteries · {luck.jumpsToFirst} jump{luck.jumpsToFirst === 1 ? "" : "s"} to #1 · {luck.jumpsTop3} into the top 3 · pushed down {luck.drops} time{luck.drops === 1 ? "" : "s"}.
        Draft grades above judge scouting; this is the part the ping-pong balls decided.
      </p>
    </div>
  );
}
