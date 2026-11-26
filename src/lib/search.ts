// Shared shape and matching logic for the header's universal search.
// Results open each entity's Overview tab.
import { gmHref, playerHref, teamHref } from "./routes";

/** [id, name, year, overall, franchise, headshotPlayerId (0 = none), letter, stamp] */
export type PlayerEntry = [number, string, number, number, string, number, string, string];
/** [abbr, name, short, letter, rank] */
export type TeamEntry = [string, string, string, string, number];
/** [slug, person, team, teamName, startYear, endYear, letter] */
export type GmEntry = [string, string, string, string, number, number | null, string];
/** [year, letter] */
export type YearEntry = [number, string];

export type SearchIndex = { p: PlayerEntry[]; t: TeamEntry[]; g: GmEntry[]; y: YearEntry[] };

export type SearchHit =
  | { kind: "player"; href: string; entry: PlayerEntry }
  | { kind: "team"; href: string; entry: TeamEntry }
  | { kind: "gm"; href: string; entry: GmEntry }
  | { kind: "year"; href: string; entry: YearEntry };

export type SearchGroup = { label: string; hits: SearchHit[] };

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim();
}

/** 0 = name starts with the query, 1 = a word starts with it, 2 = contains it, -1 = no match. */
function scoreText(haystack: string, words: string[]): number {
  if (words.length === 0) return -1;
  let worst = 0;
  for (const word of words) {
    if (haystack.startsWith(word)) continue;
    if (haystack.includes(` ${word}`)) worst = Math.max(worst, 1);
    else if (haystack.includes(word)) worst = Math.max(worst, 2);
    else return -1;
  }
  return worst;
}

const LIMITS = { player: 6, team: 4, gm: 4, year: 4 };

export function searchIndex(index: SearchIndex, raw: string): SearchGroup[] {
  const query = normalize(raw);
  if (!query) return [];
  const tokens = query.split(/\s+/);
  const yearToken = tokens.find((token) => /^(19|20)\d\d$/.test(token));
  const words = tokens.filter((token) => token !== yearToken);
  const groups: SearchGroup[] = [];

  // Draft years: "2015", "201", or "2015 draft".
  const yearDigits = tokens.find((token) => /^\d{2,4}$/.test(token));
  if (yearDigits) {
    const years = index.y
      .filter(([year]) => String(year).startsWith(yearDigits) || String(year).slice(2) === yearDigits)
      .sort((a, b) => b[0] - a[0])
      .slice(0, LIMITS.year)
      .map((entry): SearchHit => ({ kind: "year", href: `/draft-rater/drafts/${entry[0]}`, entry }));
    if (years.length) groups.push({ label: "Draft years", hits: years });
  }

  const teams = index.t
    .map((entry) => {
      const [abbr, name, short] = entry;
      const text = normalize(`${name} ${short} ${abbr}`);
      const exactAbbr = words.length === 1 && words[0] === abbr.toLowerCase();
      return { entry, score: exactAbbr ? -1 : scoreText(text, words), exactAbbr };
    })
    .filter((row) => row.exactAbbr || row.score >= 0)
    .sort((a, b) => a.score - b.score || a.entry[4] - b.entry[4])
    .slice(0, LIMITS.team)
    .map(({ entry }): SearchHit => ({ kind: "team", href: teamHref(entry[0]), entry }));
  if (teams.length) groups.push({ label: "Teams", hits: teams });

  if (words.length && words.join("").length >= 2) {
    const gms = index.g
      .map((entry) => ({ entry, score: scoreText(normalize(entry[1]), words) }))
      .filter((row) => row.score >= 0)
      .sort((a, b) => a.score - b.score || b.entry[4] - a.entry[4])
      .slice(0, LIMITS.gm)
      .map(({ entry }): SearchHit => ({ kind: "gm", href: gmHref(entry[0]), entry }));
    const players: { entry: PlayerEntry; score: number }[] = [];
    for (const entry of index.p) {
      if (yearToken && entry[2] !== Number(yearToken)) continue;
      const score = scoreText(normalize(entry[1]), words);
      if (score >= 0) players.push({ entry, score });
    }
    players.sort((a, b) => a.score - b.score || a.entry[3] - b.entry[3]);
    const hits = players
      .slice(0, LIMITS.player)
      .map(({ entry }): SearchHit => ({ kind: "player", href: playerHref(entry[0]), entry }));
    if (hits.length) groups.push({ label: "Players", hits });
    if (gms.length) groups.push({ label: "GMs", hits: gms });
  } else if (yearToken) {
    // "2015" alone: show the top picks of that draft too.
    const hits = index.p
      .filter((entry) => entry[2] === Number(yearToken))
      .sort((a, b) => a[3] - b[3])
      .slice(0, LIMITS.player)
      .map((entry): SearchHit => ({ kind: "player", href: playerHref(entry[0]), entry }));
    if (hits.length) groups.push({ label: `Top ${yearToken} picks`, hits });
  }

  return groups;
}

/** Badge colors from the StatsPuck brand kit. */
export function letterTone(letter: string | null | undefined): string {
  if (!letter) return "border-[#262B36] text-[#94A3B8]";
  if (letter === "A+") return "border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]";
  if (letter.startsWith("A")) return "border-[#10B981]/50 bg-[#10B981]/10 text-[#10B981]";
  if (letter.startsWith("B")) return "border-[#38BDF8]/50 bg-[#38BDF8]/10 text-[#38BDF8]";
  if (letter.startsWith("C")) return "border-[#F97316]/50 bg-[#F97316]/10 text-[#F97316]";
  return "border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]";
}

export const stampTone: Record<string, string> = {
  ELITE: "text-[#F59E0B]",
  STEAL: "text-[#10B981]",
  "LATE BLOOMER": "text-[#8B5CF6]",
  STALLED: "text-[#F97316]",
  BUST: "text-[#EF4444]",
  DEVELOPING: "text-[#3B82F6]",
  RETIRED: "text-[#64748B]",
};
