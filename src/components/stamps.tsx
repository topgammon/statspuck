import type { Stamp } from "@/lib/types";

const tones: Record<Stamp, string> = {
  DEVELOPING: "border-sky-400/90 text-sky-200",
  STALLED: "border-orange-400 text-orange-300",
  BUST: "border-red-500 text-red-300",
  STEAL: "border-emerald-400 text-amber-200",
  "LATE BLOOMER": "border-fuchsia-400 text-teal-200",
  ELITE: "border-[#e8c56b] text-[#f6e3a1]",
  RETIRED: "border-[#b7bdc7] text-[#c5ccd6]",
  UNDRAFTED: "border-[#38BDF8] text-[#bae6fd]",
};

export function StampMark({ stamp }: { stamp: Stamp }) {
  return (
    <span
      className={`display inline-block border-[3px] px-1.5 py-0.5 text-[11px] leading-none font-bold tracking-[0.14em] uppercase ${tones[stamp]}`}
    >
      {stamp === "DEVELOPING" ? "PROSPECT" : stamp}
    </span>
  );
}

export function VeteranMark() {
  return (
    <span className="display inline-block border-[3px] border-amber-400/90 px-1.5 py-0.5 text-[11px] leading-none font-bold tracking-[0.14em] text-amber-200 uppercase">
      Veteran
    </span>
  );
}

export function StampRow({ stamps }: { stamps: Stamp[] }) {
  if (stamps.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {stamps.map((stamp) => (
        <StampMark key={stamp} stamp={stamp} />
      ))}
    </span>
  );
}
