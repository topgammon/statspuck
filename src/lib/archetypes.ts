import { pathFor, type Bucket } from "./development";
import { nhlersFile, type Group, type Nhler } from "./nhlers";
import type { PickRow } from "./types";

// Auto-classified player archetypes. No manual tags: every label comes from box-score
// rates, ice-time split and physical profile over a player's last three NHL seasons,
// compared with today's NHL regulars at the same position group.

import type { Archetype } from "./archetype-meta";

export { ARCHETYPE_TIP, type Archetype } from "./archetype-meta";

/** Minimum games in the last three seasons before we label a skater. */
const MIN_SKATER_GP = 40;

type Rates = {
  gp: number;
  gpg: number;
  apg: number;
  ptsg: number;
  sogg: number;
  blkg: number;
  pimg: number;
  toi: number;
  evMin: number;
  ppMin: number;
  pkMin: number;
  fowPct: number | null;
  draws: number;
  pmg: number;
  goalShare: number;
};

export function ratesOf(player: Nhler): Rates | null {
  const b = player.b;
  if (!b || b.gp <= 0) return null;
  const draws = b.fw + b.fl;
  return {
    gp: b.gp,
    gpg: b.g / b.gp,
    apg: b.a / b.gp,
    ptsg: b.pts / b.gp,
    sogg: b.sog / b.gp,
    blkg: b.blk / b.gp,
    pimg: b.pim / b.gp,
    toi: (b.ev + b.pp + b.pk) / b.gp / 60,
    evMin: b.ev / b.gp / 60,
    ppMin: b.pp / b.gp / 60,
    pkMin: b.pk / b.gp / 60,
    fowPct: draws > 0 ? b.fw / draws : null,
    draws,
    pmg: b.pm / b.gp,
    goalShare: b.g + b.a > 0 ? b.g / (b.g + b.a) : 0.5,
  };
}

type Reference = Record<keyof Omit<Rates, "fowPct" | "draws" | "gp">, number[]>;

const KEYS = ["gpg", "apg", "ptsg", "sogg", "blkg", "pimg", "toi", "evMin", "ppMin", "pkMin", "pmg", "goalShare"] as const;

function buildReference(group: Group): Reference {
  const rows: Rates[] = [];
  for (const player of Object.values(nhlersFile.players)) {
    if (player.g !== group || !player.b) continue;
    const last = player.ss[player.ss.length - 1]?.[0] ?? 0;
    if (last < nhlersFile.season - 1 || player.b.gp < 80) continue;
    const rates = ratesOf(player);
    if (rates) rows.push(rates);
  }
  const out = {} as Reference;
  for (const key of KEYS) out[key] = rows.map((row) => row[key]).sort((a, b) => a - b);
  return out;
}

const reference: Record<"F" | "D", Reference> = { F: buildReference("F"), D: buildReference("D") };

/** Share of NHL regulars at this position group with a lower value, 0 to 1. */
function rank(group: "F" | "D", key: (typeof KEYS)[number], value: number): number {
  const sorted = reference[group][key];
  if (!sorted.length) return 0.5;
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < value) low = mid + 1;
    else high = mid;
  }
  return low / sorted.length;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function classifyForward(player: Nhler, r: Rates): Archetype {
  const p = (key: (typeof KEYS)[number]) => rank("F", key, r[key]);
  const big = (player.h ?? 0) >= 74 || (player.w ?? 0) >= 205;
  const cands: [Archetype, number][] = [];

  if (r.goalShare >= 0.46 && p("gpg") >= 0.7 && p("sogg") >= 0.6) {
    cands.push(["Sniper", mean([p("gpg"), p("sogg")]) + (r.goalShare - 0.4)]);
  }
  if (r.goalShare <= 0.42 && p("apg") >= 0.7 && p("ppMin") >= 0.5) {
    cands.push(["Playmaker", mean([p("apg"), p("ppMin")]) + (0.45 - r.goalShare)]);
  }
  const bruiser = [p("sogg") >= 0.6, p("pimg") >= 0.6, p("ptsg") >= 0.55].filter(Boolean).length;
  if (big && bruiser >= 2) {
    cands.push(["Power Forward", mean([p("sogg"), p("pimg"), p("ptsg")]) + 0.05 * bruiser]);
  }
  const faceoffsOk = r.fowPct == null || r.draws < 150 || r.fowPct >= 0.5;
  if (p("pkMin") >= 0.7 && r.pmg >= 0 && faceoffsOk) {
    cands.push(["Two-Way Forward", mean([p("pkMin"), r.fowPct != null && r.draws >= 150 ? r.fowPct : 0.5, p("pmg")])]);
  }
  if (p("toi") <= 0.4 && (p("pkMin") >= 0.45 || p("pimg") >= 0.5 || p("blkg") >= 0.5)) {
    cands.push(["Depth Grinder", 1 - p("toi") + 0.2]);
  }
  if (cands.length) return cands.sort((a, b) => b[1] - a[1])[0][0];

  // No clear signature: low minutes means a depth role, otherwise lean on the scoring split.
  if (p("toi") <= 0.45) return "Depth Grinder";
  if (p("gpg") >= 0.5 && r.goalShare >= 0.45) return "Sniper";
  if (p("apg") >= 0.5) return "Playmaker";
  return "Two-Way Forward";
}

function classifyDefense(r: Rates): Archetype {
  const p = (key: (typeof KEYS)[number]) => rank("D", key, r[key]);
  const cands: [Archetype, number][] = [];
  if (p("ptsg") >= 0.7 && p("ppMin") >= 0.55) cands.push(["Puck-Moving D", mean([p("ptsg"), p("ppMin")])]);
  if (p("pkMin") >= 0.65 && p("blkg") >= 0.6 && p("ptsg") <= 0.6) cands.push(["Shutdown D", mean([p("pkMin"), p("blkg")])]);
  if (p("evMin") >= 0.55 && p("ptsg") >= 0.4 && p("pkMin") >= 0.45) cands.push(["Two-Way D", mean([p("evMin"), p("pkMin"), p("ptsg")])]);
  if (cands.length) return cands.sort((a, b) => b[1] - a[1])[0][0];
  const offense = mean([p("ptsg"), p("ppMin")]);
  const defense = mean([p("pkMin"), p("blkg")]);
  if (offense - defense > 0.2) return "Puck-Moving D";
  if (defense - offense > 0.2) return "Shutdown D";
  return "Two-Way D";
}

/** Starts per 82-game season over the last two seasons. The season in progress counts only for the share played. */
export function annualStarts(player: Nhler): number | null {
  const season = nhlersFile.season;
  let starts = 0;
  let weight = 0;
  for (const [year, , , s] of player.ss) {
    if (year < season - 1) continue;
    const share = year === season && nhlersFile.lastComplete < season ? nhlersFile.progress : 1;
    starts += s;
    weight += share;
  }
  return weight > 0.15 ? starts / weight : null;
}

export function classify(player: Nhler | null): Archetype | null {
  if (!player) return null;
  if (player.g === "G") {
    const starts = annualStarts(player);
    if (starts == null) return null;
    if (starts >= 55) return "Workhorse Starter";
    if (starts >= 30) return "Tandem / 1B";
    return "Backup";
  }
  const rates = ratesOf(player);
  if (!rates || rates.gp < MIN_SKATER_GP) return null;
  return player.g === "D" ? classifyDefense(rates) : classifyForward(player, rates);
}

// ---- Prospect projection tiers ---------------------------------------------------------

export type ProspectTier = "BLUE-CHIP" | "TOP-6 / TOP-4 PROJ" | "NHL DEPTH PROJ" | "LONGSHOT";

export const PROSPECT_TIERS: ProspectTier[] = ["BLUE-CHIP", "TOP-6 / TOP-4 PROJ", "NHL DEPTH PROJ", "LONGSHOT"];

export type TierResult = {
  tier: ProspectTier;
  /** What to print on the pill: the top tier is position-specific. */
  label: string;
  /** 0 (LONGSHOT) to 3 (BLUE-CHIP). Drives the glow. */
  level: 0 | 1 | 2 | 3;
  score: number;
  tip: string;
};

function slotScore(overall: number): number {
  if (overall <= 5) return 3;
  if (overall <= 15) return 2.5;
  if (overall <= 32) return 1.9;
  if (overall <= 64) return 1.3;
  if (overall <= 96) return 0.8;
  return 0.35;
}

const LEVEL: Record<Bucket, number> = { NHL: 2.6, AHL: 2, SHL: 2.1, KHL: 2.1, Liiga: 1.8, Other: 1.6, NCAA: 1.5, CHL: 1.4, USHL: 0.9, None: 0 };

/** Progress at D+1 and D+2: the league level he reached and how much he played there. */
function progressScore(pick: PickRow): { score: number; note: string } {
  const path = pathFor(pick.id);
  if (!path) return { score: 1, note: "no path data" };
  const years = [1, 2].filter((y) => y <= pick.draftPlus && y < path.b.length);
  if (!years.length) return { score: 1, note: "too early to judge" };
  const parts = years.map((y) => {
    const bucket = path.b[y];
    let level = LEVEL[bucket] ?? 1;
    if (bucket === "NHL") level += Math.min(0.4, (path.nhl[y] ?? 0) / 82 * 0.4);
    else if (bucket !== "None") level += Math.min(0.3, (path.gp[y] ?? 0) / 70 * 0.3);
    return level;
  });
  const latest = years[years.length - 1];
  return { score: mean(parts), note: `${path.b[latest]} at D+${latest}` };
}

/** Projection tier for a DEVELOPING prospect, from draft slot plus how he progressed at D+1 / D+2. */
export function prospectTier(pick: PickRow): TierResult | null {
  if (!pick.stamps.includes("DEVELOPING")) return null;
  const slot = slotScore(pick.overall);
  const progress = progressScore(pick);
  const score = 0.6 * slot + 0.4 * progress.score;
  const topLabel = pick.group === "D" ? "TOP-4 PROJ" : pick.group === "G" ? "STARTER PROJ" : "TOP-6 PROJ";
  const basis = `Pick #${pick.overall} plus ${progress.note}.`;
  if (score >= 2.35) return { tier: "BLUE-CHIP", label: "BLUE-CHIP", level: 3, score, tip: `Elite pedigree and production. ${basis}` };
  if (score >= 1.75) return { tier: "TOP-6 / TOP-4 PROJ", label: topLabel, level: 2, score, tip: `Projects as a top-line contributor. ${basis}` };
  if (score >= 1.2) return { tier: "NHL DEPTH PROJ", label: "NHL DEPTH PROJ", level: 1, score, tip: `Projects as an NHL depth player. ${basis}` };
  return { tier: "LONGSHOT", label: "LONGSHOT", level: 0, score, tip: `Needs a big step forward. ${basis}` };
}
