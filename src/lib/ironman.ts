import ironJson from "../../data/draft-rater/ironman.json";

// IRON MAN: 340+ NHL regular-season games in a row without missing one, the season in
// progress included. Built from game logs vs. team schedules by pipelines/draft-rater/fetch_ironman.py.

export const IRON_MAN_GAMES = 340;

type Streak = { best: number; from: string; to: string; current: number };
const file = ironJson as unknown as { players: Record<string, Streak> };

export function ironStreak(playerId: number | null | undefined): Streak | null {
  if (playerId == null) return null;
  return file.players[String(playerId)] ?? null;
}

export function isIronMan(playerId: number | null | undefined): boolean {
  const streak = ironStreak(playerId);
  return Boolean(streak && Math.max(streak.best, streak.current) >= IRON_MAN_GAMES);
}

export const IRON_MAN_TIP = `Played ${IRON_MAN_GAMES}+ NHL regular-season games in a row without missing one (the current season counts).`;
