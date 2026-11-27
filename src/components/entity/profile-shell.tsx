"use client";

import type { ReactNode } from "react";
import { TabBar, useActiveTab, type TabDef } from "@/components/entity/entity-tabs";

// The Persistent Bio Card plus Module Context Tabs. The left side never changes; the
// right-hand Hero Box (and the Share card inside it) follows whichever tab is open.

export function ProfileShell({
  tabs,
  aliases,
  left,
  middle,
  heroes,
  panels,
}: {
  tabs: TabDef[];
  aliases?: Record<string, string>;
  left: ReactNode;
  middle?: ReactNode;
  /** Hero Box per tab id. A tab without one shows the first tab's hero. */
  heroes: Record<string, ReactNode>;
  panels: Record<string, ReactNode>;
}) {
  const active = useActiveTab(tabs, aliases);
  const hero = heroes[active] ?? heroes[tabs[0].id];
  return (
    <div>
      <section
        className={`grid gap-5 rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5 lg:items-stretch lg:gap-6 ${
          middle ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_13rem]" : "lg:grid-cols-[minmax(0,1fr)_15rem]"
        }`}
      >
        <div className="min-w-0">{left}</div>
        {middle ? <div className="min-w-0 lg:border-l lg:border-[#262B36] lg:pl-6">{middle}</div> : null}
        <div key={active} className="min-w-0 animate-[fadeIn_200ms_ease-out]">
          {hero}
        </div>
      </section>
      <div className="mt-5">
        <TabBar tabs={tabs} active={active} />
        <div role="tabpanel" className="pt-6">
          {panels[active]}
        </div>
      </div>
    </div>
  );
}
