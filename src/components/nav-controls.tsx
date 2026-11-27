"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GlobalSearch } from "@/components/global-search";
import { tools } from "@/lib/modules";

// Client pieces of the top nav: the compact search (hidden on the home hero until you
// scroll past it) and the Tools dropdown.

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

export function HeaderSearch() {
  const pathname = usePathname();
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 320,
    () => false,
  );
  const home = pathname === "/";
  const show = !home || scrolled;
  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={`mx-auto w-full max-w-xl transition-all duration-200 ${show ? "opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
    >
      <GlobalSearch />
    </div>
  );
}

export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#F8FAFC] transition hover:bg-white/[0.04]"
      >
        Tools
        <svg aria-hidden viewBox="0 0 20 20" className={`h-3.5 w-3.5 text-[#94A3B8] transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-40 w-72 pt-2">
          <div className="rounded-xl border border-[#262B36] bg-[#14171F] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
            {tools.map((tool) => {
              const on = pathname.startsWith(tool.href);
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 transition ${on ? "bg-[#38BDF8]/10" : "hover:bg-white/[0.04]"}`}
                >
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${on ? "text-[#38BDF8]" : "text-[#F8FAFC]"}`}>{tool.name}</span>
                    <span className="block text-xs leading-snug text-[#94A3B8]">{tool.blurb}</span>
                  </span>
                  {tool.live ? null : (
                    <span className="mt-0.5 shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#94A3B8] uppercase ring-1 ring-[#262B36]">Soon</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
