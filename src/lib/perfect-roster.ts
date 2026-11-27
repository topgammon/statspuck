import rosterBios from "../../data/draft-rater/roster_bios.json";
import { capCeiling, capFloor, capShare } from "./cap";
import { profileRows, type ProfileRow } from "./profiles";
import type { Archetype } from "./archetype-meta";
import { vitalsFor } from "./vitals";

// Live cap-compliant "Perfect Roster".
//
// Picks the best possible 20-man NHL roster from every active player under contract:
// 4 LW, 4 C, 4 RW, 3 left-shot D, 3 right-shot D and 2 goalies, with total AAV at or under the
// cap ceiling. Player value = Overall Skill + recent Impact pace (+ chemistryBonus, 0 until the
// Line Chemistry engine ships).
//
// Solved exactly, not greedily: a knapsack per position slot (exactly k players, best value for
// every budget in $100K steps), then the six position tables are combined budget by budget.

export type Slot = "LW" | "C" | "RW" | "LD" | "RD" | "G";

export const SLOT_COUNTS: Record<Slot, number> = { LW: 4, C: 4, RW: 4, LD: 3, RD: 3, G: 2 };
const SLOTS = Object.keys(SLOT_COUNTS) as Slot[];
const UNIT = 100_000;

export type RosterPlayer = {
  playerId: number;
  routeId: number;
  name: string;
  slot: Slot;
  pos: string;
  team: string | null;
  skill: number;
  rate: number;
  aav: number;
  capPct: number;
  elc: boolean;
  archetype: Archetype | null;
  headshot: boolean;
  value: number;
};

export type PerfectRoster = {
  forwards: { LW: RosterPlayer; C: RosterPlayer; RW: RosterPlayer }[];
  defense: { LD: RosterPlayer; RD: RosterPlayer }[];
  goalies: RosterPlayer[];
  total: number;
  ceiling: number;
  floor: number;
  value: number;
  /** How many players were eligible. */
  pool: number;
};

const bios = rosterBios as unknown as Record<string, { pos?: string; sc?: string }>;

/** Hook for Phase D's Line Chemistry engine. */
export function chemistryBonus(_player: RosterPlayer): number {
  void _player;
  return 0;
}

function slotOf(row: ProfileRow): Slot | null {
  if (row.group === "G") return "G";
  if (row.group === "D") {
    const shot = bios[String(row.playerId)]?.sc ?? vitalsFor(row.routeId)?.sc ?? "L";
    return shot === "R" ? "RD" : "LD";
  }
  const pos = (bios[String(row.playerId)]?.pos ?? row.pos ?? "").toUpperCase();
  if (pos.startsWith("C")) return "C";
  if (pos.startsWith("R")) return "RW";
  if (pos.startsWith("L")) return "LW";
  return null;
}

function valueOf(row: ProfileRow): number {
  const skill = row.skills!.overall;
  const rate = row.recentRate ?? 0;
  // Skaters: Impact per 82 (about 40-180) adds up to ~36. Goalies: Impact per season (about 20-70).
  return row.group === "G" ? skill + 0.5 * Math.min(rate, 80) : skill + 0.2 * Math.min(rate, 180);
}

function candidates(): RosterPlayer[] {
  const out: RosterPlayer[] = [];
  for (const row of profileRows()) {
    if (!row.active || !row.contract || !row.skills?.current || row.recentRate == null) continue;
    const slot = slotOf(row);
    if (!slot) continue;
    const player: RosterPlayer = {
      playerId: row.playerId,
      routeId: row.routeId,
      name: row.name,
      slot,
      pos: row.pos,
      team: row.team,
      skill: row.skills.overall,
      rate: Math.round(row.recentRate * 10) / 10,
      aav: row.contract.aav,
      capPct: Math.round(capShare(row.contract.aav) * 1000) / 10,
      elc: Boolean(row.contract.elc),
      archetype: row.skills.archetype,
      headshot: row.hasHeadshot,
      value: 0,
    };
    player.value = Math.round((valueOf(row) + chemistryBonus(player)) * 10) / 10;
    out.push(player);
  }
  return out;
}

/** Best value for exactly k players at every budget 0..B (units), with the chosen players. */
function groupTable(players: RosterPlayer[], k: number, B: number): { best: Float64Array; pick: (b: number) => RosterPlayer[] } {
  const n = players.length;
  const width = B + 1;
  const NEG = -1e9;
  const dp = Array.from({ length: k + 1 }, (_, j) => new Float64Array(width).fill(j === 0 ? 0 : NEG));
  const take = new Uint8Array(n * (k + 1) * width);
  const cost = players.map((p) => Math.ceil(p.aav / UNIT));
  players.forEach((player, i) => {
    const c = cost[i];
    for (let j = Math.min(k, i + 1); j >= 1; j--) {
      const prev = dp[j - 1];
      const cur = dp[j];
      for (let b = B; b >= c; b--) {
        const cand = prev[b - c] + player.value;
        if (cand > cur[b]) {
          cur[b] = cand;
          take[(i * (k + 1) + j) * width + b] = 1;
        }
      }
    }
  });
  // Best for budget <= b (dp holds exact-cost values).
  const best = new Float64Array(width);
  const at = new Int32Array(width);
  for (let b = 0; b <= B; b++) {
    if (b === 0 || dp[k][b] > best[b - 1]) {
      best[b] = dp[k][b];
      at[b] = b;
    } else {
      best[b] = best[b - 1];
      at[b] = at[b - 1];
    }
  }
  const pick = (budget: number) => {
    const out: RosterPlayer[] = [];
    let b = at[budget];
    let j = k;
    for (let i = n - 1; i >= 0 && j > 0; i--) {
      if (take[(i * (k + 1) + j) * width + b]) {
        out.push(players[i]);
        b -= cost[i];
        j -= 1;
      }
    }
    return out;
  };
  return { best, pick };
}

let cache: PerfectRoster | null = null;

export function perfectRoster(): PerfectRoster | null {
  if (cache) return cache;
  const pool = candidates();
  const B = Math.floor(capCeiling / UNIT);
  // Keep the search fast: per slot, the 120 most valuable players are more than enough.
  const tables = SLOTS.map((slot) => {
    const players = pool.filter((p) => p.slot === slot).sort((a, b) => b.value - a.value).slice(0, 120);
    return { slot, players, ...groupTable(players, SLOT_COUNTS[slot], B) };
  });
  // Combine slot tables: total[b] = best value of all slots so far within budget b.
  let total = Float64Array.from(tables[0].best);
  const splits: Int32Array[] = [];
  for (let g = 1; g < tables.length; g++) {
    const next = new Float64Array(B + 1).fill(-1e9);
    const split = new Int32Array(B + 1);
    const best = tables[g].best;
    for (let b = 0; b <= B; b++) {
      for (let x = 0; x <= b; x++) {
        const cand = best[x] + total[b - x];
        if (cand > next[b]) {
          next[b] = cand;
          split[b] = x;
        }
      }
    }
    splits.push(split);
    total = next;
  }
  if (total[B] < 0) return null;
  // Walk back: how much budget each slot used.
  const budgets: number[] = Array(tables.length).fill(0);
  let remaining = B;
  for (let g = tables.length - 1; g >= 1; g--) {
    budgets[g] = splits[g - 1][remaining];
    remaining -= budgets[g];
  }
  budgets[0] = remaining;
  const chosen = new Map<Slot, RosterPlayer[]>();
  tables.forEach((table, g) => chosen.set(table.slot, table.pick(budgets[g]).sort((a, b) => b.value - a.value)));

  const all = [...chosen.values()].flat();
  cache = {
    forwards: [0, 1, 2, 3].map((i) => ({ LW: chosen.get("LW")![i], C: chosen.get("C")![i], RW: chosen.get("RW")![i] })),
    defense: [0, 1, 2].map((i) => ({ LD: chosen.get("LD")![i], RD: chosen.get("RD")![i] })),
    goalies: chosen.get("G")!,
    total: all.reduce((sum, p) => sum + p.aav, 0),
    ceiling: capCeiling,
    floor: capFloor,
    value: Math.round(all.reduce((sum, p) => sum + p.value, 0)),
    pool: pool.length,
  };
  return cache;
}
