import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CapBar, DnaPills, PillarGrades, SectionLabel } from "@/components/entity/bio";
import { GameEdgePanel } from "@/components/entity/game-edge-panel";
import { ComingSoonStamp, HeroBox } from "@/components/entity/hero-box";
import { OrgDevelopment } from "@/components/entity/org-development";
import { ProfileShell } from "@/components/entity/profile-shell";
import { AssetMgmtSoon, AssetRankMini, DraftCapitalMatrix, FranchiseAssetCard, TradeRecord, TreesLink } from "@/components/entity/trades-cap";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { ScoutingPanels } from "@/components/scouting-panels";
import type { ShareCardModel } from "@/components/share-cards";
import { ShareLauncher } from "@/components/share-modal";
import { TeamBreakdown } from "@/components/team-breakdown";
import { TeamLogo } from "@/components/team-logo";
import { capCeiling, money, teamCap } from "@/lib/cap";
import { eras, leaderboard, og, picks } from "@/lib/data";
import { devBoard, devGems, undraftedGems } from "@/lib/dev-board";
import { development } from "@/lib/development";
import { franchiseAssets, franchiseAssetsFor } from "@/lib/franchise-assets";
import { DEV_SCORE_TIP, DRAFT_SCORE_TIP, scoreClass, signed } from "@/lib/format";
import { teamTradeReport } from "@/lib/gm-grades";
import { rosterBoard, teamSkill, teamSkillRank } from "@/lib/leaderboards";
import { teamOverall } from "@/lib/overall-grades";
import { contractSeasons, teamContracts } from "@/lib/team-contracts";
import { TeamContractsTable } from "@/components/entity/team-contracts-table";
import { gmTeamHref, playerHref, teamHref } from "@/lib/routes";
import { scoutingReport } from "@/lib/scouting";
import { letterTone } from "@/lib/search";
import { skillColor, skillTone } from "@/lib/skills";
import type { BriefPick, TeamGrade } from "@/lib/types";

type Params = { team: string };

const TEAM_TABS = [
  { id: "roster", label: "Roster & Skills" },
  { id: "cap-assets", label: "Cap & Assets" },
  { id: "draft-dev", label: "Draft & Dev" },
  { id: "history", label: "History & Trades" },
  { id: "game-edge", label: "Game Edge", soon: true },
];

const TEAM_ALIASES: Record<string, string> = {
  overview: "roster",
  draft: "draft-dev",
  development: "draft-dev",
  "trades-cap": "cap-assets",
  luck: "game-edge",
  matchups: "game-edge",
};

export function generateStaticParams() {
  return leaderboard.map((team) => ({ team: team.abbr.toLowerCase() }));
}

export const dynamicParams = false;

function findTeam(slug: string): TeamGrade | undefined {
  return leaderboard.find((row) => row.abbr === slug.toUpperCase());
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { team: slug } = await params;
  const team = findTeam(slug);
  if (!team) return {};
  const title = team.name;
  const description = `${team.name}: roster skill, cap and franchise assets, draft grade ${team.letter} (${team.rating}/100), development and trade history.`;
  const image = og.teams[team.abbr];
  return {
    title,
    description,
    alternates: { canonical: teamHref(team.abbr) },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function TeamPage({ params }: { params: Promise<Params> }) {
  const { team: teamSlug } = await params;
  const team = findTeam(teamSlug);
  if (!team) notFound();
  const owned = picks.filter((pick) => pick.franchise === team.abbr).sort((a, b) => a.year - b.year || a.overall - b.overall);
  const teamEras = eras.filter((era) => era.team === team.abbr);
  const currentGm = teamEras.filter((era) => era.endYear == null).sort((a, b) => b.startYear - a.startYear)[0] ?? null;
  const report = scoutingReport(owned, picks);
  const trades = teamTradeReport(team.abbr);
  const skill = teamSkill(team.abbr);
  const skillRank = teamSkillRank(team.abbr);
  const assets = franchiseAssetsFor(team.abbr);
  const cap = teamCap(team.abbr);
  const roster = rosterBoard(team.abbr);
  const n = leaderboard.length;
  const overall = teamOverall(team.abbr);

  const metric = (over: Pick<Extract<ShareCardModel, { kind: "metric" }>, "hero" | "tiles"> & { product?: { name: string; path: string } }): ShareCardModel => ({
    kind: "metric",
    product: over.product ?? { name: "Team Profile", path: teamHref(team.abbr) },
    color: team.color,
    eyebrow: currentGm ? `GM ${currentGm.person}` : "NHL franchise",
    title: team.name,
    teamAbbr: team.abbr,
    teamName: team.name,
    hero: over.hero,
    tiles: over.tiles,
  });
  const share = (tab: string, card: ShareCardModel, summary: string) => (
    <ShareLauncher fileSlug={`${slug(team.name)}-${tab}`} title={`${team.name} · ${TEAM_TABS.find((item) => item.id === tab)?.label ?? tab}`} summary={summary} path={teamHref(team.abbr, tab as "roster")} card={card} />
  );

  const left = (
    <div className="flex items-center gap-4">
      <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-[#262B36] bg-[#0B0D10]/60 sm:h-28 sm:w-28">
        <TeamLogo abbr={team.abbr} name={team.name} className="h-16 w-20 sm:h-20 sm:w-24" />
      </span>
      <div className="min-w-0">
        <h1 className="display text-3xl leading-tight font-bold sm:text-4xl">{team.name}</h1>
        {currentGm ? (
          <p className="mt-2 text-sm text-[#94A3B8]">
            GM{" "}
            <Link href={gmTeamHref(currentGm.slug)} className="font-semibold text-[#F8FAFC] underline decoration-[#38BDF8]/50 underline-offset-4 hover:decoration-[#38BDF8]">
              {currentGm.person}
            </Link>{" "}
            · since {currentGm.startYear}
          </p>
        ) : null}
        <Link
          href="/leaderboards?board=teams"
          title="Overall Grade: average of the Draft, Development and Trades ratings. Click for the team leaderboard."
          className="mt-3 inline-flex items-center gap-2.5 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 py-1.5 pr-3 pl-1.5 transition hover:border-[#38BDF8]/60"
        >
          <span className={`display flex h-10 min-w-12 items-center justify-center rounded-lg border px-1.5 text-2xl leading-none font-bold ${letterTone(overall?.letter ?? null)}`}>
            {overall?.letter ?? "—"}
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">Overall grade</span>
            <span className="block text-sm font-semibold">{overall ? `${overall.rating}/100 · #${overall.rank} of ${n}` : "Needs 2 pillars"}</span>
          </span>
        </Link>
      </div>
    </div>
  );

  const middle = (
    <div className="flex h-full flex-col gap-4">
      <CapBar abbr={team.abbr} />
      <AssetRankMini abbr={team.abbr} />
      <DnaPills report={report} />
    </div>
  );

  const heroes: Record<string, ReactNode> = {
    roster: (
      <HeroBox
        label="Team Skill Rating"
        value={skill ? String(skill.rating) : "—"}
        valueTone={skillTone(skill?.rating ?? null)}
        unit={skill ? "/ 99" : undefined}
        href="/leaderboards?board=teams"
        hrefLabel="Team leaderboard"
        caption="Top 12 F, 6 D and the starting goalie"
        stats={[
          { label: "Skill rank", value: skillRank ? `#${skillRank}/${n}` : "—", href: "/leaderboards?board=teams" },
          { label: "Best player", value: roster.rows[0]?.name.split(" ").slice(-1)[0] ?? "—", title: roster.rows[0]?.name, href: roster.rows[0]?.href ?? undefined },
        ]}
        action={share(
          "roster",
          metric({
            hero: { label: "Team Skill", value: skill ? String(skill.rating) : "—", unit: "/99", color: skillColor(skill?.rating ?? null), note: skillRank ? `#${skillRank} of ${n}` : undefined },
            tiles: roster.rows.slice(0, 4).map((row) => ({ label: row.name, value: row.values.skill == null ? "—" : String(row.values.skill), note: String(row.values.archetype ?? "") })),
          }),
          `${team.name}: ${skill ? `${skill.rating} Team Skill` : "Team Skill"}${skillRank ? `, #${skillRank} in the NHL` : ""}.`,
        )}
      />
    ),
    "cap-assets": (
      <HeroBox
        label="Total Asset Rank"
        value={assets ? `#${assets.rank}` : "—"}
        unit={`/ ${franchiseAssets.length}`}
        href="/trade-machine/rankings"
        hrefLabel="All 32 franchises"
        caption="Roster + prospects + 2027–29 picks"
        stats={[
          { label: "Cap space", value: cap ? money(cap.capSpace) : "—", tone: cap && cap.capSpace < 0 ? "text-[#EF4444]" : undefined, title: `Ceiling ${money(capCeiling)}` },
          { label: "Asset value", value: assets ? String(Math.round(assets.total)) : "—" },
        ]}
        action={share(
          "cap-assets",
          metric({
            product: { name: "Trade Machine", path: "/trade-machine/rankings" },
            hero: { label: "Asset Rank", value: assets ? `#${assets.rank}` : "—", unit: `/${franchiseAssets.length}`, note: assets ? `${Math.round(assets.total)} total Asset Value` : undefined },
            tiles: assets
              ? [
                  { label: "Roster", value: String(Math.round(assets.roster)) },
                  { label: "Prospects", value: String(Math.round(assets.prospects)) },
                  { label: "Picks", value: String(Math.round(assets.picks)) },
                  { label: "Cap space", value: cap ? money(cap.capSpace) : "—" },
                ]
              : [],
          }),
          `${team.name}: #${assets?.rank ?? "—"} in Total Franchise Asset Value.`,
        )}
      />
    ),
    "draft-dev": (
      <PillarGrades
        hero={{
          label: "Overall Grade",
          letter: overall?.letter ?? null,
          note: overall ? `${overall.rating}/100 · #${overall.rank} of ${n}` : "Needs 2 pillars",
          title: "Average of the Draft, Development and Trades ratings.",
        }}
        pillars={[
          { label: "Draft", letter: team.letter, score: signed(team.avg), tone: scoreClass(team.avg), title: DRAFT_SCORE_TIP },
          { label: "Dev", letter: team.dev?.letter ?? null, score: team.dev ? signed(team.dev.avg) : "too new", tone: team.dev ? scoreClass(team.dev.avg) : undefined, title: DEV_SCORE_TIP },
          trades
            ? { label: "Trades", letter: trades.letter, score: signed(trades.score), tone: scoreClass(trades.score), title: "Net Impact from every trade since 2005-06, five seasons out, shrunk for sample size." }
            : { label: "Trades", letter: null, soon: true },
        ]}
        stats={[
          { label: "Draft rank", value: `#${team.rank} of ${n}` },
          { label: "Dev rank", value: team.dev?.rank ? `#${team.dev.rank} of ${devBoard.length}` : "—" },
        ]}
        action={share(
          "draft-dev",
          {
            kind: "team",
            name: team.name,
            abbr: team.abbr,
            color: team.color,
            rank: team.rank,
            letter: team.letter,
            rating: team.rating,
            avg: team.avg,
            report,
            byYear: team.byYear,
          },
          `${team.name} draft grade ${team.letter}, Draft Score ${signed(team.avg)}.`,
        )}
      />
    ),
    history: (
      <HeroBox
        label="Trades Grade"
        badge={
          <span className={`display mx-auto inline-flex min-w-[4.5rem] items-center justify-center rounded-xl border px-3 py-1 text-5xl leading-none font-bold ${letterTone(trades?.letter ?? null)}`}>
            {trades?.letter ?? "—"}
          </span>
        }
        href="/trade-machine/rater"
        hrefLabel="Trade Rater"
        caption="Every trade since 2005-06, five seasons out"
        stats={[
          { label: "Trades", value: trades ? String(trades.trades) : "—" },
          { label: "Net Impact", value: trades ? signed(trades.net, 0) : "—", tone: trades ? scoreClass(trades.net) : undefined },
        ]}
        action={share(
          "history",
          metric({
            product: { name: "Trade Machine", path: "/trade-machine/rater" },
            hero: { label: "Trades Grade", value: trades?.letter ?? "—", note: trades ? `${trades.trades} trades since 2005-06` : undefined },
            tiles: trades
              ? [
                  { label: "Net Impact", value: signed(trades.net, 0) },
                  { label: "Trade Score", value: signed(trades.score) },
                  { label: "GM eras", value: String(teamEras.length) },
                ]
              : [],
          }),
          `${team.name} trade grade ${trades?.letter ?? "—"}.`,
        )}
      />
    ),
    "game-edge": <HeroBox label="Game Edge" badge={<ComingSoonStamp />} caption="Line chemistry, goal types and pregame edges." href="/game-edge" hrefLabel="Preview Game Edge" />,
  };

  const panels: Record<string, ReactNode> = {
    roster: (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="display text-2xl font-bold">Roster &amp; Skills</h2>
            <p className="text-sm text-[#94A3B8]">Today&apos;s NHL roster by Overall Skill. Players who debuted before 2005-06 are outside the StatsPuck era and not listed.</p>
          </div>
          <Link href="/leaderboards?board=players" className="text-sm font-semibold text-[#38BDF8] hover:underline">
            League skill leaderboard →
          </Link>
        </div>
        {roster.rows.length ? <LeaderboardTable board={roster} /> : <p className="text-sm text-[#94A3B8]">No roster players on file.</p>}
      </div>
    ),
    "cap-assets": (
      <div className="grid gap-5">
        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <CapBar abbr={team.abbr} />
        </div>
        <FranchiseAssetCard abbr={team.abbr} />
        <DraftCapitalMatrix abbr={team.abbr} teamName={team.name} />
        <TeamContractsTable rows={teamContracts(team.abbr)} seasons={contractSeasons()} teamName={team.name} ceiling={capCeiling} />
        <AssetMgmtSoon subject={team.name} />
      </div>
    ),
    "draft-dev": (
      <div className="grid gap-10">
        <div>
          <p className="text-sm text-[#94A3B8]">
            <Link href="/draft-rater" className="hover:text-white">
              Draft Rater
            </Link>{" "}
            · The letter compares this franchise with the other {n - 1}. Every graduated pick counts equally, with a #1 overall hit capped at +250. Prospects under 25 Impact are not in the average.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PickCard title="Best pick" pick={team.best} />
            <PickCard title="Worst pick" pick={team.worst} />
          </div>
          <ScoutingPanels report={report} />
          <TeamBreakdown eras={teamEras} color={team.color} byYear={team.byYear} picks={owned} />
        </div>
        <section>
          <h2 className="display mb-3 text-2xl font-bold">Development</h2>
          <OrgDevelopment
            subject={team.name}
            dev={team.dev}
            gems={devGems(team.dev)}
            undrafted={undraftedGems({ franchise: team.abbr })}
            board={devBoard}
            highlight={team.abbr}
            matureThrough={development.matureThrough}
          />
        </section>
      </div>
    ),
    history: (
      <div className="grid gap-5">
        {trades ? <TradeRecord report={trades} subject={team.name} /> : <p className="text-sm text-[#94A3B8]">No trades on file.</p>}
        <TreesLink abbr={team.abbr} label={`${team.name} trade trees`} />
        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>General managers since 2005</SectionLabel>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[...teamEras]
              .sort((a, b) => b.startYear - a.startYear)
              .map((era) => (
                <li key={era.slug}>
                  <Link href={gmTeamHref(era.slug)} className="flex items-center justify-between gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-3 py-2 text-sm hover:border-[#38BDF8]/60">
                    <span className="font-semibold">{era.person}</span>
                    <span className="flex items-center gap-2 text-[#94A3B8]">
                      {era.startYear}–{era.endYear ?? "now"}
                      <span className={`display rounded-md border px-1.5 text-xs font-bold ${letterTone(era.letter)}`}>{era.letter ?? "—"}</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </div>
    ),
    "game-edge": <GameEdgePanel subject={team.name} />,
  };

  return <ProfileShell tabs={TEAM_TABS} aliases={TEAM_ALIASES} left={left} middle={middle} heroes={heroes} panels={panels} />;
}

function PickCard({ title, pick }: { title: string; pick: BriefPick }) {
  return (
    <Link href={playerHref(pick.id, "career")} className="block rounded-2xl border border-[#262B36] p-4 hover:border-[#38BDF8]/60">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className="mt-1 text-lg font-semibold">{pick.name}</p>
      <p className={`display text-3xl font-bold ${scoreClass(pick.score)}`}>{signed(pick.score)}</p>
      <p className="text-sm text-zinc-500">
        {pick.year} · #{pick.overall}
      </p>
    </Link>
  );
}
