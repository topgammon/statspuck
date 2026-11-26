import Link from "next/link";
import { StatsPuckLockup } from "@/components/wordmark";

const links = [
  { href: "/draft-rater", label: "Draft Rater" },
  { href: "/draft-rater/drafts", label: "Drafts" },
  { href: "/draft-rater/methodology", label: "Method" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#262B36] bg-[#0B0D10]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="StatsPuck home">
          <StatsPuckLockup />
        </Link>
        <nav className="flex items-center gap-5 text-sm text-[#94A3B8]">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
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
