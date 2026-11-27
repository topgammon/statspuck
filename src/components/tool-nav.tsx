"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Section switcher shown at the top of every multi-page tool (Draft Rater, Trade Machine...).
// Tools own their sub-pages here, so the site menu can stay a clean list of tools.

export type ToolSection = { href: string; label: string; /** Also active on deeper paths, e.g. /draft-rater/drafts/2015. */ prefix?: boolean };

export function ToolNav({ tool, sections, hideOn = [] }: { tool: string; sections: ToolSection[]; hideOn?: string[] }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  if (hideOn.some((path) => pathname.startsWith(path))) return null;
  const isOn = (section: ToolSection) => pathname === section.href || (section.prefix === true && pathname.startsWith(`${section.href}/`));
  return (
    <nav aria-label={`${tool} sections`} className="mb-7 flex flex-wrap items-center gap-3">
      <span className="display text-xs font-bold tracking-[0.2em] text-[#94A3B8] uppercase">{tool}</span>
      <span className="h-4 w-px bg-[#262B36]" aria-hidden />
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[#262B36] bg-[#14171F]/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {sections.map((section) => {
          const on = isOn(section);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={on ? "page" : undefined}
              className={`relative rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                on ? "bg-[#38BDF8]/12 text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.45)]" : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {section.label}
              {on ? <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#38BDF8]" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const DRAFT_RATER_SECTIONS: ToolSection[] = [
  { href: "/draft-rater", label: "Board" },
  { href: "/draft-rater/drafts", label: "Draft Classes", prefix: true },
  { href: "/lottery", label: "Lottery Simulator" },
];

export const TRADE_MACHINE_SECTIONS: ToolSection[] = [
  { href: "/trade-machine", label: "Mock Trade" },
  { href: "/trade-machine/rater", label: "Trade Rater" },
  { href: "/trade-machine/trees", label: "Trade Trees" },
  { href: "/trade-machine/rankings", label: "Franchise Rankings" },
];
