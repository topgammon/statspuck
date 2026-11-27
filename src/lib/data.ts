import classesJson from "../../data/draft-rater/classes.json";
import curvesJson from "../../data/draft-rater/curves.json";
import erasJson from "../../data/draft-rater/eras.json";
import headlinesJson from "../../data/draft-rater/headlines.json";
import leaderboardJson from "../../data/draft-rater/leaderboard.json";
import metaJson from "../../data/draft-rater/meta.json";
import ogJson from "../../data/draft-rater/og.json";
import picksJson from "../../data/draft-rater/picks.json";
import teamsJson from "../../data/draft-rater/teams.json";
import undraftedJson from "../../data/draft-rater/undrafted.json";
import { gradeEras, gradeTeams, type GradeFilter } from "./grade";
import { isIronMan } from "./ironman";
import type { CurveSet, DraftClass, Era, Headlines, Meta, OgIndex, PickRow, Stamp, TeamGrade, TeamInfo, UndraftedPlayer } from "./types";

export const meta = metaJson as Meta;

/** Adds the IRON MAN stamp (durability) on top of the pipeline's Draft Rater stamps. Never part of any grade. */
function withIronMan<T extends { playerId: number | null; stamps: Stamp[] }>(row: T): T {
  if (row.stamps.includes("IRON MAN") || !isIronMan(row.playerId)) return row;
  return { ...row, stamps: [...row.stamps, "IRON MAN"] };
}

export const picks = (picksJson as PickRow[]).map(withIronMan);
export const draftClasses = classesJson as DraftClass[];
export const curves = curvesJson as CurveSet;
export const leaderboard = leaderboardJson as TeamGrade[];
export const eras = erasJson as Era[];
export const headlines = headlinesJson as Headlines;
export const teams = teamsJson as TeamInfo[];
export const og = ogJson as OgIndex;

/**
 * Undrafted NHL graduates. Never part of Draft Rater grades. Anyone who debuted
 * before 2005-06 is left out so the 2005+ era stays fair (the pipeline drops them too).
 */
export const undrafted = (undraftedJson as unknown as UndraftedPlayer[]).filter((player) => player.debut >= meta.curveFirstYear).map(withIronMan);

export const picksById = new Map(picks.map((pick) => [pick.id, pick]));
export const undraftedById = new Map(undrafted.map((player) => [player.id, player]));
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
  const gms = gradeEras(picks, eras, officialFilter(), 15);
  for (const gm of gms) {
    const row = erasBySlug.get(gm.slug);
    if (!row || row.avg == null || Math.abs(row.avg - gm.avg) > 0.051) {
      throw new Error(`GM Draft Score mismatch for ${gm.slug}: file ${row?.avg}, code ${gm.avg}`);
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
