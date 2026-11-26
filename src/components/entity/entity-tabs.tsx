"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// Module Context Tabs. The open tab lives in the URL (?tab=draft) so links can
// open a specific tab and the browser keeps it on refresh. Overview has no param.

export type TabDef = { id: string; label: string; soon?: boolean };

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("popstate", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("popstate", callback);
  };
}

function currentTab(): string | null {
  return new URLSearchParams(window.location.search).get("tab");
}

export function selectTab(id: string) {
  const url = new URL(window.location.href);
  if (id === "overview") url.searchParams.delete("tab");
  else url.searchParams.set("tab", id);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((listener) => listener());
}

function useTab(tabs: TabDef[]): string {
  const raw = useSyncExternalStore(subscribe, currentTab, () => null);
  return tabs.some((tab) => tab.id === raw) ? (raw as string) : "overview";
}

export function EntityTabs({ tabs, panels }: { tabs: TabDef[]; panels: Record<string, ReactNode> }) {
  const active = useTab(tabs);
  return (
    <div className="mt-5">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Profile sections" className="flex min-w-max gap-1 border-b border-[#262B36]">
          {tabs.map((tab) => {
            const on = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => selectTab(tab.id)}
                className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
                  on ? "border-[#38BDF8] text-[#F8FAFC]" : "border-transparent text-[#94A3B8] hover:text-white"
                }`}
              >
                {tab.label}
                {tab.soon ? <span className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]/50" aria-label="coming soon" /> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" className="pt-6">
        {panels[active]}
      </div>
    </div>
  );
}

/** A link-style button that switches to another tab on the same page. */
export function TabLink({ tab, children, className = "" }: { tab: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        selectTab(tab);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
