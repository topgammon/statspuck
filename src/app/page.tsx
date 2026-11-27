import Link from "next/link";
import type { ReactNode } from "react";
import { AboutSupport } from "@/components/about-support";
import { GlobalSearch } from "@/components/global-search";
import { Cell, RowImage } from "@/components/leaderboard-table";
import { money, RosterCard } from "@/components/perfect-roster-view";
import { StatsPuckBadge } from "@/components/wordmark";
import { perfectRoster } from "@/lib/perfect-roster";
import { todaysGames } from "@/lib/game-edge";
import { activeRefs } from "@/lib/ref-watch";
import { leaderboard } from "@/lib/data";
import { devBoard } from "@/lib/dev-board";
import { skillBoard, type BoardRow } from "@/lib/leaderboards";
import { modules, type ModuleInfo } from "@/lib/modules";
import { profileRows } from "@/lib/profiles";
import { rumors } from "@/lib/rumors";
import { formatRating } from "@/lib/rating";
import { playerHref, teamHref } from "@/lib/routes";
import { letterTone } from "@/lib/search";

// Search-first home page. Above the fold: logo, one line, one big search bar.
// Below: six tool cards with live top-3 mini leaderboards, then a Featured strip.

type MiniRow = { href: string; name: string; image: BoardRow["image"]; value: ReactNode };

function topAssetPlayers(): MiniRow[] {
  return profileRows()
    .filter((row) => row.assetRating != null)
    .sort((a, b) => (b.assetRating ?? 0) - (a.assetRating ?? 0))
    .slice(0, 3)
    .map((row) => ({
      href: playerHref(row.routeId, "asset"),
      name: row.name,
      image: { kind: "player", playerId: row.playerId, headshot: row.hasHeadshot },
      value: <span className="display text-base font-bold text-[#10B981]">{formatRating(row.assetRating ?? 0)}</span>,
    }));
}

function letter(value: string | null) {
  return <span className={`display inline-flex min-w-8 justify-center rounded-md border px-1 text-sm font-bold ${letterTone(value)}`}>{value ?? "—"}</span>;
}

export default function HomePage() {
  const skills = skillBoard(5);

  const minis: Record<string, { title: string; rows: MiniRow[] } | null> = {
    "Draft Rater": {
      title: "Top drafting teams",
      rows: [...leaderboard]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 3)
        .map((team) => ({ href: teamHref(team.abbr, "draft-dev"), name: team.name, image: { kind: "team", abbr: team.abbr }, value: letter(team.letter) })),
    },
    "Development Path": {
      title: "Top development teams",
      rows: devBoard.slice(0, 3).map((row) => ({ href: teamHref(row.abbr, "draft-dev"), name: row.name, image: { kind: "team", abbr: row.abbr }, value: letter(row.letter) })),
    },
    "Trade Machine": { title: "Highest Asset Value", rows: topAssetPlayers() },
    Leaderboards: {
      title: "Top Overall Skill",
      rows: skills.rows.slice(0, 3).map((row) => ({ href: row.href ?? "/leaderboards", name: row.name, image: row.image, value: <Cell value={row.values.skill} column={skills.columns[0]} /> })),
    },
    "Card Studio": {
      title: "Make a scouting card",
      rows: skills.rows.slice(0, 3).map((row) => ({
        href: row.image?.kind === "player" && row.image.playerId ? `/card-studio?template=scout&player=${row.image.playerId}` : `/card-studio?ref=${row.name}`,
        name: row.name,
        image: row.image,
        value: <span className="text-xs font-semibold text-[#38BDF8]">Card →</span>,
      })),
    },
    "Rumor & Buzz Tracker": {
      title: "Latest buzz",
      rows: rumors()
        .slice(0, 3)
        .map((rumor) => ({
          href: `/rumors#${rumor.id}`,
          name: rumor.players[0]?.name ?? rumor.headline,
          image: { kind: "team", abbr: rumor.teamCode } as BoardRow["image"],
          value: <span className="text-[10px] font-semibold tracking-wide whitespace-nowrap text-[#94A3B8] uppercase">{rumor.rumorType.replace(" Talks", "").replace(" Watch", "")}</span>,
        })),
    },
    "Game Edge": todaysGames().games.length
      ? {
          title: "Tonight's matchups",
          rows: todaysGames()
            .games.slice(0, 3)
            .map((g) => ({
              href: "/game-edge",
              name: `${g.away} @ ${g.home}`,
              image: { kind: "team", abbr: g.home } as BoardRow["image"],
              value: <span className="text-xs font-semibold text-[#38BDF8]">Report →</span>,
            })),
        }
      : null,
    "Ref Watch": {
      title: "Most consistent referees",
      rows: activeRefs()
        .filter((r) => !r.low)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((r) => ({ href: `/ref-watch/${r.slug}`, name: r.name, image: null, value: letter(r.grade) })),
    },
  };

  return (
    <div>
      {/* Full-screen hero: header + logo + search fill the first screen; tools start below the fold. */}
      <section className="relative -mt-8 flex min-h-[calc(100svh-4.25rem)] flex-col items-center justify-center pb-16 text-center">
        <span className="hidden sm:block">
          <StatsPuckBadge height={250} />
        </span>
        <span className="sm:hidden">
          <StatsPuckBadge height={170} />
        </span>
        <h1 className="display mt-8 text-4xl leading-[1.02] font-bold sm:text-6xl">
          Every hockey decision, <span className="text-[#38BDF8]">settled by the math.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[#94A3B8] sm:text-lg">
          StatsPuck turns two decades of NHL data into clear, objective grades—no hot takes, no team bias. Built for hardcore fans, player agents, and front offices who want the
          answer, not the noise.
        </p>
        <div className="mt-8 w-full max-w-2xl">
          <GlobalSearch size="hero" />
        </div>
        <a href="#tools" aria-label="Scroll to the tools" className="absolute bottom-6 text-[#94A3B8] transition hover:text-white">
          <svg aria-hidden viewBox="0 0 20 20" className="h-7 w-7 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m5 8 5 5 5-5" />
          </svg>
        </a>
      </section>

      <section id="tools" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between gap-4">
          <h2 className="display text-3xl font-bold">Tools</h2>
          <p className="hidden text-sm text-[#94A3B8] sm:block">Click a card to open the tool. Click a row to jump straight to that team or player.</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {modules.filter((item) => item.onHome !== false).map((item) => (
            <ToolCard key={item.name} item={item} mini={minis[item.name] ?? null} />
          ))}
        </div>
      </section>

      <PerfectRosterPreview />

      <AboutSupport />
    </div>
  );
}

/** "Live Perfect Roster (Cap-Compliant)": 1st line, 1st pair, starting goalie, cap used. */
function PerfectRosterPreview() {
  const roster = perfectRoster();
  if (!roster) return null;
  const line = roster.forwards[0];
  const pair = roster.defense[0];
  return (
    <section className="mt-14">
      <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5 shadow-[0_0_40px_-12px_rgba(225,29,72,0.35)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#E11D48] uppercase">Live Perfect Roster · Cap-compliant</p>
            <h2 className="display mt-1 text-2xl font-bold sm:text-3xl">The best team that fits under the cap</h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Cap used</p>
            <p className="display text-2xl font-bold">
              {money(roster.total)} <span className="text-sm font-normal text-[#94A3B8]">/ {money(roster.ceiling)}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#38BDF8] to-[#10B981]" style={{ width: `${Math.min(100, (roster.total / roster.ceiling) * 100)}%` }} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">1st line</p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
              <RosterCard player={line.LW} label="LW" compact />
              <RosterCard player={line.C} label="C" compact />
              <RosterCard player={line.RW} label="RW" compact />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">1st pair</p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <RosterCard player={pair.LD} label="LD" compact />
              <RosterCard player={pair.RD} label="RD" compact />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Starter</p>
            <div className="mt-1.5">
              <RosterCard player={roster.goalies[0]} label="G" compact />
            </div>
          </div>
        </div>
        <Link href="/perfect-roster" className="mt-4 inline-block text-sm font-semibold text-[#38BDF8] hover:underline">
          View Full 20-Man Roster →
        </Link>
      </div>
    </section>
  );
}

function ToolIcon({ icon, live }: { icon: ModuleInfo["icon"]; live: boolean }) {
  const paths: Record<ModuleInfo["icon"], ReactNode> = {
    draft: <path d="M4 18V9m5 9V5m5 13v-6m5 6V3" />,
    path: <path d="M4 19c4 0 4-7 8-7s4-7 8-7M4 19h.01M20 5h.01" />,
    trade: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
    edge: <path d="M4 4h16v16H4zM12 4v16M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />,
    ref: <path d="M8 3h8l-1 5H9L8 3Zm1 5v13m6-13v13M9 12h6m-6 4h6" />,
    board: <path d="M5 20V10m7 10V4m7 16v-7M3 20h18" />,
    card: <path d="M4 5h16v14H4zM4 15l4-4 3 3 3-3 6 6M15 9h.01" />,
    rumor: <path d="M4 10v4h3l5 4V6L7 10H4Zm12-1a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" />,
  };
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
        live ? "border-[#E11D48]/50 bg-[#E11D48]/10 text-[#E11D48]" : "border-[#262B36] bg-[#0B0D10] text-[#94A3B8]"
      }`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[icon]}
      </svg>
    </span>
  );
}

function ToolCard({ item, mini }: { item: ModuleInfo; mini: { title: string; rows: MiniRow[] } | null }) {
  return (
    <div
      className={`group relative flex h-full flex-col rounded-2xl border bg-[#14171F] p-4 transition hover:-translate-y-0.5 sm:p-5 ${
        item.live ? "border-[#E11D48]/50 hover:border-[#38BDF8] hover:shadow-[0_0_40px_-8px_rgba(56,189,248,0.45)]" : "border-[#262B36] hover:border-[#38BDF8]/50"
      }`}
    >
      {/* The whole card opens the tool; rows below sit above this link and open their own page. */}
      <Link href={item.href} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Open ${item.name}`} />
      <div className="pointer-events-none relative flex items-start justify-between gap-2">
        <ToolIcon icon={item.icon} live={item.live} />
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap ${
            item.live ? "bg-[#E11D48] text-white" : "bg-white/5 text-[#94A3B8] ring-1 ring-[#262B36]"
          }`}
        >
          {item.live ? "LIVE" : "SOON"}
        </span>
      </div>
      <h3 className="display pointer-events-none relative mt-3 text-xl font-bold sm:text-2xl">{item.name}</h3>
      <p className="pointer-events-none relative mt-1 text-xs leading-relaxed text-[#94A3B8] sm:text-sm">{item.blurb}</p>
      {mini ? (
        <div className="relative z-10 mt-4">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{mini.title}</p>
          <ol className="mt-1.5 divide-y divide-[#262B36] rounded-xl border border-[#262B36] bg-[#0B0D10]/60">
            {mini.rows.map((row, index) => (
              <li key={row.href}>
                <Link href={row.href} className="flex items-center gap-2 px-2.5 py-1.5 transition hover:bg-[#38BDF8]/[0.07]">
                  <span className="w-3 text-xs font-semibold text-[#94A3B8]">{index + 1}</span>
                  <span className="hidden shrink-0 sm:inline-flex">
                    <RowImage image={row.image} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#F8FAFC] sm:text-sm" title={row.name}>
                    {row.name.includes(" ") ? (
                      <>
                        <span className="sm:hidden">{row.name.split(" ").slice(-1)[0]}</span>
                        <span className="hidden sm:inline">{row.name}</span>
                      </>
                    ) : (
                      row.name
                    )}
                  </span>
                  {row.value}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="pointer-events-none relative mt-4 rounded-xl border border-dashed border-[#262B36] px-3 py-4 text-center text-xs text-[#94A3B8]">Preview coming soon</div>
      )}
      <p className="pointer-events-none relative mt-auto pt-3 text-sm font-semibold text-[#38BDF8]">{item.live ? "Open →" : "Preview →"}</p>
    </div>
  );
}
