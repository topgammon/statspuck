export function signed(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const text = value.toFixed(digits);
  return value > 0 ? `+${text}` : text;
}

export const DRAFT_SCORE_TIP =
  "Average Impact above or below expected per graded pick, centered relative to the NHL league average of 0.0";

export const DEV_SCORE_TIP =
  "How well this franchise turns its picks into NHL players by year six, versus what those exact draft slots usually produce. Combines NHL graduation (25+ and 100+ Impact) with Impact growth from year two on. 0.0 is the NHL average.";

const LETTER_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-"];

/** A+ is 0 and D- is 11, so an ascending sort reads best grade first. */
export function letterRank(letter: string | null | undefined): number | null {
  if (!letter) return null;
  const index = LETTER_ORDER.indexOf(letter);
  return index === -1 ? null : index;
}

export function scoreClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "text-zinc-300";
  return value > 0 ? "text-[#3ddc97]" : "text-[#ff4d4d]";
}

export function seasonLabel(start: number): string {
  return `${start}–${String(start + 1).slice(2)}`;
}

export function yearLabel(milestone: number): string {
  if (milestone <= 0) return "Not started";
  return `Year ${milestone}`;
}

/** Seasons after Draft +8 are veterans. The grade itself still stops at the position cap. */
export const VETERAN_AFTER = 8;

export function draftLabel(draftPlus: number): string {
  if (draftPlus <= 0) return "Not started";
  if (draftPlus > VETERAN_AFTER) return "Veteran";
  return `Draft +${draftPlus}`;
}

export function isVeteran(draftPlus: number): boolean {
  return draftPlus > VETERAN_AFTER;
}

export function updatedLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const text = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `Last updated ${text}`;
}
