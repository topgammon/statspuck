import { money } from "@/lib/cap";

// Horizontal Salary Cap Bar with both limits marked: the Floor (Lower Limit) and the Ceiling (Upper Limit).
// Pure markup, so it works on server pages (team and GM profiles) and in the interactive Trade Machine.

export function CapMeter({
  used,
  ceiling,
  floor,
  before,
  label = "Salary cap",
  compact = false,
}: {
  /** Cap used (after any trade). */
  used: number;
  ceiling: number;
  floor: number;
  /** Cap used before a trade. Shows a tick and a coloured change segment. */
  before?: number;
  label?: string;
  compact?: boolean;
}) {
  const max = ceiling * 1.08;
  const at = (value: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  const over = used > ceiling;
  const under = used < floor;
  const tone = over ? "#EF4444" : under ? "#F97316" : "#38BDF8";
  const space = ceiling - used;
  const aboveFloor = used - floor;
  const changed = before != null && Math.abs(used - before) > 1;
  const lo = Math.min(used, before ?? used);
  const hi = Math.max(used, before ?? used);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">{label}</p>
        <span className={`display font-bold ${compact ? "text-base" : "text-lg"} ${over ? "text-[#EF4444]" : under ? "text-[#F97316]" : "text-[#F8FAFC]"}`}>
          {money(used)}
        </span>
      </div>

      <div className="relative mt-5 mb-6">
        <div
          className="relative h-3.5 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]"
          role="img"
          aria-label={`${money(used)} used. Floor ${money(floor)}, ceiling ${money(ceiling)}. ${space >= 0 ? `${money(space)} of space` : `${money(-space)} over the ceiling`}.`}
        >
          <div className="absolute inset-y-0 left-0" style={{ width: at(Math.min(used, ceiling)), background: tone, opacity: changed ? 0.55 : 1 }} />
          {over ? <div className="absolute inset-y-0" style={{ left: at(ceiling), width: `calc(${at(used)} - ${at(ceiling)})`, background: "#EF4444" }} /> : null}
          {changed ? (
            <div
              className="absolute inset-y-0"
              style={{
                left: at(lo),
                width: `calc(${at(hi)} - ${at(lo)})`,
                background: used > (before ?? used) ? "#10B981" : "#E11D48",
                backgroundImage: "repeating-linear-gradient(135deg, rgba(0,0,0,0.25) 0 3px, transparent 3px 6px)",
              }}
            />
          ) : null}
        </div>

        <Marker left={at(floor)} tone="#F97316" name="Lower Limit" value={money(floor)} side="above" />
        <Marker left={at(ceiling)} tone="#E11D48" name="Upper Limit" value={money(ceiling)} side="below" />
      </div>

      <dl className={`grid gap-2 text-center ${compact ? "grid-cols-3" : "grid-cols-3"}`}>
        <Fact label="Used cap" value={money(used)} tone={over ? "text-[#EF4444]" : under ? "text-[#F97316]" : "text-[#38BDF8]"} />
        <Fact label={over ? "Over ceiling" : "Cap space"} value={money(Math.abs(space))} tone={over ? "text-[#EF4444]" : "text-[#10B981]"} />
        <Fact
          label={under ? "Below floor" : "Above floor"}
          value={money(Math.abs(aboveFloor))}
          tone={under ? "text-[#F97316]" : "text-[#F8FAFC]"}
        />
      </dl>
    </div>
  );
}

/** A limit line. One label sits above the bar and the other below, so they never collide on narrow cards. */
function Marker({ left, tone, name, value, side }: { left: string; tone: string; name: string; value: string; side: "above" | "below" }) {
  return (
    <div className="pointer-events-none absolute top-[-6px] bottom-[-6px]" style={{ left }}>
      <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full" style={{ background: tone }} />
      <div
        className={`absolute right-[-3px] text-[9px] font-bold tracking-wider whitespace-nowrap uppercase ${side === "above" ? "top-[-16px]" : "bottom-[-18px]"}`}
        style={{ color: tone }}
      >
        {name} <span className="font-semibold text-[#94A3B8] normal-case">{value}</span>
      </div>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <dt className="text-[9px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</dt>
      <dd className={`display text-sm leading-tight font-bold ${tone}`}>{value}</dd>
    </div>
  );
}
