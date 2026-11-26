import type { ReactNode } from "react";
import { contracts, money, type PlayerContract } from "@/lib/cap";
import { modules } from "@/lib/modules";
import type { ScoutingReport } from "@/lib/scouting";
import { letterTone } from "@/lib/search";

// Building blocks for the Persistent Top Bio Card on player, team, and GM pages.

export function BioCard({ left, middle, right }: { left: ReactNode; middle: ReactNode; right: ReactNode }) {
  return (
    <section className="grid gap-5 rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_11.5rem] lg:items-stretch lg:gap-6">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0 lg:border-l lg:border-[#262B36] lg:pl-6">{middle}</div>
      <div className="min-w-0">{right}</div>
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">{children}</p>;
}

/** Small label + value chip used for snapshot numbers and Scouting DNA. */
export function QuickPill({ label, value, tone = "text-[#F8FAFC]", title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div title={title} className="min-w-0 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-2.5 py-2 sm:px-3">
      <p className="text-[10px] leading-tight font-semibold tracking-[0.1em] text-[#94A3B8] uppercase sm:tracking-[0.14em]">{label}</p>
      <p className={`display mt-0.5 text-xl leading-none font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export function PillGrid({ children, count = 3 }: { children: ReactNode; count?: number }) {
  return <div className={`grid gap-2 ${count === 4 ? "grid-cols-2" : "grid-cols-3"}`}>{children}</div>;
}

/** The big grade box on the right of every bio card. */
export function HeroGrade({
  letter,
  label = "Draft Grade",
  stats,
  action,
}: {
  letter: string | null;
  label?: string;
  stats: { label: string; value: string; tone?: string; title?: string }[];
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-4">
      <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:text-center">
        <SectionLabel>{label}</SectionLabel>
        <span className={`display inline-flex min-w-[4.5rem] items-center justify-center self-center rounded-xl border px-3 py-1 text-5xl leading-none font-bold ${letterTone(letter)}`}>
          {letter ?? "—"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-center">
        {stats.map((item) => (
          <div key={item.label} title={item.title} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
            <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{item.label}</dt>
            <dd className={`display text-lg leading-tight font-bold ${item.tone ?? "text-[#F8FAFC]"}`}>{item.value}</dd>
          </div>
        ))}
      </dl>
      {action ? <div className="mt-auto flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ContractPill({ contract }: { contract: PlayerContract | null }) {
  if (!contract) return null;
  const text = contract.elc ? `ELC · Exp ${contract.expires}` : `${money(contract.aav)} AAV · Exp ${contract.expires}`;
  return (
    <span className="inline-flex items-center rounded-full border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-2.5 py-0.5 text-xs font-semibold text-[#38BDF8]">
      {text}
    </span>
  );
}

/** Used cap vs remaining space against the league ceiling. Shows a quiet placeholder until cap data is connected. */
export function CapBar({ capHit }: { capHit: number | null }) {
  const ceiling = contracts.capCeiling;
  if (capHit == null) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel>Salary cap · {contracts.season}</SectionLabel>
          <span className="text-xs text-[#94A3B8]">Ceiling {money(ceiling)}</span>
        </div>
        <div className="mt-2 h-3 rounded-full border border-dashed border-[#262B36] bg-[#0B0D10]" />
        <p className="mt-1.5 text-xs text-[#94A3B8]">Team cap figures are coming soon.</p>
      </div>
    );
  }
  const used = Math.min(capHit / ceiling, 1);
  const space = ceiling - capHit;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>Salary cap · {contracts.season}</SectionLabel>
        <span className="text-xs text-[#94A3B8]">Ceiling {money(ceiling)}</span>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]" role="img" aria-label={`${money(capHit)} used, ${money(space)} space`}>
        <div className="h-full bg-[#38BDF8]" style={{ width: `${used * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span className="text-[#38BDF8]">Used {money(capHit)}</span>
        <span className={space >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}>
          {space >= 0 ? `Space ${money(space)}` : `Over by ${money(-space)}`}
        </span>
      </div>
    </div>
  );
}

const SOON: Record<string, { module: string; title: string; points: string[] }> = {
  development: {
    module: "Development Path",
    title: "Development Path",
    points: ["League-by-league path to the NHL", "Graduation odds by draft slot and age", "How this compares to similar prospects"],
  },
  asset: {
    module: "Trade Machine",
    title: "Asset Value",
    points: ["Projected Impact per $1M of cap", "Age curve and injury risk", "One value scale shared with every player and pick"],
  },
  trades: {
    module: "Trade Machine",
    title: "Trades & Cap",
    points: ["Historical trade grades", "Cap efficiency: Impact per dollar", "Contract comparables"],
  },
  luck: {
    module: "Luck Meter",
    title: "Luck & Variance",
    points: ["Shooting and save-percentage swings", "Injury man-games lost", "Linemate quality"],
  },
  matchups: {
    module: "Matchup Edge",
    title: "Matchups",
    points: ["Goal-type breakdowns", "Goalie tendency heatmaps", "Line chemistry and pregame edges"],
  },
};

/** Placeholder for a module tab that is not live yet. Future tools replace this panel in place. */
export function ComingSoonPanel({ tab, subject }: { tab: keyof typeof SOON; subject: string }) {
  const info = SOON[tab];
  const blurb = modules.find((item) => item.name === info.module)?.blurb;
  return (
    <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-6 sm:p-8">
      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase ring-1 ring-[#262B36]">
        Coming soon · {info.module}
      </span>
      <h2 className="display mt-4 text-3xl font-bold">
        {info.title} <span className="text-[#94A3B8]">for {subject}</span>
      </h2>
      {blurb ? <p className="mt-2 max-w-2xl text-[#94A3B8]">{blurb}</p> : null}
      <ul className="mt-5 grid gap-2 sm:grid-cols-3">
        {info.points.map((point) => (
          <li key={point} className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-3 py-3 text-sm text-[#F8FAFC]/80">
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small preview cards on Overview for the modules that are not live yet. */
export function ModulePreviews({ tabs }: { tabs: (keyof typeof SOON)[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tabs.map((tab) => {
        const info = SOON[tab];
        return (
          <div key={tab} className="rounded-xl border border-[#262B36] bg-[#14171F] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="display text-lg font-bold">{info.title}</p>
              <span className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">Soon</span>
            </div>
            <p className="mt-1 text-sm text-[#94A3B8]">{info.points.join(" · ")}</p>
          </div>
        );
      })}
    </div>
  );
}

export const PLAYER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "draft", label: "Draft" },
  { id: "development", label: "Development", soon: true },
  { id: "asset", label: "Asset Value", soon: true },
  { id: "luck", label: "Luck", soon: true },
  { id: "matchups", label: "Matchups", soon: true },
];

export const ORG_TABS = [
  { id: "overview", label: "Overview" },
  { id: "draft", label: "Draft" },
  { id: "development", label: "Development", soon: true },
  { id: "trades", label: "Trades & Cap", soon: true },
  { id: "luck", label: "Luck", soon: true },
  { id: "matchups", label: "Matchups", soon: true },
];

export function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(0)}%`;
}

/** Scouting DNA quick pills for team and GM bio cards. */
export function DnaPills({ report, graded }: { report: ScoutingReport; graded?: number }) {
  return (
    <div>
      <SectionLabel>Scouting DNA</SectionLabel>
      <div className="mt-2">
        <PillGrid count={graded != null ? 4 : 3}>
          {graded != null ? <QuickPill label="Graded Picks" value={String(graded)} /> : null}
          <QuickPill
            label="1st-Rd Bust %"
            value={pct(report.bust.rate)}
            tone="text-[#EF4444]"
            title={`${report.bust.count} of ${report.bust.n} evaluated first-rounders graded D+ or lower. League: ${pct(report.leagueBust.rate)}`}
          />
          <QuickPill
            label="Late-Rd Hit %"
            value={pct(report.late.rate)}
            tone="text-[#10B981]"
            title={`${report.late.count} of ${report.late.n} round 4–7 picks beat the slot and played 100+ games. League: ${pct(report.leagueLate.rate)}`}
          />
          <QuickPill
            label="Gem Rate"
            value={report.gemRate == null ? "—" : `${(report.gemRate * 100).toFixed(1)}%`}
            tone="text-[#F59E0B]"
            title={`${report.gems} steals and late bloomers out of ${report.evaluated} graded picks`}
          />
        </PillGrid>
      </div>
    </div>
  );
}
