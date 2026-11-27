import rumorsJson from "../../data/rumors.json";
import { capShare, playerContract } from "./cap";
import { teams } from "./data";
import { profileRows } from "./profiles";

// Rumor & Buzz Tracker: hand-curated rumor entries (data/rumors.json) joined to live
// StatsPuck numbers (Skill, contract, clause, Asset Value) at build time.

export type RumorType = "Trade Block" | "Extension Talks" | "Buyout Candidate" | "Offer Sheet Watch";
export type Credibility = "Tier 1 Insider" | "League Chatter";

type RawRumor = {
  id: string;
  date: string;
  rumorType: RumorType;
  credibility: Credibility;
  playerIds: number[];
  teamCode: string;
  interested: string[];
  headline: string;
  summary: string;
  sourceName: string | null;
  sourceUrl: string | null;
};

export type RumorPlayer = {
  playerId: number;
  routeId: number | null;
  name: string;
  pos: string;
  team: string | null;
  headshot: boolean;
  skill: number | null;
  archetype: string | null;
  aav: number | null;
  capPct: number | null;
  expires: number | null;
  status: string | null;
  elc: boolean;
  clause: string | null;
  clauseText: string | null;
  asset: number | null;
};

export type Rumor = Omit<RawRumor, "interested"> & {
  teamName: string;
  teamColor: string;
  interested: { abbr: string; name: string }[];
  players: RumorPlayer[];
};

const file = rumorsJson as unknown as { sample: boolean; updated: string; rumors: RawRumor[] };
const teamByAbbr = new Map(teams.map((team) => [team.abbr, team]));

export const rumorsAreSample = file.sample;
export const rumorsUpdated = file.updated;

export function rumors(): Rumor[] {
  const rows = new Map(profileRows().map((row) => [row.playerId, row]));
  return file.rumors
    .filter((rumor) => teamByAbbr.has(rumor.teamCode))
    .map((rumor) => {
      const team = teamByAbbr.get(rumor.teamCode)!;
      const players: RumorPlayer[] = rumor.playerIds.map((playerId) => {
        const row = rows.get(playerId);
        const contract = playerContract(playerId);
        return {
          playerId,
          routeId: row?.routeId ?? null,
          name: row?.name ?? `Player ${playerId}`,
          pos: row?.pos ?? "",
          team: contract?.team ?? row?.team ?? null,
          headshot: row?.hasHeadshot ?? true,
          skill: row?.skills?.overall ?? null,
          archetype: row?.skills?.archetype ?? null,
          aav: contract?.aav ?? null,
          capPct: contract ? Math.round(capShare(contract.aav) * 1000) / 10 : null,
          expires: contract?.expires ?? null,
          status: contract?.status ?? null,
          elc: Boolean(contract?.elc),
          clause: contract?.clause ?? null,
          clauseText: contract?.clauseText ?? null,
          asset: row?.assetRating ?? null,
        };
      });
      return {
        ...rumor,
        teamName: team.name,
        teamColor: team.color,
        interested: rumor.interested.filter((abbr) => teamByAbbr.has(abbr)).map((abbr) => ({ abbr, name: teamByAbbr.get(abbr)!.name })),
        players,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Trade Machine link with the rumored player(s) already moving to the first rumored destination. */
export function rumorTradeHref(rumor: Rumor): string {
  const ids = rumor.players.map((player) => player.playerId).join(",");
  const to = rumor.interested[0]?.abbr;
  return `/trade-machine?player=${ids}${to ? `&to=${to}` : ""}`;
}

/** Card Studio link: a trade graphic when there is a destination, otherwise a scouting card. */
export function rumorCardHref(rumor: Rumor): string {
  const first = rumor.players[0];
  const to = rumor.interested[0]?.abbr;
  if (to) return `/card-studio?template=trade&player=${rumor.players.map((p) => p.playerId).join(",")}&to=${to}`;
  return `/card-studio?template=scout&player=${first?.playerId ?? ""}`;
}
