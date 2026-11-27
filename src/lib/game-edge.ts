import chemistryJson from "../../data/game-edge/chemistry.json";
import goaliesJson from "../../data/game-edge/goalies.json";
import playersJson from "../../data/game-edge/players.json";
import teamsJson from "../../data/game-edge/teams.json";
import todayJson from "../../data/game-edge/today.json";
import chemistry2Json from "../../data/game-edge/chemistry-2yr.json";
import goalies2Json from "../../data/game-edge/goalies-2yr.json";
import players2Json from "../../data/game-edge/players-2yr.json";
import teams2Json from "../../data/game-edge/teams-2yr.json";
import { profileRows } from "./profiles";
import { playerHref, type EntityTab } from "./routes";

// Game Edge data, built nightly by pipelines/game-edge/build.py from free NHL play-by-play
// and shift charts. Default view = this season only; "two" adds last season at full weight.

/** [shots on goal, goals] */
export type SG = [number, number];

export type Chance = "rebound" | "rush" | "royal" | "tip" | "netfront" | "slot" | "point" | "other";
export type IceZone = "netfront" | "highslot" | "leftcircle" | "rightcircle" | "point";

export const CHANCE_LABEL: Record<Chance, string> = {
  rebound: "Rebounds",
  rush: "Rush",
  royal: "Royal-Road",
  tip: "Tips & Deflections",
  netfront: "Net-Front",
  slot: "Slot / Mid-Range",
  point: "Point / Perimeter",
  other: "Other",
};

export const CHANCE_TIP: Record<Chance, string> = {
  rebound: "Shot within 2.5 seconds of a saved shot by the same team.",
  rush: "Shot within 5 seconds of the puck being in the neutral or defensive zone (takeaway, faceoff, giveaway or opponent shot).",
  royal: "Shot within 2 seconds of an offensive-zone event on the other side of the ice (cross-ice pass proxy).",
  tip: "Official NHL shot type: tip-in or deflection.",
  netfront: "Shot from inside 10 feet of the goal line, in the crease / low-slot box.",
  slot: "Everything else between the dots: the home-plate area.",
  point: "Shot from near the blue line or outside the faceoff dots.",
  other: "No coordinates recorded.",
};

export const ZONE_LABEL: Record<IceZone, string> = {
  netfront: "Net-Front",
  highslot: "High Slot",
  leftcircle: "Left Circle",
  rightcircle: "Right Circle",
  point: "Point",
};

export const SHOT_LABEL: Record<string, string> = {
  wrist: "Wrist",
  snap: "Snap",
  slap: "Slap",
  backhand: "Backhand",
  "tip-in": "Tip-In",
  deflected: "Deflected",
  "wrap-around": "Wrap-Around",
  other: "Other",
};

export type Unit = { team: string; ids: number[]; names: string[]; toi: number; cf: number; gf: number | null; goals: [number, number]; delta: number };

export type TeamEdge = {
  games: number;
  weightGames: number;
  minutes: number;
  for: Partial<Record<Chance, SG>>;
  against: Partial<Record<Chance, SG>>;
  shotFor: Record<string, SG>;
  shotAgainst: Record<string, SG>;
  pp: Record<string, number>;
  pk: Record<string, number>;
  taken: number;
  drawn: number;
  ppPct: number | null;
  pkPct: number | null;
  ppOpp: number;
  goalies: number[];
  lines: Unit[];
  pairs: Unit[];
  refs: { best: RefSplit[]; worst: RefSplit[]; all: Record<string, [number, number]> };
};

export type RefSplit = { slug: string; name: string; games: number; delta: number; taken?: number; drawn?: number };

export type GoalieEdge = {
  id: number;
  name: string;
  team: string | null;
  gp: number;
  sa: number;
  ga: number;
  sv: number | null;
  chance: Partial<Record<Chance, SG>>;
  zone: Partial<Record<IceZone, SG>>;
  type: Record<string, SG>;
};

export type PlayerEdge = {
  shots: number;
  goals: number;
  cells: [number, number, number][];
  type: Record<string, SG>;
  chance: Partial<Record<Chance, SG>>;
  toi5: number;
  cf5: number | null;
  mates: { id: number; name: string; toi: number; cf: number; delta: number }[];
  lift: number;
  refs: { best: RefSplit[]; worst: RefSplit[] };
};

type TeamsFile = {
  asOf: string;
  current: number;
  league: {
    for: Partial<Record<Chance, SG>>;
    shot: Record<string, SG>;
    teamGames: number;
    taken: number;
    ppPct: number;
    sv: number | null;
  };
  teams: Record<string, TeamEdge>;
};

type GoaliesFile = { asOf: string; league: { sv: number | null; chance: Record<string, SG>; zone: Record<string, SG>; type: Record<string, SG> }; goalies: GoalieEdge[] };
type PlayersFile = { asOf: string; players: Record<string, PlayerEdge> };
type ChemistryFile = { asOf: string; lines: Unit[]; pairs: Unit[]; bonus: Record<string, number> };

/** "season" = this season only (the default everywhere). "two" = this season + last season. */
export type EdgeView = "season" | "two";

const DATA: Record<EdgeView, { teams: TeamsFile; goalies: GoaliesFile; players: PlayersFile; chemistry: ChemistryFile }> = {
  season: {
    teams: teamsJson as unknown as TeamsFile,
    goalies: goaliesJson as unknown as GoaliesFile,
    players: playersJson as unknown as PlayersFile,
    chemistry: chemistryJson as unknown as ChemistryFile,
  },
  two: {
    teams: teams2Json as unknown as TeamsFile,
    goalies: goalies2Json as unknown as GoaliesFile,
    players: players2Json as unknown as PlayersFile,
    chemistry: chemistry2Json as unknown as ChemistryFile,
  },
};
const today = todayJson as unknown as { date: string; games: { id: number; start: string; away: string; home: string; refs: string[] }[] };

export const edgeAsOf = DATA.season.teams.asOf;
export const edgeCurrentSeason = DATA.season.teams.current;

export function leagueEdgeFor(view: EdgeView = "season") {
  return DATA[view].teams.league;
}

export function leagueGoalieFor(view: EdgeView = "season") {
  return DATA[view].goalies.league;
}

export function teamEdge(abbr: string, view: EdgeView = "season"): TeamEdge | undefined {
  return DATA[view].teams.teams[abbr];
}

export function allTeamEdges(view: EdgeView = "season"): Record<string, TeamEdge> {
  return DATA[view].teams.teams;
}

export function allGoalieEdges(view: EdgeView = "season"): GoalieEdge[] {
  return DATA[view].goalies.goalies;
}

export function goalieEdge(id: number, view: EdgeView = "season"): GoalieEdge | undefined {
  return DATA[view].goalies.goalies.find((g) => g.id === id);
}

export function playerEdge(id: number | null | undefined, view: EdgeView = "season"): PlayerEdge | undefined {
  return id == null ? undefined : DATA[view].players.players[String(id)];
}

export function topLines(view: EdgeView = "season"): Unit[] {
  return DATA[view].chemistry.lines;
}

export function topPairs(view: EdgeView = "season"): Unit[] {
  return DATA[view].chemistry.pairs;
}

/** Perfect Roster chemistry bonus (value points, -3..+3) from this season's 5v5 WOWY chemistry lift. */
export function chemistryBonusFor(playerId: number): number {
  return DATA.season.chemistry.bonus[String(playerId)] ?? 0;
}

export function todaysGames() {
  return today;
}

let routeMap: Map<number, number> | null = null;

/** Profile link for an NHL player id (profiles live at /players/[routeId]); null if he has no page. */
export function playerIdHref(playerId: number, tab?: EntityTab): string | null {
  if (!routeMap) routeMap = new Map(profileRows().map((r) => [r.playerId, r.routeId]));
  const route = routeMap.get(playerId);
  return route == null ? null : playerHref(route, tab);
}

/** Share of the total for each key. */
export function shares<K extends string>(table: Partial<Record<K, SG>>, index: 0 | 1): Partial<Record<K, number>> {
  const total = Object.values(table).reduce<number>((sum, v) => sum + ((v as SG | undefined)?.[index] ?? 0), 0);
  const out: Partial<Record<K, number>> = {};
  for (const [k, v] of Object.entries(table) as [K, SG][]) out[k] = total ? v[index] / total : 0;
  return out;
}

/** Save percentage on a [shots, goals] pair. */
export function svPct(sg: SG | undefined): number | null {
  if (!sg || sg[0] < 1) return null;
  return 1 - sg[1] / sg[0];
}
