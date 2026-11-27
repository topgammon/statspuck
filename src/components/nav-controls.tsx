"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { GlobalSearch } from "@/components/global-search";

// Client pieces of the top nav: the compact search (hidden on the home hero until you
// scroll past it).

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

export function HeaderSearch() {
  const pathname = usePathname();
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > window.innerHeight * 0.55,
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
