// Canonical entity URLs. Every link to a player, team, or GM goes through here.
//
// Player tabs: skills (default) | stats | asset | career | game-edge
// Team tabs:   roster (default) | cap-assets | draft-dev | history | game-edge
// GM tabs:     report (default) | drafting | development | transactions
// Older tab names (overview, draft, development, trades-cap, luck, matchups) still work:
// each profile maps them onto the new tabs, so old links never break.

export type EntityTab =
  | "skills"
  | "stats"
  | "asset"
  | "career"
  | "game-edge"
  | "roster"
  | "cap-assets"
  | "draft-dev"
  | "history"
  | "report"
  | "drafting"
  | "development"
  | "transactions"
  // legacy names
  | "overview"
  | "draft"
  | "trades-cap"
  | "luck"
  | "matchups";

const DEFAULTS = new Set(["overview", "skills", "roster", "report"]);

function withTab(path: string, tab?: EntityTab): string {
  return tab && !DEFAULTS.has(tab) ? `${path}?tab=${tab}` : path;
}

export function playerHref(id: number, tab?: EntityTab): string {
  return withTab(`/players/${id}`, tab);
}

export function teamHref(abbr: string, tab?: EntityTab): string {
  return withTab(`/teams/${abbr.toLowerCase()}`, tab);
}

export function gmHref(slug: string, tab?: EntityTab): string {
  return withTab(`/gms/${slug}`, tab);
}

/** A GM link from a team context: opens on that tenure instead of his whole career. */
export function gmTeamHref(slug: string): string {
  return `/gms/${slug}?view=team`;
}
