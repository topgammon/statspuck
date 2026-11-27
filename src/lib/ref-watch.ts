import refsJson from "../../data/game-edge/refs.json";

// Ref Watch data, built nightly by pipelines/game-edge/build.py from free NHL play-by-play.

export type RefInfraction = { key: string; label: string; perGame: number; league: number; pct: number };

export type Referee = {
  name: string;
  slug: string;
  games: number;
  seasons: number[];
  currentGames: number;
  active: boolean;
  /** Under 15 games: shown only when the low-sample toggle is on. */
  low: boolean;
  /** Raw calls per 60 in his games. */
  raw: number;
  /** Isolated calls per 60 (ridge model removes partner and team effects). */
  rate: number;
  /** Isolated calls per 60 vs league average. */
  delta: number;
  /** Net home power plays per 60 vs league baseline. */
  home: number;
  /** % of "even-up" / against-the-leader calls (50 = neutral). */
  mgmt: number;
  /** Crunch-time call rate / normal rate. */
  crunch: number;
  crunchRate: number;
  p12: number;
  p3: number;
  infractions: RefInfraction[];
  signature: { label: string; pct: number }[];
  zones: Record<"oz" | "nz" | "dz" | "slot" | "boards", number>;
  grid: [number, number][];
  calls: number;
  teamsBest: { team: string; games: number; net: number; delta: number }[];
  teamsWorst: { team: string; games: number; net: number; delta: number }[];
  taken: { id: number; name: string; n: number }[];
  drawn: { id: number; name: string; n: number }[];
  partners: string[];
  score: number;
  grade: string;
  /** Official NHL headshot, sweater number, hometown and first NHL season (records.nhl.com). */
  photo?: string | null;
  number?: number | null;
  hometown?: string | null;
  since?: number | null;
  style: "Strict Whistle" | "Balanced" | "Let Them Play" | "Game Manager";
};

export type RefLeague = {
  rate: number;
  home: number;
  mgmt: number;
  crunch: number;
  crunchRate: number;
  p12: number;
  p3: number;
  perTeamGame: number;
};

type RefFile = { asOf: string; seasons: number[]; games: number; league: RefLeague; refs: Referee[] };

const data = refsJson as unknown as RefFile;

export const refLeague = data.league;
export const refAsOf = data.asOf;
export const refSeasons = data.seasons;
export const refGames = data.games;

export function allRefs(): Referee[] {
  return data.refs;
}

/** Referees who worked a game this season. */
export function activeRefs(): Referee[] {
  return data.refs.filter((r) => r.active);
}

export function refBySlug(slug: string): Referee | undefined {
  return data.refs.find((r) => r.slug === slug);
}

export function refHref(slug: string): string {
  return `/ref-watch/${slug}`;
}

export const STYLE_TONE: Record<Referee["style"], string> = {
  "Strict Whistle": "#E11D48",
  Balanced: "#38BDF8",
  "Let Them Play": "#10B981",
  "Game Manager": "#8B5CF6",
};

export function gradeColor(letter: string): string {
  if (letter.startsWith("A")) return "#F59E0B";
  if (letter.startsWith("B")) return "#10B981";
  if (letter.startsWith("C")) return "#38BDF8";
  return "#EF4444";
}

export function seasonLabel(season: number): string {
  return `${season}-${String(season + 1).slice(2)}`;
}

/** A compact version of every active ref for client widgets (Ref Edge calculator). */
export type RefLite = Pick<Referee, "slug" | "name" | "rate" | "delta" | "home" | "style" | "grade" | "games" | "low">;

export function refLite(r: Referee): RefLite {
  return { slug: r.slug, name: r.name, rate: r.rate, delta: r.delta, home: r.home, style: r.style, grade: r.grade, games: r.games, low: r.low };
}
