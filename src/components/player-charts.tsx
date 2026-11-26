"use client";

import { useState } from "react";
import type { PickGroup } from "@/lib/types";

export type Peer = {
  id: number;
  name: string;
  qg: number;
  redraft: number;
  overall: number;
};

type Props = {
  id: number;
  name: string;
  year: number;
  overall: number;
  group: PickGroup;
  milestone: number;
  partial: boolean;
  active: boolean | null;
  progress: number;
  games: number;
  expected: number | null;
  seasons: number[];
  expectedPath: number[];
  qg: number;
  color: string;
  peers: Peer[];
};

const PLOT = "#0c0d12";
const GRID = "#27272a";
const INK = "#a1a1aa";
const GREEN = "#3ddc97";
const RED = "#ff4d4d";

export function PlayerCharts(props: Props) {
  const inactive = props.active === false;
  const pace = inactive ? { ...props, partial: false } : props;
  const played = lastPlayed(props.seasons);
  const seasonCount = inactive ? Math.max(played, 0) : props.seasons.length;
  const bars = {
    ...props,
    seasons: props.seasons.slice(0, seasonCount),
    partial: inactive ? false : props.partial,
  };
  if (pace.milestone <= 0 || pace.seasons.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="display text-2xl font-bold">Charts & trajectory</h2>
        <p className="mt-3 text-sm text-zinc-500">No post-draft seasons yet.</p>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="display text-2xl font-bold">Charts & trajectory</h2>
      <div className="mt-4">
        <PaceChart {...pace} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {bars.seasons.length > 0 ? <SeasonChart {...bars} /> : null}
        <ClassCurve {...props} />
      </div>
    </section>
  );
}

function PaceChart({ name, overall, milestone, partial, games, expected: seasonExpected, seasons, expectedPath, qg, group }: Props) {
  const width = 760;
  const height = 300;
  const padL = 48;
  const padR = 18;
  const padT = 16;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const played = seasons.filter((value) => value > 0).length;
  const rookie = milestone <= 1 && played <= 1 && games > 0;
  const careerActual = running(seasons);
  if (careerActual.length > 0) careerActual[careerActual.length - 1] = qg;
  const actual = rookie
    ? Array.from({ length: games + 1 }, (_, game) => (qg * game) / games)
    : [0, ...careerActual];
  const expected = rookie
    ? Array.from({ length: games + 1 }, (_, game) => ((seasonExpected ?? 0) * game) / games)
    : [0, ...(expectedPath.length > 0 ? expectedPath : careerActual.map(() => 0))];
  while (expected.length < actual.length) expected.push(expected[expected.length - 1] ?? 0);
  const yMax = niceMax(Math.max(10, ...actual, ...expected));
  const xFor = (slot: number) => padL + (actual.length <= 1 ? innerW / 2 : ((slot - 1) / (actual.length - 1)) * innerW);
  const yFor = (value: number) => padT + (1 - value / yMax) * innerH;
  const [hover, setHover] = useState<number | null>(null);
  const areas = areaBands(actual, expected, xFor, yFor);
  const labelStep = actual.length > 18 ? 4 : actual.length > 12 ? 2 : 1;

  return (
    <figure className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-200">Pace vs expectation</span>
        <span className="text-xs text-zinc-500">
          {rookie
            ? `This season, game by game, against a prorated expected slope for pick ${overall}`
            : `Cumulative Impact from the draft, ${group === "G" ? "goalie" : "skater"} curve for pick ${overall}`}
        </span>
      </figcaption>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Pace versus expectation for ${name}`}>
          <rect x={padL} y={padT} width={innerW} height={innerH} fill={PLOT} stroke={GRID} />
          {ticks(yMax).map((value) => (
            <g key={value}>
              <line x1={padL} x2={padL + innerW} y1={yFor(value)} y2={yFor(value)} stroke={GRID} />
              <text x={padL - 8} y={yFor(value) + 4} textAnchor="end" fill={INK} fontSize="11">
                {Math.round(value)}
              </text>
            </g>
          ))}
          {areas.map((area, index) => (
            <polygon key={index} points={area.points} fill={area.above ? GREEN : RED} fillOpacity="0.2" />
          ))}
          <polyline fill="none" stroke="#71717a" strokeWidth="2" strokeDasharray="5 4" points={line(expected, xFor, yFor)} />
          <polyline fill="none" stroke="#f4f4f5" strokeWidth="2.75" points={line(actual, xFor, yFor)} />
          {actual.map((value, index) => (
            <circle key={index} cx={xFor(index + 1)} cy={yFor(value)} r={hover === index ? 4.5 : 3} fill="#f4f4f5" />
          ))}
          {actual.map((_, index) => {
            const left = index === 0 ? padL : (xFor(index) + xFor(index + 1)) / 2;
            const right = index === actual.length - 1 ? padL + innerW : (xFor(index + 1) + xFor(index + 2)) / 2;
            return (
              <rect
                key={index}
                x={left}
                y={padT}
                width={Math.max(right - left, 1)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{tip(rookie ? `Game ${index}` : `D+${index}`, actual[index], expected[index])}</title>
              </rect>
            );
          })}
          {actual.map((_, index) =>
            index % labelStep === 0 || index === actual.length - 1 ? (
              <text key={index} x={xFor(index + 1)} y={height - 12} textAnchor="middle" fill={INK} fontSize="11">
                {rookie ? `G${index}` : `D+${index}`}
                {!rookie && partial && index === actual.length - 1 ? "*" : ""}
              </text>
            ) : null,
          )}
        </svg>
        {hover != null ? (
          <Tooltip
            left={(xFor(hover + 1) / width) * 100}
            text={tip(rookie ? `Game ${hover}` : `D+${hover}`, actual[hover], expected[hover])}
          />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-zinc-100" />
          Actual
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-zinc-500" />
          Expected
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: GREEN, opacity: 0.45 }} />
          Ahead
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: RED, opacity: 0.45 }} />
          Behind
        </span>
        {rookie ? <span>Actual and expected both start at zero and run through the games played so far.</span> : null}
        {!rookie && partial ? <span>The latest year is part way through the season.</span> : null}
      </div>
    </figure>
  );
}

function SeasonChart({ name, seasons, partial, progress }: Props) {
  const width = 520;
  const height = 280;
  const padL = 42;
  const padR = 12;
  const padT = 16;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yMax = niceMax(Math.max(90, ...seasons, 75));
  const yFor = (value: number) => padT + (1 - value / yMax) * innerH;
  const slot = innerW / seasons.length;
  const barW = Math.min(26, slot * 0.55);
  const [hover, setHover] = useState<number | null>(null);

  return (
    <figure className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <figcaption className="text-sm font-semibold text-zinc-200">Season-by-season Impact</figcaption>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Season Impact for ${name}`}>
          <rect x={padL} y={padT} width={innerW} height={innerH} fill={PLOT} stroke={GRID} />
          <rect
            x={padL}
            y={yFor(75)}
            width={partial ? Math.max(slot * (seasons.length - 1), 0) : innerW}
            height={Math.max(yFor(65) - yFor(75), 1)}
            fill="#f4f4f5"
            fillOpacity="0.06"
          />
          {partial ? (
            <rect
              x={padL + slot * (seasons.length - 1)}
              y={yFor(75 * progress)}
              width={slot}
              height={Math.max(yFor(65 * progress) - yFor(75 * progress), 1)}
              fill="#e8c56b"
              fillOpacity="0.16"
            />
          ) : null}
          <line
            x1={padL}
            x2={padL + (partial ? Math.max(slot * (seasons.length - 1), 0) : innerW)}
            y1={yFor(70)}
            y2={yFor(70)}
            stroke={INK}
            strokeDasharray="3 4"
          />
          {partial ? (
            <line
              x1={padL + slot * (seasons.length - 1)}
              x2={padL + innerW}
              y1={yFor(70 * progress)}
              y2={yFor(70 * progress)}
              stroke="#e8c56b"
              strokeDasharray="3 4"
            />
          ) : null}
          <text x={padL + innerW - 4} y={yFor(partial ? 75 * progress : 75) - 4} textAnchor="end" fill={INK} fontSize="10">
            {partial ? "Pace now" : "NHL pace"}
          </text>
          {ticks(yMax).map((value) => (
            <text key={value} x={padL - 8} y={yFor(value) + 4} textAnchor="end" fill={INK} fontSize="11">
              {Math.round(value)}
            </text>
          ))}
          {seasons.map((value, index) => {
            const x = padL + slot * index + (slot - barW) / 2;
            const y = yFor(value);
            const active = hover === index;
            return (
              <g key={index} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + slot * index} y={padT} width={slot} height={innerH} fill="transparent" />
                <rect x={x} y={y} width={barW} height={Math.max(padT + innerH - y, value > 0 ? 2 : 0)} fill={active ? "#ffffff" : "#d4d4d8"} />
                <text x={x + barW / 2} y={height - 12} textAnchor="middle" fill={INK} fontSize="11">
                  {seasons.length > 14 && index % 2 === 1 && index !== seasons.length - 1
                    ? ""
                    : `${index + 1}${partial && index === seasons.length - 1 ? "*" : ""}`}
                </text>
                <title>{`D+${index + 1}: ${value.toFixed(1)} Impact`}</title>
              </g>
            );
          })}
        </svg>
        {hover != null ? (
          <Tooltip left={((padL + slot * hover + slot / 2) / width) * 100} text={`D+${hover + 1}  ${seasons[hover].toFixed(1)} Impact`} />
        ) : null}
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        Each year on its own. The gray band is a full NHL season, about 75 to 82 Impact for an average regular.
        {partial ? " The gold line is that pace scaled to how far this season has gone." : ""}
      </p>
    </figure>
  );
}

function ClassCurve({ id, name, year, peers, color }: Props) {
  const width = 520;
  const height = 280;
  const padL = 44;
  const padR = 16;
  const padT = 28;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const ordered = [...peers].sort((a, b) => a.qg - b.qg || b.redraft - a.redraft);
  const max = Math.max(10, ...ordered.map((peer) => peer.qg));
  const yFor = (value: number) => padT + (1 - value / max) * innerH;
  const xFor = (index: number) => padL + (ordered.length <= 1 ? innerW / 2 : (index / (ordered.length - 1)) * innerW);
  const mineIndex = ordered.findIndex((peer) => peer.id === id);
  const mine = mineIndex >= 0 ? ordered[mineIndex] : undefined;
  const top = mine ? Math.max(1, Math.round((mine.redraft / ordered.length) * 100)) : null;
  const callout = mine && top != null ? `Top ${top}% · Redraft #${mine.redraft} of ${ordered.length}` : "";
  const points = ordered.map((peer, index) => `${xFor(index).toFixed(1)},${yFor(peer.qg).toFixed(1)}`).join(" ");
  const fill = ordered.length
    ? `${padL},${(padT + innerH).toFixed(1)} ${points} ${xFor(ordered.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)}`
    : "";
  const [hover, setHover] = useState<number | null>(null);
  const labelLeft = mineIndex >= 0 && mineIndex > ordered.length * 0.62;

  return (
    <figure className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-200">Draft class percentile</span>
        <span className="text-xs text-zinc-500">
          {year} · {ordered.length} players
        </span>
      </figcaption>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${name} on the ${year} draft class Impact curve`}>
          <rect x={padL} y={padT} width={innerW} height={innerH} fill={PLOT} stroke={GRID} />
          {ticks(max).map((value) => (
            <text key={value} x={padL - 8} y={yFor(value) + 4} textAnchor="end" fill={INK} fontSize="11">
              {Math.round(value)}
            </text>
          ))}
          <polygon points={fill} fill={color} fillOpacity="0.16" />
          <polyline fill="none" stroke="#d4d4d8" strokeWidth="2.25" points={points} />
          {ordered.map((peer, index) => (
            <rect
              key={peer.id}
              x={index === 0 ? padL : (xFor(index - 1) + xFor(index)) / 2}
              y={padT}
              width={Math.max((index === ordered.length - 1 ? padL + innerW : (xFor(index) + xFor(index + 1)) / 2) - (index === 0 ? padL : (xFor(index - 1) + xFor(index)) / 2), 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${peer.name}: ${peer.qg.toFixed(1)} Impact, redraft #${peer.redraft}`}</title>
            </rect>
          ))}
          {mine ? (
            <g>
              <line x1={xFor(mineIndex)} x2={xFor(mineIndex)} y1={yFor(mine.qg)} y2={padT + innerH} stroke={color} strokeWidth="1.5" />
              <circle cx={xFor(mineIndex)} cy={yFor(mine.qg)} r="11" fill={color} fillOpacity="0.28" />
              <circle cx={xFor(mineIndex)} cy={yFor(mine.qg)} r="5" fill={color} stroke="#f4f4f5" strokeWidth="1.5" />
              <text
                x={xFor(mineIndex) + (labelLeft ? -8 : 8)}
                y={Math.max(padT + 12, yFor(mine.qg) - 12)}
                textAnchor={labelLeft ? "end" : "start"}
                fill="#f4f4f5"
                fontSize="11"
              >
                {callout}
              </text>
            </g>
          ) : null}
          <text x={padL} y={height - 12} fill={INK} fontSize="11">
            Lowest
          </text>
          <text x={padL + innerW} y={height - 12} textAnchor="end" fill={INK} fontSize="11">
            #1
          </text>
        </svg>
        {hover != null ? (
          <Tooltip
            left={(xFor(hover) / width) * 100}
            text={`${ordered[hover].name}  ${ordered[hover].qg.toFixed(1)} QG  ·  redraft #${ordered[hover].redraft}`}
          />
        ) : null}
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {year} class from the lowest Impact total to redraft #1. {callout || `${name} is in this class.`}
      </p>
    </figure>
  );
}

function lastPlayed(seasons: number[]): number {
  let last = -1;
  seasons.forEach((value, index) => {
    if (value > 0) last = index;
  });
  return last + 1;
}

function Tooltip({ left, text }: { left: number; text: string }) {
  const align = left > 72 ? "translateX(-100%)" : left < 28 ? "translateX(0)" : "translateX(-50%)";
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 max-w-[16rem] rounded-md border border-white/15 bg-[#0B0D10] px-2.5 py-1.5 text-[11px] leading-4 tracking-wide text-zinc-100"
      style={{ left: `${left}%`, transform: align }}
    >
      {text}
    </div>
  );
}

function tip(label: string, actual: number, expected: number) {
  const score = actual - expected;
  const signed = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  return `${label}  Actual ${actual.toFixed(1)}  ·  Expected ${expected.toFixed(1)}  ·  Score ${signed}`;
}

function running(values: number[]) {
  const totals: number[] = [];
  let sum = 0;
  for (const value of values) {
    sum += value;
    totals.push(sum);
  }
  return totals;
}

function line(values: number[], xFor: (year: number) => number, yFor: (value: number) => number) {
  return values.map((value, index) => `${xFor(index + 1).toFixed(1)},${yFor(value).toFixed(1)}`).join(" ");
}

function areaBands(
  actual: number[],
  expected: number[],
  xFor: (year: number) => number,
  yFor: (value: number) => number,
) {
  const bands: { above: boolean; points: string }[] = [];
  for (let index = 0; index < actual.length - 1; index += 1) {
    const d0 = actual[index] - expected[index];
    const d1 = actual[index + 1] - expected[index + 1];
    if (d0 === 0 && d1 === 0) continue;
    if (d0 * d1 < 0) {
      const t = d0 / (d0 - d1);
      pushBand(bands, index, 0, t, d0 > 0, actual, expected, xFor, yFor);
      pushBand(bands, index, t, 1, d1 > 0, actual, expected, xFor, yFor);
    } else {
      pushBand(bands, index, 0, 1, d0 + d1 > 0, actual, expected, xFor, yFor);
    }
  }
  return bands;
}

function pushBand(
  bands: { above: boolean; points: string }[],
  index: number,
  t0: number,
  t1: number,
  above: boolean,
  actual: number[],
  expected: number[],
  xFor: (year: number) => number,
  yFor: (value: number) => number,
) {
  const x0 = xFor(index + 1) + (xFor(index + 2) - xFor(index + 1)) * t0;
  const x1 = xFor(index + 1) + (xFor(index + 2) - xFor(index + 1)) * t1;
  const a0 = actual[index] + (actual[index + 1] - actual[index]) * t0;
  const a1 = actual[index] + (actual[index + 1] - actual[index]) * t1;
  const e0 = expected[index] + (expected[index + 1] - expected[index]) * t0;
  const e1 = expected[index] + (expected[index + 1] - expected[index]) * t1;
  bands.push({
    above,
    points: `${x0.toFixed(1)},${yFor(a0).toFixed(1)} ${x1.toFixed(1)},${yFor(a1).toFixed(1)} ${x1.toFixed(1)},${yFor(e1).toFixed(1)} ${x0.toFixed(1)},${yFor(e0).toFixed(1)}`,
  });
}

function ticks(max: number) {
  return [0, 0.25, 0.5, 0.75, 1].map((step) => max * step);
}

function niceMax(value: number) {
  const padded = value * 1.08;
  const step = padded > 400 ? 100 : padded > 150 ? 50 : 25;
  return Math.ceil(padded / step) * step;
}
