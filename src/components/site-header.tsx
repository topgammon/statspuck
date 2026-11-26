import Link from "next/link";
import { GlobalSearch } from "@/components/global-search";
import { MenuDrawer } from "@/components/menu-drawer";
import { StatsPuckBadge } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#262B36] bg-[#0B0D10]/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:gap-5">
        <Link href="/" className="flex items-center gap-3" aria-label="StatsPuck home">
          <StatsPuckBadge height={40} />
          <span className="display hidden text-xl font-bold tracking-[0.04em] lg:block">STATSPUCK</span>
        </Link>
        <div className="mx-auto w-full max-w-xl">
          <GlobalSearch />
        </div>
        <MenuDrawer />
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
