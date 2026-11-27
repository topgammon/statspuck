import Link from "next/link";
import { MenuDrawer } from "@/components/menu-drawer";
import { HeaderSearch } from "@/components/nav-controls";
import { StatsPuckBadge } from "@/components/wordmark";
import { teams } from "@/lib/data";
import { teamHref } from "@/lib/routes";

// Top nav. Left: logo. Center: compact search (hidden on the home hero until scrolled).
// Right: the slide-out menu (every tool plus Leaderboards).

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#262B36] bg-[#0B0D10]/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:gap-5">
        <Link href="/" className="flex items-center gap-3" aria-label="StatsPuck home">
          <StatsPuckBadge height={40} />
          <span className="display hidden text-xl font-bold tracking-[0.04em] xl:block">STATSPUCK</span>
        </Link>
        <HeaderSearch />
        <nav aria-label="Browse" className="flex items-center gap-1">
          <Link href="/leaderboards?view=teams" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-[#94A3B8] transition hover:bg-white/[0.04] hover:text-white sm:flex">
            Teams
          </Link>
          <Link href="/leaderboards?view=players" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-[#94A3B8] transition hover:bg-white/[0.04] hover:text-white sm:flex">
            Players
          </Link>
          <MenuDrawer />
        </nav>
      </div>
    </header>
  );
}

const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Tools",
    links: [
      { href: "/draft-rater", label: "Draft Rater" },
      { href: "/draft-rater/drafts", label: "Draft Classes" },
      { href: "/development", label: "Development Path" },
      { href: "/trade-machine", label: "Trade Machine" },
      { href: "/trade-machine/rater", label: "Trade Rater" },
      { href: "/trade-machine/trees", label: "Trade Trees" },
      { href: "/trade-machine/rankings", label: "Franchise Rankings" },
      { href: "/ufa-tracker", label: "UFA & RFA Tracker" },
      { href: "/lottery", label: "Draft Lottery Simulator" },
      { href: "/perfect-roster", label: "Perfect Roster" },
      { href: "/trophies", label: "Trophy Favorites" },
      { href: "/game-edge", label: "Game Edge" },
      { href: "/ref-watch", label: "Ref Watch" },
    ],
  },
  {
    title: "Leaderboards",
    links: [
      { href: "/leaderboards", label: "Overall Skill" },
      { href: "/leaderboards?board=teams", label: "Teams" },
      { href: "/leaderboards?board=gms", label: "General Managers" },
      { href: "/leaderboards?board=contracts", label: "Best Contract Value" },
      { href: "/leaderboards?board=steals", label: "Draft Steals" },
      { href: "/leaderboards?board=trophies", label: "Trophy Favorites" },
      { href: "/leaderboards?board=lottery", label: "Lottery Luck" },
      { href: "/leaderboards?board=milestones", label: "Milestone Watch" },
      { href: "/leaderboards?board=debuts", label: "NHL Debuts" },
      { href: "/leaderboards?board=seasons", label: "Season Leaders" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/draft-rater/methodology", label: "Methodology" },
      { href: "/", label: "Home" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[#262B36] bg-[#0B0D10]/70">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_2fr]">
          <div>
            <Link href="/" className="flex items-center gap-3" aria-label="StatsPuck home">
              <StatsPuckBadge height={34} />
              <span className="display text-lg font-bold tracking-[0.04em]">STATSPUCK</span>
            </Link>
            <p className="mt-3 text-sm text-[#94A3B8]">Hockey decisions, backed by math.</p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#F8FAFC] uppercase">{column.title}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[#94A3B8] transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-label="NHL teams">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#F8FAFC] uppercase">Teams</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {[...teams]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((team) => (
                  <li key={team.abbr}>
                    <Link href={teamHref(team.abbr)} className="text-[#94A3B8] transition hover:text-white">
                      {team.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-[#262B36] pt-6 text-xs text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} StatsPuck · statspuck.com</p>
          <p className="max-w-2xl sm:text-right">
            StatsPuck is an independent analytics site and is not affiliated with, endorsed by, or sponsored by the National Hockey League, its teams, or the NHLPA. NHL and team
            names and logos are trademarks of their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}
