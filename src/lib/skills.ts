import { classify, ratesOf } from "./archetypes";
import type { Archetype } from "./archetype-meta";
import { nhlersFile, type Group, type Nhler } from "./nhlers";
import { goalieSeasons } from "./season-stats";

// Skills: an EA-style 0-99 Overall Skill Rating plus six axes, built only from real
// box-score data over a player's last three NHL seasons and ranked against today's
// NHL regulars at the same position. No hand-entered ratings.
//
// Skaters: Offense, Defense, Skating, Physicality, Discipline, Possession.
// Goalies: Reflexes, Rebound Control, Workload, Consistency, Puck-Playing, Clutch.
// Axes we do not have data for yet (hits, takeaways, NHL EDGE speed, shot location,
// playoff splits) say so instead of guessing.

export type SkillAxis = { id: string; label: string; value: number | null; tip: string; proxy?: boolean };

export type SkillProfile = {
  playerId: number;
  group: Group;
  overall: number;
  archetype: Archetype | null;
  axes: SkillAxis[];
  /** Seasons the rating is built from, e.g. "2023-24 to 2025-26". */
  window: string;
  gp: number;
  /** Still playing: last season on file is this one or last one. */
  current: boolean;
};

const MIN_SKATER_GP = 40;
const MIN_GOALIE_GP = 30;

/** 0-1 share of the reference pool below `value`. */
function pctOf(sorted: number[], value: number): number {
  if (!sorted.length) return 0.5;
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < value) low = mid + 1;
    else high = mid;
  }
  // Mid-rank so ties land in the middle instead of the bottom.
  let top = low;
  while (top < sorted.length && sorted[top] === value) top++;
  return (low + top) / 2 / sorted.length;
}

/** 0-1 skill share to the 0-99 display scale. A league-average regular is about 65. */
export function toSkill(share: number): number {
  return Math.max(1, Math.min(99, Math.round(30 + 69 * share)));
}

/**
 * Overall from a z-score against NHL regulars: average regular = 72, each standard
 * deviation = 9 points, so only true outliers reach the high 90s.
 */
function overallFromZ(z: number): number {
  return Math.max(35, Math.min(99, Math.round(72 + 9 * z)));
}

function stats(values: number[]): { mean: number; sd: number } {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, values.length)) || 1;
  return { mean, sd };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const sortNums = (values: number[]) => [...values].sort((a, b) => a - b);

function seasonLabel(start: number): string {
  return `${start}-${String(start + 1).slice(2)}`;
}

function windowOf(player: Nhler): string {
  const years = player.ss.map((row) => row[0]);
  if (!years.length) return "";
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? seasonLabel(first) : `${seasonLabel(first)} to ${seasonLabel(last)}`;
}

function impactPerGame(player: Nhler): number {
  const gp = player.ss.reduce((sum, row) => sum + row[1], 0);
  const impact = player.ss.reduce((sum, row) => sum + row[2], 0);
  return gp > 0 ? impact / gp : 0;
}

function isCurrent(player: Nhler): boolean {
  const last = player.ss[player.ss.length - 1]?.[0] ?? 0;
  return last >= nhlersFile.season - 1;
}

// ---- Skaters -------------------------------------------------------------------------

type SkaterRaw = {
  id: number;
  player: Nhler;
  gpg: number;
  apg: number;
  sogg: number;
  blkg: number;
  pimg: number;
  pmg: number;
  toi: number;
  evMin: number;
  ppMin: number;
  pkMin: number;
  fowPct: number | null;
  draws: number;
  size: number;
  ipg: number;
};

function skaterRaw(id: number, player: Nhler): SkaterRaw | null {
  const r = ratesOf(player);
  if (!r || r.gp < MIN_SKATER_GP) return null;
  // Size index: inches over 68 plus pounds over 170, both scaled to about 0-1.
  const size = ((player.h ?? 72) - 68) / 10 + ((player.w ?? 195) - 170) / 70;
  return {
    id,
    player,
    gpg: r.gpg,
    apg: r.apg,
    sogg: r.sogg,
    blkg: r.blkg,
    pimg: r.pimg,
    pmg: r.pmg,
    toi: r.toi,
    evMin: r.evMin,
    ppMin: r.ppMin,
    pkMin: r.pkMin,
    fowPct: r.fowPct,
    draws: r.draws,
    size,
    ipg: impactPerGame(player),
  };
}

type SkaterKey = "gpg" | "apg" | "sogg" | "blkg" | "pimg" | "pmg" | "toi" | "evMin" | "ppMin" | "pkMin" | "size" | "ipg";
const SKATER_KEYS: SkaterKey[] = ["gpg", "apg", "sogg", "blkg", "pimg", "pmg", "toi", "evMin", "ppMin", "pkMin", "size", "ipg"];

/** Position weights for the Overall: how much each axis matters for a forward vs. a defenseman. */
const WEIGHTS: Record<"F" | "D", Record<string, number>> = {
  F: { offense: 0.4, defense: 0.14, skating: 0.14, physicality: 0.08, discipline: 0.08, possession: 0.16 },
  D: { offense: 0.24, defense: 0.3, skating: 0.16, physicality: 0.12, discipline: 0.08, possession: 0.1 },
};

function skaterAxes(raw: SkaterRaw, p: (key: SkaterKey, value: number) => number): { axes: SkillAxis[]; shares: Record<string, number> } {
  const offense = 0.35 * p("gpg", raw.gpg) + 0.35 * p("apg", raw.apg) + 0.2 * p("sogg", raw.sogg) + 0.1 * p("ppMin", raw.ppMin);
  const defense = 0.4 * p("pkMin", raw.pkMin) + 0.3 * p("blkg", raw.blkg) + 0.3 * p("pmg", raw.pmg);
  const skating = 0.6 * p("toi", raw.toi) + 0.4 * p("evMin", raw.evMin);
  const physicality = 0.45 * p("size", raw.size) + 0.35 * p("blkg", raw.blkg) + 0.2 * p("pimg", raw.pimg);
  const discipline = 1 - p("pimg", raw.pimg);
  const faceoffs = raw.fowPct != null && raw.draws >= 150 ? clamp01((raw.fowPct - 0.4) / 0.2) : null;
  const possession = faceoffs != null ? 0.45 * faceoffs + 0.3 * p("sogg", raw.sogg) + 0.25 * p("pmg", raw.pmg) : 0.55 * p("sogg", raw.sogg) + 0.45 * p("pmg", raw.pmg);
  const shares = { offense, defense, skating, physicality, discipline, possession };
  const axes: SkillAxis[] = [
    { id: "offense", label: "Offense", value: toSkill(offense), tip: "Goals, assists and shots per game plus power-play role, ranked against NHL regulars at his position. Expected goals arrive with play-by-play data." },
    { id: "defense", label: "Defense", value: toSkill(defense), tip: "Penalty-kill minutes, blocked shots and goal differential while he plays. Takeaways arrive with play-by-play data." },
    {
      id: "skating",
      label: "Skating",
      value: toSkill(skating),
      proxy: true,
      tip: "Pace proxy: total and even-strength ice time per game. NHL EDGE burst and top-speed data (2021-22+) is the next upgrade.",
    },
    { id: "physicality", label: "Physicality", value: toSkill(physicality), tip: "Size, blocked shots and penalty minutes. Hits arrive with play-by-play data." },
    { id: "discipline", label: "Discipline", value: toSkill(discipline), tip: "Fewer penalty minutes per game ranks higher. Penalties drawn arrive with play-by-play data." },
    {
      id: "possession",
      label: "Possession",
      value: toSkill(possession),
      tip: faceoffs != null ? "Faceoff win %, shot volume and goal differential while he plays." : "Shot volume and goal differential while he plays (not a regular faceoff taker).",
    },
  ];
  return { axes, shares };
}

// ---- Goalies -------------------------------------------------------------------------

type GoalieRaw = { id: number; player: Nhler; svPct: number; startsPerSeason: number; spread: number | null; ipg: number; gp: number };

function goalieRaw(id: number, player: Nhler): GoalieRaw | null {
  const recent = new Set(player.ss.map((row) => row[0]));
  const rows = goalieSeasons(id).filter((row) => recent.has(row[0]));
  const gp = rows.reduce((sum, row) => sum + row[1], 0);
  const shots = rows.reduce((sum, row) => sum + row[3], 0);
  const saves = rows.reduce((sum, row) => sum + row[4], 0);
  if (gp < MIN_GOALIE_GP || shots < 300) return null;
  const starts = rows.reduce((sum, row) => sum + row[2], 0);
  const weight = player.ss.reduce((sum, [year]) => sum + (year === nhlersFile.season && nhlersFile.lastComplete < year ? nhlersFile.progress : 1), 0);
  const solid = rows.filter((row) => row[1] >= 15 && row[3] > 0).map((row) => row[4] / row[3]);
  let spread: number | null = null;
  if (solid.length >= 2) {
    const mean = solid.reduce((a, b) => a + b, 0) / solid.length;
    spread = Math.sqrt(solid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / solid.length);
  }
  return { id, player, svPct: saves / shots, startsPerSeason: weight > 0 ? starts / weight : 0, spread, ipg: impactPerGame(player), gp };
}

// ---- Build everything once -------------------------------------------------------------

function build(): Map<number, SkillProfile> {
  const out = new Map<number, SkillProfile>();
  const skaters: Record<"F" | "D", SkaterRaw[]> = { F: [], D: [] };
  const goalies: GoalieRaw[] = [];
  for (const [key, player] of Object.entries(nhlersFile.players)) {
    const id = Number(key);
    if (player.g === "G") {
      const raw = goalieRaw(id, player);
      if (raw) goalies.push(raw);
    } else {
      const raw = skaterRaw(id, player);
      if (raw) skaters[player.g].push(raw);
    }
  }

  for (const group of ["F", "D"] as const) {
    const rows = skaters[group];
    const regulars = rows.filter((row) => isCurrent(row.player) && (row.player.b?.gp ?? 0) >= 80);
    const ref = Object.fromEntries(SKATER_KEYS.map((key) => [key, sortNums(regulars.map((row) => row[key]))])) as Record<SkaterKey, number[]>;
    const p = (key: SkaterKey, value: number) => pctOf(ref[key], value);
    const parts = new Map<number, { axes: SkillAxis[]; style: number }>();
    for (const row of rows) {
      const { axes, shares } = skaterAxes(row, p);
      const style = Object.entries(WEIGHTS[group]).reduce((sum, [axis, weight]) => sum + weight * shares[axis], 0);
      parts.set(row.id, { axes, style });
    }
    // Production (Impact per game) leads; the style axes break ties and reward complete players.
    const ipgStats = stats(regulars.map((row) => row.ipg));
    const styleStats = stats(regulars.map((row) => parts.get(row.id)!.style));
    const raw = (row: SkaterRaw) => 0.72 * ((row.ipg - ipgStats.mean) / ipgStats.sd) + 0.28 * ((parts.get(row.id)!.style - styleStats.mean) / styleStats.sd);
    const rawStats = stats(regulars.map(raw));
    for (const row of rows) {
      const entry = parts.get(row.id)!;
      out.set(row.id, {
        playerId: row.id,
        group,
        overall: overallFromZ((raw(row) - rawStats.mean) / rawStats.sd),
        archetype: classify(row.player),
        axes: entry.axes,
        window: windowOf(row.player),
        gp: row.player.b?.gp ?? 0,
        current: isCurrent(row.player),
      });
    }
  }

  const regularsG = goalies.filter((row) => isCurrent(row.player) && row.gp >= 60);
  const svRef = sortNums(regularsG.map((row) => row.svPct));
  const startsRef = sortNums(regularsG.map((row) => row.startsPerSeason));
  const spreadRef = sortNums(regularsG.filter((row) => row.spread != null).map((row) => row.spread as number));
  const gIpg = stats(regularsG.map((row) => row.ipg));
  const gSv = stats(regularsG.map((row) => row.svPct));
  const gStarts = stats(regularsG.map((row) => row.startsPerSeason));
  const scoreOf = (row: GoalieRaw) =>
    0.55 * ((row.ipg - gIpg.mean) / gIpg.sd) + 0.3 * ((row.svPct - gSv.mean) / gSv.sd) + 0.15 * ((row.startsPerSeason - gStarts.mean) / gStarts.sd);
  const gRaw = stats(regularsG.map(scoreOf));
  for (const row of goalies) {
    const soon = "Needs shot-location play-by-play data. Coming with Game Edge.";
    out.set(row.id, {
      playerId: row.id,
      group: "G",
      overall: overallFromZ((scoreOf(row) - gRaw.mean) / gRaw.sd),
      archetype: classify(row.player),
      axes: [
        { id: "reflexes", label: "High-Danger / Reflexes", value: toSkill(pctOf(svRef, row.svPct)), proxy: true, tip: `Save percentage (${row.svPct.toFixed(3).replace(/^0/, "")}) over his last three seasons. High-danger splits arrive with shot-location data.` },
        { id: "rebounds", label: "Rebound Control", value: null, tip: soon },
        { id: "workload", label: "Workload & Stamina", value: toSkill(pctOf(startsRef, row.startsPerSeason)), tip: `About ${Math.round(row.startsPerSeason)} starts per season.` },
        {
          id: "consistency",
          label: "Consistency",
          value: row.spread == null ? null : toSkill(1 - pctOf(spreadRef, row.spread)),
          tip: row.spread == null ? "Needs two seasons of 15+ games." : "How little his save percentage swings from season to season.",
        },
        { id: "puck", label: "Puck-Playing", value: null, tip: soon },
        { id: "clutch", label: "Clutch", value: null, tip: "Needs late-game and playoff splits. Coming with Game Edge." },
      ],
      window: windowOf(row.player),
      gp: row.gp,
      current: isCurrent(row.player),
    });
  }
  return out;
}

let cache: Map<number, SkillProfile> | null = null;

export function allSkills(): Map<number, SkillProfile> {
  if (!cache) cache = build();
  return cache;
}

export function skillsFor(playerId: number | null | undefined): SkillProfile | null {
  if (playerId == null) return null;
  return allSkills().get(playerId) ?? null;
}

export function skillTone(value: number | null): string {
  if (value == null) return "text-[#94A3B8]";
  if (value >= 90) return "text-[#F59E0B]";
  if (value >= 80) return "text-[#10B981]";
  if (value >= 65) return "text-[#38BDF8]";
  if (value >= 50) return "text-[#F8FAFC]";
  return "text-[#F97316]";
}

export function skillColor(value: number | null): string {
  if (value == null) return "#64748B";
  if (value >= 90) return "#F59E0B";
  if (value >= 80) return "#10B981";
  if (value >= 65) return "#38BDF8";
  if (value >= 50) return "#F8FAFC";
  return "#F97316";
}
