import type { CurveSet } from "@/lib/types";

const bands = [
  { letter: "A+", from: 97, tone: "#3ddc97" },
  { letter: "A", from: 90, tone: "#5ee4a8" },
  { letter: "A-", from: 82, tone: "#86efac" },
  { letter: "B+", from: 72, tone: "#7dd3fc" },
  { letter: "B", from: 60, tone: "#93c5fd" },
  { letter: "B-", from: 48, tone: "#a5b4fc" },
  { letter: "C+", from: 38, tone: "#d4d4d8" },
  { letter: "C", from: 28, tone: "#a1a1aa" },
  { letter: "C-", from: 18, tone: "#fb923c" },
  { letter: "D+", from: 10, tone: "#f87171" },
  { letter: "D", from: 4, tone: "#ef4444" },
  { letter: "D-", from: 0, tone: "#dc2626" },
];

export function ExpectedChart({ curves }: { curves: CurveSet }) {
  const width = 720;
  const height = 320;
  const padL = 46;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const series = [
    { key: "1", label: "Year 1", color: "#38bdf8", dash: "3 5" },
    { key: "4", label: "Year 4", color: "#f87171", dash: "6 5" },
    { key: "8", label: "Year 8", color: "#f4f4f5", dash: "0" },
    ...(curves.skater["16"] ? [{ key: "16", label: "Year 16", color: "#e8c56b", dash: "0" }] : []),
  ];
  const maxPick = curves.maxPick;
  const values = series.flatMap((item) => curves.skater[item.key] ?? []);
  const yMax = Math.max(40, ...values);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xFor = (pick: number) => padL + ((pick - 1) / Math.max(maxPick - 1, 1)) * innerW;
  const yFor = (value: number) => padT + (1 - value / yMax) * innerH;

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Expected quality games by draft slot at year 1, year 4, year 8, and year 16">
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="#0c0d12" stroke="#27272a" />
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const value = yMax * step;
          const y = yFor(value);
          return (
            <g key={step}>
              <line x1={padL} x2={padL + innerW} y1={y} y2={y} stroke="#27272a" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#a1a1aa" fontSize="11">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        {series.map((item) => {
          const points = (curves.skater[item.key] ?? [])
            .map((value, index) => `${xFor(index + 1).toFixed(1)},${yFor(value).toFixed(1)}`)
            .join(" ");
          return (
            <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="2.4" strokeDasharray={item.dash} points={points} />
          );
        })}
        {[1, 32, 64, 128, maxPick].map((pick) => (
          <text key={pick} x={xFor(pick)} y={height - 12} textAnchor="middle" fill="#a1a1aa" fontSize="11">
            {pick}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-400">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-6" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span>Pick number, left to right. Skaters. Goalies use their own curve, and both keep going for the whole career.</span>
      </figcaption>
    </figure>
  );
}

export function QualityScale() {
  const rows = [
    { label: "Fourth-liner", per: 0.6, note: "Limited ice, quiet night" },
    { label: "Everyday NHLer", per: 1.0, note: "A regular shift" },
    { label: "First-line star", per: 1.4, note: "Heavy minutes, real production" },
  ];
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-2xl border border-white/10 p-4">
          <p className="text-sm text-zinc-400">{row.label}</p>
          <p className="display mt-2 text-4xl font-bold">{row.per.toFixed(1)}</p>
          <p className="text-sm text-zinc-500">quality games per game played</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#E11D48]" style={{ width: `${(row.per / 1.4) * 100}%` }} />
          </div>
          <p className="mt-3 text-sm text-zinc-400">{row.note}. Ten games is about {(row.per * 10).toFixed(0)} quality games.</p>
        </div>
      ))}
    </div>
  );
}

export function WindowTimeline() {
  const marks = [
    { label: "Draft", at: 0 },
    { label: "Year 3", at: 30 },
    { label: "Year 5", at: 50 },
    { label: "Year 8", at: 80 },
    { label: "Year 10", at: 100 },
  ];
  return (
    <div className="mt-4">
      <div className="relative h-3 rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 w-[30%] rounded-full bg-sky-400/70" />
        <div className="absolute inset-y-0 left-[30%] w-[20%] rounded-full bg-sky-400/35" />
      </div>
      <div className="relative mt-2 h-8 text-xs text-zinc-400">
        {marks.map((mark) => (
          <span key={mark.label} className="absolute -translate-x-1/2" style={{ left: `${mark.at}%` }}>
            {mark.label}
          </span>
        ))}
      </div>
      <p className="text-sm text-zinc-400">
        The blue stretch is the skater window, through year 3. Goalies stay in it through year 5. Hit 25 quality games and the window ends early.
      </p>
    </div>
  );
}

export function LetterScale() {
  const widths = bands.map((band, index) => {
    const ceiling = index === 0 ? 100 : bands[index - 1].from;
    return { ...band, width: ceiling - band.from };
  });
  return (
    <div className="mt-4">
      <div className="flex h-10 overflow-hidden rounded-lg">
        {widths.map((band) => (
          <div
            key={band.letter}
            className="flex items-center justify-center text-[10px] font-bold text-black"
            style={{ width: `${band.width}%`, background: band.tone }}
            title={`${band.letter}, from the ${band.from}th percentile`}
          >
            {band.letter}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-zinc-500">A+ starts at the 97th percentile. D- is the bottom 4 percent. The same cuts grade teams, GMs, and draft classes.</p>
    </div>
  );
}
