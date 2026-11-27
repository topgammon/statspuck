import { nhlerFor, nhlersFile } from "./nhlers";
import { profileRows, type ProfileRow } from "./profiles";
import { goalieSeasons, skaterSeasons } from "./season-stats";

// Trophy Favorites: top 5 for the Hart, Norris, Vezina, Calder and Selke, from this season only.
//
// Every race uses a Luck-Adjusted Impact pace:
//   skaters - goals above what his shot volume and his own career shooting % (pulled toward the
//             league's ~10%) would predict are taken back out (0.75 Impact per goal, the same
//             weight Impact gives a goal);
//   goalies - this season's save % is pulled toward his career save % in proportion to sample
//             size, and the goals-saved part of Impact is recomputed (0.65 per goal).
// Then each race blends that pace with the Overall Skill Rating and its own trophy angle.

export type TrophyId = "hart" | "norris" | "vezina" | "calder" | "selke";

export type Favorite = {
  routeId: number;
  playerId: number;
  name: string;
  pos: string;
  team: string | null;
  headshot: boolean;
  gp: number;
  line: string;
  pace: number;
  luck: number;
  skill: number | null;
  score: number;
};

export type Race = { id: TrophyId; name: string; award: string; blurb: string; favorites: Favorite[] };

const LEAGUE_SH = 0.1;
const SH_PRIOR_SHOTS = 300;
const SV_PRIOR_SHOTS = 1500;

type Line = { row: ProfileRow; gp: number; impact: number; adjusted: number; luck: number; text: string; rookie: boolean; defense: number | null };

function season(): number {
  return nhlersFile.season;
}

function rookie(row: ProfileRow, playerId: number): boolean {
  // NHL rule, simplified: no prior season of 25+ games, fewer than 6 games in each of two prior seasons, age under 26.
  const current = season();
  const rows = row.group === "G" ? goalieSeasons(playerId) : skaterSeasons(playerId);
  const prior = rows.filter((r) => r[0] < current);
  if (prior.some((r) => r[1] >= 25)) return false;
  if (prior.filter((r) => r[1] >= 6).length >= 2) return false;
  const bd = nhlerFor(playerId)?.bd;
  if (bd) {
    const [y, m, d] = bd.split("-").map(Number);
    const ageSept15 = current - y - (m > 9 || (m === 9 && d > 15) ? 1 : 0);
    if (ageSept15 >= 26) return false;
  }
  return true;
}

function lineFor(row: ProfileRow): Line | null {
  const current = season();
  const nhler = nhlerFor(row.playerId);
  const now = nhler?.ss.find((s) => s[0] === current);
  if (!now || now[1] < 8) return null;
  const [, gp, impact] = now;
  if (row.group === "G") {
    const rows = goalieSeasons(row.playerId);
    const cur = rows.filter((r) => r[0] === current);
    const sa = cur.reduce((s, r) => s + r[3], 0);
    const sv = cur.reduce((s, r) => s + r[4], 0);
    const ga = cur.reduce((s, r) => s + r[5], 0);
    const toi = cur.reduce((s, r) => s + r[6], 0);
    const wins = cur.reduce((s, r) => s + (r[8] ?? 0), 0);
    const careerSa = rows.filter((r) => r[0] < current).reduce((s, r) => s + r[3], 0);
    const careerSv = rows.filter((r) => r[0] < current).reduce((s, r) => s + r[4], 0);
    if (sa <= 0) return null;
    const svPct = sv / sa;
    const norm = careerSa > 0 ? careerSv / careerSa : 0.905;
    const blended = (svPct * sa + norm * SV_PRIOR_SHOTS) / (sa + SV_PRIOR_SHOTS);
    const luckGoals = (svPct - blended) * sa;
    const adjusted = impact - 0.65 * luckGoals;
    const gaa = toi > 0 ? (ga * 3600) / toi : 0;
    return { row, gp, impact, adjusted, luck: impact - adjusted, text: `${wins} W · ${svPct.toFixed(3).replace(/^0/, "")} SV% · ${gaa.toFixed(2)} GAA`, rookie: rookie(row, row.playerId), defense: null };
  }
  const rows = skaterSeasons(row.playerId);
  const cur = rows.filter((r) => r[0] === current);
  const g = cur.reduce((s, r) => s + r[2], 0);
  const a = cur.reduce((s, r) => s + r[3], 0);
  const sog = cur.reduce((s, r) => s + r[7], 0);
  const careerShots = rows.filter((r) => r[0] < current).reduce((s, r) => s + r[7], 0);
  const careerGoals = rows.filter((r) => r[0] < current).reduce((s, r) => s + r[2], 0);
  const norm = (careerGoals + LEAGUE_SH * SH_PRIOR_SHOTS) / (careerShots + SH_PRIOR_SHOTS);
  const luckGoals = g - sog * norm;
  const adjusted = impact - 0.75 * luckGoals;
  const defense = row.skills?.axes.find((axis) => axis.id === "defense")?.value ?? null;
  return { row, gp, impact, adjusted, luck: impact - adjusted, text: `${g} G · ${a} A · ${g + a} PTS`, rookie: rookie(row, row.playerId), defense };
}

const per82 = (line: Line) => (line.adjusted / Math.max(1, line.gp)) * 82;

function favorite(line: Line, score: number): Favorite {
  return {
    routeId: line.row.routeId,
    playerId: line.row.playerId,
    name: line.row.name,
    pos: line.row.pos,
    team: line.row.team,
    headshot: line.row.hasHeadshot,
    gp: line.gp,
    line: line.text,
    pace: Math.round(per82(line) * 10) / 10,
    luck: Math.round(line.luck * 10) / 10,
    skill: line.row.skills?.current ? line.row.skills.overall : null,
    score: Math.round(score * 10) / 10,
  };
}

/** Share of his team's games played so far, so a hot 10-game start does not top a full season. */
function availability(line: Line, maxGp: number): number {
  return Math.min(1, line.gp / Math.max(1, maxGp));
}

export function trophyRaces(): Race[] {
  const lines = profileRows()
    .filter((row) => row.active)
    .map(lineFor)
    .filter((line): line is Line => line != null);
  const maxGp = Math.max(1, ...lines.map((l) => l.gp));
  const skill = (line: Line) => (line.row.skills?.current ? line.row.skills.overall : 65);
  const top = (pool: Line[], score: (l: Line) => number) =>
    pool
      .map((line) => ({ line, s: score(line) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(({ line, s }) => favorite(line, s));

  const skaters = lines.filter((l) => l.row.group !== "G");
  const goalies = lines.filter((l) => l.row.group === "G");
  // A goalie's Impact per 82 games sits a little below an elite skater's; a small lift lets a truly
  // dominant season contend for the Hart, as in real voting, without goalies flooding the race.
  const hartScore = (l: Line) => (l.row.group === "G" ? per82(l) * 1.1 : per82(l)) * availability(l, maxGp) + 0.8 * skill(l);

  return [
    {
      id: "hart",
      name: "Hart Trophy",
      award: "Most valuable player",
      blurb: "Luck-adjusted Impact pace over the games played so far, plus Overall Skill.",
      favorites: top(lines, hartScore),
    },
    {
      id: "norris",
      name: "Norris Trophy",
      award: "Best defenseman",
      blurb: "Defensemen only: luck-adjusted Impact pace, Overall Skill and the Defense skill axis.",
      favorites: top(
        skaters.filter((l) => l.row.group === "D"),
        (l) => per82(l) * availability(l, maxGp) + 0.8 * skill(l) + 0.3 * (l.defense ?? 60),
      ),
    },
    {
      id: "vezina",
      name: "Vezina Trophy",
      award: "Best goaltender",
      blurb: "Goalies only: luck-adjusted Impact pace (save % pulled toward his career norm) and workload, plus Overall Skill.",
      favorites: top(goalies, (l) => per82(l) * availability(l, maxGp) + 0.8 * skill(l)),
    },
    {
      id: "calder",
      name: "Calder Trophy",
      award: "Rookie of the year",
      blurb: "NHL rookies (no 25-game season before, fewer than 6 games in two earlier seasons, under 26): luck-adjusted Impact pace and Skill.",
      favorites: top(
        lines.filter((l) => l.rookie),
        (l) => per82(l) * availability(l, maxGp) + 0.5 * skill(l),
      ),
    },
    {
      id: "selke",
      name: "Selke Trophy",
      award: "Best defensive forward",
      blurb: "Forwards only: the Defense skill axis leads, with luck-adjusted Impact pace and Skill.",
      favorites: top(
        skaters.filter((l) => l.row.group === "F"),
        (l) => 1.6 * (l.defense ?? 50) + 0.35 * per82(l) * availability(l, maxGp) + 0.3 * skill(l),
      ),
    },
  ];
}
