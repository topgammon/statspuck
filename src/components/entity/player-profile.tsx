import Link from "next/link";
import type { ReactNode } from "react";
import { ContractDeepDive, InjuryTimeline, surplusScore, TradeHistory } from "@/components/entity/asset-extras";
import { ContractCompsPanel } from "@/components/entity/contract-comps-panel";
import { fairValue } from "@/lib/contract-comps";
import { nextMilestones } from "@/lib/milestones";
import { awardsFor } from "@/lib/awards";
import { TrophyCase } from "@/components/entity/trophy-case";
import { AssetValuePanel } from "@/components/entity/asset-value";
import { ArchetypePill, ProspectTierPill, SectionLabel } from "@/components/entity/bio";
import { PlayerGameEdge } from "@/components/entity/edge-panels";
import { goalieEdge, playerEdge } from "@/lib/game-edge";
import { ComingSoonStamp, HeroBox } from "@/components/entity/hero-box";
import { DebutAndMilestones, DraftPanel } from "@/components/entity/player-career";
import { PlayerDevelopment } from "@/components/entity/player-development";
import { ProfileShell } from "@/components/entity/profile-shell";
import { SkillsPanel } from "@/components/entity/skills-panel";
import { StatsTable } from "@/components/entity/stats-table";
import { UndraftedDevelopmentPanel, UndraftedDraftPanel } from "@/components/entity/undrafted-profile";
import { ClauseBadge } from "@/components/clause-badge";
import { CountryFlag } from "@/components/country-badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { ShareLauncher } from "@/components/share-modal";
import type { MetricCard, ShareCardModel } from "@/components/share-cards";
import { StampRow, VeteranMark } from "@/components/stamps";
import { TeamLogo } from "@/components/team-logo";
import { prospectTier } from "@/lib/archetypes";
import { capShare, money, pctCap, playerContract, type PlayerContract } from "@/lib/cap";
import { countryName } from "@/lib/countries";
import { meta, teamsByAbbr } from "@/lib/data";
import { isVeteran, scoreClass, signed } from "@/lib/format";
import { playerStatsTable } from "@/lib/player-stats";
import { playerTrades } from "@/lib/player-trades";
import { playerValue } from "@/lib/player-value";
import { profileRows } from "@/lib/profiles";
import { formatRating, ratingTone } from "@/lib/rating";
import { playerHref } from "@/lib/routes";
import { letterTone } from "@/lib/search";
import { debutSeason, playoffTotals } from "@/lib/season-stats";
import { skillColor, skillsFor, skillTone } from "@/lib/skills";
import type { PickRow, UndraftedPlayer, Vitals } from "@/lib/types";
import { ageOn, birthLabel, feetInches, vitalsFor } from "@/lib/vitals";

// The unified player profile: one Persistent Bio Card plus five Module Context Tabs
// (Skills | Stats | Asset Value | Career | Game Edge). Drafted picks and undrafted
// graduates share it; only the Career tab differs.

export const PLAYER_TABS = [
  { id: "skills", label: "Skills" },
  { id: "stats", label: "Stats" },
  { id: "asset", label: "Asset Value" },
  { id: "career", label: "Career" },
  { id: "game-edge", label: "Game Edge" },
];

/** Old tab names keep working: they open the closest new tab. */
export const PLAYER_TAB_ALIASES: Record<string, string> = {
  overview: "skills",
  "asset-value": "asset",
  draft: "career",
  development: "career",
  luck: "game-edge",
  matchups: "game-edge",
};

export type PlayerSubject = { kind: "pick"; pick: PickRow } | { kind: "undrafted"; player: UndraftedPlayer };

/** "$8.50M · 8.9% Cap · Exp 2030" or "ELC · $0.95M · 1.0% Cap · Exp 2027". */
export function contractPillText(contract: PlayerContract): string {
  const base = `${money(contract.aav)} · ${pctCap(contract.aav)} Cap · Exp ${contract.expires}`;
  return contract.elc ? `ELC · ${base}` : base;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function PlayerProfile({ subject }: { subject: PlayerSubject }) {
  const pick = subject.kind === "pick" ? subject.pick : null;
  const und = subject.kind === "undrafted" ? subject.player : null;
  const base = (pick ?? und)!;
  const routeId = base.id;
  const playerId = base.playerId;
  const name = base.name;
  const group = base.group;
  const stamps = base.stamps;
  const retired = pick ? pick.stamps.includes("RETIRED") || pick.active === false : und!.active === false;
  const color = (pick ? teamsByAbbr.get(pick.franchise)?.color : und!.franchise ? teamsByAbbr.get(und!.franchise)?.color : null) ?? "#38BDF8";
  const current = base.currentTeam ? teamsByAbbr.get(base.currentTeam) : null;
  const contract = retired ? null : playerContract(playerId);
  const value = playerValue({ playerId, pick, retired });
  const tier = pick ? prospectTier(pick) : null;
  const skills = skillsFor(playerId);
  const veteran = isVeteran(base.gpCareer) && !stamps.includes("RETIRED");
  const vitals: Vitals | null = vitalsFor(routeId);
  const country = vitals?.ctry ?? pick?.country ?? null;
  const rate = group === "G" ? (base.savePct == null ? "—" : base.savePct.toFixed(3).replace(/^0/, "")) : base.ppg == null ? "—" : base.ppg.toFixed(2);
  const rateLabel = group === "G" ? "SV%" : "PPG";

  // Impact by season start year, for the Stats table.
  const impactBySeason = new Map<number, number>();
  if (pick) (pick.seasons ?? []).forEach((impact, index) => impactBySeason.set(pick.year + index, impact));
  else und!.seasons.forEach((impact, index) => impactBySeason.set(und!.firstSeason + index, impact));
  const stats = playerStatsTable(playerId, group, impactBySeason);
  const playoff = playoffTotals(playerId);
  const debut = und ? und.debut : debutSeason(playerId);
  const debutTeam = und?.firstTeam ? { abbr: und.franchise ?? und.firstTeam, name: und.firstTeamName ?? und.firstTeam } : pick ? { abbr: pick.franchise, name: pick.franchiseName } : null;

  // Rank among active players at his position, for the Skills hero.
  const positionRank = (() => {
    if (!skills?.current || retired) return null;
    const pool = profileRows().filter((row) => row.active && row.group === group && row.skills?.current);
    const better = pool.filter((row) => row.skills!.overall > skills.overall).length;
    return { rank: better + 1, of: pool.length };
  })();
  const groupWord = group === "G" ? "goalies" : group === "D" ? "defensemen" : "forwards";

  // ---- Left: Persistent Bio Card (never changes) -------------------------------------
  const age = ageOn(vitals?.bd, meta.asOf);
  const vitalsList: { label: string; value: ReactNode; title?: string }[] = [
    { label: "Height", value: feetInches(vitals?.h) },
    { label: "Weight", value: vitals?.w ? `${vitals.w} lbs` : null },
    { label: group === "G" ? "Catches" : "Shoots", value: vitals?.sc ?? null },
    { label: "Age", value: age == null ? null : String(age), title: birthLabel(vitals?.bd) ? `Born ${birthLabel(vitals?.bd)}` : undefined },
    { label: "Country", value: country ? <CountryFlag code={country} name={countryName(country)} /> : null },
  ].filter((item) => item.value != null && item.value !== "");

  const left = (
    <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-start">
      <PlayerHeadshot playerId={playerId} name={name} available={pick ? pick.hasHeadshot : true} color={color} className="h-28 w-28 shrink-0 sm:h-32 sm:w-32" />
      <div className="min-w-0 flex-1">
        <h1 className="display text-3xl leading-tight font-bold sm:text-4xl">{name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-bold text-[#F8FAFC]">{base.pos}</span>
          {current ? (
            <Link href={`/teams/${current.abbr.toLowerCase()}`} className="inline-flex items-center gap-1.5 font-semibold text-[#F8FAFC] hover:text-[#38BDF8]">
              <TeamLogo abbr={current.abbr} name={current.name} className="h-6 w-7" />
              {current.name}
            </Link>
          ) : retired ? (
            <span className="text-[#94A3B8]">Retired</span>
          ) : (
            <span className="text-[#94A3B8]">Not on an NHL roster</span>
          )}
        </div>
        {vitalsList.length ? (
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {vitalsList.map((item) => (
              <div key={item.label} title={item.title}>
                <dt className="text-[9px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">{item.label}</dt>
                <dd className="mt-0.5 flex items-center text-sm leading-tight font-semibold text-[#F8FAFC]">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {contract ? (
            <Link
              href={playerHref(routeId, "asset")}
              title="Open the Asset Value tab"
              className="inline-flex items-center rounded-full border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-2.5 py-0.5 text-xs font-semibold text-[#38BDF8] transition hover:border-[#38BDF8]"
            >
              {contractPillText(contract)}
            </Link>
          ) : null}
          {contract?.clause ? <ClauseBadge clause={contract.clause} text={contract.clauseText} /> : null}
          {pick ? (
            <Link href={`/draft-rater/drafts/${pick.year}`} className="rounded-full border border-[#262B36] px-2.5 py-0.5 text-xs text-[#94A3B8] hover:border-[#38BDF8]/60 hover:text-white">
              {pick.year} · R{pick.round} #{pick.overall} · {pick.team}
            </Link>
          ) : (
            <span className="rounded-full border border-[#262B36] px-2.5 py-0.5 text-xs text-[#94A3B8]">Undrafted · NHL debut {und!.debut}</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StampRow stamps={stamps} />
          {veteran ? <VeteranMark /> : null}
          {skills?.archetype ? (
            <Link href="/leaderboards?board=players" title="See every player on the Skills leaderboard">
              <ArchetypePill archetype={skills.archetype} />
            </Link>
          ) : null}
          <ProspectTierPill tier={tier} />
        </div>
        {playerId != null ? (
          <Link href={`/card-studio?template=scout&player=${playerId}`} className="mt-3 inline-block text-xs font-semibold text-[#38BDF8] hover:underline">
            Open in Card Studio →
          </Link>
        ) : null}
      </div>
    </div>
  );

  // ---- Share cards, one per tab --------------------------------------------------------
  const teamLine = current ? current.name : retired ? "Retired" : "Free agent";
  const metric = (over: Partial<MetricCard> & Pick<MetricCard, "hero" | "tiles">): ShareCardModel => ({
    kind: "metric",
    product: { name: "Player Profile", path: playerHref(routeId) },
    color,
    eyebrow: `${base.pos} · ${teamLine}`,
    title: name,
    playerId,
    stamps,
    ...over,
  });
  const share = (tab: string, card: ShareCardModel, summary: string) => (
    <ShareLauncher fileSlug={`${slug(name)}-${tab}`} title={`${name} · ${PLAYER_TABS.find((item) => item.id === tab)?.label ?? tab}`} summary={summary} path={playerHref(routeId, tab as "skills")} card={card} />
  );

  // ---- Right: Hero Box per tab ---------------------------------------------------------
  const skillsHero = (
    <HeroBox
      label="Overall Skill"
      value={skills ? String(skills.overall) : "—"}
      valueTone={skillTone(skills?.overall ?? null)}
      unit={skills ? "/ 99" : undefined}
      href="/leaderboards?board=players"
      hrefLabel="Skill leaderboard"
      caption={skills?.archetype ? <ArchetypePill archetype={skills.archetype} small /> : skills ? null : "Needs more NHL games"}
      stats={
        positionRank
          ? [
              { label: "Rank", value: `#${positionRank.rank}`, title: `Among ${positionRank.of} active NHL ${groupWord}`, href: "/leaderboards?board=players" },
              { label: "Window", value: skills?.window.split(" to ").pop() ?? "—", title: skills?.window },
            ]
          : skills
            ? [{ label: "Last rated", value: skills.window.split(" to ").pop() ?? "—", title: skills.window }]
            : []
      }
      action={share(
        "skills",
        metric({
          hero: { label: "Overall Skill", value: skills ? String(skills.overall) : "—", unit: "/99", color: skillColor(skills?.overall ?? null), note: skills?.archetype ?? undefined },
          tiles: [],
          bars: skills?.axes.map((axis) => ({ label: axis.label.replace("High-Danger / ", ""), value: axis.value })),
        }),
        `${name}: ${skills ? `${skills.overall} Overall Skill` : "not rated yet"} on StatsPuck.`,
      )}
    />
  );

  const statsHero = (
    <HeroBox
      label="Career Impact"
      value={base.qg.toFixed(0)}
      caption="NHL regular season, since 2005-06"
      href={pick ? `/draft-rater/drafts/${pick.year}?sort=redraft` : "/leaderboards?board=players"}
      hrefLabel={pick ? `${pick.year} class by Impact` : "Leaderboards"}
      stats={[
        { label: "Career GP", value: base.gpCareer.toLocaleString("en-US") },
        { label: rateLabel, value: rate },
      ]}
      action={share(
        "stats",
        metric({
          hero: { label: "Career Impact", value: base.qg.toFixed(0), note: `${base.gpCareer} NHL games` },
          tiles: [
            { label: "Career GP", value: String(base.gpCareer) },
            group === "G" ? { label: "SV%", value: rate } : { label: "Points", value: base.points == null ? "—" : String(base.points), note: `${base.goals ?? 0} G · ${base.assists ?? 0} A` },
            { label: rateLabel === "PPG" ? "PPG" : "GAA", value: rateLabel === "PPG" ? rate : base.gaa == null ? "—" : base.gaa.toFixed(2) },
            { label: "Playoff Impact", value: playoff.gp ? playoff.impact.toFixed(0) : "—", note: playoff.gp ? `${playoff.gp} playoff GP` : undefined },
          ],
        }),
        `${name}: ${base.qg.toFixed(0)} career Impact in ${base.gpCareer} NHL games.`,
      )}
    />
  );

  const capPct = contract ? `${(capShare(contract.aav) * 100).toFixed(1)}%` : "—";
  const assetHero = (
    <HeroBox
      label="Asset Value"
      value={formatRating(value.rating)}
      valueTone={ratingTone(value.rating)}
      unit="/ 100"
      href={playerId ? `/trade-machine?player=${playerId}` : "/trade-machine"}
      hrefLabel="Test in Trade Machine"
      caption={value.kind === "prospect" ? <ProspectTierPill tier={value.tier} small /> : value.kind === "inactive" ? "Retired or inactive" : value.kind === "unsigned" ? "No NHL contract" : null}
      stats={[
        { label: "% of Cap", value: capPct, title: contract ? `${money(contract.aav)} AAV` : undefined, href: "/leaderboards?board=contracts" },
        { label: "Expires", value: contract ? String(contract.expires) : "—" },
      ]}
      action={share(
        "asset",
        metric({
          product: { name: "Trade Machine", path: "/trade-machine" },
          hero: { label: "Asset Value", value: formatRating(value.rating), unit: "/100", color: value.rating >= 40 ? "#10B981" : "#F8FAFC", note: contract ? contractPillText(contract) : undefined },
          tiles: [
            { label: "% of Cap", value: capPct },
            { label: "AAV", value: contract ? money(contract.aav) : "—" },
            { label: "Expires", value: contract ? String(contract.expires) : "—" },
            { label: "Surplus Score", value: surplusScore(value) == null ? "—" : String(surplusScore(value)) },
          ],
        }),
        `${name}: ${formatRating(value.rating)} Asset Value on the StatsPuck Trade Machine scale.`,
      )}
    />
  );

  const careerShare: ShareCardModel = pick ? { kind: "player", pick, color } : { kind: "undrafted", player: und!, color };
  const careerHero = pick ? (
    <HeroBox
      label="Draft Grade"
      badge={
        <span className={`display mx-auto inline-flex min-w-[4.5rem] items-center justify-center rounded-xl border px-3 py-1 text-5xl leading-none font-bold ${letterTone(pick.developing ? null : pick.letter)}`}>
          {pick.developing ? "—" : (pick.letter ?? "—")}
        </span>
      }
      href={`/draft-rater/drafts/${pick.year}`}
      hrefLabel={`${pick.year} draft class`}
      stats={[
        { label: "Draft Score", value: signed(pick.score), tone: pick.developing ? "text-zinc-300" : scoreClass(pick.score), title: "Impact minus what this draft slot usually produces by now", href: "/leaderboards?board=steals" },
        { label: "Redraft", value: `#${pick.redraft}`, title: `Where he ranks in the ${pick.year} class by Impact alone. Click to see the class sorted by Redraft.`, href: `/draft-rater/drafts/${pick.year}?sort=redraft` },
      ]}
      action={share("career", careerShare, `${name}, ${pick.year} #${pick.overall}, ${pick.developing ? "prospect" : pick.letter}, ${signed(pick.score)} versus the slot.`)}
    />
  ) : (
    <HeroBox
      label="Draft status"
      badge={
        <span className="display ink mx-auto inline-flex items-center justify-center border-[3px] border-[#38BDF8] px-2.5 py-1.5 text-xl leading-none font-bold tracking-[0.16em] text-[#bae6fd]">UNDRAFTED</span>
      }
      stats={[
        { label: "NHL debut", value: String(und!.debut) },
        { label: "Dev credit", value: und!.devCredit == null ? "—" : signed(und!.devCredit), tone: und!.devCredit == null ? undefined : "text-[#10B981]", href: "/leaderboards?board=development" },
      ]}
      action={share("career", careerShare, `${name} went undrafted and built ${und!.qg.toFixed(0)} career Impact in ${und!.gpCareer} NHL games.`)}
    />
  );

  const edge = group === "G" ? null : playerEdge(playerId);
  const goalieEdgeRow = group === "G" && playerId != null ? goalieEdge(playerId) : undefined;
  const edgeHero = edge ? (
    <HeroBox
      label="5v5 Chemistry Lift"
      value={`${edge.lift > 0 ? "+" : ""}${edge.lift.toFixed(1)}`}
      valueTone={edge.lift >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}
      unit="CF%"
      caption="How much his linemates' 5-on-5 shot share rises with him on the ice."
      href="/game-edge?tab=chemistry"
      hrefLabel="Line Chemistry"
    />
  ) : goalieEdgeRow ? (
    <HeroBox
      label="Save % this season"
      value={goalieEdgeRow.sv != null ? goalieEdgeRow.sv.toFixed(3).replace(/^0/, "") : "—"}
      caption="Zone-by-zone tendencies below. Switch on last season for a bigger sample."
      href="/game-edge?tab=goalies"
      hrefLabel="Goalie Tendencies"
    />
  ) : (
    <HeroBox label="Game Edge" value="—" caption="Not enough NHL play-by-play this season yet." href="/game-edge" hrefLabel="Open Game Edge" />
  );

  // ---- Tab panels ---------------------------------------------------------------------
  const callouts: { label: string; value: string; sub?: string; soon?: boolean }[] = [
    { label: "Career GP", value: base.gpCareer.toLocaleString("en-US"), sub: "NHL regular season" },
    { label: "Career Impact", value: base.qg.toFixed(1), sub: "1.0 ≈ one average NHL game" },
    group === "G"
      ? { label: "Career SV%", value: rate, sub: base.gaa == null ? undefined : `${base.gaa.toFixed(2)} GAA` }
      : { label: "Career PPG", value: rate, sub: base.points == null ? undefined : `${base.goals ?? 0} G · ${base.assists ?? 0} A · ${base.points} PTS` },
    {
      label: "Playoff Impact",
      value: playoff.gp ? playoff.impact.toFixed(1) : "—",
      sub: playoff.gp ? `${playoff.gp} playoff games · ${playoff.springs} ${playoff.springs === 1 ? "spring" : "springs"}` : "No NHL playoff games yet",
    },
  ];

  const statsPanel = (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {callouts.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-4 ${item.soon ? "border-dashed border-[#262B36] bg-[#14171F]/60" : "border-[#262B36] bg-[#14171F]"}`}>
            <SectionLabel>{item.label}</SectionLabel>
            <p className={`display mt-2 text-4xl leading-none font-bold ${item.soon ? "text-[#94A3B8]" : ""}`}>{item.value}</p>
            {item.sub ? <p className="mt-2 text-xs text-[#94A3B8]">{item.sub}</p> : null}
          </div>
        ))}
      </div>
      <StatsTable columns={stats.columns} rows={stats.rows} totals={stats.totals} playoffs={stats.playoffs} />
    </div>
  );

  const assetPanel = (
    <div className="grid gap-5">
      <AssetValuePanel playerId={playerId} name={name} tier={tier} value={value} />
      {!retired && playerId != null ? <ContractCompsPanel name={name} fair={fairValue(playerId)} contract={contract} /> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <ContractDeepDive contract={contract} value={value} />
        <TradeHistory trades={playerTrades(name)} playerId={playerId} name={name} />
      </div>
      <InjuryTimeline playerId={playerId} />
    </div>
  );

  const careerPanel = pick ? (
    <div className="grid gap-8">
      <TrophyCase awards={awardsFor(playerId)} name={name} />
      <DraftPanel pick={pick} color={color} />
      <section>
        <h2 className="display mb-3 text-2xl font-bold">Development path</h2>
        <PlayerDevelopment pick={pick} />
      </section>
      <DebutAndMilestones debut={debut} team={debutTeam} gp={base.gpCareer} milestones={!retired && playerId != null ? nextMilestones(playerId, group === "G") : undefined} />
    </div>
  ) : (
    <div className="grid gap-5">
      <TrophyCase awards={awardsFor(playerId)} name={name} />
      <UndraftedDraftPanel player={und!} />
      <UndraftedDevelopmentPanel player={und!} />
      <DebutAndMilestones debut={debut} team={debutTeam} gp={base.gpCareer} milestones={!retired && playerId != null ? nextMilestones(playerId, group === "G") : undefined} />
    </div>
  );

  return (
    <ProfileShell
      tabs={PLAYER_TABS}
      aliases={PLAYER_TAB_ALIASES}
      left={left}
      heroes={{ skills: skillsHero, stats: statsHero, asset: assetHero, career: careerHero, "game-edge": edgeHero }}
      panels={{
        skills: <SkillsPanel skills={skills} name={name} />,
        stats: statsPanel,
        asset: assetPanel,
        career: careerPanel,
        "game-edge": <PlayerGameEdge playerId={playerId} name={name} goalie={group === "G"} />,
      }}
    />
  );
}
