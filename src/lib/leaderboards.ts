import { capShare } from "./cap";
import { leaderboard, picks, teamsByAbbr } from "./data";
import { allGmCareers, teamOverall } from "./overall-grades";
import { ironStreak } from "./ironman";
import { franchiseAssets, franchiseAssetsFor } from "./franchise-assets";
import { teamTradeReport } from "./gm-grades";
import { impactPerCap, profileRows, type ProfileRow } from "./profiles";
import { gmHref, playerHref, teamHref } from "./routes";

// Every leaderboard on the site, as plain serializable rows. The /leaderboards hub,
// the home page tool cards and the Featured strip all read from here, so a number
// shown in one place always matches the others.

export type ColumnFormat = "text" | "int" | "dec1" | "dec2" | "signed" | "letter" | "skill" | "money" | "pct" | "rank" | "svpct" | "toi";

export type BoardColumn = { key: string; label: string; tip?: string; format: ColumnFormat; /** Higher is better; drives the default sort. */ desc?: boolean };

export type BoardRow = {
  /** Profile link, or null for players outside the StatsPuck era (no profile page). */
  href: string | null;
  /** Used by board filters, e.g. "elc", "active", "skater", "goalie". */
  tags?: string[];
  name: string;
  sub: string;
  image: { kind: "player"; playerId: number; headshot: boolean } | { kind: "team"; abbr: string } | null;
  values: Record<string, number | string | null>;
};

export type Board = {
  id: BoardId;
  label: string;
  blurb: string;
  columns: BoardColumn[];
  /** Column the board is ranked by. */
  rankBy: string;
  rows: BoardRow[];
  /** On/off switches above the board. include=false: hide tagged rows while off. include=true: show only tagged rows while on. */
  toggles?: { tag: string; label: string; on: boolean; onlyWhenOn: boolean }[];
  /** Two-way switch, e.g. Skaters | Goalies. */
  segments?: { tag: string; label: string }[];
};

export type BoardId = "players" | "teams" | "gms" | "contracts" | "steals" | "seasons";

function playerImage(row: ProfileRow): BoardRow["image"] {
  return { kind: "player", playerId: row.playerId, headshot: row.hasHeadshot };
}

function teamShort(abbr: string | null): string {
  return abbr ? (teamsByAbbr.get(abbr)?.short ?? abbr) : "No team";
}

/** Active NHL players with a current Skills rating, best first. */
export function skillBoard(limit?: number, group?: "skater" | "goalie"): Board {
  const rows = profileRows()
    .filter((row) => row.active && row.skills?.current)
    .filter((row) => (group ? (row.group === "G") === (group === "goalie") : true))
    .sort((a, b) => b.skills!.overall - a.skills!.overall || (b.recentRate ?? 0) - (a.recentRate ?? 0))
    .slice(0, limit ?? 2000)
    .map((row): BoardRow => {
      const iron = ironStreak(row.playerId);
      return {
        href: playerHref(row.routeId, "skills"),
        tags: [row.group === "G" ? "goalie" : "skater"],
        name: row.name,
        sub: `${row.pos} · ${teamShort(row.team)}`,
        image: playerImage(row),
        values: {
          skill: row.skills!.overall,
          archetype: row.skills!.archetype ?? "—",
          impact: row.recentRate == null ? null : Math.round(row.recentRate * 10) / 10,
          asset: row.assetRating == null ? null : Math.round(row.assetRating),
          iron: iron && iron.current > 0 ? iron.current : null,
          ironBest: iron && iron.best > 0 ? iron.best : null,
        },
      };
    });
  return {
    id: "players",
    label: "Players",
    blurb: "Overall Skill Rating (0–99) for every active NHL player, built from his last three seasons against today's regulars at his position.",
    rankBy: "skill",
    segments: [
      { tag: "skater", label: "Skaters" },
      { tag: "goalie", label: "Goalies" },
    ],
    columns: [
      { key: "skill", label: "Skill", format: "skill", desc: true, tip: "Overall Skill Rating, 0-99. About 72 is a league-average regular; 95+ is elite." },
      { key: "archetype", label: "Role", format: "text" },
      { key: "impact", label: "Impact / 82", format: "dec1", desc: true, tip: "Impact per 82 games over the last two seasons. Goalies: per season." },
      { key: "asset", label: "Asset Value", format: "int", desc: true, tip: "Trade value on the 0-100 Trade Machine scale." },
      {
        key: "iron",
        label: "Iron Man streak",
        format: "int",
        desc: true,
        tip: "Games in a row he has played right now without missing one (this season included). 340+ earns the IRON MAN stamp. Tracked for players whose recent seasons make a 340-game streak possible.",
      },
      { key: "ironBest", label: "Best streak", format: "int", desc: true, tip: "His longest run of consecutive games played since 2005-06." },
    ],
    rows,
  };
}

/** Best recent Impact for every 1% of the salary cap. */
export function contractBoard(limit?: number): Board {
  const rows = profileRows()
    .filter((row) => row.active && row.contract && (row.recentRate ?? 0) >= 20)
    .map((row) => ({ row, value: impactPerCap(row) }))
    .filter((item): item is { row: ProfileRow; value: number } => item.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit ?? 1000)
    .map(
      ({ row, value }): BoardRow => ({
        href: playerHref(row.routeId, "asset"),
        tags: row.contract!.elc ? ["elc"] : [],
        name: row.name,
        sub: `${row.pos} · ${teamShort(row.team)}${row.contract!.elc ? " · ELC" : ""}`,
        image: playerImage(row),
        values: {
          perCap: Math.round(value * 10) / 10,
          impact: Math.round((row.recentRate ?? 0) * 10) / 10,
          aav: row.contract!.aav,
          cap: Math.round(capShare(row.contract!.aav) * 1000) / 10,
          expires: row.contract!.expires,
        },
      }),
    );
  return {
    id: "contracts",
    label: "Best Contract Value",
    blurb: "Impact per 82 games over the last two seasons for every 1% of the salary cap he costs. Entry-level deals are hidden by default; switch them on to see them.",
    rankBy: "perCap",
    toggles: [{ tag: "elc", label: "Show ELC players", on: false, onlyWhenOn: false }],
    columns: [
      { key: "perCap", label: "Impact / % Cap", format: "dec1", desc: true, tip: "Recent Impact per 82 games divided by his cap hit as a % of the ceiling." },
      { key: "impact", label: "Impact / 82", format: "dec1", desc: true },
      { key: "aav", label: "AAV", format: "money", desc: true },
      { key: "cap", label: "% Cap", format: "pct", desc: true },
      { key: "expires", label: "Expires", format: "int" },
    ],
    rows,
  };
}

/** Picks stamped STEAL, by Draft Score. */
export function stealBoard(limit?: number): Board {
  const rows = picks
    .filter((pick) => pick.stamps.includes("STEAL") && pick.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit ?? 300)
    .map(
      (pick): BoardRow => ({
        href: playerHref(pick.id, "career"),
        name: pick.name,
        sub: `${pick.year} · #${pick.overall} · ${pick.franchise}`,
        image: { kind: "player", playerId: pick.playerId ?? 0, headshot: pick.hasHeadshot && pick.playerId != null },
        values: { score: pick.score, letter: pick.letter, overall: pick.overall, redraft: pick.redraft, year: pick.year },
      }),
    );
  return {
    id: "steals",
    label: "Draft Steals",
    blurb: "Pick #20 or later that graded A or better, or beat the slot by 200+ Impact. Click any row for his Career tab.",
    rankBy: "score",
    columns: [
      { key: "score", label: "Draft Score", format: "signed", desc: true, tip: "Impact minus what his draft slot usually produces by now." },
      { key: "letter", label: "Grade", format: "letter", desc: true },
      { key: "overall", label: "Pick", format: "rank" },
      { key: "redraft", label: "Redraft", format: "rank", tip: "Where he would go if his class were redrafted by Impact." },
      { key: "year", label: "Year", format: "int" },
    ],
    rows,
  };
}

/** Average Overall Skill of a team's best 12 forwards, 6 defensemen and 1 goalie on today's roster. */
export function teamSkill(abbr: string): { rating: number; count: number } | null {
  const roster = profileRows().filter((row) => row.active && row.team === abbr && row.skills?.current);
  const top = (group: string, n: number) =>
    roster
      .filter((row) => row.group === group)
      .map((row) => row.skills!.overall)
      .sort((a, b) => b - a)
      .slice(0, n);
  const values = [...top("F", 12), ...top("D", 6), ...top("G", 1)];
  if (values.length < 8) return null;
  return { rating: Math.round(values.reduce((a, b) => a + b, 0) / values.length), count: values.length };
}

/** Today's roster for one team, by Overall Skill. Only players with a StatsPuck profile (2005+ era). */
export function rosterBoard(abbr: string): Board {
  const rows = profileRows()
    .filter((row) => row.active && row.team === abbr)
    .sort((a, b) => (b.skills?.current ? b.skills.overall : 0) - (a.skills?.current ? a.skills.overall : 0) || (b.assetRating ?? 0) - (a.assetRating ?? 0))
    .map(
      (row): BoardRow => ({
        href: playerHref(row.routeId),
        name: row.name,
        sub: row.pos,
        image: playerImage(row),
        values: {
          skill: row.skills?.current ? row.skills.overall : null,
          archetype: row.skills?.archetype ?? "—",
          asset: row.assetRating == null ? null : Math.round(row.assetRating),
          cap: row.contract ? Math.round(capShare(row.contract.aav) * 1000) / 10 : null,
          expires: row.contract?.expires ?? null,
        },
      }),
    );
  return {
    id: "players",
    label: "Roster",
    blurb: "",
    rankBy: "skill",
    columns: [
      { key: "skill", label: "Skill", format: "skill", desc: true, tip: "Overall Skill Rating, 0-99" },
      { key: "archetype", label: "Role", format: "text" },
      { key: "asset", label: "Asset Value", format: "int", desc: true, tip: "Trade value on the 0-100 Trade Machine scale" },
      { key: "cap", label: "% Cap", format: "pct", desc: true },
      { key: "expires", label: "Expires", format: "int" },
    ],
    rows,
  };
}

let teamSkillRanks: Map<string, number> | null = null;
export function teamSkillRank(abbr: string): number | null {
  if (!teamSkillRanks) {
    const ranked = leaderboard
      .map((team) => ({ abbr: team.abbr, skill: teamSkill(team.abbr)?.rating ?? -1 }))
      .sort((a, b) => b.skill - a.skill);
    teamSkillRanks = new Map(ranked.map((row, index) => [row.abbr, index + 1]));
  }
  return teamSkillRanks.get(abbr) ?? null;
}

export function teamBoard(): Board {
  const rows = leaderboard
    .map((team): BoardRow => {
      const assets = franchiseAssetsFor(team.abbr);
      const trades = teamTradeReport(team.abbr);
      const overall = teamOverall(team.abbr);
      return {
        href: teamHref(team.abbr),
        name: team.name,
        sub: overall ? `#${overall.rank} overall franchise` : "NHL franchise",
        image: { kind: "team", abbr: team.abbr },
        values: {
          overall: overall?.rating ?? null,
          overallLetter: overall?.letter ?? null,
          skill: teamSkill(team.abbr)?.rating ?? null,
          assetRank: assets?.rank ?? null,
          draft: team.letter,
          dev: team.dev?.letter ?? null,
          trades: trades?.letter ?? null,
        },
      };
    })
    .sort((a, b) => ((b.values.overall as number) ?? 0) - ((a.values.overall as number) ?? 0));
  return {
    id: "teams",
    label: "Teams",
    blurb: "All 32 franchises ranked by Overall Grade (Draft + Development + Trades since 2005), with today's roster skill and total asset rank.",
    rankBy: "overall",
    columns: [
      { key: "overall", label: "Rating", format: "int", desc: true, tip: "Overall Grade on a 0-100 scale: the average of the Draft, Development and Trades ratings." },
      { key: "overallLetter", label: "Overall", format: "letter", desc: true },
      { key: "draft", label: "Draft", format: "letter", desc: true },
      { key: "dev", label: "Dev", format: "letter", desc: true, tip: "Development Grade: how well the franchise turns picks into NHL players." },
      { key: "trades", label: "Trades", format: "letter", desc: true },
      { key: "skill", label: "Team Skill", format: "skill", desc: true, tip: "Average Overall Skill of the top 12 forwards, 6 defensemen and starting goalie on today's roster." },
      { key: "assetRank", label: "Asset Rank", format: "rank", tip: `Total Franchise Asset Value rank out of ${franchiseAssets.length}: roster, prospects and draft picks.` },
    ],
    rows,
  };
}

/** One row per GM career (every team he ran since 2005), by Overall GM Grade. */
export function gmBoard(): Board {
  const rows = allGmCareers()
    .sort((a, b) => (b.overall?.rating ?? -1) - (a.overall?.rating ?? -1) || b.firstYear - a.firstYear)
    .map((career): BoardRow => {
      const teams = [...new Set(career.stops.map((stop) => stop.team))];
      const lastEnd = Math.max(...career.stops.map((stop) => stop.endYear ?? 0));
      return {
        href: gmHref(career.latest.slug),
        tags: career.current ? ["active"] : [],
        name: career.person,
        sub: `${teams.join(" · ")} · ${career.firstYear}–${career.current ? "now" : lastEnd}`,
        image: { kind: "team", abbr: career.latest.team },
        values: {
          overall: career.overall?.rating ?? null,
          overallLetter: career.overall?.letter ?? null,
          draft: career.draft.letter,
          dev: career.dev.letter,
          trades: career.asset?.letter ?? null,
          teams: teams.length,
        },
      };
    });
  return {
    id: "gms",
    label: "GMs",
    blurb: "GMs are graded on their whole career: every team they have run since 2005. Click a GM to see the breakdown by team.",
    rankBy: "overall",
    toggles: [{ tag: "active", label: "Active GMs only", on: true, onlyWhenOn: true }],
    columns: [
      { key: "overall", label: "Rating", format: "int", desc: true, tip: "Overall GM Grade on a 0-100 scale: the average of the Drafting, Development and Trades pillars that have data." },
      { key: "overallLetter", label: "Overall", format: "letter", desc: true },
      { key: "draft", label: "Draft", format: "letter", desc: true },
      { key: "dev", label: "Dev", format: "letter", desc: true, tip: "Career Development Grade, weighted by picks across every team." },
      { key: "trades", label: "Trades", format: "letter", desc: true },
      { key: "teams", label: "Teams", format: "int", desc: true },
    ],
    rows,
  };
}
export function allBoards(): Board[] {
  return [skillBoard(), teamBoard(), gmBoard(), contractBoard(), stealBoard()];
}
