// The site URL is set at build time in next.config.ts:
// staging builds point at staging.statspuck.com, everything else at statspuck.com.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://statspuck.com").replace(/\/$/, "");

/** Where the Draft Rater module lives on the site. */
export const draftRaterBase = "/draft-rater";

export const site = {
  name: "Draft Rater",
  brand: "StatsPuck",
  description:
    "Who actually wins the NHL draft. Every pick since 2005, graded by the hockey they played against the slot.",
  url: siteUrl,
};

/** Full share link for any page. `path` is the site path, e.g. "/players/123" or "/draft-rater/drafts/2015". */
export function canonicalUrl(path: string, search = ""): string {
  const clean = path === "/" || path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `${siteUrl}${clean}${query}`;
}

/** Files in public/ are served from the site root. Kept as a helper so asset paths stay in one place. */
export function publicPath(path: string): string {
  return path;
}
