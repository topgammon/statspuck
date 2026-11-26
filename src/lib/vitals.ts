import vitalsJson from "../../data/draft-rater/vitals.json";
import type { Vitals } from "./types";

// Height, weight, hand, birth date and birthplace for every profile page.
// Server-side only: keyed by the /players/[id] route id. Built by the nightly pipeline.

const vitals = vitalsJson as Record<string, Vitals>;

export function vitalsFor(id: number): Vitals | null {
  return vitals[String(id)] ?? null;
}

/** 74 -> 6'2" */
export function feetInches(inches: number | undefined): string | null {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

/** Whole years between a YYYY-MM-DD birth date and an as-of date. */
export function ageOn(birthDate: string | undefined, asOf: string): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ay, am, ad] = asOf.slice(0, 10).split("-").map(Number);
  if (!by || !ay) return null;
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age -= 1;
  return age;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 1997-01-13 -> Jan 13, 1997 */
export function birthLabel(birthDate: string | undefined): string | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month) return null;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// Canadian provinces and US states print as short codes after the city.
const PROVINCES: Record<string, string> = {
  Alberta: "AB", "British Columbia": "BC", Manitoba: "MB", "New Brunswick": "NB", "Newfoundland and Labrador": "NL", "Nova Scotia": "NS",
  Ontario: "ON", "Prince Edward Island": "PE", Quebec: "QC", Québec: "QC", Saskatchewan: "SK", Yukon: "YT", "Northwest Territories": "NT",
};

export function birthplace(v: Vitals): string | null {
  if (!v.city) return null;
  const prov = v.prov ? (PROVINCES[v.prov] ?? v.prov) : null;
  return prov ? `${v.city}, ${prov}` : v.city;
}
