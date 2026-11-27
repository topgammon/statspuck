import debutsJson from "../../data/draft-rater/debuts.json";
import { picks, undrafted } from "./data";
import { pathFor } from "./development";
import { profileRows, type ProfileRow } from "./profiles";
import { goalieSeasons, skaterSeasons } from "./season-stats";

// Milestone Watch and NHL Debuts.
//
// Career totals come from our season box scores, which start in 2005-06. Nearly every active
// player debuted after that; the few who did not would be undercounted, so they are left out.

export type MilestoneStat = "gp" | "goals" | "points" | "wins";

export const STAT_LABEL: Record<MilestoneStat, string> = { gp: "Games played", goals: "Goals", points: "Points", wins: "Goalie wins" };

/** The headline milestones Milestone Watch tracks. */
export const MAJOR: Record<MilestoneStat, number> = { gp: 1000, goals: 500, points: 1000, wins: 300 };

/** Round-number steps for the Career tab's "next milestone" bars. */
const STEPS: Record<MilestoneStat, number[]> = {
  gp: [100, 250, 500, 750, 1000, 1250, 1500, 1750],
  goals: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900],
  points: [100, 250, 500, 750, 1000, 1250, 1500, 1750],
  wins: [50, 100, 200, 300, 400, 500, 600],
};

export const WATCH_WINDOW = 25;

export type Totals = { gp: number; goals: number; points: number; wins: number; firstSeason: number | null; goalie: boolean };

export function careerTotals(playerId: number, goalie: boolean): Totals {
  if (goalie) {
    const rows = goalieSeasons(playerId);
    return { gp: rows.reduce((s, r) => s + r[1], 0), goals: 0, points: 0, wins: rows.reduce((s, r) => s + (r[8] ?? 0), 0), firstSeason: rows.length ? Math.min(...rows.map((r) => r[0])) : null, goalie };
  }
  const rows = skaterSeasons(playerId);
  return {
    gp: rows.reduce((s, r) => s + r[1], 0),
    goals: rows.reduce((s, r) => s + r[2], 0),
    points: rows.reduce((s, r) => s + r[4], 0),
    wins: 0,
    firstSeason: rows.length ? Math.min(...rows.map((r) => r[0])) : null,
    goalie,
  };
}

export type Progress = { stat: MilestoneStat; value: number; target: number; previous: number; remaining: number };

/** Next round-number milestone for each stat that applies to this player. */
export function nextMilestones(playerId: number, goalie: boolean): Progress[] {
  const totals = careerTotals(playerId, goalie);
  const stats: MilestoneStat[] = goalie ? ["gp", "wins"] : ["gp", "goals", "points"];
  return stats.flatMap((stat) => {
    const value = totals[stat];
    const target = STEPS[stat].find((step) => step > value);
    if (!target) return [];
    const previous = [...STEPS[stat]].reverse().find((step) => step <= value) ?? 0;
    return [{ stat, value, target, previous, remaining: target - value }];
  });
}

export type Watch = { row: ProfileRow; stat: MilestoneStat; value: number; target: number; remaining: number };

/** Active players within 25 of 1,000 GP, 500 goals, 1,000 points or 300 wins (or just past them this season). */
export function milestoneWatch(): Watch[] {
  const out: Watch[] = [];
  for (const row of profileRows()) {
    if (!row.active) continue;
    const goalie = row.group === "G";
    const totals = careerTotals(row.playerId, goalie);
    if (totals.firstSeason == null) continue;
    const stats: MilestoneStat[] = goalie ? ["gp", "wins"] : ["gp", "goals", "points"];
    for (const stat of stats) {
      const target = MAJOR[stat];
      const value = totals[stat];
      if (value < target && target - value <= WATCH_WINDOW) out.push({ row, stat, value, target, remaining: target - value });
    }
  }
  return out.sort((a, b) => a.remaining / a.target - b.remaining / b.target);
}

// ---- NHL Debuts --------------------------------------------------------------------------

type DebutRaw = {
  playerId: number;
  date: string;
  team: string;
  opponent: string;
  home: boolean;
  goals: number;
  assists: number;
  points: number;
  shots: number | null;
  toi: string | null;
  gp: number;
  goalie: { decision: string | null; shotsAgainst: number | null; goalsAgainst: number | null; savePct: number | null } | null;
};

const debutFile = debutsJson as unknown as { season: number; players: DebutRaw[] };

export type Debut = DebutRaw & { routeId: number | null; name: string; draft: string; path: string | null; headshot: boolean };

export function nhlDebuts(): Debut[] {
  const pickByPlayer = new Map(picks.filter((p) => p.playerId != null).map((p) => [p.playerId as number, p]));
  const undraftedByPlayer = new Map(undrafted.map((u) => [u.playerId, u]));
  const profiles = new Map(profileRows().map((row) => [row.playerId, row]));
  return debutFile.players.map((raw) => {
    const pick = pickByPlayer.get(raw.playerId);
    const und = undraftedByPlayer.get(raw.playerId);
    const profile = profiles.get(raw.playerId);
    let path: string | null = null;
    if (pick) {
      const p = pathFor(pick.id);
      const leagues = p ? [...new Set(p.b.slice(1).filter((b) => b !== "None" && b !== "NHL"))] : [];
      path = [pick.league ?? pick.amateur ?? null, ...leagues].filter(Boolean).join(" → ") || null;
    } else if (und?.origin?.league) path = und.origin.league;
    return {
      ...raw,
      routeId: pick?.id ?? und?.id ?? null,
      name: profile?.name ?? pick?.name ?? und?.name ?? `Player ${raw.playerId}`,
      draft: pick ? `${pick.year} · R${pick.round} #${pick.overall} · ${pick.team}` : "Undrafted",
      path,
      headshot: pick?.hasHeadshot ?? true,
    };
  });
}

export const debutSeason = debutFile.season;
