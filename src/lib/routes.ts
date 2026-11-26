// Canonical entity URLs. Every link to a player, team, or GM goes through here.
// Links from inside the Draft Rater pass tab "draft"; search and the hub open Overview.

export type EntityTab = "overview" | "draft" | "development" | "asset" | "trades" | "luck" | "matchups";

function withTab(path: string, tab?: EntityTab): string {
  return tab && tab !== "overview" ? `${path}?tab=${tab}` : path;
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
