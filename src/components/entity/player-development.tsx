import Link from "next/link";
import { BUCKET_COLOR, BUCKET_LABEL, development, pathFor, TIER_LABEL, tierOf, type Bucket } from "@/lib/development";
import { signed } from "@/lib/format";
import type { PickRow } from "@/lib/types";
import { SectionLabel } from "./bio";

const MIN_PATH_SAMPLE = 8;

function Badge({ bucket, small = false }: { bucket: Bucket; small?: boolean }) {
  const color = BUCKET_COLOR[bucket];
  return (
    <span
      className={`display inline-flex items-center justify-center rounded-md border font-bold tracking-wide ${small ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-sm"}`}
      style={{ borderColor: `${color}88`, color, backgroundColor: `${color}1A` }}
    >
      {bucket === "None" ? "—" : bucket}
    </span>
  );
}

type PathStat = { key: string; steps: Bucket[]; n: number; rate25: number; rate100: number; avg: number };

/** Most common D+1..D+3 routes for picks like this one, with how often each produced NHL players. */
function routesFor(pick: PickRow): PathStat[] {
  const tier = tierOf(pick.overall, pick.round);
  const groups = new Map<string, { steps: Bucket[]; impacts: number[] }>();
  for (const row of development.cohort) {
    const [, , overall, round, group, , , qg, path] = row;
    if (group !== pick.group || tierOf(overall, round) !== tier) continue;
    const steps = path.slice(1, 4).map((index) => development.buckets[index]);
    const key = steps.join(">");
    const entry = groups.get(key) ?? { steps, impacts: [] };
    entry.impacts.push(qg);
    groups.set(key, entry);
  }
  return [...groups.entries()].map(([key, { steps, impacts }]) => ({
    key,
    steps,
    n: impacts.length,
    rate25: impacts.filter((value) => value >= 25).length / impacts.length,
    rate100: impacts.filter((value) => value >= 100).length / impacts.length,
    avg: impacts.reduce((sum, value) => sum + value, 0) / impacts.length,
  }));
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function PlayerDevelopment({ pick }: { pick: PickRow }) {
  const path = pathFor(pick.id);
  const tier = tierOf(pick.overall, pick.round);
  const routes = routesFor(pick);
  const best = routes.filter((route) => route.n >= MIN_PATH_SAMPLE).sort((a, b) => b.rate100 - a.rate100 || b.n - a.n)[0];
  const mineKey = path ? path.b.slice(1, 4).join(">") : null;
  const mine = routes.find((route) => route.key === mineKey);
  const years = Array.from({ length: development.horizon + 1 }, (_, index) => index);

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionLabel>League timeline</SectionLabel>
          {path?.dev != null ? (
            <span className="text-sm text-[#94A3B8]">
              Development value <span className={`display font-bold ${path.dev >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{signed(path.dev)}</span> vs his slot
            </span>
          ) : null}
        </div>
        {path ? (
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {years.map((year) => {
              const bucket = path.b[year] ?? "None";
              const played = year <= pick.draftPlus;
              const impact = year >= 1 ? pick.seasons?.[year - 1] : undefined;
              return (
                <li key={year} className={`rounded-xl border p-3 ${year === 0 ? "border-dashed border-[#262B36]" : "border-[#262B36] bg-[#0B0D10]/60"}`}>
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{year === 0 ? "Draft year" : `D+${year}`}</p>
                  <div className="mt-2">{played || year === 0 ? <Badge bucket={bucket} /> : <span className="text-sm text-[#94A3B8]">Not yet</span>}</div>
                  {played || year === 0 ? (
                    <div className="mt-2 space-y-0.5 text-xs text-[#94A3B8]">
                      <p className="truncate" title={path.lg[year] ?? ""}>
                        {path.lg[year] ?? "No games"}
                        {path.gp[year] ? ` · ${path.gp[year]} GP` : ""}
                      </p>
                      {year >= 1 ? (
                        <p>
                          NHL {path.nhl[year] ?? 0} GP · <span className="text-[#F8FAFC]">{impact == null ? "—" : impact.toFixed(1)}</span> Impact
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-[#94A3B8]">No league history on file for this player.</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RouteCard
          title="His route (D+1 to D+3)"
          route={mine}
          empty={path ? "Too few players took this exact route to compare." : "No route on file."}
          tier={TIER_LABEL[tier]}
          group={pick.group}
        />
        <RouteCard
          title="Most successful route for his slot"
          route={best}
          empty="Not enough history for this draft range and position."
          tier={TIER_LABEL[tier]}
          group={pick.group}
          highlight
        />
      </div>
      <p className="text-xs text-[#94A3B8]">
        Compared with {pick.group === "G" ? "goalies" : pick.group === "D" ? "defensemen" : "forwards"} drafted in the {TIER_LABEL[tier]} range from 2005 through {development.matureThrough}.{" "}
        <Link href="/development" className="text-[#38BDF8] hover:underline">
          Explore every pathway →
        </Link>
      </p>
    </div>
  );
}

function RouteCard({
  title,
  route,
  empty,
  tier,
  group,
  highlight = false,
}: {
  title: string;
  route: PathStat | undefined;
  empty: string;
  tier: string;
  group: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-[#14171F] p-5 ${highlight ? "border-[#38BDF8]/50" : "border-[#262B36]"}`}>
      <SectionLabel>{title}</SectionLabel>
      {route ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {route.steps.map((step, index) => (
              <span key={index} className="inline-flex items-center gap-1.5">
                {index > 0 ? <span className="text-[#94A3B8]">→</span> : null}
                <Badge bucket={step} />
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-[#94A3B8]">{route.steps.map((step) => BUCKET_LABEL[step]).join(" → ")}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Made NHL" value={pct(route.rate25)} tone="text-[#38BDF8]" />
            <Stat label="Regular 100+" value={pct(route.rate100)} tone="text-[#10B981]" />
            <Stat label="Avg Impact" value={route.avg.toFixed(0)} />
          </dl>
          <p className="mt-3 text-xs text-[#94A3B8]">
            {route.n} {tier} {group === "G" ? "goalies" : group === "D" ? "defensemen" : "forwards"} took this route.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-[#94A3B8]">{empty}</p>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-[#F8FAFC]" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-2">
      <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</dt>
      <dd className={`display text-xl font-bold ${tone}`}>{value}</dd>
    </div>
  );
}
