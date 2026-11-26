import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { leaderboard, meta, officialFilter, picks, teams } from "@/lib/data";
import { heroSet } from "@/lib/grade";
import { modules, type ModuleInfo } from "@/lib/modules";
import { letterTone } from "@/lib/search";

export default function HubPage() {
  const top = leaderboard.find((team) => team.rank === 1) ?? leaderboard[0];
  const { gems } = heroSet(picks, teams, officialFilter());

  return (
    <div>
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Hockey intelligence platform</p>
          <h1 className="display mt-3 text-5xl leading-[0.95] font-bold sm:text-6xl lg:text-7xl">
            Every hockey decision,
            <br />
            <span className="text-[#38BDF8]">settled by the math.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#94A3B8]">
            StatsPuck turns two decades of NHL data into clear, objective grades—no hot takes, no team bias. Built for
            hardcore fans, player agents, and front offices who want the answer, not the noise.
          </p>
          <div className="mt-7 grid max-w-md grid-cols-3 gap-4 text-sm">
            <Stat value={meta.pickCount.toLocaleString()} label="NHL picks graded" />
            <Stat value={`${meta.curveFirstYear}–${meta.latestDraftYear}`} label="Draft years" />
            <Stat value={String(leaderboard.length)} label="Franchises ranked" />
          </div>
        </div>

        <SnapshotCard top={top} gems={gems} />
      </section>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="display text-3xl font-bold">The StatsPuck modules</h2>
          <p className="hidden text-sm text-[#94A3B8] sm:block">One platform. Six lenses on the game.</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {modules.map((item) => (
            <ModuleCard key={item.name} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="display text-xl font-bold text-[#F8FAFC] sm:text-2xl">{value}</p>
      <p className="text-xs tracking-wide text-[#94A3B8] uppercase">{label}</p>
    </div>
  );
}

function SnapshotCard({
  top,
  gems,
}: {
  top: (typeof leaderboard)[number];
  gems: ReturnType<typeof heroSet>["gems"];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#262B36] bg-[#14171F] p-5 shadow-[0_0_0_1px_rgba(225,29,72,0.15),0_20px_60px_rgba(0,0,0,0.45)] sm:p-6">
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#E11D48]/15 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="display text-lg font-bold tracking-wide">Draft Rater snapshot</p>
        <span className="flex items-center gap-1.5 rounded-full bg-[#E11D48]/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E11D48]" />
          Live data
        </span>
      </div>

      <Link
        href={`/draft-rater/teams/${top.abbr.toLowerCase()}`}
        className="relative mt-5 flex items-center gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/70 p-3 sm:gap-4 sm:p-4 transition hover:border-[#38BDF8]/60"
      >
        <TeamLogo abbr={top.abbr} className="h-10 w-10 sm:h-14 sm:w-14" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">#1 drafting franchise</p>
          <p className="display truncate text-xl font-bold sm:text-2xl">{top.name}</p>
          <p className="text-xs text-[#94A3B8]">
            {top.n} graded picks since {meta.curveFirstYear}
          </p>
        </div>
        <span className={`display ml-auto shrink-0 rounded-lg border px-2.5 py-1 text-2xl font-bold ${letterTone(top.letter)}`}>
          {top.letter}
        </span>
      </Link>

      {gems ? (
        <Link
          href={`/draft-rater/teams/${gems.franchise.toLowerCase()}`}
          className="relative mt-3 flex items-center gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/70 p-3 sm:gap-4 sm:p-4 transition hover:border-[#38BDF8]/60"
        >
          <TeamLogo abbr={gems.franchise} className="h-10 w-10 sm:h-14 sm:w-14" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">Top gem finder</p>
            <p className="display truncate text-xl font-bold sm:text-2xl">{gems.franchiseName}</p>
            <p className="text-xs text-[#94A3B8]">Most steals, late bloomers &amp; elite hits</p>
          </div>
          <span className="ml-auto shrink-0 text-right">
            <span className="display block text-2xl font-bold text-[#10B981]">{gems.count}</span>
            <span className="block text-[11px] text-[#94A3B8]">{(gems.rate * 100).toFixed(1)}% rate</span>
          </span>
        </Link>
      ) : null}

      <Link
        href="/draft-rater"
        className="relative mt-5 flex w-full items-center justify-center rounded-xl bg-[#E11D48] px-5 py-3 font-semibold text-white transition hover:bg-[#be123c]"
      >
        Launch Draft Rater →
      </Link>
    </div>
  );
}

function ModuleIcon({ icon, live }: { icon: ModuleInfo["icon"]; live: boolean }) {
  const paths: Record<ModuleInfo["icon"], React.ReactNode> = {
    draft: <path d="M4 18V9m5 9V5m5 13v-6m5 6V3" />,
    path: <path d="M4 19c4 0 4-7 8-7s4-7 8-7M4 19h.01M20 5h.01" />,
    trade: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
    luck: <path d="M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
    matchup: <path d="M4 4h16v16H4zM12 4v16M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />,
    ref: <path d="M8 3h8l-1 5H9L8 3Zm1 5v13m6-13v13M9 12h6m-6 4h6" />,
  };
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
        live ? "border-[#E11D48]/50 bg-[#E11D48]/10 text-[#E11D48]" : "border-[#262B36] bg-[#0B0D10] text-[#94A3B8]"
      }`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[icon]}
      </svg>
    </span>
  );
}

function StatusPill({ status }: { status: ModuleInfo["status"] }) {
  const tone =
    status === "LIVE NOW"
      ? "bg-[#E11D48] text-white"
      : status === "UP NEXT"
        ? "bg-[#38BDF8]/12 text-[#38BDF8] ring-1 ring-[#38BDF8]/40"
        : "bg-white/5 text-[#94A3B8] ring-1 ring-[#262B36]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap ${tone}`}>{status}</span>
  );
}

function ModuleCard({ item }: { item: ModuleInfo }) {
  const live = Boolean(item.href);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <ModuleIcon icon={item.icon} live={live} />
        <StatusPill status={item.status} />
      </div>
      <h3 className="display mt-4 text-xl font-bold sm:text-2xl">{item.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{item.blurb}</p>
      {live ? <p className="mt-auto pt-4 text-sm font-semibold text-[#38BDF8]">Open the board →</p> : null}
    </>
  );
  const base = "flex h-full flex-col rounded-2xl border bg-[#14171F] p-4 sm:p-5";
  return live && item.href ? (
    <Link
      href={item.href}
      className={`${base} border-[#E11D48]/60 shadow-[0_0_0_1px_rgba(225,29,72,0.25),0_0_32px_-6px_rgba(56,189,248,0.35)] transition hover:-translate-y-0.5 hover:border-[#38BDF8] hover:shadow-[0_0_0_1px_rgba(56,189,248,0.4),0_0_40px_-4px_rgba(225,29,72,0.45)]`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${base} border-[#262B36]`}>{body}</div>
  );
}
