import Link from "next/link";
import type { ReactNode } from "react";
import { AssetTeaser, AssetValuePanel } from "@/components/entity/asset-value";
import { ArchetypePill, BioCard, ComingSoonPanel, ContractPill, HeroGrade, ModulePreviews, PillGrid, PLAYER_TABS, QuickPill, SectionLabel, VitalsRow, type VitalItem } from "@/components/entity/bio";
import { EntityTabs, TabLink } from "@/components/entity/entity-tabs";
import { PlayerHeadshot } from "@/components/player-headshot";
import { ShareLauncher } from "@/components/share-modal";
import { StampRow } from "@/components/stamps";
import { TeamLogo, TeamName } from "@/components/team-logo";
import { classify } from "@/lib/archetypes";
import { playerContract } from "@/lib/cap";
import { teamsByAbbr } from "@/lib/data";
import { nhlerFor } from "@/lib/nhlers";
import { BUCKET_COLOR, BUCKET_LABEL, type Bucket } from "@/lib/development";
import { signed } from "@/lib/format";
import { gmHref, teamHref } from "@/lib/routes";
import type { UndraftedPlayer } from "@/lib/types";

const DEV_TIP =
  "Undrafted signings never count in Draft Rater. When one reaches 100+ career Impact, the franchise that gave him his NHL debut (and its GM that season) gets this credit in their Development Grade.";

function seasonLabel(start: number): string {
  return `${start}-${String(start + 1).slice(2)}`;
}

/** Tournaments and national-team events are not a season's league. */
function isEvent(league: string): boolean {
  const lower = league.toLowerCase();
  return /^(wc|wc-a|wc-b|eht|og|u-?1[78]|whc-17|m-cup|wch|4 nations)$/i.test(league) || /wjc|wj18|wjac|cup|champions hl|hlinka|olympic|spengler|euro hockey tour/.test(lower);
}

/** Rough league bucket for the timeline colours (mirrors pipelines/draft-rater/development.py). */
function bucketOf(league: string): Bucket {
  const name = league.trim();
  const upper = name.toUpperCase();
  if (upper === "NHL") return "NHL";
  if (upper === "AHL") return "AHL";
  if (["OHL", "WHL", "QMJHL", "LHJMQ", "CHL"].includes(upper)) return "CHL";
  if (upper.startsWith("NCAA") || ["WCHA", "H-EAST", "HOCKEY EAST", "CCHA", "ECAC", "NCHC", "BIG TEN", "BIG 10", "AHA", "ATLANTIC HOCKEY", "CHA"].includes(upper)) return "NCAA";
  if (upper === "USHL" || upper.endsWith("JHL") || upper.includes("JR. A")) return "USHL";
  if (["SHL", "SWEHL", "SEL", "SWEDEN", "ELITSERIEN"].includes(upper)) return "SHL";
  if (["LIIGA", "SM-LIIGA", "SM-L", "FINLAND"].includes(upper)) return "Liiga";
  if (["KHL", "RSL", "RUSSIA", "RUS-KHL"].includes(upper)) return "KHL";
  return "Other";
}

type SeasonStep = { season: number; league: string; team: string; gp: number; nhl: number };

function timeline(player: UndraftedPlayer): SeasonStep[] {
  const bySeason = new Map<number, [number, string, string, number][]>();
  for (const row of player.path) {
    if (row[3] <= 0 || isEvent(row[1])) continue;
    bySeason.set(row[0], [...(bySeason.get(row[0]) ?? []), row]);
  }
  return [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, rows]) => {
      const top = [...rows].sort((a, b) => b[3] - a[3])[0];
      const nhl = rows.filter((row) => row[1] === "NHL").reduce((sum, row) => sum + row[3], 0);
      return { season, league: top[1], team: top[2], gp: top[3], nhl };
    });
}

export function UndraftedProfile({ player, vitals }: { player: UndraftedPlayer; vitals: VitalItem[] }) {
  const color = (player.franchise && teamsByAbbr.get(player.franchise)?.color) || "#38BDF8";
  const current = player.currentTeam ? teamsByAbbr.get(player.currentTeam) : null;
  const retired = player.active === false;

  const share = (
    <ShareLauncher
      fileSlug={player.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
      title={`${player.name}, undrafted`}
      summary={`${player.name} went undrafted and built ${player.qg.toFixed(0)} career Impact in ${player.gpCareer} NHL games.`}
      path={`/players/${player.id}`}
      card={{ kind: "undrafted", player, color }}
    />
  );

  const left = (
    <div>
      <div className="flex items-start gap-4">
        <PlayerHeadshot playerId={player.playerId} name={player.name} available color={color} className="h-24 w-24 sm:h-28 sm:w-28" />
        <div className="min-w-0">
          <h1 className="display text-3xl leading-tight font-bold sm:text-4xl">{player.name}</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            <span className="font-semibold text-[#F8FAFC]">{player.pos}</span> · Undrafted · First NHL Team:{" "}
            {player.firstTeam ? (
              <span className="font-semibold text-[#F8FAFC]">{player.firstTeamName}</span>
            ) : (
              "—"
            )}{" "}
            ({seasonLabel(player.debut)})
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {current ? (
              <Link href={teamHref(current.abbr)} className="inline-flex items-center gap-1.5 rounded-full border border-[#262B36] bg-[#0B0D10]/60 py-0.5 pr-2.5 pl-1 text-xs font-semibold hover:border-[#38BDF8]/60">
                <TeamLogo abbr={current.abbr} className="h-5 w-6" />
                {current.name}
              </Link>
            ) : retired ? (
              <span className="display rounded-full border border-[#64748B]/60 px-2.5 py-0.5 text-xs font-bold tracking-[0.14em] text-[#94A3B8]">RETIRED</span>
            ) : (
              <span className="rounded-full border border-[#262B36] px-2.5 py-0.5 text-xs text-[#94A3B8]">Not on an NHL roster</span>
            )}
            <ContractPill contract={retired ? null : playerContract(player.playerId)} />
          </div>
        </div>
      </div>
      <VitalsRow items={vitals} />
    </div>
  );

  const middle = (
    <div className="flex h-full flex-col gap-3">
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <StampRow stamps={player.stamps} />
        <ArchetypePill archetype={classify(nhlerFor(player.playerId))} />
      </div>
      <PillGrid>
        <QuickPill label="Career Impact" value={player.qg.toFixed(1)} title="Impact puts skaters and goalies on one scale where 1.0 is about one average NHL game. Seasons since 2005-06." />
        <QuickPill label="Career GP" value={String(player.gpCareer)} title="NHL regular-season games since 2005-06" />
        {player.group === "G" ? (
          <QuickPill label="SV%" value={player.savePct == null ? "—" : player.savePct.toFixed(3).replace(/^0/, "")} />
        ) : (
          <QuickPill label="PPG" value={player.ppg == null ? "—" : player.ppg.toFixed(2)} />
        )}
      </PillGrid>
    </div>
  );

  const right = (
    <HeroGrade
      label="Draft status"
      letter={null}
      badge={
        <span className="display inline-flex items-center justify-center self-center border-[3px] border-[#38BDF8] px-2.5 py-1.5 text-xl leading-none font-bold tracking-[0.16em] text-[#bae6fd]">
          UNDRAFTED
        </span>
      }
      stats={[
        { label: "NHL debut", value: String(player.debut), title: `First NHL game in ${seasonLabel(player.debut)}` },
        {
          label: "Dev credit",
          value: player.devCredit == null ? "—" : signed(player.devCredit),
          tone: player.devCredit == null ? undefined : "text-[#10B981]",
          title: DEV_TIP,
        },
      ]}
      action={share}
    />
  );

  const panels: Record<string, ReactNode> = {
    overview: <Overview player={player} />,
    draft: <DraftPanel player={player} />,
    development: <DevelopmentPanel player={player} />,
    asset: <AssetValuePanel playerId={player.playerId} name={player.name} />,
    luck: <ComingSoonPanel tab="luck" subject={player.name} />,
    matchups: <ComingSoonPanel tab="matchups" subject={player.name} />,
  };

  return (
    <div>
      <BioCard left={left} middle={middle} right={right} />
      <EntityTabs tabs={PLAYER_TABS} panels={panels} />
    </div>
  );
}

function Overview({ player }: { player: UndraftedPlayer }) {
  const facts: [string, ReactNode][] = [
    ["Position", player.pos],
    ["Draft", "Undrafted"],
    ["NHL debut", seasonLabel(player.debut)],
  ];
  if (player.firstTeam) facts.push(["First NHL team", <TeamName key="first" abbr={player.firstTeam} name={player.firstTeamName ?? player.firstTeam} logoClassName="h-5 w-7" />]);
  if (player.origin) facts.push(["Before the NHL", [player.origin.club, player.origin.league].filter(Boolean).join(" · ")]);
  if (player.goals != null) facts.push(["Career scoring", `${player.goals} G · ${player.assists ?? 0} A · ${player.points ?? 0} PTS`]);
  if (player.gaa != null) facts.push(["Career GAA", player.gaa.toFixed(2)]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>Bio</SectionLabel>
        <dl className="mt-3 divide-y divide-[#262B36]">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-[#94A3B8]">{label}</dt>
              <dd className="text-right text-[#F8FAFC]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-2xl border border-[#38BDF8]/40 bg-[#14171F] p-5">
        <SectionLabel>Undrafted graduate</SectionLabel>
        <p className="mt-3 text-sm leading-6 text-[#94A3B8]">
          All 32 teams passed on {player.name} in every NHL Entry Draft. He signed as a free agent and has{" "}
          <span className="font-semibold text-[#F8FAFC]">{player.qg.toFixed(1)} Impact</span> in {player.gpCareer} NHL games since 2005-06.
        </p>
        <p className="mt-3 text-sm leading-6 text-[#94A3B8]">
          {player.devCredit != null && player.franchiseName ? (
            <>
              The <span className="font-semibold text-[#F8FAFC]">{player.franchiseName}</span>
              {player.creditGm ? <> and GM {player.creditGm}</> : null} get{" "}
              <span className="font-semibold text-[#10B981]">{signed(player.devCredit)}</span> Development credit for finding him.
            </>
          ) : (
            "Development credit goes to his debut franchise once he reaches 100 career Impact."
          )}
        </p>
        <TabLink tab="development" className="mt-4 text-sm font-semibold text-[#38BDF8] hover:underline">
          See his path to the NHL →
        </TabLink>
      </div>
      <div className="lg:col-span-2">
        <div className="mb-3">
          <AssetTeaser playerId={player.playerId} />
        </div>
        <ModulePreviews tabs={["luck", "matchups"]} />
      </div>
    </div>
  );
}

function DraftPanel({ player }: { player: UndraftedPlayer }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-6">
      <span className="display inline-block border-[3px] border-[#38BDF8] px-2 py-1 text-sm leading-none font-bold tracking-[0.14em] text-[#bae6fd] uppercase">Undrafted</span>
      <h2 className="display mt-4 text-2xl font-bold">Not part of Draft Rater</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#94A3B8]">
        Draft Score measures picks against their draft slot, so undrafted players stay out of every slot average, team grade, and GM grade. {player.name}
        {"'"}s value shows up where it belongs: in the Development Grade of the team that signed him.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/draft-rater/methodology" className="font-semibold text-[#38BDF8] hover:underline">
          How Draft Rater works →
        </Link>
      </p>
    </div>
  );
}

function DevelopmentPanel({ player }: { player: UndraftedPlayer }) {
  const steps = timeline(player);
  const nhlSeasons = player.seasons.map((impact, index) => ({ season: player.firstSeason + index, impact }));
  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionLabel>Path to the NHL</SectionLabel>
          <span className="text-sm text-[#94A3B8]">Four seasons before his debut through three after</span>
        </div>
        {steps.length ? (
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {steps.map((step) => {
              const bucket = bucketOf(step.league);
              const tone = BUCKET_COLOR[bucket];
              return (
                <li key={step.season} className={`rounded-xl border p-3 ${step.season === player.debut ? "border-[#E11D48]/70 bg-[#E11D48]/5" : "border-[#262B36] bg-[#0B0D10]/60"}`}>
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{step.season === player.debut ? "NHL debut" : seasonLabel(step.season)}</p>
                  <span
                    className="display mt-2 inline-flex rounded-md border px-2 py-1 text-sm font-bold tracking-wide"
                    style={{ borderColor: `${tone}88`, color: tone, backgroundColor: `${tone}1A` }}
                    title={BUCKET_LABEL[bucket]}
                  >
                    {step.league}
                  </span>
                  <p className="mt-2 truncate text-xs text-[#94A3B8]" title={step.team}>
                    {step.team} · {step.gp} GP
                  </p>
                  {step.nhl > 0 && step.league !== "NHL" ? <p className="text-xs text-[#94A3B8]">NHL {step.nhl} GP</p> : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-[#94A3B8]">No league history on file for this player.</p>
        )}
      </div>

      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>Impact by NHL season</SectionLabel>
        <div className="mt-4 flex items-end gap-1.5 overflow-x-auto pb-1" role="img" aria-label="Impact each NHL season">
          {nhlSeasons.map((row) => {
            const peak = Math.max(1, ...nhlSeasons.map((item) => item.impact));
            return (
              <div key={row.season} className="flex min-w-9 flex-1 flex-col items-center gap-1" title={`${seasonLabel(row.season)}: ${row.impact.toFixed(1)} Impact`}>
                <span className="text-[10px] text-[#94A3B8]">{row.impact.toFixed(0)}</span>
                <div className="w-full rounded-t bg-[#38BDF8]" style={{ height: `${Math.max(2, (row.impact / peak) * 96)}px` }} />
                <span className="text-[10px] text-[#94A3B8]">{String(row.season).slice(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[#10B981]/40 bg-[#14171F] p-5">
        <SectionLabel>Development credit</SectionLabel>
        {player.devCredit != null && player.franchise ? (
          <p className="mt-3 text-sm leading-6 text-[#94A3B8]">
            <span className="display text-2xl font-bold text-[#10B981]">{signed(player.devCredit)}</span> added to the{" "}
            <Link href={teamHref(player.franchise, "development")} className="font-semibold text-[#F8FAFC] hover:underline">
              {player.franchiseName}
            </Link>{" "}
            Development Grade
            {player.creditEra && player.creditGm ? (
              <>
                {" "}
                and to{" "}
                <Link href={gmHref(player.creditEra, "development")} className="font-semibold text-[#F8FAFC] hover:underline">
                  {player.creditGm}
                </Link>
              </>
            ) : null}
            . Scored like a pick from a slot where history expects nothing: graduation over his first six NHL seasons plus Impact growth.
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#94A3B8]">{DEV_TIP}</p>
        )}
        <p className="mt-3 text-xs text-[#94A3B8]">
          <Link href="/development" className="text-[#38BDF8] hover:underline">
            Explore every pathway →
          </Link>
        </p>
      </div>
    </div>
  );
}
