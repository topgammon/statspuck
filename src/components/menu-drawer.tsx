"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { StatsPuckBadge } from "@/components/wordmark";
import { modules } from "@/lib/modules";

export function MenuDrawer() {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open]);

  /** A tool's own root link is active only on that exact page; sub-pages match by prefix. */
  const isActive = (href: string, root: string) => (href === root ? pathname === root || pathname === `${root}/` : pathname.startsWith(href));

  const drawer = (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        inert={!open}
        onClick={(event) => {
          // Any link inside the drawer closes it.
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`absolute top-0 right-0 flex h-full w-[min(22rem,88vw)] flex-col border-l border-[#262B36] bg-[#14171F] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#262B36] px-5 py-4">
          <span className="display text-sm font-bold tracking-[0.18em] text-[#94A3B8] uppercase">Menu</span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#262B36] text-[#94A3B8] transition hover:border-[#38BDF8] hover:text-white"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5 5 15" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-5">
          <Link
            href="/leaderboards"
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition ${
              pathname.startsWith("/leaderboards") ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-[#262B36] bg-[#0B0D10]/60 hover:border-[#38BDF8]/60"
            }`}
          >
            <span className="display text-xl font-bold text-[#F8FAFC]">Leaderboards</span>
            <span className="text-[#38BDF8]">→</span>
          </Link>

          <p className="mt-6 text-[11px] font-semibold tracking-[0.16em] text-[#E11D48] uppercase">Tools</p>
          <div className="mt-3 grid gap-2">
            {modules
              .filter((item) => item.icon !== "board")
              .map((item) => (
                <div
                  key={item.name}
                  className={`rounded-xl border p-3 ${item.live ? "border-[#E11D48]/40 bg-[#0B0D10]/60" : "border-dashed border-[#262B36] bg-[#0B0D10]/30"}`}
                >
                  <Link href={item.href} className="flex items-center justify-between gap-2">
                    <span className={`display text-xl font-bold ${item.live ? "text-[#F8FAFC]" : "text-[#F8FAFC]/70"}`}>{item.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        item.live ? "bg-[#E11D48]/15 text-[#E11D48]" : "bg-white/5 text-[#94A3B8]"
                      }`}
                    >
                      {item.live ? "Live" : "Soon"}
                    </span>
                  </Link>
                  {item.links ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {item.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`rounded-lg border px-1 py-1.5 text-center text-sm leading-tight transition ${
                            isActive(link.href, item.href)
                              ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]"
                              : "border-[#262B36] text-[#94A3B8] hover:border-[#38BDF8]/60 hover:text-white"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        </nav>

        <div className="border-t border-[#262B36] px-5 py-4 text-sm">
          <Link href="/" className="flex items-center gap-2 text-[#94A3B8] transition hover:text-white">
            <StatsPuckBadge height={26} />
            StatsPuck Home
          </Link>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#262B36] bg-[#14171F] text-sm font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8]"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
