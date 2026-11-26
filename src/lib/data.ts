import classesJson from "../../data/classes.json";
import curvesJson from "../../data/curves.json";
import erasJson from "../../data/eras.json";
import headlinesJson from "../../data/headlines.json";
import leaderboardJson from "../../data/leaderboard.json";
import metaJson from "../../data/meta.json";
import ogJson from "../../data/og.json";
import picksJson from "../../data/picks.json";
import teamsJson from "../../data/teams.json";
import { gradeTeams, type GradeFilter } from "./grade";
import type { CurveSet, DraftClass, Era, Headlines, Meta, OgIndex, PickRow, TeamGrade, TeamInfo } from "./types";

export const picks = picksJson as PickRow[];
export const draftClasses = classesJson as DraftClass[];
export const curves = curvesJson as CurveSet;
export const leaderboard = leaderboardJson as TeamGrade[];
export const eras = erasJson as Era[];
export const headlines = headlinesJson as Headlines;
export const meta = metaJson as Meta;
export const teams = teamsJson as TeamInfo[];
export const og = ogJson as OgIndex;

export const picksById = new Map(picks.map((pick) => [pick.id, pick]));
export const teamsByAbbr = new Map(leaderboard.map((team) => [team.abbr, team]));
export const erasBySlug = new Map(eras.map((era) => [era.slug, era]));

export function officialFilter(): GradeFilter {
  return {
    minYear: meta.curveFirstYear,
    maxYear: meta.latestDraftYear,
    group: "ALL",
  };
}

/** Fail the build if the page math drifts from the published board. */
export function assertGradesMatch(): void {
  const again = gradeTeams(picks, teams, officialFilter());
  for (const row of leaderboard) {
    const other = again.find((team) => team.abbr === row.abbr);
    if (!other) throw new Error(`Missing recomputed grade for ${row.abbr}`);
    if (
      Math.abs(other.avg - row.avg) > 0.051 ||
      other.letter !== row.letter ||
      other.rating !== row.rating ||
      other.n !== row.n ||
      other.developing !== row.developing
    ) {
      throw new Error(
        `Grade mismatch for ${row.abbr}: file ${row.letter} ${row.rating} ${row.avg} n${row.n} d${row.developing}, code ${other.letter} ${other.rating} ${other.avg} n${other.n} d${other.developing}`,
      );
    }
  }
}

export function pickImage(id: number, franchise: string): string {
  const cards = og.picks[String(id)];
  if (cards?.steal) return cards.steal;
  if (cards?.bust) return cards.bust;
  if (cards?.best) return cards.best;
  if (cards?.worst) return cards.worst;
  return og.teams[franchise] ?? og.home;
}
