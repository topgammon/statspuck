import { InfoTip } from "@/components/info-tip";
import { scoreClass, signed } from "@/lib/format";
import type { RateStat, RoundStat, ScoutingReport } from "@/lib/scouting";

const TIPS = {
  bust: "Share of first-round picks that ended up graded D+ or worse. A pick only counts once his make-or-break years are over (6 seasons for skaters, 8 for goalies). Prospects are left out.",
  late: "Share of round 4–7 picks that became real hits: a positive score versus the draft slot and 100+ NHL games. Every late-round pick counts except those still wearing the prospect badge.",
  gems: "Steals are picks from #20 on that earned an A grade or beat the slot by 200+. Late bloomers were below the slot through year four and climbed above it later. Gem rate is the share of evaluated picks with either stamp.",
  best: "The position group (forwards, defense, or goalies) with the best skill-weighted score versus the draft slot.",
};

export function ScoutingPanels({ report }: { report: ScoutingReport }) {
  const scale = Math.max(40, ...report.rounds.map((bucket) => Math.abs(bucket.score ?? 0)));
  return (
    <section className="mt-10">
      <h2 className="display text-2xl font-bold">Scouting DNA</h2>
      <div className="mt-4 grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
        <RateCard
          label="1st-round bust rate"
          tip={TIPS.bust}
          align="start"
          stat={report.bust}
          league={report.leagueBust}
          empty="No evaluated first-round picks"
        />
        <RateCard
          label="Late-round hit rate"
          tip={TIPS.late}
          align="end"
          stat={report.late}
          league={report.leagueLate}
          empty="No evaluated picks in rounds 4–7"
        />
        <div className="flex h-full min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <CardLabel label="Gem finder" tip={TIPS.gems} align="start" />
          <p className="mt-3 text-sm leading-6 text-zinc-200">
            <span className="display text-3xl font-bold text-white">{report.steals}</span> Steals
            <span className="mx-1.5 text-zinc-600">·</span>
            <span className="display text-3xl font-bold text-white">{report.bloomers}</span> Late bloomers
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            {report.gemRate == null ? "No evaluated picks" : `${(report.gemRate * 100).toFixed(1)}% gem rate`}
          </p>
        </div>
        <div className="flex h-full min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <CardLabel label="Best position group" tip={TIPS.best} align="end" />
          {report.best ? (
            <div className="mt-3">
              <p className="display text-3xl leading-none font-bold">{report.best.label}</p>
              <p className={`mt-2 text-xs ${scoreClass(report.best.score)}`}>
                {signed(report.best.score)} vs the slot · {report.best.n} graded
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No graded picks yet</p>
          )}
        </div>
      </div>

      <h3 className="display mt-8 text-xl font-bold">Round by round</h3>
      <div className="mt-3 grid gap-3">
        {report.rounds.map((bucket) => (
          <RoundRow key={bucket.label} bucket={bucket} scale={scale} />
        ))}
      </div>
    </section>
  );
}

function CardLabel({ label, tip, align }: { label: string; tip: string; align: "start" | "center" | "end" }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] leading-4 tracking-[0.16em] text-zinc-500 uppercase">{label}</p>
      <InfoTip text={tip} align={align} />
    </div>
  );
}

function RateCard({
  label,
  tip,
  align,
  stat,
  league,
  empty,
}: {
  label: string;
  tip: string;
  align: "start" | "center" | "end";
  stat: RateStat;
  league: RateStat;
  empty: string;
}) {
  return (
    <div className="flex h-full min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <CardLabel label={label} tip={tip} align={align} />
      <div className="mt-3">
        <p className="display text-4xl leading-none font-bold">{stat.rate == null ? "—" : percent(stat.rate)}</p>
        <p className="mt-2 text-xs leading-4 text-zinc-500">
          {stat.n === 0 ? empty : `${stat.count} of ${stat.n}`}
          <br />
          NHL average {league.rate == null ? "—" : percent(league.rate)}
        </p>
      </div>
    </div>
  );
}

function RoundRow({ bucket, scale }: { bucket: RoundStat; scale: number }) {
  const score = bucket.score ?? 0;
  const width = bucket.score == null ? 0 : (Math.min(Math.abs(score), scale) / scale) * 50;
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)_4.5rem]">
      <div>
        <p className="text-sm font-medium">{bucket.label}</p>
        <p className="text-xs text-zinc-500">
          {bucket.hint}
          {bucket.n > 0 ? ` · ${bucket.n} graded` : ""}
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-white/[0.04]">
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
        {bucket.score != null ? (
          <span
            className="absolute inset-y-0 rounded-full"
            style={{
              width: `${width}%`,
              left: score >= 0 ? "50%" : `${50 - width}%`,
              background: score >= 0 ? "#3ddc97" : "#ff4d4d",
            }}
          />
        ) : null}
      </div>
      <div className="text-left sm:text-right">
        <p className="display text-lg leading-none font-bold">{bucket.letter ?? "—"}</p>
        <p className={`mt-1 text-xs ${scoreClass(bucket.score)}`}>{bucket.score == null ? "No graded picks" : signed(bucket.score)}</p>
      </div>
    </div>
  );
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
