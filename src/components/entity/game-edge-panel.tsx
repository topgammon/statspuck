import { ComingSoonStamp } from "@/components/entity/hero-box";

// Coming-soon preview of the Game Edge tactical modules. Every number on it is a
// placeholder shape, clearly marked, so nobody mistakes the mockup for real data.

const MODULES = [
  { title: "Line Chemistry", body: "Which linemates lift his Impact, and which pairings drag it down.", shape: "bars" },
  { title: "Goal-Type Breakdowns", body: "Rebounds, rush chances, tips and cross-ice goals from play-by-play.", shape: "donut" },
  { title: "Spatial Heatmaps", body: "Where his shots, goals and chances come from on the ice.", shape: "rink" },
  { title: "Lineup Deployment", body: "Offensive-zone starts, quality of competition, power-play units.", shape: "bars" },
  { title: "Clutch Splits", body: "Late-and-close, overtime and playoff performance.", shape: "line" },
] as const;

export function GameEdgePanel({ subject }: { subject: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[#38BDF8]/40 bg-[#14171F]/70 p-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#38BDF8] uppercase">Game Edge · Preview</p>
          <h2 className="display mt-1 text-2xl font-bold">
            Tactical scouting for <span className="text-[#94A3B8]">{subject}</span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#94A3B8]">Built from NHL play-by-play coordinates and shift data. The layout below is a mockup of what is coming; no numbers are live yet.</p>
        </div>
        <ComingSoonStamp />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((item) => (
          <div key={item.title} className="relative overflow-hidden rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="display text-lg font-bold">{item.title}</p>
              <span className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">Soon</span>
            </div>
            <p className="mt-1 text-sm text-[#94A3B8]">{item.body}</p>
            <div className="mt-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 opacity-60" aria-hidden>
              <Shape kind={item.shape} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Shape({ kind }: { kind: (typeof MODULES)[number]["shape"] }) {
  if (kind === "rink") {
    return (
      <svg viewBox="0 0 200 90" className="h-20 w-full">
        <rect x="2" y="2" width="196" height="86" rx="28" fill="none" stroke="#262B36" strokeWidth="2" />
        <line x1="100" y1="2" x2="100" y2="88" stroke="#E11D48" strokeOpacity="0.4" strokeWidth="2" />
        <circle cx="100" cy="45" r="14" fill="none" stroke="#38BDF8" strokeOpacity="0.4" />
        {[
          [160, 40, 16],
          [170, 52, 10],
          [150, 30, 8],
          [176, 44, 6],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#E11D48" fillOpacity="0.25" />
        ))}
      </svg>
    );
  }
  if (kind === "donut") {
    return (
      <svg viewBox="0 0 200 90" className="h-20 w-full">
        <circle cx="100" cy="45" r="32" fill="none" stroke="#262B36" strokeWidth="14" />
        <circle cx="100" cy="45" r="32" fill="none" stroke="#38BDF8" strokeOpacity="0.6" strokeWidth="14" strokeDasharray="70 201" />
        <circle cx="100" cy="45" r="32" fill="none" stroke="#E11D48" strokeOpacity="0.6" strokeWidth="14" strokeDasharray="45 201" strokeDashoffset="-70" />
      </svg>
    );
  }
  if (kind === "line") {
    return (
      <svg viewBox="0 0 200 90" className="h-20 w-full">
        <path d="M4 70 L40 52 L76 60 L112 30 L148 40 L196 18" fill="none" stroke="#38BDF8" strokeOpacity="0.6" strokeWidth="3" />
        <line x1="4" y1="80" x2="196" y2="80" stroke="#262B36" />
      </svg>
    );
  }
  return (
    <div className="flex h-20 items-end gap-2">
      {[60, 85, 40, 70, 30, 55].map((h, i) => (
        <span key={i} className="flex-1 rounded-t bg-[#38BDF8]/40" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
