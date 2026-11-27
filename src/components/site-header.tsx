import Link from "next/link";
import { MenuDrawer } from "@/components/menu-drawer";
import { HeaderSearch, ToolsMenu } from "@/components/nav-controls";
import { StatsPuckBadge } from "@/components/wordmark";

// Top nav. Left: logo. Center: compact search (hidden on the home hero until scrolled).
// Right: Tools dropdown, Leaderboards, and the slide-out menu.

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#262B36] bg-[#0B0D10]/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:gap-5">
        <Link href="/" className="flex items-center gap-3" aria-label="StatsPuck home">
          <StatsPuckBadge height={40} />
          <span className="display hidden text-xl font-bold tracking-[0.04em] xl:block">STATSPUCK</span>
        </Link>
        <HeaderSearch />
        <nav aria-label="Main" className="flex items-center gap-1">
          <div className="hidden md:block">
            <ToolsMenu />
          </div>
          <Link href="/leaderboards" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-[#F8FAFC] transition hover:bg-white/[0.04] md:flex">
            Leaderboards
          </Link>
          <MenuDrawer />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[#262B36]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="hover:text-white">
          StatsPuck · statspuck.com
        </Link>
        <p>Hockey decisions, backed by math.</p>
      </div>
    </footer>
  );
}
