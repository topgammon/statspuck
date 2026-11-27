import type { StatColumn, StatRow } from "@/components/entity/stats-table";
import { goalieSeasons, playoffGoalieSeasons, playoffSkaterSeasons, skaterSeasons, type GoalieSeason, type SkaterSeason } from "./season-stats";
import type { PickGroup } from "./types";

// Builds the Stats tab table for one player from the season export. Traded players
// have one row per club in the source; here each season is merged into one line.

export type StatsTableData = { columns: StatColumn[]; rows: StatRow[]; totals: StatRow | null; playoffs: { rows: StatRow[]; totals: StatRow | null } };

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

export function playerStatsTable(playerId: number | null, group: PickGroup, impactBySeason: Map<number, number>): StatsTableData {
  if (group === "G") {
    const regular = goalieTable(goalieSeasons(playerId), impactBySeason);
    // Playoff rows carry their own Impact in the last slot.
    const pRows = playoffGoalieSeasons(playerId);
    const playoff = goalieTable(
      pRows.map((row) => row.slice(0, 7) as GoalieSeason),
      new Map(pRows.map((row) => [row[0], row[7]])),
    );
    return { ...regular, playoffs: { rows: playoff.rows, totals: playoff.totals } };
  }
  const regular = skaterTable(skaterSeasons(playerId), impactBySeason);
  const pRows = playoffSkaterSeasons(playerId);
  const playoff = skaterTable(
    pRows.map((row) => [...row.slice(0, 12), 0, 0] as SkaterSeason),
    new Map(pRows.map((row) => [row[0], row[12]])),
  );
  return { ...regular, playoffs: { rows: playoff.rows, totals: playoff.totals } };
}

function skaterTable(source: SkaterSeason[], impact: Map<number, number>): Omit<StatsTableData, "playoffs"> {
  const merged = new Map<number, number[]>();
  for (const row of source) {
    const prev = merged.get(row[0]);
    if (!prev) {
      merged.set(row[0], [...row]);
      continue;
    }
    const gp = prev[1] + row[1];
    const toi = gp > 0 ? (prev[11] * prev[1] + row[11] * row[1]) / gp : 0;
    for (let i = 1; i < row.length; i++) prev[i] += row[i];
    prev[11] = toi;
  }
  const rows: StatRow[] = [...merged.values()].map((r) => ({
    season: r[0],
    gp: r[1],
    g: r[2],
    a: r[3],
    pts: r[4],
    pm: r[5],
    pim: r[6],
    sog: r[7],
    shPct: r[7] > 0 ? round((r[2] / r[7]) * 100) : null,
    blk: r[8],
    foPct: r[9] + r[10] >= 50 ? round((r[9] / (r[9] + r[10])) * 100) : null,
    toi: r[11],
    impact: impact.has(r[0]) ? round(impact.get(r[0])!) : null,
  }));
  const sum = (key: string) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const all = [...merged.values()];
  const gp = sum("gp");
  const fw = all.reduce((t, r) => t + r[9], 0);
  const fl = all.reduce((t, r) => t + r[10], 0);
  const totals: StatRow | null = rows.length
    ? {
        season: null,
        gp,
        g: sum("g"),
        a: sum("a"),
        pts: sum("pts"),
        pm: sum("pm"),
        pim: sum("pim"),
        sog: sum("sog"),
        shPct: sum("sog") > 0 ? round((sum("g") / sum("sog")) * 100) : null,
        blk: sum("blk"),
        foPct: fw + fl >= 50 ? round((fw / (fw + fl)) * 100) : null,
        toi: gp > 0 ? all.reduce((t, r) => t + r[11] * r[1], 0) / gp : null,
        impact: rows.some((row) => row.impact != null) ? round(sum("impact")) : null,
      }
    : null;
  return {
    columns: [
      { key: "season", label: "Season" },
      { key: "gp", label: "GP" },
      { key: "g", label: "G" },
      { key: "a", label: "A" },
      { key: "pts", label: "PTS" },
      { key: "pm", label: "+/-", signed: true, tip: "Goal differential at even strength and shorthanded while he is on the ice" },
      { key: "pim", label: "PIM", tip: "Penalty minutes" },
      { key: "sog", label: "SOG", tip: "Shots on goal" },
      { key: "shPct", label: "S%", digits: 1, tip: "Shooting percentage: goals per shot on goal" },
      { key: "blk", label: "BLK", tip: "Blocked shots" },
      { key: "foPct", label: "FO%", digits: 1, tip: "Faceoff win %, shown with 50+ draws" },
      { key: "toi", label: "TOI/GP", tip: "Average ice time per game" },
      { key: "impact", label: "Impact", digits: 1, tip: "StatsPuck Impact for the season. 1.0 is about one average NHL game." },
    ],
    rows,
    totals,
  };
}

function goalieTable(source: GoalieSeason[], impact: Map<number, number>): Omit<StatsTableData, "playoffs"> {
  const merged = new Map<number, number[]>();
  for (const row of source) {
    const prev = merged.get(row[0]);
    if (!prev) merged.set(row[0], [...row]);
    else for (let i = 1; i < row.length; i++) prev[i] += row[i];
  }
  const toRow = (r: number[], season: number | null): StatRow => ({
    season,
    gp: r[1],
    gs: r[2],
    svPct: r[3] > 0 ? r[4] / r[3] : null,
    gaa: r[6] > 0 ? round((r[5] * 3600) / r[6], 2) : null,
    sa: r[3],
    sv: r[4],
    ga: r[5],
    impact: season != null && impact.has(season) ? round(impact.get(season)!) : null,
  });
  const all = [...merged.values()];
  const rows = all.map((r) => toRow(r, r[0]));
  const total = all.reduce((acc, r) => acc.map((value, i) => (i === 0 ? 0 : value + r[i])), [0, 0, 0, 0, 0, 0, 0]);
  const totals = rows.length ? { ...toRow(total, null), impact: rows.some((row) => row.impact != null) ? round(rows.reduce((t, row) => t + (Number(row.impact) || 0), 0)) : null } : null;
  return {
    columns: [
      { key: "season", label: "Season" },
      { key: "gp", label: "GP" },
      { key: "gs", label: "GS", tip: "Games started" },
      { key: "svPct", label: "SV%", tip: "Save percentage" },
      { key: "gaa", label: "GAA", digits: 2, tip: "Goals against per 60 minutes" },
      { key: "sa", label: "SA", tip: "Shots against" },
      { key: "sv", label: "SV", tip: "Saves" },
      { key: "ga", label: "GA", tip: "Goals against" },
      { key: "impact", label: "Impact", digits: 1, tip: "StatsPuck Impact for the season. Goalies earn 1.35 per start plus goals saved above average." },
    ],
    rows,
    totals,
  };
}
