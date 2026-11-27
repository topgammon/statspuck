import rosterBios from "../../data/draft-rater/roster_bios.json";
import { meta } from "./data";
import { nhlersFile } from "./nhlers";
import { profileRows } from "./profiles";
import { allGoalieSeasons, allSkaterSeasons, statsLastSeason, statsName, teamGames } from "./season-stats";

// Single-season leaderboards (goals, assists, points, PPG, FO%, SV%, GAA...), one file per
// season at /season-leaders/{season}.json so the Leaderboards page only downloads what you open.

/** [routeId (0 = no profile), playerId, name, pos, headshot 0/1, gp, g, a, pts, plusMinus, sog, foPct|null, toiPerGameSec] */
export type SeasonSkaterRow = [number, number, string, string, number, number, number, number, number, number, number, number | null, number];
/** [routeId, playerId, name, headshot 0/1, gp, starts, svPct|null, gaa|null, shotsAgainst, saves] */
export type SeasonGoalieRow = [number, number, string, number, number, number, number | null, number | null, number, number];

export type SeasonFile = { season: number; inProgress: boolean; teamGames: number; skaters: SeasonSkaterRow[]; goalies: SeasonGoalieRow[] };

const bios = rosterBios as unknown as Record<string, { n?: string; pos?: string }>;

let who: Map<number, { routeId: number; name: string; pos: string; headshot: boolean }> | null = null;
function identity(playerId: number): { routeId: number; name: string; pos: string; headshot: boolean } | null {
  if (!who) {
    who = new Map();
    for (const row of profileRows()) who.set(row.playerId, { routeId: row.routeId, name: row.name, pos: row.pos, headshot: row.hasHeadshot });
  }
  const known = who.get(playerId);
  if (known) return known;
  const name = statsName(playerId) ?? nhlersFile.players[String(playerId)]?.n ?? bios[String(playerId)]?.n;
  if (!name) return null;
  return { routeId: 0, name, pos: nhlersFile.players[String(playerId)]?.pos ?? bios[String(playerId)]?.pos ?? "", headshot: true };
}

export function seasonList(): number[] {
  const out: number[] = [];
  for (let season = statsLastSeason; season >= 2005; season--) out.push(season);
  return out;
}

export function seasonFile(season: number): SeasonFile {
  const skaters: SeasonSkaterRow[] = [];
  for (const [key, rows] of Object.entries(allSkaterSeasons())) {
    const these = rows.filter((row) => row[0] === season);
    if (!these.length) continue;
    const pid = Number(key);
    const id = identity(pid);
    if (!id) continue;
    const sum = (i: number) => these.reduce((total, row) => total + row[i], 0);
    const gp = sum(1);
    if (gp <= 0) continue;
    const draws = sum(9) + sum(10);
    const toi = these.reduce((total, row) => total + row[11] * row[1], 0) / gp;
    skaters.push([id.routeId, pid, id.name, id.pos, id.headshot ? 1 : 0, gp, sum(2), sum(3), sum(4), sum(5), sum(7), draws >= 50 ? Math.round((sum(9) / draws) * 1000) / 10 : null, Math.round(toi)]);
  }
  const goalies: SeasonGoalieRow[] = [];
  for (const [key, rows] of Object.entries(allGoalieSeasons())) {
    const these = rows.filter((row) => row[0] === season);
    if (!these.length) continue;
    const pid = Number(key);
    const id = identity(pid);
    if (!id) continue;
    const sum = (i: number) => these.reduce((total, row) => total + row[i], 0);
    const gp = sum(1);
    if (gp <= 0) continue;
    const sa = sum(3);
    const toi = sum(6);
    goalies.push([
      id.routeId,
      pid,
      id.name,
      id.headshot ? 1 : 0,
      gp,
      sum(2),
      sa > 0 ? Math.round((sum(4) / sa) * 10000) / 10000 : null,
      toi > 0 ? Math.round(((sum(5) * 3600) / toi) * 100) / 100 : null,
      sa,
      sum(4),
    ]);
  }
  skaters.sort((a, b) => b[8] - a[8]);
  goalies.sort((a, b) => b[4] - a[4]);
  return { season, inProgress: meta.seasonInProgress === season, teamGames: teamGames(season), skaters, goalies };
}
