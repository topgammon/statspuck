import Link from "next/link";
import { SectionLabel } from "@/components/entity/bio";
import { BUCKET_COLOR, BUCKET_LABEL, type Bucket } from "@/lib/development";
import { signed } from "@/lib/format";
import { gmHref, teamHref } from "@/lib/routes";
import type { UndraftedPlayer } from "@/lib/types";

// Career-tab pieces for undrafted graduates. The rest of their profile is the shared
// PlayerProfile (components/entity/player-profile.tsx).
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

export function UndraftedDraftPanel({ player }: { player: UndraftedPlayer }) {
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

export function UndraftedDevelopmentPanel({ player }: { player: UndraftedPlayer }) {
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
