import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InfoTip } from "@/components/info-tip";
import { RefPhoto, StyleBadge } from "@/components/ref-watch/ref-table";
import { FullRink } from "@/components/rink";
import { ShareLauncher } from "@/components/share-modal";
import { TeamLogo } from "@/components/team-logo";
import { teamsByAbbr } from "@/lib/data";
import { playerIdHref } from "@/lib/game-edge";
import { allRefs, gradeColor, refBySlug, refLeague, seasonLabel, STYLE_TONE } from "@/lib/ref-watch";
import { teamHref } from "@/lib/routes";

export function generateStaticParams() {
  return allRefs().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ref = refBySlug(slug);
  if (!ref) return { title: "Referee" };
  return {
    title: `${ref.name} · Ref Watch`,
    description: `${ref.name}: ${ref.grade} consistency grade, ${ref.rate.toFixed(1)} calls/60 (${ref.style}), home bias, crunch-time whistle and signature calls.`,
    alternates: { canonical: `/ref-watch/${ref.slug}` },
  };
}

const sign = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;

export default async function RefereePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ref = refBySlug(slug);
  if (!ref) notFound();
  const L = refLeague;
  const seasons = `${seasonLabel(ref.seasons[0])}${ref.seasons.length > 1 ? ` to ${seasonLabel(ref.seasons[ref.seasons.length - 1])}` : ""}`;
  const totalZones = Object.values(ref.zones).reduce((s, v) => s + v, 0) || 1;
  const maxPct = Math.max(40, ...ref.infractions.map((i) => Math.abs(i.pct)));
  const p3Ratio = ref.p12 ? ref.p3 / ref.p12 : 1;
  const leagueP3 = L.p12 ? L.p3 / L.p12 : 1;

  return (
    <div>
      <Link href="/ref-watch" className="text-xs font-semibold text-[#38BDF8] hover:underline">
        ← Ref Watch
      </Link>

      {/* Bio card */}
      <div className="mt-3 grid gap-5 rounded-2xl border border-[#262B36] bg-[#14171F] p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <RefPhoto name={ref.name} photo={ref.photo} className="h-28 w-28 text-2xl" />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">
            NHL Referee{ref.number ? ` · #${ref.number}` : ""}
            {ref.hometown ? ` · ${ref.hometown}` : ""}
            {ref.since ? ` · NHL since ${ref.since}-${String(ref.since + 1).slice(2)}` : ""}
          </p>
          <h1 className="display text-4xl font-bold">{ref.name}</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {ref.games} games · {seasons} {ref.low ? <span className="text-[#F97316]">· small sample</span> : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StyleBadge style={ref.style} />
            <span className="text-sm">
              <b className="tabular-nums">{ref.rate.toFixed(1)}</b> calls/60 <span className={ref.delta >= 0 ? "text-[#E11D48]" : "text-[#10B981]"}>· {sign(ref.delta)} vs avg</span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ShareLauncher
              fileSlug={`ref-${ref.slug}`}
              title={`${ref.name} · Ref Watch`}
              summary={`${ref.name}: ${ref.grade} consistency grade, ${ref.style}, ${ref.rate.toFixed(1)} calls/60 (${sign(ref.delta)} vs avg).`}
              path={`/ref-watch/${ref.slug}`}
              card={{
                kind: "metric",
                product: { name: "Ref Watch", path: "/ref-watch" },
                color: STYLE_TONE[ref.style],
                eyebrow: "Ref Watch · NHL Referee",
                title: ref.name,
                subtitle: `${ref.games} games · ${seasons}`,
                stamps: [ref.style],
                hero: { label: "Consistency grade", value: ref.grade, note: `${ref.score}/100`, color: gradeColor(ref.grade) },
                tiles: [
                  { label: "Calls/60", value: ref.rate.toFixed(1), note: `${sign(ref.delta)} vs avg` },
                  { label: "Home bias", value: sign(ref.home, 2), note: "net home PP/60" },
                  { label: "Game-Mgmt", value: ref.mgmt.toFixed(1), note: `avg ${L.mgmt.toFixed(1)}` },
                  { label: "Signature", value: ref.signature[0] ? `${ref.signature[0].label}` : "—", note: ref.signature[0] ? `${ref.signature[0].pct > 0 ? "+" : ""}${ref.signature[0].pct}%` : undefined },
                ],
              }}
            />
            <Link href="/card-studio" className="text-sm font-semibold text-[#38BDF8] hover:underline">
              Open in Card Studio →
            </Link>
          </div>
        </div>
        <div className="text-center">
          <div className="display grid h-24 w-24 place-items-center rounded-2xl border-2 text-4xl font-bold" style={{ borderColor: gradeColor(ref.grade), color: gradeColor(ref.grade) }}>
            {ref.grade}
          </div>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-[#94A3B8]">
            {ref.score}/100 consistency
            <InfoTip text="Consistency & Objectivity: low home/away lean, few score-state make-up calls, and the same standard late in tight games as in periods 1-2. Percentile vs every referee with 15+ games." align="end" />
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* 1. Infraction signature */}
        <Panel title="Infraction signature" tip="Calls per game of each penalty type vs the league rate, shrunk toward average for small samples.">
          <ul className="grid gap-1.5">
            {ref.infractions
              .filter((i) => i.key !== "other")
              .map((i) => (
                <li key={i.key} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs">
                  <span className="truncate text-[#94A3B8]">{i.label}</span>
                  <span className="relative h-3 rounded-full bg-[#0B0D10]">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-[#334155]" />
                    <span
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        background: i.pct >= 0 ? "#E11D48" : "#10B981",
                        left: i.pct >= 0 ? "50%" : `${50 - (50 * Math.abs(i.pct)) / maxPct}%`,
                        width: `${(50 * Math.abs(i.pct)) / maxPct}%`,
                      }}
                    />
                  </span>
                  <span className={`text-right font-semibold tabular-nums ${i.pct >= 0 ? "text-[#E11D48]" : "text-[#10B981]"}`}>
                    {i.pct > 0 ? "+" : ""}
                    {i.pct}%
                  </span>
                </li>
              ))}
          </ul>
        </Panel>

        {/* 2. Context gauges */}
        <Panel title="Context & crunch-time gauges">
          <div className="grid gap-3 sm:grid-cols-2">
            <Gauge
              label="Home / away bias"
              value={sign(ref.home, 2)}
              unit="net home PP/60 vs avg"
              position={0.5 + Math.max(-0.5, Math.min(0.5, ref.home / 1))}
              tip="Positive = the home team gets more power plays with him than with an average ref."
              left="Away"
              right="Home"
            />
            <Gauge
              label="Game management"
              value={ref.mgmt.toFixed(1)}
              unit={`league ${L.mgmt.toFixed(1)}`}
              position={0.5 + Math.max(-0.5, Math.min(0.5, (ref.mgmt - L.mgmt) / 10))}
              tip="% of calls that go against the team that has drawn more power plays so far or is leading. Higher = more 'evening up'."
              left="Lets it ride"
              right="Evens it up"
            />
            <Gauge
              label="Crunch-time whistle"
              value={`${Math.round(ref.crunch * 100)}%`}
              unit={`of his normal rate · league ${Math.round(L.crunch * 100)}%`}
              position={0.5 + Math.max(-0.5, Math.min(0.5, (ref.crunch - L.crunch) / 0.6))}
              tip="Call rate in the final 5 minutes of regulation in one-goal or tied games, vs his normal 60-minute rate."
              left="Swallows it"
              right="Calls it"
            />
            <Gauge
              label="3rd period vs 1st-2nd"
              value={`${Math.round(p3Ratio * 100)}%`}
              unit={`league ${Math.round(leagueP3 * 100)}%`}
              position={0.5 + Math.max(-0.5, Math.min(0.5, (p3Ratio - leagueP3) / 0.4))}
              tip="Third-period call rate as a share of his periods 1-2 rate."
              left="Fades late"
              right="Same standard"
            />
          </div>
        </Panel>

        {/* 3. Team splits */}
        <Panel title="Team harsher / softer splits" tip="Net power-play differential per game (drawn minus taken) with this referee vs that team's usual. Teams with 4+ games only, shrunk for sample size.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TeamList title="Best under him" rows={ref.teamsBest} tone="#10B981" />
            <TeamList title="Worst under him" rows={ref.teamsWorst} tone="#EF4444" />
          </div>
        </Panel>

        {/* 4. Player friction */}
        <Panel title="Player friction watch" tip="Players he has penalized most, and who drew the most calls from him (2+).">
          <div className="grid gap-4 sm:grid-cols-2">
            <PlayerList title="Most penalized" rows={ref.taken} tone="#E11D48" />
            <PlayerList title="Most calls drawn" rows={ref.drawn} tone="#10B981" />
          </div>
        </Panel>
      </div>

      {/* 5. Rink heatmap */}
      <section className="mt-6 rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-xl font-bold">Where on the ice he calls it</h2>
          <p className="text-xs text-[#94A3B8]">Offending player&apos;s position · his team attacks left → right</p>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-center">
          <FullRink cells={ref.grid} label={`Heatmap of ${ref.calls} calls by ${ref.name}`} />
          <ul className="grid gap-2 text-sm">
            {(
              [
                ["slot", "Net-Front / Slot"],
                ["boards", "Boards / Corners"],
                ["dz", "Defensive Zone"],
                ["nz", "Neutral Zone"],
                ["oz", "Offensive Zone"],
              ] as const
            ).map(([key, label]) => {
              const share = ref.zones[key] / totalZones;
              return (
                <li key={key} className="grid grid-cols-[9rem_minmax(0,1fr)_3rem] items-center gap-2">
                  <span className="text-[#94A3B8]">{label}</span>
                  <span className="h-2.5 rounded-full bg-[#0B0D10]">
                    <span className="block h-full rounded-full bg-[#E11D48]" style={{ width: `${share * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{Math.round(share * 100)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {ref.partners.length ? (
        <p className="mt-6 text-xs text-[#94A3B8]">
          Worked with:{" "}
          {ref.partners.map((p, i) => {
            const partner = allRefs().find((r) => r.name === p);
            return (
              <span key={p}>
                {i ? ", " : ""}
                {partner ? (
                  <Link href={`/ref-watch/${partner.slug}`} className="hover:text-[#38BDF8]">
                    {p}
                  </Link>
                ) : (
                  p
                )}
              </span>
            );
          })}
        </p>
      ) : null}
    </div>
  );
}

function Panel({ title, tip, children }: { title: string; tip?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
      <h2 className="display flex items-center gap-2 text-xl font-bold">
        {title} {tip ? <InfoTip text={tip} /> : null}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Gauge({ label, value, unit, position, tip, left, right }: { label: string; value: string; unit: string; position: number; tip: string; left: string; right: string }) {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3">
      <p className="flex items-center gap-1 text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">
        {label} <InfoTip text={tip} />
      </p>
      <p className="display mt-1 text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-[#94A3B8]">{unit}</p>
      <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-[#10B981]/40 via-[#262B36] to-[#E11D48]/40">
        <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-[#94A3B8]" />
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0B0D10] bg-[#38BDF8]" style={{ left: `${position * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-[#94A3B8] uppercase">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function TeamList({ title, rows, tone }: { title: string; rows: { team: string; games: number; net: number; delta: number }[]; tone: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{title}</p>
      {rows.length ? (
        <ul className="mt-2 grid gap-1.5">
          {rows.map((r) => (
            <li key={r.team}>
              <Link href={teamHref(r.team, "game-edge")} className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm hover:bg-white/[0.04]">
                <TeamLogo abbr={r.team} className="h-5 w-6" />
                <span className="flex-1 truncate">{teamsByAbbr.get(r.team)?.short ?? r.team}</span>
                <span className="text-[11px] text-[#94A3B8]">{r.games} GP</span>
                <span className="w-12 text-right font-semibold tabular-nums" style={{ color: tone }}>
                  {sign(r.delta, 2)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[#94A3B8]">Not enough games yet.</p>
      )}
    </div>
  );
}

function PlayerList({ title, rows, tone }: { title: string; rows: { id: number; name: string; n: number }[]; tone: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{title}</p>
      {rows.length ? (
        <ul className="mt-2 grid gap-1.5">
          {rows.map((r) => {
            const href = playerIdHref(r.id, "game-edge");
            return (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              {href ? (
                <Link href={href} className="flex-1 truncate hover:text-[#38BDF8]">
                  {r.name}
                </Link>
              ) : (
                <span className="flex-1 truncate">{r.name}</span>
              )}
              <span className="font-semibold tabular-nums" style={{ color: tone }}>
                {r.n}
              </span>
            </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[#94A3B8]">No repeat names yet.</p>
      )}
    </div>
  );
}
