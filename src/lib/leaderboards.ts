import { capShare } from "./cap";
import { eras, leaderboard, picks, teamsByAbbr } from "./data";
import { devBoard } from "./dev-board";
import { franchiseAssets, franchiseAssetsFor } from "./franchise-assets";
import { gmReport, teamTradeReport } from "./gm-grades";
import { impactPerCap, profileRows, type ProfileRow } from "./profiles";
import { gmHref, playerHref, teamHref } from "./routes";

// Every leaderboard on the site, as plain serializable rows. The /leaderboards hub,
// the home page tool cards and the Featured strip all read from here, so a number
// shown in one place always matches the others.

export type ColumnFormat = "text" | "int" | "dec1" | "dec2" | "signed" | "letter" | "skill" | "money" | "pct" | "rank";

export type BoardColumn = { key: string; label: string; tip?: string; format: ColumnFormat; /** Higher is better; drives the default sort. */ desc?: boolean };

export type BoardRow = {
  href: string;
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
};

export type BoardId = "players" | "teams" | "gms" | "contracts" | "steals" | "development";

function playerImage(row: ProfileRow): BoardRow["image"] {
  return { kind: "player", playerId: row.playerId, headshot: row.hasHeadshot };
}

function teamShort(abbr: string | null): string {
  return abbr ? (teamsByAbbr.get(abbr)?.short ?? abbr) : "No team";
}

/** Active NHL players with a current Skills rating, best first. */
export function skillBoard(limit?: number): Board {
  const rows = profileRows()
    .filter((row) => row.active && row.skills?.current)
    .sort((a, b) => b.skills!.overall - a.skills!.overall || (b.recentRate ?? 0) - (a.recentRate ?? 0))
    .slice(0, limit ?? 400)
    .map(
      (row): BoardRow => ({
        href: playerHref(row.routeId, "skills"),
        name: row.name,
        sub: `${row.pos} · ${teamShort(row.team)}`,
        image: playerImage(row),
        values: {
          skill: row.skills!.overall,
          archetype: row.skills!.archetype ?? "—",
          impact: row.recentRate == null ? null : Math.round(row.recentRate * 10) / 10,
          asset: row.assetRating == null ? null : Math.round(row.assetRating),
        },
      }),
    );
  return {
    id: "players",
    label: "Players",
    blurb: "Overall Skill Rating (0–99) for every active NHL player, built from his last three seasons against today's regulars at his position.",
    rankBy: "skill",
    columns: [
      { key: "skill", label: "Skill", format: "skill", desc: true, tip: "Overall Skill Rating, 0-99. About 72 is a league-average regular; 95+ is elite." },
      { key: "archetype", label: "Role", format: "text" },
      { key: "impact", label: "Impact / 82", format: "dec1", desc: true, tip: "Impact per 82 games over the last two seasons. Goalies: per season." },
      { key: "asset", label: "Asset Value", format: "int", desc: true, tip: "Trade value on the 0-100 Trade Machine scale." },
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
    .slice(0, limit ?? 300)
    .map(
      ({ row, value }): BoardRow => ({
        href: playerHref(row.routeId, "asset"),
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
    blurb: "Impact per 82 games over the last two seasons for every 1% of the salary cap he costs. Entry-level deals shine here on purpose: that is real cap value.",
    rankBy: "perCap",
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
      return {
        href: teamHref(team.abbr),
        name: team.name,
        sub: `#${team.rank} drafting franchise`,
        image: { kind: "team", abbr: team.abbr },
        values: {
          skill: teamSkill(team.abbr)?.rating ?? null,
          assetRank: assets?.rank ?? null,
          draft: team.letter,
          dev: team.dev?.letter ?? null,
          trades: trades?.letter ?? null,
        },
      };
    })
    .sort((a, b) => ((b.values.skill as number) ?? 0) - ((a.values.skill as number) ?? 0));
  return {
    id: "teams",
    label: "Teams",
    blurb: "All 32 franchises: today's roster skill, total asset rank, and the Draft, Development and Trades grades since 2005.",
    rankBy: "skill",
    columns: [
      { key: "skill", label: "Team Skill", format: "skill", desc: true, tip: "Average Overall Skill of the top 12 forwards, 6 defensemen and starting goalie on today's roster." },
      { key: "assetRank", label: "Asset Rank", format: "rank", tip: `Total Franchise Asset Value rank out of ${franchiseAssets.length}: roster, prospects and draft picks.` },
      { key: "draft", label: "Draft", format: "letter", desc: true },
      { key: "dev", label: "Dev", format: "letter", desc: true },
      { key: "trades", label: "Trades", format: "letter", desc: true },
    ],
    rows,
  };
}

export function gmBoard(): Board {
  const rows = eras
    .map((era) => ({ era, report: gmReport(era.slug) }))
    .filter(({ report }) => report?.overall)
    .sort((a, b) => b.report!.overall!.rating - a.report!.overall!.rating)
    .map(
      ({ era, report }): BoardRow => ({
        href: gmHref(era.slug),
        name: era.person,
        sub: `${era.teamName} · ${era.startYear}–${era.endYear ?? "now"}`,
        image: { kind: "team", abbr: era.team },
        values: {
          overall: report!.overall!.rating,
          overallLetter: report!.overall!.letter,
          draft: report!.draft.letter,
          dev: report!.dev.letter,
          trades: report!.asset?.letter ?? null,
          active: era.endYear == null ? "Current" : "Past",
        },
      }),
    );
  return {
    id: "gms",
    label: "GMs",
    blurb: "Overall GM Grade: the average of the Drafting, Development and Trades pillars that have data.",
    rankBy: "overall",
    columns: [
      { key: "overall", label: "Rating", format: "int", desc: true, tip: "Overall GM Grade on a 0-100 scale." },
      { key: "overallLetter", label: "Grade", format: "letter", desc: true },
      { key: "draft", label: "Draft", format: "letter", desc: true },
      { key: "dev", label: "Dev", format: "letter", desc: true },
      { key: "trades", label: "Trades", format: "letter", desc: true },
      { key: "active", label: "Status", format: "text" },
    ],
    rows,
  };
}

export function developmentBoard(): Board {
  return {
    id: "development",
    label: "Development",
    blurb: "How well each franchise turns its picks into NHL players over their first six seasons. 0.0 is the average franchise.",
    rankBy: "rank",
    columns: [
      { key: "rank", label: "Rank", format: "rank" },
      { key: "letter", label: "Dev Grade", format: "letter", desc: true },
      { key: "avg", label: "Dev Score", format: "signed", desc: true, tip: "Graduation and Impact growth versus what the draft slot predicts." },
      { key: "n", label: "Picks", format: "int", desc: true },
      { key: "draftLetter", label: "Draft Grade", format: "letter", desc: true },
    ],
    rows: devBoard.map((row) => ({
      href: teamHref(row.abbr, "draft-dev"),
      name: row.name,
      sub: `${row.n} mature picks`,
      image: { kind: "team", abbr: row.abbr },
      values: { rank: row.rank, letter: row.letter, avg: row.avg, n: row.n, draftLetter: row.draftLetter },
    })),
  };
}

export function allBoards(): Board[] {
  return [skillBoard(), teamBoard(), gmBoard(), contractBoard(), stealBoard(), developmentBoard()];
}
