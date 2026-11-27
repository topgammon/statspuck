import { awardsFor } from "./awards";
import { capCeiling, capShare, playerContract } from "./cap";
import { draftClasses, leaderboard, meta, picks, teams, teamsByAbbr, undrafted } from "./data";
import { impactPerCap, profileRows } from "./profiles";
import { playerValue } from "./player-value";
import { vitalsFor, ageOn } from "./vitals";
import { franchiseAssetsFor } from "./franchise-assets";
import { teamEdge } from "./game-edge";
import { teamOverall } from "./overall-grades";

// Everything Card Studio needs, flattened into one static JSON file (/card-studio/players.json)
// so the studio page loads fast and fetches the numbers in the browser.

export type StudioPlayer = {
  /** NHL player id (headshots, Trade Machine). */
  id: number;
  /** /players/[r] */
  r: number;
  n: string;
  pos: string;
  g: "F" | "D" | "G";
  /** Current NHL team, or null. */
  t: string | null;
  /** Accent color: current team, else draft franchise. */
  c: string;
  hs: boolean;
  active: boolean;
  age: number | null;
  ht: number | null;
  wt: number | null;
  sh: string | null;
  ctry: string | null;
  /** Overall Skill 0-99, its six axes and archetype. */
  sk: number | null;
  ax: [string, number | null][];
  arch: string | null;
  st: string[];
  /** Career Impact, games, points, PPG / SV%. */
  qg: number;
  gp: number;
  pts: number | null;
  ppg: number | null;
  sv: number | null;
  aav: number | null;
  cap: number | null;
  exp: number | null;
  elc: boolean;
  cl: string | null;
  /** Asset Value 0-100, Contract Surplus Score 0-100, Impact per 1% of the cap. */
  av: number | null;
  sur: number | null;
  ipc: number | null;
  dr: { y: number; rd: number; o: number; tm: string; l: string | null; s: number | null; rx: number; dev: boolean } | null;
  /** Trophies: [name, times won]. */
  aw: [string, number][];
};

export type StudioClassPick = { id: number | null; r: number; n: string; o: number; rd: number; tm: string; qg: number; s: number | null; l: string | null; hs: boolean };

export type StudioClass = { y: number; l: string | null; rating: number | null; top: StudioClassPick[]; steals: StudioClassPick[] };

/** Team head-to-head numbers: grades as [rating, letter]; goals per game; PP/PK %; net penalties drawn per game. */
export type StudioTeamStats = {
  ov: [number, string] | null;
  dr: [number, string] | null;
  dv: [number, string] | null;
  fa: number | null;
  cs: number | null;
  gf: number | null;
  ga: number | null;
  pp: number | null;
  pk: number | null;
  pn: number | null;
};

export type StudioTeam = { abbr: string; name: string; short: string; color: string; l: string | null; x?: StudioTeamStats };

export type StudioData = { asOf: string; ceiling: number; players: StudioPlayer[]; classes: StudioClass[]; teams: StudioTeam[] };

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildStudioData(): StudioData {
  const pickByPlayer = new Map(picks.filter((pick) => pick.playerId != null && !pick.forfeited).map((pick) => [pick.playerId as number, pick]));
  const undraftedByPlayer = new Map(undrafted.map((player) => [player.playerId, player]));
  const players: StudioPlayer[] = [];
  for (const row of profileRows()) {
    const pick = pickByPlayer.get(row.playerId) ?? null;
    const und = pick ? null : (undraftedByPlayer.get(row.playerId) ?? null);
    const base = pick ?? und;
    if (!base) continue;
    const awards = awardsFor(row.playerId);
    // Keep the file small: active players, plus notable retired careers.
    if (!row.active && base.gpCareer < 200 && !awards.length) continue;
    if (row.active && base.gpCareer === 0 && !row.contract && !pick) continue;
    const vitals = vitalsFor(row.routeId);
    const contract = row.active ? playerContract(row.playerId) : null;
    const value = playerValue({ playerId: row.playerId, pick, retired: !row.active });
    const franchise = pick?.franchise ?? und?.franchise ?? null;
    const color = (row.team ? teamsByAbbr.get(row.team)?.color : null) ?? (franchise ? teamsByAbbr.get(franchise)?.color : null) ?? "#38BDF8";
    const ipc = impactPerCap(row);
    players.push({
      id: row.playerId,
      r: row.routeId,
      n: row.name,
      pos: row.pos,
      g: row.group,
      t: row.team,
      c: color,
      hs: row.hasHeadshot,
      active: row.active,
      age: ageOn(vitals?.bd, meta.asOf),
      ht: vitals?.h ?? null,
      wt: vitals?.w ?? null,
      sh: vitals?.sc ?? null,
      ctry: vitals?.ctry ?? pick?.country ?? null,
      sk: row.skills?.overall ?? null,
      ax: (row.skills?.axes ?? []).map((axis) => [axis.label.replace("High-Danger / ", ""), axis.value]),
      arch: row.skills?.archetype ?? null,
      st: row.stamps,
      qg: Math.round(base.qg),
      gp: base.gpCareer,
      pts: base.points,
      ppg: base.ppg,
      sv: base.savePct,
      aav: contract?.aav ?? null,
      cap: contract ? round1(capShare(contract.aav) * 100) : null,
      exp: contract?.expires ?? null,
      elc: Boolean(contract?.elc),
      cl: contract?.clause ?? null,
      av: value.kind === "inactive" ? null : Math.round(value.rating),
      sur: value.kind === "contract" ? Math.max(0, Math.min(100, Math.round(50 + value.asset.value / 400_000))) : null,
      ipc: ipc == null || (row.recentRate ?? 0) < 20 ? null : round1(ipc),
      dr: pick
        ? { y: pick.year, rd: pick.round, o: pick.overall, tm: pick.team, l: pick.developing ? null : pick.letter, s: pick.score == null ? null : Math.round(pick.score), rx: pick.redraft, dev: pick.developing }
        : null,
      aw: awards.map((award) => [award.name, award.seasons.length]),
    });
  }

  const brief = (pick: (typeof picks)[number]): StudioClassPick => ({
    id: pick.playerId,
    r: pick.id,
    n: pick.name,
    o: pick.overall,
    rd: pick.round,
    tm: pick.team,
    qg: Math.round(pick.qg),
    s: pick.score == null ? null : Math.round(pick.score),
    l: pick.developing ? null : pick.letter,
    hs: pick.hasHeadshot && pick.playerId != null,
  });
  const classes: StudioClass[] = draftClasses
    .map((cls) => {
      const pool = picks.filter((pick) => pick.year === cls.year && !pick.forfeited);
      const top = [...pool].sort((a, b) => a.redraft - b.redraft).slice(0, 5).map(brief);
      const steals = pool
        .filter((pick) => pick.round >= 2 && pick.score != null && pick.qg > 0)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5)
        .map(brief);
      return { y: cls.year, l: cls.letter ?? null, rating: cls.rating ?? null, top, steals };
    })
    .sort((a, b) => b.y - a.y);

  const byAbbr = new Map(leaderboard.map((team) => [team.abbr, team]));
  return {
    asOf: meta.asOf,
    ceiling: capCeiling,
    players,
    classes,
    teams: teams.map((team) => {
      const grade = byAbbr.get(team.abbr);
      const overall = teamOverall(team.abbr);
      const assets = franchiseAssetsFor(team.abbr);
      const edge = teamEdge(team.abbr);
      const goals = (table: Partial<Record<string, [number, number]>> | undefined) =>
        edge && edge.weightGames ? round2(Object.values(table ?? {}).reduce((s, v) => s + (v?.[1] ?? 0), 0) / edge.weightGames) : null;
      return {
        abbr: team.abbr,
        name: team.name,
        short: team.short,
        color: team.color,
        l: grade?.letter ?? null,
        x: {
          ov: overall ? [overall.rating, overall.letter] : null,
          dr: grade ? [Math.round(grade.rating), grade.letter] : null,
          dv: grade?.dev && grade.dev.rating != null && grade.dev.letter ? [Math.round(grade.dev.rating), grade.dev.letter] : null,
          fa: assets ? Math.round(assets.total) : null,
          cs: assets ? assets.capSpace : null,
          gf: goals(edge?.for),
          ga: goals(edge?.against),
          pp: edge?.ppPct != null ? round1(edge.ppPct * 100) : null,
          pk: edge?.pkPct != null ? round1(edge.pkPct * 100) : null,
          pn: edge ? round2(edge.drawn - edge.taken) : null,
        },
      };
    }),
  };
}
