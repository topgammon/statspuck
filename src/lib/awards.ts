import awardsJson from "../../data/draft-rater/awards.json";

// NHL awards for every player since 2005-06, from the official NHL player feed
// (pipelines/draft-rater/fetch_awards.py, refreshed monthly).

export type Award = { name: string; seasons: number[] };

const file = awardsJson as unknown as { asOf: string; players: Record<string, [string, number[]][]> };

/** Most prestigious first; anything not listed sorts after, alphabetically. */
const ORDER = [
  "Stanley Cup",
  "Hart Memorial Trophy",
  "Conn Smythe Trophy",
  "Ted Lindsay Award",
  "Vezina Trophy",
  "James Norris Memorial Trophy",
  "Art Ross Trophy",
  "Maurice “Rocket” Richard Trophy",
  "Calder Memorial Trophy",
  "Frank J. Selke Trophy",
  "William M. Jennings Trophy",
  "Lady Byng Memorial Trophy",
  "King Clancy Memorial Trophy",
  "Mark Messier NHL Leadership Award",
  "Bill Masterton Memorial Trophy",
];

export function awardsFor(playerId: number | null | undefined): Award[] {
  if (playerId == null) return [];
  const rows = file.players[String(playerId)] ?? [];
  return rows
    .map(([name, seasons]) => ({ name, seasons }))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.name);
      const ib = ORDER.indexOf(b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b.seasons.length - a.seasons.length || a.name.localeCompare(b.name);
    });
}

/** Gold for the big individual awards, silver for the rest. */
export function isMajor(name: string): boolean {
  return ORDER.slice(0, 10).includes(name);
}
