"use client";

import { useEffect, useMemo, useState } from "react";
import { CapMeter } from "@/components/cap-meter";
import { ArchetypePill, ProspectTierPill } from "@/components/entity/bio";
import { PlayerHeadshot } from "@/components/player-headshot";
import { ShareLauncher } from "@/components/share-modal";
import type { TradeSide } from "@/components/share-cards";
import { TeamLogo } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import { formatRating, ratingFill, ratingTone, toRating } from "@/lib/rating";
import type { PickTierId } from "@/lib/valuation";
import type { TradeData, TradePick, TradePlayer, TradeTeam } from "@/lib/trade-data";
import { playerHref } from "@/lib/routes";

// Interactive Trade Machine. Everything is computed in the browser from the data the page ships:
// Asset Value ratings, cap totals, floor and ceiling checks, and the verdict.

type Item = {
  key: string;
  kind: "player" | "pick";
  id: string;
  from: string;
  to: string;
  /** Share of salary the sending team keeps, 0 to 0.5. Players only. */
  retain: number;
  tier?: PickTierId;
};

const money = (value: number) => `$${(Math.abs(value) / 1_000_000).toFixed(2)}M`;
const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${money(value)}`;

function gradeFor(margin: number): string {
  if (margin >= 0.3) return "A+";
  if (margin >= 0.2) return "A";
  if (margin >= 0.12) return "A-";
  if (margin >= 0.06) return "B+";
  if (margin >= -0.06) return "B";
  if (margin >= -0.12) return "B-";
  if (margin >= -0.2) return "C";
  if (margin >= -0.3) return "D";
  return "F";
}

function gradeTone(grade: string): string {
  const first = grade.charAt(0);
  if (first === "A") return "text-[#F59E0B]";
  if (first === "B") return "text-[#10B981]";
  if (first === "C") return "text-[#F8FAFC]";
  return "text-[#EF4444]";
}

type Row = { label: string; sub: string; rating: number; color: string };

type Calc = {
  team: TradeTeam;
  incoming: number;
  outgoing: number;
  net: number;
  capAfter: number;
  capDelta: number;
  grade: string;
  margin: number;
  rowsIn: Row[];
  issues: string[];
};

export function TradeMachine({ data }: { data: TradeData }) {
  const teamsByAbbr = useMemo(() => new Map(data.teams.map((team) => [team.abbr, team])), [data.teams]);
  const playersById = useMemo(() => new Map(data.players.map((player) => [String(player.id), player])), [data.players]);
  const picksByKey = useMemo(() => new Map(data.picks.map((pick) => [pickKey(pick), pick])), [data.picks]);
  const sortedTeams = useMemo(() => [...data.teams].sort((a, b) => a.name.localeCompare(b.name)), [data.teams]);

  const [slots, setSlots] = useState<string[]>(() => [sortedTeams[0].abbr, sortedTeams[1].abbr]);
  const [items, setItems] = useState<Item[]>([]);

  // ?player=ID pre-loads that player on the left side, sent to the next team.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("player");
    const player = id ? playersById.get(id) : null;
    if (!player) return;
    const other = sortedTeams.find((team) => team.abbr !== player.team)?.abbr;
    if (!other) return;
    // Read from the address bar after the page loads, so server and browser render the same first frame.
    const timer = window.setTimeout(() => {
      setSlots([player.team, other]);
      setItems([{ key: `p:${player.id}`, kind: "player", id: String(player.id), from: player.team, to: other, retain: 0 }]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [playersById, sortedTeams]);

  const mode = slots.length;
  const rate = (usd: number) => toRating(usd, data.scale.uref, data.scale.exponent);
  const playerRating = (player: TradePlayer, retain: number) => rate(player.usd + retain * player.aavPv);
  const pickRating = (pick: TradePick, tier: PickTierId) => rate(data.pickUsd[tier] * Math.pow(data.discount, Math.max(0, pick.year - data.firstPickYear)));

  function itemValue(item: Item): number {
    if (item.kind === "player") {
      const player = playersById.get(item.id);
      return player ? playerRating(player, item.retain) : 0;
    }
    const pick = picksByKey.get(item.id);
    return pick ? pickRating(pick, item.tier ?? pick.defaultTier) : 0;
  }

  function setSlot(index: number, abbr: string) {
    const old = slots[index];
    if (old === abbr) return;
    setSlots((current) => current.map((value, i) => (i === index ? abbr : value)));
    setItems((current) => current.filter((item) => item.from !== old && item.to !== old));
  }

  function setMode(next: 2 | 3) {
    if (next === mode) return;
    if (next === 3) {
      const extra = sortedTeams.find((team) => !slots.includes(team.abbr))?.abbr;
      if (extra) setSlots([...slots, extra]);
    } else {
      const dropped = slots[2];
      setSlots(slots.slice(0, 2));
      setItems((current) => current.filter((item) => item.from !== dropped && item.to !== dropped));
    }
  }

  function otherTeam(from: string): string {
    return slots.find((abbr) => abbr !== from) ?? from;
  }

  function toggle(kind: "player" | "pick", id: string, from: string, tier?: PickTierId) {
    const key = kind === "player" ? `p:${id}` : id;
    setItems((current) => {
      if (current.some((item) => item.key === key)) return current.filter((item) => item.key !== key);
      return [...current, { key, kind, id, from, to: otherTeam(from), retain: 0, tier }];
    });
  }

  function patch(key: string, change: Partial<Item>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  const calcs = useMemo<Calc[]>(() => {
    const values = items.map((item) => ({ item, value: itemValue(item) }));
    const moved = values.reduce((sum, row) => sum + Math.abs(row.value), 0);
    const size = Math.max(12, moved / 2);
    return slots.map((abbr) => {
      const team = teamsByAbbr.get(abbr)!;
      let incoming = 0;
      let outgoing = 0;
      let capDelta = 0;
      const rowsIn: Row[] = [];
      for (const { item, value } of values) {
        const retained = item.kind === "player" ? item.retain : 0;
        const player = item.kind === "player" ? playersById.get(item.id) : null;
        const hit = player ? player.aav * (1 - retained) : 0;
        if (item.to === abbr) {
          incoming += value;
          capDelta += hit;
          rowsIn.push(rowFor(item, value));
        }
        if (item.from === abbr) {
          outgoing += value;
          capDelta -= hit;
        }
      }
      const net = incoming - outgoing;
      const capAfter = team.capHit + capDelta;
      const issues: string[] = [];
      if (items.length) {
        if (capAfter > data.ceiling) issues.push(`${team.short} would be ${money(capAfter - data.ceiling)} over the cap ceiling`);
        if (capAfter < data.floor) issues.push(`${team.short} would be ${money(data.floor - capAfter)} under the cap floor`);
      }
      const margin = net / size;
      return { team, incoming, outgoing, net, capAfter, capDelta, grade: gradeFor(margin), margin, rowsIn, issues };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, slots, data]);

  function rowFor(item: Item, value: number): Row {
    if (item.kind === "player") {
      const player = playersById.get(item.id)!;
      return { label: player.name, sub: player.pos, rating: Math.round(value), color: ratingFill(value) };
    }
    const pick = picksByKey.get(item.id)!;
    const tier = item.tier ?? pick.defaultTier;
    return { label: `${pick.year} Round ${pick.round}`, sub: data.pickLabel[tier], rating: Math.round(value), color: ratingFill(value) };
  }

  const empty = items.length === 0;
  const issues = calcs.flatMap((calc) => calc.issues);
  const best = [...calcs].sort((a, b) => b.margin - a.margin)[0];
  const fair = !empty && Math.abs(best.margin) < 0.06 && calcs.every((calc) => Math.abs(calc.margin) < 0.06);
  const degree = best.margin >= 0.25 ? "Lopsided win" : best.margin >= 0.12 ? "Clear win" : "Narrow win";
  const headline = empty ? "Build a trade" : fair ? "Fair trade" : `${best.team.short} win this trade`;
  const sub = empty
    ? "Add players or picks from either roster."
    : fair
      ? "Both sides come out about even."
      : `${degree} · ${best.net >= 0 ? "+" : "−"}${Math.abs(Math.round(best.net))} Asset Value net`;

  const shareSides: TradeSide[] = calcs.map((calc) => ({
    abbr: calc.team.abbr,
    name: calc.team.name,
    color: calc.team.color,
    grade: calc.grade,
    total: Math.round(calc.incoming),
    capDelta: calc.capDelta,
    receives: calc.rowsIn,
  }));

  return (
    <div>
      <section className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Trade Machine</p>
        <h1 className="display mt-2 text-5xl leading-[0.95] font-bold sm:text-6xl">Make the trade. See who wins.</h1>
        <p className="mt-4 text-lg text-[#94A3B8]">
          Every player and draft pick sits on one 0–100 Asset Value scale, built from recent Impact, the NHL age curve and what each contract is worth. Move assets between teams and the
          scoreboard, cap check and grade update live.
        </p>
      </section>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <TogglePill<"2" | "3"> label="Teams in the trade" value={String(mode) as "2" | "3"} options={[{ id: "2", label: "2-team" }, { id: "3", label: "3-team" }]} onChange={(value) => setMode(Number(value) as 2 | 3)} />
          <button
            type="button"
            onClick={() => setItems([])}
            disabled={empty}
            className="rounded-full border border-[#262B36] px-3 py-1.5 text-xs tracking-wide text-[#94A3B8] uppercase transition hover:border-[#38BDF8]/60 hover:text-white disabled:opacity-40"
          >
            Clear trade
          </button>
        </div>
        {!empty ? (
          <ShareLauncher
            fileSlug={slots.map((abbr) => abbr.toLowerCase()).join("-")}
            title={`${headline} · ${slots.join(" / ")}`}
            summary={`${headline}: ${sub} on the StatsPuck Trade Machine.`}
            path="/trade-machine"
            card={{ kind: "trade", headline, sub, sides: shareSides, capNotes: issues }}
          />
        ) : null}
      </section>

      <Scoreboard calcs={calcs} empty={empty} headline={headline} sub={sub} fair={fair} issues={issues} mode={mode} />

      <div className={`mt-6 grid gap-5 ${mode === 3 ? "xl:grid-cols-3" : "lg:grid-cols-2"}`}>
        {slots.map((abbr, index) => {
          const calc = calcs[index];
          return (
            <TeamColumn
              key={index}
              slot={index}
              calc={calc}
              data={data}
              sortedTeams={sortedTeams}
              slots={slots}
              mode={mode}
              items={items}
              playersById={playersById}
              picksByKey={picksByKey}
              onTeam={(next) => setSlot(index, next)}
              onToggle={toggle}
              onPatch={patch}
              itemValue={itemValue}
              pickRating={pickRating}
              playerRating={playerRating}
              abbr={abbr}
            />
          );
        })}
      </div>
    </div>
  );
}

function pickKey(pick: TradePick): string {
  return `k:${pick.team}:${pick.year}:${pick.round}:${pick.from}`;
}

/* ------------------------------------------------------------------ */
/* Scoreboard: balance meter, verdict, grades, cap compliance          */
/* ------------------------------------------------------------------ */

function Scoreboard({ calcs, empty, headline, sub, fair, issues, mode }: { calcs: Calc[]; empty: boolean; headline: string; sub: string; fair: boolean; issues: string[]; mode: number }) {
  const [a, b] = calcs;
  const lean = mode === 2 ? Math.max(-1, Math.min(1, a.margin / 0.5)) : 0;
  return (
    <section className="mt-5 rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-6" aria-live="polite">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Trade value balance</p>
          {mode === 2 ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                <TeamLogo abbr={a.team.abbr} className="h-10 w-12" />
                <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-[#94A3B8]/60" />
                  {!empty ? (
                    <div
                      className="absolute inset-y-0 transition-all duration-500"
                      style={{
                        left: lean < 0 ? `${50 + lean * 50}%` : "50%",
                        width: `${Math.abs(lean) * 50}%`,
                        background: fair ? "#94A3B8" : "linear-gradient(90deg, #10B981, #34D399)",
                      }}
                    />
                  ) : null}
                </div>
                <TeamLogo abbr={b.team.abbr} className="h-10 w-12" />
              </div>
              <div className="mt-2 grid grid-cols-2 text-sm">
                <p className="text-[#94A3B8]">
                  {a.team.short} receive <span className={`display text-xl font-bold ${ratingTone(a.incoming)}`}>{formatRating(a.incoming)}</span>
                </p>
                <p className="text-right text-[#94A3B8]">
                  {b.team.short} receive <span className={`display text-xl font-bold ${ratingTone(b.incoming)}`}>{formatRating(b.incoming)}</span>
                </p>
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-2.5">
              {calcs.map((calc) => {
                const lean3 = Math.max(-1, Math.min(1, calc.margin / 0.5));
                return (
                  <div key={calc.team.abbr} className="flex items-center gap-3">
                    <TeamLogo abbr={calc.team.abbr} className="h-8 w-10" />
                    <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-[#94A3B8]/60" />
                      {!empty ? (
                        <div
                          className="absolute inset-y-0 transition-all duration-500"
                          style={{ left: lean3 < 0 ? `${50 + lean3 * 50}%` : "50%", width: `${Math.abs(lean3) * 50}%`, background: lean3 >= 0 ? "#10B981" : "#EF4444" }}
                        />
                      ) : null}
                    </div>
                    <span className={`display w-16 text-right text-lg font-bold ${calc.net >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                      {calc.net >= 0 ? "+" : "−"}
                      {Math.abs(Math.round(calc.net))}
                    </span>
                  </div>
                );
              })}
              <p className="text-xs text-[#94A3B8]">Net Asset Value for each team: what it receives minus what it sends.</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-4 text-center">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Verdict</p>
          <p className={`display mt-1 text-2xl leading-tight font-bold ${empty ? "text-[#94A3B8]" : fair ? "text-[#F8FAFC]" : "text-[#10B981]"}`}>{headline}</p>
          <p className="mt-1 text-sm text-[#94A3B8]">{sub}</p>
        </div>
      </div>

      {!empty ? (
        <div className={`mt-5 grid gap-3 ${mode === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {calcs.map((calc) => (
            <div key={calc.team.abbr} className="flex items-center justify-between gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{calc.team.name}</p>
                <p className="text-xs text-[#94A3B8]">
                  Gets {formatRating(calc.incoming)} · sends {formatRating(calc.outgoing)} · cap {signedMoney(calc.capDelta)}
                </p>
              </div>
              <span className="flex flex-col items-center">
                <span className="text-[9px] tracking-[0.14em] text-[#94A3B8] uppercase">Grade</span>
                <span className={`display text-4xl leading-none font-bold ${gradeTone(calc.grade)}`}>{calc.grade}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {!empty ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${issues.length ? "border-[#F97316]/50 bg-[#F97316]/10 text-[#FDBA74]" : "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]"}`}>
          <p className="font-semibold">{issues.length ? "Cap compliance: this trade does not work as built" : "Cap compliance: every team stays between the floor and the ceiling"}</p>
          {issues.length ? (
            <ul className="mt-1 list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One team's side: cap bar, assets it sends, roster browser           */
/* ------------------------------------------------------------------ */

type ColumnProps = {
  slot: number;
  abbr: string;
  calc: Calc;
  data: TradeData;
  sortedTeams: TradeTeam[];
  slots: string[];
  mode: number;
  items: Item[];
  playersById: Map<string, TradePlayer>;
  picksByKey: Map<string, TradePick>;
  onTeam: (abbr: string) => void;
  onToggle: (kind: "player" | "pick", id: string, from: string, tier?: PickTierId) => void;
  onPatch: (key: string, change: Partial<Item>) => void;
  itemValue: (item: Item) => number;
  pickRating: (pick: TradePick, tier: PickTierId) => number;
  playerRating: (player: TradePlayer, retain: number) => number;
};

function TeamColumn(props: ColumnProps) {
  const { abbr, calc, data, sortedTeams, slots, mode, items, playersById, picksByKey, onTeam, onToggle, onPatch, itemValue, pickRating, playerRating } = props;
  const team = calc.team;
  const [tab, setTab] = useState<"players" | "picks">("players");
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<"ALL" | "F" | "D" | "G">("ALL");

  const sends = items.filter((item) => item.from === abbr);
  const roster = useMemo(() => data.players.filter((player) => player.team === abbr), [data.players, abbr]);
  const shown = roster.filter((player) => (pos === "ALL" || player.group === pos) && player.name.toLowerCase().includes(query.trim().toLowerCase()));
  const ownedPicks = data.picks.filter((pick) => pick.team === abbr);
  const tradedAway = data.away.filter((pick) => pick.team === abbr);
  const inTrade = new Set(items.map((item) => item.key));

  return (
    <div className="min-w-0 rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl border border-[#262B36] bg-[#0B0D10]/60">
          <TeamLogo abbr={abbr} name={team.name} className="h-9 w-11" />
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Team {props.slot + 1}</span>
          <select
            value={abbr}
            onChange={(event) => onTeam(event.target.value)}
            className="display w-full rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-xl font-bold text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
          >
            {sortedTeams.map((option) => (
              <option key={option.abbr} value={option.abbr} disabled={slots.includes(option.abbr) && option.abbr !== abbr}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-[#262B36] bg-[#0B0D10]/50 px-3 pt-2 pb-3">
        <CapMeter used={calc.capAfter} before={team.capHit} ceiling={data.ceiling} floor={data.floor} label={items.length ? "Cap after trade" : `Salary cap · ${data.season}`} compact />
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">{team.short} send</p>
        {sends.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-[#262B36] px-3 py-4 text-center text-sm text-[#94A3B8]">Nothing yet. Add players or picks below.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {sends.map((item) => {
              const value = itemValue(item);
              const player = item.kind === "player" ? playersById.get(item.id) : null;
              const pick = item.kind === "pick" ? picksByKey.get(item.id) : null;
              return (
                <li key={item.key} className="rounded-xl border border-[#38BDF8]/30 bg-[#38BDF8]/[0.04] p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{player ? player.name : `${pick!.year} Round ${pick!.round}`}</p>
                      <p className="truncate text-xs text-[#94A3B8]">
                        {player ? `${money(player.aav)} AAV · ${player.yearsLeft} yr${player.yearsLeft === 1 ? "" : "s"} left` : pick!.from !== pick!.team ? `Pick acquired from ${pick!.from}` : "Own pick"}
                      </p>
                    </div>
                    <span className={`display text-2xl font-bold ${ratingTone(value)}`}>{formatRating(value)}</span>
                    <button type="button" onClick={() => onToggle(item.kind, item.id, abbr)} aria-label="Remove from trade" className="grid h-8 w-8 place-items-center rounded-full text-[#94A3B8] hover:bg-white/5 hover:text-white">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M5 5l10 10M15 5 5 15" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#94A3B8]">
                    {mode === 3 ? (
                      <label className="flex items-center gap-1.5">
                        To
                        <select value={item.to} onChange={(event) => onPatch(item.key, { to: event.target.value })} className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-2 py-1 text-[#F8FAFC]">
                          {slots.filter((other) => other !== abbr).map((other) => (
                            <option key={other} value={other}>
                              {other}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {player ? (
                      <label className="flex min-w-0 flex-1 items-center gap-2" title="Salary the sending team keeps paying, up to 50%">
                        Retain
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={5}
                          value={Math.round(item.retain * 100)}
                          onChange={(event) => onPatch(item.key, { retain: Number(event.target.value) / 100 })}
                          className="min-w-16 flex-1 accent-[#E11D48]"
                          aria-label={`Salary retained on ${player.name}`}
                        />
                        <span className="w-9 text-right font-semibold text-[#F8FAFC]">{Math.round(item.retain * 100)}%</span>
                      </label>
                    ) : null}
                    {pick && pick.tiers.length > 1 ? (
                      <label className="flex items-center gap-1.5">
                        Projected
                        <select
                          value={item.tier ?? pick.defaultTier}
                          onChange={(event) => onPatch(item.key, { tier: event.target.value as PickTierId })}
                          className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-2 py-1 text-[#F8FAFC]"
                        >
                          {pick.tiers.map((tier) => (
                            <option key={tier} value={tier}>
                              {data.pickLabel[tier]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {pick && pick.tiers.length === 1 ? <span>Projected tier: {data.pickLabel[pick.tiers[0]]}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <TogglePill<"players" | "picks"> label="Browse" value={tab} options={[{ id: "players", label: `Players ${roster.length}` }, { id: "picks", label: `Picks ${ownedPicks.length}` }]} onChange={setTab} />
        {tab === "players" ? (
          <TogglePill<"ALL" | "F" | "D" | "G"> label="Position" value={pos} options={[{ id: "ALL", label: "All" }, { id: "F", label: "F" }, { id: "D", label: "D" }, { id: "G", label: "G" }]} onChange={setPos} />
        ) : null}
      </div>

      {tab === "players" ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${team.short} roster`}
            className="mt-3 w-full rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/70 focus:border-[#38BDF8] focus:outline-none"
          />
          <ul className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
            {shown.length === 0 ? <li className="py-4 text-center text-sm text-[#94A3B8]">No players match.</li> : null}
            {shown.map((player) => {
              const on = inTrade.has(`p:${player.id}`);
              return (
                <li key={player.id}>
                  <div className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${on ? "border-[#38BDF8]/60 bg-[#38BDF8]/[0.07]" : "border-[#262B36] bg-[#0B0D10]/40 hover:border-[#38BDF8]/40"}`}>
                    <PlayerHeadshot playerId={player.id} name={player.name} available={player.headshot} color={team.color} className="h-10 w-10 !rounded-xl !border" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <a href={playerHref(player.id, "asset")} className="truncate text-sm font-semibold hover:underline">
                          {player.name}
                        </a>
                        <span className="shrink-0 text-[10px] font-semibold text-[#94A3B8]">{player.pos}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <ArchetypePill archetype={player.archetype} small />
                        <ProspectTierPill tier={player.tier} small />
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
                        {player.age != null ? `Age ${player.age} · ` : ""}
                        {player.elc ? "ELC" : `${money(player.aav)} AAV`} · {((player.aav / data.ceiling) * 100).toFixed(1)}% Cap · {player.yearsLeft} yr{player.yearsLeft === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="w-14 shrink-0 text-right" title={`Asset Value ${formatRating(player.rating)} / 100`}>
                      <p className={`display text-xl leading-none font-bold ${ratingTone(playerRating(player, 0))}`}>{formatRating(player.rating)}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, player.rating))}%`, background: ratingFill(player.rating) }} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggle("player", String(player.id), abbr)}
                      aria-pressed={on}
                      aria-label={on ? `Remove ${player.name} from the trade` : `Add ${player.name} to the trade`}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-lg leading-none font-bold transition ${on ? "border-[#E11D48] bg-[#E11D48] text-white" : "border-[#262B36] text-[#94A3B8] hover:border-[#38BDF8] hover:text-white"}`}
                    >
                      {on ? "✓" : "+"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ul className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
          {ownedPicks.length === 0 ? <li className="py-4 text-center text-sm text-[#94A3B8]">No 2027–2029 picks on file.</li> : null}
          {tradedAway.length ? (
            <li className="rounded-xl border border-dashed border-[#262B36] px-3 py-2 text-[11px] text-[#94A3B8]">
              <span className="font-semibold tracking-wider uppercase">Own picks traded away: </span>
              {tradedAway.map((a) => `${a.year} R${a.round} → ${a.to}`).join(" · ")}
            </li>
          ) : null}
          {ownedPicks.map((pick) => {
            const key = pickKey(pick);
            const on = inTrade.has(key);
            const tier = items.find((item) => item.key === key)?.tier ?? pick.defaultTier;
            const value = pickRating(pick, tier);
            return (
              <li key={key} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${on ? "border-[#38BDF8]/60 bg-[#38BDF8]/[0.07]" : "border-[#262B36] bg-[#0B0D10]/40 hover:border-[#38BDF8]/40"}`}>
                <span className="display w-14 shrink-0 text-lg font-bold text-[#F8FAFC]">{pick.year}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    Round {pick.round}
                    {pick.from !== pick.team ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#262B36] bg-[#0B0D10] py-px pr-2 pl-1 text-[10px] font-semibold text-[#94A3B8]" title={`Acquired from ${pick.from}`}>
                        <TeamLogo abbr={pick.from} className="h-4 w-5" />
                        {pick.from}
                      </span>
                    ) : null}
                    {pick.cond ? <span className="rounded-full bg-[#F59E0B]/15 px-1.5 text-[9px] font-bold tracking-wider text-[#F59E0B] uppercase">Cond.</span> : null}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">Projected {data.pickLabel[tier]}</p>
                </div>
                <span className={`display text-xl font-bold ${ratingTone(value)}`}>{formatRating(value)}</span>
                <button
                  type="button"
                  onClick={() => onToggle("pick", key, abbr, pick.defaultTier)}
                  aria-pressed={on}
                  aria-label={on ? `Remove ${pick.year} round ${pick.round} pick` : `Add ${pick.year} round ${pick.round} pick`}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-lg leading-none font-bold transition ${on ? "border-[#E11D48] bg-[#E11D48] text-white" : "border-[#262B36] text-[#94A3B8] hover:border-[#38BDF8] hover:text-white"}`}
                >
                  {on ? "✓" : "+"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
