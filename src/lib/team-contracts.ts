import rosterBios from "../../data/draft-rater/roster_bios.json";
import { capSeasonStart, capShare, contracts } from "./cap";
import { profileRows } from "./profiles";

// Every NHL contract a team holds today, for the Cap & Assets tab.

export type ContractRow = {
  playerId: number;
  routeId: number | null;
  name: string;
  pos: string;
  group: "F" | "D" | "G";
  age: number | null;
  aav: number;
  capPct: number;
  expires: number;
  elc: boolean;
  /** Free-agent status when the deal ends (from the cap source; age-based estimate if missing). */
  status: "UFA" | "RFA" | null;
  clause: string | null;
  clauseText: string | null;
  asset: number | null;
  headshot: boolean;
};

const bios = rosterBios as unknown as Record<string, { n?: string; pos?: string; bd?: string }>;

function groupOf(pos: string): "F" | "D" | "G" {
  if (pos === "G") return "G";
  if (pos === "D") return "D";
  return "F";
}

function ageOnJulyFirst(bd: string | undefined, year: number): number | null {
  if (!bd) return null;
  const [y, m] = bd.split("-").map(Number);
  if (!y || !m) return null;
  return year - y - (m > 7 ? 1 : 0);
}

export function teamContracts(abbr: string): ContractRow[] {
  const profiles = new Map(profileRows().map((row) => [row.playerId, row]));
  const rows: ContractRow[] = [];
  for (const [key, contract] of Object.entries(contracts.players)) {
    if (contract.team !== abbr) continue;
    const playerId = Number(key);
    const profile = profiles.get(playerId);
    const bio = bios[key];
    const name = profile?.name ?? bio?.n;
    if (!name) continue;
    const rawPos = profile?.pos ?? bio?.pos ?? "";
    const pos = rawPos === "L" ? "LW" : rawPos === "R" ? "RW" : rawPos;
    const endAge = ageOnJulyFirst(bio?.bd, contract.expires);
    rows.push({
      playerId,
      routeId: profile?.routeId ?? null,
      name,
      pos,
      group: profile?.group ?? groupOf(rawPos),
      age: ageOnJulyFirst(bio?.bd, capSeasonStart),
      aav: contract.aav,
      capPct: Math.round(capShare(contract.aav) * 1000) / 10,
      expires: contract.expires,
      elc: Boolean(contract.elc),
      status: contract.status ?? (endAge == null ? null : endAge >= 27 ? "UFA" : "RFA"),
      clause: contract.clause ?? null,
      clauseText: contract.clauseText ?? null,
      asset: profile?.assetRating != null ? Math.round(profile.assetRating) : null,
      headshot: profile?.hasHeadshot ?? true,
    });
  }
  return rows.sort((a, b) => b.aav - a.aav);
}

/** The cap seasons shown as columns: this one plus the next five (start years). */
export function contractSeasons(): number[] {
  return Array.from({ length: 6 }, (_, index) => capSeasonStart + index);
}
