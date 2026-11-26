// Client-safe pieces of the Asset Value scale. No data imports, so interactive pages can use them.

/** Rating curve: 100 is the top asset on the board, and gaps shrink a little toward the top. */
export const RATING_EXPONENT = 0.85;

/** Turn a dollar value into the 0-100 Asset Value rating. Underwater contracts go below zero. */
export function toRating(value: number, uref: number, exponent = RATING_EXPONENT): number {
  if (uref <= 0) return 0;
  const scaled = 100 * Math.pow(Math.abs(value) / uref, exponent);
  return Math.max(-100, Math.min(100, value < 0 ? -scaled : scaled));
}

export function ratingTone(rating: number): string {
  if (rating < 0) return "text-[#EF4444]";
  if (rating >= 70) return "text-[#F59E0B]";
  if (rating >= 40) return "text-[#10B981]";
  if (rating >= 15) return "text-[#38BDF8]";
  return "text-[#94A3B8]";
}

export function ratingFill(rating: number): string {
  if (rating < 0) return "#EF4444";
  if (rating >= 70) return "#F59E0B";
  if (rating >= 40) return "#10B981";
  if (rating >= 15) return "#38BDF8";
  return "#64748B";
}

/** Trade grade from a team's net value as a share of everything that moved. B is even, A and up is a clear win. */
export function gradeForMargin(margin: number): string {
  if (margin >= 0.3) return "A+";
  if (margin >= 0.2) return "A";
  if (margin >= 0.12) return "A-";
  if (margin >= 0.06) return "B+";
  if (margin >= -0.06) return "B";
  if (margin >= -0.12) return "B-";
  if (margin >= -0.2) return "C";
  if (margin >= -0.3) return "D";
  return "F";
}

export function gradeTone(grade: string): string {
  const first = grade.charAt(0);
  if (first === "A") return "text-[#F59E0B]";
  if (first === "B") return "text-[#10B981]";
  if (first === "C") return "text-[#F8FAFC]";
  return "text-[#EF4444]";
}

export function formatRating(rating: number): string {
  const rounded = Math.round(rating);
  return rounded > 0 ? String(rounded) : rounded < 0 ? `−${Math.abs(rounded)}` : "0";
}
