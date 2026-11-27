// SVG hockey rinks in NHL coordinates (x -100..100 ft, y -42.5..42.5 ft).
// FullRink: heat cells across the whole ice (Ref Watch call heatmap).
// HalfRink: the attacking half (x 25..100) for shot maps and goalie zones.

function Markings({ half = false }: { half?: boolean }) {
  const x0 = half ? 25 : -100;
  return (
    <g fill="none" strokeWidth={0.6}>
      {half ? <path d="M25 -42.5 H72 A28 28 0 0 1 100 -14.5 V14.5 A28 28 0 0 1 72 42.5 H25" stroke="#334155" /> : <rect x={x0} y={-42.5} width={100 - x0} height={85} rx={28} stroke="#334155" />}
      {!half ? <line x1={0} y1={-42.5} x2={0} y2={42.5} stroke="#E11D48" strokeOpacity={0.6} strokeWidth={1} /> : null}
      {[25, ...(half ? [] : [-25])].map((x) => (
        <line key={x} x1={x} y1={-42.5} x2={x} y2={42.5} stroke="#38BDF8" strokeOpacity={0.55} strokeWidth={1} />
      ))}
      {[89, ...(half ? [] : [-89])].map((x) => (
        <g key={x}>
          <line x1={x} y1={-40} x2={x} y2={40} stroke="#E11D48" strokeOpacity={0.5} />
          <path d={x > 0 ? `M${x} -4 A6 6 0 0 0 ${x} 4` : `M${x} -4 A6 6 0 0 1 ${x} 4`} stroke="#38BDF8" strokeOpacity={0.6} />
        </g>
      ))}
      {[69, ...(half ? [] : [-69])].flatMap((x) =>
        [22, -22].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r={15} stroke="#E11D48" strokeOpacity={0.35} />),
      )}
      {!half ? <circle cx={0} cy={0} r={15} stroke="#38BDF8" strokeOpacity={0.4} /> : null}
    </g>
  );
}

export function FullRink({ cells, xBins = 20, yBins = 9, label }: { cells: [number, number][]; xBins?: number; yBins?: number; label: string }) {
  const max = Math.max(1, ...cells.map((c) => c[1]));
  const w = 200 / xBins;
  const h = 85 / yBins;
  return (
    <svg viewBox="-102 -44.5 204 89" className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        <clipPath id="full-rink-clip">
          <rect x={-100} y={-42.5} width={200} height={85} rx={28} />
        </clipPath>
      </defs>
      <rect x={-100} y={-42.5} width={200} height={85} rx={28} fill="#0B0D10" />
      <g clipPath="url(#full-rink-clip)">
        {cells.map(([cell, n]) => {
          const gx = cell % xBins;
          const gy = Math.floor(cell / xBins);
          return <rect key={cell} x={-100 + gx * w} y={42.5 - (gy + 1) * h} width={w} height={h} fill="#E11D48" fillOpacity={0.04 + 0.8 * (n / max) ** 1.3} />;
        })}
      </g>
      <Markings />
    </svg>
  );
}

/** Attacking half. cells = [cell, shots, goals] on a 15 x 17 grid of 5-ft squares from x = 25. */
export function HalfRinkShots({ cells, label }: { cells: [number, number, number][]; label: string }) {
  const max = Math.max(1, ...cells.map((c) => c[1]));
  return (
    <svg viewBox="23 -44.5 79 89" className="h-auto w-full" role="img" aria-label={label}>
      <rect x={25} y={-42.5} width={75} height={85} fill="#0B0D10" />
      {cells.map(([cell, shots, goals]) => {
        const gx = cell % 15;
        const gy = Math.floor(cell / 15);
        return (
          <g key={cell}>
            <rect x={25 + gx * 5} y={42.5 - (gy + 1) * 5} width={5} height={5} fill="#38BDF8" fillOpacity={0.06 + 0.7 * (shots / max)} />
            {goals >= 0.75 ? <circle cx={27.5 + gx * 5} cy={42.5 - gy * 5 - 2.5} r={Math.min(2.2, 0.8 + goals * 0.35)} fill="#E11D48" /> : null}
          </g>
        );
      })}
      <Markings half />
    </svg>
  );
}

// Plain rectangles, clipped to the rounded half-rink outline.
const ZONE_SHAPES: Record<string, { d: string; lx: number; ly: number }> = {
  point: { d: "M25 -42.5 H54 V42.5 H25 Z", lx: 39.5, ly: 0 },
  highslot: { d: "M54 -10 H69 V10 H54 Z", lx: 61.5, ly: 0 },
  netfront: { d: "M69 -10 H100 V10 H69 Z", lx: 80, ly: 0 },
  leftcircle: { d: "M54 10 H100 V42.5 H54 Z", lx: 72, ly: 25 },
  rightcircle: { d: "M54 -10 H100 V-42.5 H54 Z", lx: 72, ly: -25 },
};

const HALF_OUTLINE = "M25 -42.5 H72 A28 28 0 0 1 100 -14.5 V14.5 A28 28 0 0 1 72 42.5 H25 Z";

/**
 * Goalie / zone map: each ice zone coloured by a value vs league.
 * values: zone -> {delta (e.g. save % above league, in points), text}
 */
export function HalfRinkZones({ values, label }: { values: Record<string, { delta: number | null; text: string }>; label: string }) {
  return (
    <svg viewBox="23 -44.5 79 89" className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        <clipPath id="half-rink-zones">
          <path d={HALF_OUTLINE} />
        </clipPath>
      </defs>
      <path d={HALF_OUTLINE} fill="#0B0D10" />
      <g clipPath="url(#half-rink-zones)">
      {Object.entries(ZONE_SHAPES).map(([zone, shape]) => {
        const v = values[zone];
        const delta = v?.delta ?? null;
        const color = delta == null ? "#334155" : delta >= 0 ? "#10B981" : "#EF4444";
        const strength = delta == null ? 0.1 : Math.min(0.75, 0.15 + Math.abs(delta) / 6);
        // SVG y is flipped vs ice y: we draw +y (shooter's left) at the top.
        return (
          <g key={zone} transform="scale(1,-1)">
            <path d={shape.d} fill={color} fillOpacity={strength} stroke="#0B0D10" strokeWidth={0.8} />
            <text x={shape.lx} y={-shape.ly} transform="scale(1,-1)" textAnchor="middle" dominantBaseline="middle" fontSize={4.2} fontWeight={700} fill="#F8FAFC">
              {v?.text ?? "–"}
            </text>
          </g>
        );
      })}
      </g>
      <Markings half />
    </svg>
  );
}
