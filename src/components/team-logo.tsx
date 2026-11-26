import { publicPath } from "@/lib/site";

// Current crests use the club abbreviation. A few names on old picks are a
// different mark than the franchise that owns them now.
const fileByName: Record<string, string> = {
  "Mighty Ducks of Anaheim": "ANA-mighty",
  "Atlanta Thrashers": "ATL",
  "Phoenix Coyotes": "PHX",
  "Arizona Coyotes": "ARI",
  "Utah Hockey Club": "UTA-club",
};

export function teamLogoFile(abbr: string, name?: string): string {
  if (name && fileByName[name]) return fileByName[name];
  return abbr;
}

export function TeamLogo({
  abbr,
  name,
  className = "h-8 w-12",
}: {
  abbr: string;
  name?: string;
  className?: string;
}) {
  return (
    <img
      src={publicPath(`/logos/teams/${teamLogoFile(abbr, name)}.svg`)}
      alt=""
      className={`${className} shrink-0 object-contain`}
    />
  );
}

export function TeamName({
  abbr,
  name,
  logoClassName,
  className = "",
}: {
  abbr: string;
  name: string;
  logoClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <TeamLogo abbr={abbr} name={name} className={logoClassName} />
      <span>{name}</span>
    </span>
  );
}
