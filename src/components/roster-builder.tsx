"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { CapMeter } from "@/components/cap-meter";
import { letterFor } from "@/lib/grade";
import type { RosterPlayer, Slot } from "@/lib/perfect-roster";

// Build Your Own Roster: pick 20 active players on their real contracts and stay under the cap.
// Team Rating compares your roster's value against a replacement-level roster (0) and the
// solved Perfect Roster (100). The roster is saved in this browser and in a shareable link.

type SlotDef = { slot: Slot; group: string; label: string };

const LAYOUT: SlotDef[] = [
  ...[1, 2, 3, 4].flatMap((n) => (["LW", "C", "RW"] as Slot[]).map((slot) => ({ slot, group: `Line ${n}`, label: slot }))),
  ...[1, 2, 3].flatMap((n) => (["LD", "RD"] as Slot[]).map((slot) => ({ slot, group: `Pair ${n}`, label: slot }))),
  { slot: "G", group: "Goalies", label: "Starter" },
  { slot: "G", group: "Goalies", label: "Backup" },
];
const SIZE = LAYOUT.length;
const STORAGE_KEY = "statspuck-roster-builder";

const isF = (s: Slot) => s === "LW" || s === "C" || s === "RW";
const isD = (s: Slot) => s === "LD" || s === "RD";

/** Can this player fill this slot? Forwards fill any forward slot, defensemen any D slot. */
function fits(player: RosterPlayer, slot: Slot): boolean {
  if (slot === "G") return player.slot === "G";
  if (isF(slot)) return isF(player.slot);
  return isD(player.slot);
}

/** Small penalty for playing off position (wrong wing, centre on the wing, wrong-side D). */
function offPosition(player: RosterPlayer, slot: Slot): number {
  if (player.slot === slot) return 0;
  if (isF(slot)) return player.slot === "C" ? 1 : 3;
  return 2;
}

function money(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

function skillTone(value: number): string {
  if (value >= 90) return "text-[#F59E0B]";
  if (value >= 80) return "text-[#10B981]";
  if (value >= 65) return "text-[#38BDF8]";
  return "text-[#F8FAFC]";
}

function gradeTone(letter: string): string {
  if (letter.startsWith("A")) return "#F59E0B";
  if (letter.startsWith("B")) return "#10B981";
  if (letter.startsWith("C")) return "#38BDF8";
  return "#EF4444";
}

function Headshot({ player, size = "h-10 w-10" }: { player: RosterPlayer; size?: string }) {
  return (
    <img
      src={player.headshot ? `https://assets.nhle.com/mugs/nhl/latest/${player.playerId}.png` : "/player-silhouette.svg"}
      onError={(e) => {
        e.currentTarget.src = "/player-silhouette.svg";
      }}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded-full border border-[#262B36] bg-[#14171F] object-cover object-top`}
    />
  );
}

export function RosterBuilder({
  pool,
  perfectIds,
  perfectValue,
  ceiling,
  floor,
  season,
}: {
  pool: RosterPlayer[];
  /** Perfect Roster player ids in LAYOUT order. */
  perfectIds: number[];
  perfectValue: number;
  ceiling: number;
  floor: number;
  season: string;
}) {
  const byId = useMemo(() => new Map(pool.map((p) => [p.playerId, p])), [pool]);
  const [roster, setRoster] = useState<(number | null)[]>(() => Array(SIZE).fill(null));
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"value" | "skill" | "cheap" | "bargain">("value");
  const [anyPos, setAnyPos] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load from the share link first, then from this browser.
  useEffect(() => {
    let ids: (number | null)[] | null = null;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("r");
      const raw = fromUrl ?? window.localStorage.getItem(STORAGE_KEY);
      if (raw) ids = raw.split(/[.,]/).map((x) => (Number(x) > 0 && byId.has(Number(x)) ? Number(x) : null));
    } catch {
      ids = null;
    }
    const timer = window.setTimeout(() => {
      if (ids) setRoster(Array.from({ length: SIZE }, (_, i) => ids![i] ?? null));
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [byId]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, roster.map((id) => id ?? 0).join("."));
    } catch {
      /* storage blocked: nothing to do */
    }
  }, [roster, loaded]);

  const players = roster.map((id) => (id == null ? null : byId.get(id) ?? null));
  const filled = players.filter(Boolean).length;
  const used = players.reduce((sum, p) => sum + (p?.aav ?? 0), 0);
  const space = ceiling - used;
  const over = used > ceiling;
  const value = players.reduce((sum, p, i) => sum + (p ? p.value - offPosition(p, LAYOUT[i].slot) : 0), 0);

  // Replacement level: the 40th-best player at each slot is what any team can find for cheap.
  const replacement = useMemo(() => {
    const at = (slot: Slot) => {
      const vals = pool.filter((p) => p.slot === slot).map((p) => p.value).sort((a, b) => b - a);
      return vals[Math.min(vals.length - 1, slot === "G" ? 30 : 60)] ?? 0;
    };
    return LAYOUT.reduce((sum, def) => sum + at(def.slot), 0);
  }, [pool]);

  const rating = filled === 0 ? 0 : Math.max(0, Math.min(100, Math.round((100 * (value + (SIZE - filled) * (replacement / SIZE) - replacement)) / (perfectValue - replacement))));
  const letter = letterFor(rating);
  const avgSkill = filled ? Math.round(players.reduce((s, p) => s + (p?.skill ?? 0), 0) / filled) : 0;

  const taken = new Set(roster.filter((id): id is number => id != null));
  const activeSlot = active == null ? null : LAYOUT[active].slot;
  const spaceForSlot = active == null ? space : space + (players[active]?.aav ?? 0);

  const options = useMemo(() => {
    if (activeSlot == null) return [];
    const q = query.trim().toLowerCase();
    const list = pool.filter(
      (p) =>
        (anyPos ? fits(p, activeSlot) : p.slot === activeSlot || (activeSlot === "G" && p.slot === "G")) &&
        (!q || p.name.toLowerCase().includes(q) || (p.team ?? "").toLowerCase() === q),
    );
    const sorter: Record<typeof sort, (a: RosterPlayer, b: RosterPlayer) => number> = {
      value: (a, b) => b.value - a.value,
      skill: (a, b) => b.skill - a.skill,
      cheap: (a, b) => a.aav - b.aav,
      // Bargain = value per dollar.
      bargain: (a, b) => b.value / Math.max(b.aav, 1) - a.value / Math.max(a.aav, 1),
    };
    return list.sort(sorter[sort]).slice(0, 80);
  }, [pool, activeSlot, query, anyPos, sort]);

  function place(index: number, player: RosterPlayer | null) {
    setRoster((cur) => {
      const next = [...cur];
      if (player) {
        const existing = next.indexOf(player.playerId);
        if (existing >= 0) next[existing] = null;
      }
      next[index] = player?.playerId ?? null;
      return next;
    });
  }

  function choose(player: RosterPlayer) {
    if (active == null) return;
    place(active, player);
    // Jump to the next empty slot so building a full roster is quick.
    const nextEmpty = roster.findIndex((id, i) => i > active && id == null);
    setActive(nextEmpty >= 0 ? nextEmpty : null);
    setQuery("");
  }

  function autoFill() {
    const next = [...roster];
    const used = new Set(next.filter((id): id is number => id != null));
    const empty = LAYOUT.map((_, i) => i).filter((i) => next[i] == null);
    // Pass 1: the cheapest player at every empty spot, so the roster is always complete.
    for (const i of empty) {
      const pick = pool.filter((p) => p.slot === LAYOUT[i].slot && !used.has(p.playerId)).sort((a, b) => a.aav - b.aav)[0];
      if (!pick) continue;
      next[i] = pick.playerId;
      used.add(pick.playerId);
    }
    // Pass 2: top line first, upgrade each spot to the best player the leftover space allows.
    let budget = ceiling - next.reduce<number>((s, id) => s + (id ? byId.get(id)?.aav ?? 0 : 0), 0);
    for (const i of empty) {
      const current = next[i] == null ? null : byId.get(next[i]!) ?? null;
      if (!current) continue;
      const pick = pool
        .filter((p) => p.slot === LAYOUT[i].slot && !used.has(p.playerId) && p.aav <= current.aav + budget && p.value > current.value)
        .sort((a, b) => b.value - a.value)[0];
      if (!pick) continue;
      used.delete(current.playerId);
      used.add(pick.playerId);
      budget -= pick.aav - current.aav;
      next[i] = pick.playerId;
    }
    setRoster(next);
  }

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}?r=${roster.map((id) => id ?? 0).join(".")}#build`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your roster link:", url);
    }
  }

  const groups = LAYOUT.reduce<{ group: string; items: number[] }[]>((acc, def, i) => {
    const last = acc[acc.length - 1];
    if (last && last.group === def.group) last.items.push(i);
    else acc.push({ group: def.group, items: [i] });
    return acc;
  }, []);

  return (
    <section id="build" className="mt-12 scroll-mt-24">
      <p className="text-sm font-semibold tracking-[0.2em] text-[#38BDF8] uppercase">Build Your Own Roster</p>
      <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">Can you beat the Perfect Roster?</h2>
      <p className="mt-2 max-w-3xl text-[#94A3B8]">
        Pick any 20 active NHL players on their real contracts. Stay under the {season} cap and see how your team grades. 100 = as good as the Perfect Roster above.
        Your roster saves in this browser and you can share it with a link.
      </p>

      {/* Scoreboard */}
      <div className="z-20 mt-5 lg:sticky lg:top-16 grid gap-4 rounded-2xl border border-[#262B36] bg-[#14171F]/95 p-4 backdrop-blur lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-center gap-4">
          <div
            className="display grid h-16 w-16 place-items-center rounded-2xl border-2 text-2xl font-bold"
            style={{ borderColor: over ? "#EF4444" : gradeTone(letter), color: over ? "#EF4444" : gradeTone(letter) }}
            title="Team Rating grade"
          >
            {filled ? (over ? "✕" : letter) : "–"}
          </div>
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Team rating</dt>
              <dd className="display text-2xl font-bold">{filled ? rating : "–"}</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Players</dt>
              <dd className="display text-2xl font-bold">{filled}/20</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Avg skill</dt>
              <dd className="display text-2xl font-bold">{filled ? avgSkill : "–"}</dd>
            </div>
          </dl>
        </div>
        <CapMeter used={used} ceiling={ceiling} floor={floor} label={`Your cap · ${season}`} compact />
        <div className="flex flex-wrap gap-2 lg:flex-col">
          <button type="button" onClick={autoFill} className="rounded-lg bg-[#38BDF8] px-3 py-1.5 text-xs font-bold text-[#0B0D10] hover:bg-[#7dd3fc]">
            Auto-fill empty spots
          </button>
          <button type="button" onClick={() => setRoster([...perfectIds])} className="rounded-lg border border-[#262B36] px-3 py-1.5 text-xs font-semibold hover:border-[#38BDF8]">
            Start from Perfect Roster
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={share} className="flex-1 rounded-lg border border-[#262B36] px-3 py-1.5 text-xs font-semibold hover:border-[#38BDF8]">
              {copied ? "Link copied!" : "Share link"}
            </button>
            <button type="button" onClick={() => setRoster(Array(SIZE).fill(null))} className="rounded-lg border border-[#262B36] px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:border-[#EF4444] hover:text-[#EF4444]">
              Clear
            </button>
          </div>
        </div>
      </div>
      {over ? (
        <p className="mt-2 text-sm font-semibold text-[#EF4444]">You are {money(-space)} over the cap. Swap someone out to make this roster legal.</p>
      ) : filled === SIZE ? (
        <p className="mt-2 text-sm font-semibold text-[#10B981]">
          Full, cap-legal roster! {rating >= 100 ? "You matched the Perfect Roster." : `${100 - rating} points short of the Perfect Roster.`}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* Roster slots */}
        <div className="grid gap-3">
          {groups.map(({ group, items }) => (
            <div key={group} className="rounded-2xl border border-[#262B36] bg-[#14171F] p-3">
              <p className="display mb-2 text-sm font-bold text-[#94A3B8]">{group}</p>
              <div className={`grid gap-2 ${items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {items.map((i) => {
                  const p = players[i];
                  const def = LAYOUT[i];
                  const isActive = active === i;
                  const penalty = p ? offPosition(p, def.slot) : 0;
                  return (
                    <div
                      key={i}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 transition ${isActive ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-[#262B36] bg-[#0B0D10]/70 hover:border-[#38BDF8]/60"}`}
                    >
                      <button type="button" onClick={() => setActive(isActive ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        {p ? (
                          <Headshot player={p} />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-[#38BDF8]/50 text-lg text-[#38BDF8]">+</span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                            {def.label}
                            {p?.team ? ` · ${p.team}` : ""}
                            {penalty ? <span className="text-[#F97316]"> · off-position</span> : null}
                          </span>
                          <span className="block truncate text-sm font-semibold">{p ? p.name : isActive ? "Pick a player →" : "Empty"}</span>
                          {p ? <span className="block text-[11px] text-[#94A3B8]">{money(p.aav)}</span> : null}
                        </span>
                        {p ? <span className={`display text-xl font-bold ${skillTone(p.skill)}`}>{p.skill}</span> : null}
                      </button>
                      {p ? (
                        <button type="button" onClick={() => place(i, null)} aria-label={`Remove ${p.name}`} className="rounded px-1.5 text-[#94A3B8] hover:text-[#EF4444]">
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Player picker */}
        <aside className="lg:sticky lg:top-56 lg:self-start">
          <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-3">
            {active == null ? (
              <p className="p-4 text-sm text-[#94A3B8]">Click any spot on your roster to pick a player for it.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    {LAYOUT[active].group} · {LAYOUT[active].label}
                  </p>
                  <button type="button" onClick={() => setActive(null)} className="text-xs text-[#94A3B8] hover:text-[#F8FAFC]">
                    Close
                  </button>
                </div>
                <p className="mt-0.5 text-[11px] text-[#94A3B8]">Space for this spot: {money(Math.max(0, spaceForSlot))}</p>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or team (e.g. TOR)"
                  className="mt-2 w-full rounded-lg border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm outline-none focus:border-[#38BDF8]"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {(
                    [
                      ["value", "Best"],
                      ["skill", "Skill"],
                      ["bargain", "Bargain"],
                      ["cheap", "Cheapest"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSort(key)}
                      className={`rounded-full px-2.5 py-1 font-semibold ${sort === key ? "bg-[#38BDF8] text-[#0B0D10]" : "border border-[#262B36] text-[#94A3B8]"}`}
                    >
                      {label}
                    </button>
                  ))}
                  {LAYOUT[active].slot !== "G" ? (
                    <label className="ml-auto flex items-center gap-1 text-[#94A3B8]" title="Off-position players lose a few rating points">
                      <input type="checkbox" checked={anyPos} onChange={(e) => setAnyPos(e.target.checked)} /> Any {isF(LAYOUT[active].slot) ? "forward" : "D"}
                    </label>
                  ) : null}
                </div>
                <ul className="mt-2 max-h-[28rem] overflow-y-auto pr-1">
                  {options.map((p) => {
                    const onRoster = taken.has(p.playerId) && players[active]?.playerId !== p.playerId;
                    const tooPricey = p.aav > spaceForSlot;
                    return (
                      <li key={p.playerId}>
                        <button
                          type="button"
                          onClick={() => choose(p)}
                          className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-white/[0.05]"
                        >
                          <Headshot player={p} size="h-8 w-8" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {p.name} {onRoster ? <span className="text-[10px] text-[#38BDF8]">(on roster, will move)</span> : null}
                            </span>
                            <span className={`block text-[11px] ${tooPricey ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                              {p.slot} · {p.team ?? "—"} · {p.elc ? "ELC " : ""}
                              {money(p.aav)}
                              {tooPricey ? " · over your space" : ""}
                            </span>
                          </span>
                          <span className={`display text-lg font-bold ${skillTone(p.skill)}`}>{p.skill}</span>
                        </button>
                      </li>
                    );
                  })}
                  {options.length === 0 ? <li className="p-3 text-sm text-[#94A3B8]">No players match.</li> : null}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
      <p className="mt-4 text-xs text-[#94A3B8]">
        Team Rating: 0 = a replacement-level roster, 100 = the Perfect Roster. Player value is the same as above (Overall Skill + recent Impact pace). Forwards can play any forward spot and
        defensemen either side, but off-position players lose a few points. Big number on each card = Overall Skill.
      </p>
    </section>
  );
}
