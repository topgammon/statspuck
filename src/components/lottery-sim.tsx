"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useRef, useState } from "react";
import { teamLogoFile } from "@/components/team-logo";

// True-math NHL Draft Lottery (2022+ format).
//   - 14 numbered balls, 4 drawn: C(14,4) = 1,001 combinations. 1,000 are split between the 16
//     lottery seeds by the official odds; the last one is a redraw.
//   - Two draws: one for pick #1, one for pick #2.
//   - A club may move up at most 10 spots. If a seed below 11 wins a draw, it moves up 10 places
//     and the pick it skipped stays with the next club in line.
//   - A club that won two lotteries in the last five drafts cannot move up: its combinations redraw.

export type SeedTeam = { team: string; name: string; ineligible: boolean; note?: string };

const ODDS = [185, 135, 115, 95, 85, 75, 65, 60, 50, 35, 30, 25, 20, 15, 5, 5];
const MAX_JUMP = 10;

/** Every 4-ball combination of 1-14, in order. */
function allCombos(): number[][] {
  const out: number[][] = [];
  for (let a = 1; a <= 11; a++) for (let b = a + 1; b <= 12; b++) for (let c = b + 1; c <= 13; c++) for (let d = c + 1; d <= 14; d++) out.push([a, b, c, d]);
  return out;
}

const COMBOS = allCombos(); // 1,001
/** combo index -> seed index (0-15), or -1 for the redraw combination. */
const OWNER: number[] = (() => {
  const owner: number[] = [];
  ODDS.forEach((count, seed) => {
    for (let i = 0; i < count; i++) owner.push(seed);
  });
  owner.push(-1);
  return owner;
})();

function drawBalls(): number[] {
  const balls = Array.from({ length: 14 }, (_, i) => i + 1);
  const out: number[] = [];
  for (let i = 0; i < 4; i++) out.push(balls.splice(Math.floor(Math.random() * balls.length), 1)[0]);
  return out;
}

function comboIndex(balls: number[]): number {
  const key = [...balls].sort((a, b) => a - b).join("-");
  return COMBOS.findIndex((combo) => combo.join("-") === key);
}

type Draw = { balls: number[]; seed: number; redraws: number; target: number };

/** One draw: keep drawing until the combination belongs to an eligible club that has not already won. */
function runDraw(seeds: SeedTeam[], exclude: number[], pickNumber: number): Draw {
  let redraws = 0;
  for (;;) {
    const balls = drawBalls();
    const seed = OWNER[comboIndex(balls)];
    if (seed < 0 || exclude.includes(seed) || seeds[seed]?.ineligible) {
      redraws += 1;
      continue;
    }
    // Seeds are 0-based here; seed index 0 is the 1st seed.
    const target = Math.max(pickNumber, seed + 1 - MAX_JUMP);
    return { balls, seed, redraws, target };
  }
}

/** Final top-16 order (seed indexes) after both draws. */
function placeOrder(draws: Draw[], count: number): number[] {
  const slots: (number | null)[] = Array(count).fill(null);
  for (const draw of draws) {
    let at = draw.target - 1;
    while (slots[at] != null) at += 1;
    slots[at] = draw.seed;
  }
  const rest = Array.from({ length: count }, (_, i) => i).filter((seed) => !draws.some((d) => d.seed === seed));
  return slots.map((slot) => slot ?? (rest.shift() as number));
}

function simulate(seeds: SeedTeam[]): { draws: Draw[]; order: number[] } {
  const first = runDraw(seeds, [], 1);
  const second = runDraw(seeds, [first.seed], 2);
  return { draws: [first, second], order: placeOrder([first, second], seeds.length) };
}

function Logo({ abbr, className = "h-6 w-7" }: { abbr: string; className?: string }) {
  return <img src={`/logos/teams/${teamLogoFile(abbr)}.svg`} alt="" className={`${className} shrink-0 object-contain`} />;
}

export function LotterySim({ initial, allTeams }: { initial: SeedTeam[]; allTeams: { abbr: string; name: string }[] }) {
  const [seeds, setSeeds] = useState<SeedTeam[]>(initial);
  const [result, setResult] = useState<{ draws: Draw[]; order: number[] } | null>(null);
  const [revealed, setRevealed] = useState(0); // balls shown so far (0-8)
  const [spinning, setSpinning] = useState(false);
  const [odds, setOdds] = useState<{ first: number; second: number; top3: number; avg: number }[] | null>(null);
  const timers = useRef<number[]>([]);

  const names = useMemo(() => new Map(allTeams.map((t) => [t.abbr, t.name])), [allTeams]);

  function spin() {
    timers.current.forEach((t) => window.clearTimeout(t));
    const next = simulate(seeds);
    setResult(next);
    setRevealed(0);
    setSpinning(true);
    for (let i = 1; i <= 8; i++) timers.current.push(window.setTimeout(() => setRevealed(i), i * 550));
    timers.current.push(window.setTimeout(() => setSpinning(false), 8 * 550 + 200));
  }

  function runOdds() {
    const n = 1000;
    const tally = seeds.map(() => ({ first: 0, second: 0, top3: 0, sum: 0 }));
    for (let i = 0; i < n; i++) {
      const { order } = simulate(seeds);
      order.forEach((seed, slot) => {
        tally[seed].sum += slot + 1;
        if (slot === 0) tally[seed].first += 1;
        if (slot === 1) tally[seed].second += 1;
        if (slot <= 2) tally[seed].top3 += 1;
      });
    }
    setOdds(tally.map((t) => ({ first: (t.first / n) * 100, second: (t.second / n) * 100, top3: (t.top3 / n) * 100, avg: t.sum / n })));
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= seeds.length) return;
    setSeeds((current) => {
      const next = [...current];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setResult(null);
    setOdds(null);
  }

  function patch(index: number, change: Partial<SeedTeam>) {
    setSeeds((current) => current.map((s, i) => (i === index ? { ...s, ...change } : s)));
    setResult(null);
    setOdds(null);
  }

  const done = result && revealed >= 8 && !spinning;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* Seed-order editor */}
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Lottery order (worst first)</p>
          <button
            type="button"
            onClick={() => {
              setSeeds(initial);
              setResult(null);
              setOdds(null);
            }}
            className="text-xs font-semibold text-[#38BDF8] hover:underline"
          >
            Reset
          </button>
        </div>
        <ol className="mt-3 space-y-1">
          {seeds.map((seed, index) => (
            <li key={index} className="flex items-center gap-2 rounded-lg border border-[#262B36] bg-[#0B0D10]/60 px-2 py-1.5 text-sm">
              <span className="w-5 text-right text-xs font-bold text-[#94A3B8]">{index + 1}</span>
              <Logo abbr={seed.team} />
              <select
                value={seed.team}
                onChange={(event) => patch(index, { team: event.target.value, name: names.get(event.target.value) ?? event.target.value })}
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent text-sm font-semibold text-[#F8FAFC] hover:border-[#262B36] focus:border-[#38BDF8] focus:outline-none"
                aria-label={`Team in seed ${index + 1}`}
              >
                {allTeams.map((team) => (
                  <option key={team.abbr} value={team.abbr} className="bg-[#14171F]">
                    {team.name}
                  </option>
                ))}
              </select>
              <span className="w-11 text-right text-xs text-[#94A3B8] tabular-nums">{(ODDS[index] / 10).toFixed(1)}%</span>
              <label title="Won 2 lotteries in the last 5 drafts: cannot move up" className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                <input type="checkbox" checked={seed.ineligible} onChange={(event) => patch(index, { ineligible: event.target.checked })} className="accent-[#E11D48]" />
                2/5
              </label>
              <span className="flex flex-col">
                <button type="button" onClick={() => move(index, -1)} aria-label="Move up" className="text-[10px] leading-none text-[#94A3B8] hover:text-white">
                  ▲
                </button>
                <button type="button" onClick={() => move(index, 1)} aria-label="Move down" className="text-[10px] leading-none text-[#94A3B8] hover:text-white">
                  ▼
                </button>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-[#94A3B8]">
          Percentages are each seed&apos;s official odds of winning the #1 draw. Tick <b>2/5</b> for a club that won two lotteries in the last five drafts: it cannot move up.
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={spin} disabled={spinning} className="display rounded-xl bg-[#E11D48] px-5 py-2.5 text-lg font-bold tracking-wide text-white transition hover:bg-[#f43f5e] disabled:opacity-60">
            {spinning ? "Drawing…" : "Run the lottery"}
          </button>
          <button type="button" onClick={runOdds} className="display rounded-xl border border-[#38BDF8]/60 px-5 py-2.5 text-lg font-bold tracking-wide text-[#38BDF8] transition hover:bg-[#38BDF8]/10">
            1,000-sim odds
          </button>
        </div>

        {result ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {result.draws.map((draw, d) => {
              const shown = Math.max(0, Math.min(4, revealed - d * 4));
              const team = seeds[draw.seed];
              const ready = shown === 4;
              return (
                <div key={d} className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Draw {d + 1} · pick #{d + 1}</p>
                  <div className="mt-3 flex gap-2">
                    {draw.balls.map((ball, i) => (
                      <span
                        key={i}
                        className={`display flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl font-bold transition-all duration-300 ${
                          i < shown ? "scale-100 border-white bg-white text-[#0B0D10] shadow-[0_0_18px_rgba(255,255,255,0.35)]" : "scale-90 border-dashed border-[#262B36] text-transparent"
                        }`}
                      >
                        {i < shown ? ball : "?"}
                      </span>
                    ))}
                  </div>
                  {ready ? (
                    <div className="mt-3 text-sm">
                      <p className="flex items-center gap-2 font-semibold">
                        <Logo abbr={team.team} />
                        {team.name} <span className="text-[#94A3B8]">(seed {draw.seed + 1})</span>
                      </p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        Combination {[...draw.balls].sort((a, b) => a - b).join("-")}
                        {draw.redraws ? ` · ${draw.redraws} redraw${draw.redraws === 1 ? "" : "s"}` : ""}
                      </p>
                      <p className={`mt-1 text-xs font-semibold ${draw.target === d + 1 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                        {draw.target === d + 1 ? `Wins pick #${d + 1}` : `Can only jump 10 spots: moves to #${draw.target}`}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {done ? (
          <div className="mt-4 rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Final draft order</p>
            <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {result!.order.map((seed, slot) => {
                const moved = seed - slot;
                return (
                  <li key={slot} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${moved > 0 ? "bg-[#10B981]/10" : moved < 0 ? "bg-[#EF4444]/[0.06]" : "bg-[#0B0D10]/60"}`}>
                    <span className="display w-7 text-right font-bold">#{slot + 1}</span>
                    <Logo abbr={seeds[seed].team} />
                    <span className="min-w-0 flex-1 truncate">{seeds[seed].name}</span>
                    <span className={`text-xs font-bold ${moved > 0 ? "text-[#10B981]" : moved < 0 ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                      {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : "—"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        {odds ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#262B36] bg-[#14171F]">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">
                  {["Seed", "Team", "Official #1", "Sim #1", "Sim #2", "Top 3", "Avg pick"].map((h) => (
                    <th key={h} className="sticky top-0 bg-[#0B0D10] px-3 py-2 text-right font-semibold first:text-left [&:nth-child(2)]:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262B36]">
                {odds.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-[#94A3B8]">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <Logo abbr={seeds[i].team} className="h-5 w-6" />
                        {seeds[i].name}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-[#94A3B8]">{(ODDS[i] / 10).toFixed(1)}%</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{row.first.toFixed(1)}%</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{row.second.toFixed(1)}%</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{row.top3.toFixed(1)}%</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{row.avg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-[#94A3B8]">1,000 full lotteries with both draws, redraws, the 10-spot limit and eligibility. Results vary a little each run.</p>
          </div>
        ) : null}

        {!result && !odds ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#262B36] p-6 text-sm text-[#94A3B8]">
            Run a single lottery to watch the balls come out, or run 1,000 lotteries to see every club&apos;s real chances. Change the order on the left to test any standings.
          </div>
        ) : null}
      </div>
    </div>
  );
}
