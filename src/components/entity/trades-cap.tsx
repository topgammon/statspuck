import Link from "next/link";
import { SectionLabel } from "@/components/entity/bio";
import { TeamLogo } from "@/components/team-logo";
import { ROUNDS, capitalAsOf, capitalYears, draftCapitalFor } from "@/lib/draft-capital";
import { franchiseAssetsFor, franchiseAssets } from "@/lib/franchise-assets";
import type { AssetGrade, GmReport, TeamTradeReport, TradePiece, TradeSide } from "@/lib/gm-grades";
import { letterTone } from "@/lib/search";
import { formatRating, ratingTone } from "@/lib/rating";

// Panels for the Trades & Cap tab on team and GM profiles: franchise asset pool, draft capital matrix, trade record.

export const POOL_COLORS = { roster: "#38BDF8", prospects: "#8B5CF6", picks: "#F59E0B" };

const fmt = (value: number) => Math.round(value).toLocaleString("en-US");

/** The three buckets as one stacked bar. */
export function PoolBar({ roster, prospects, picks, height = "h-3" }: { roster: number; prospects: number; picks: number; height?: string }) {
  const total = Math.max(1, roster + prospects + picks);
  const parts = [
    { key: "Roster", value: roster, color: POOL_COLORS.roster },
    { key: "Prospects", value: prospects, color: POOL_COLORS.prospects },
    { key: "Picks", value: picks, color: POOL_COLORS.picks },
  ];
  return (
    <div className={`flex ${height} overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]`} role="img" aria-label={parts.map((p) => `${p.key} ${fmt(p.value)}`).join(", ")}>
      {parts.map((part) => (
        <div key={part.key} title={`${part.key}: ${fmt(part.value)}`} style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />
      ))}
    </div>
  );
}

/** Small version for the Persistent Top Bio Card: rank, total and the stacked bar. */
export function AssetRankMini({ abbr }: { abbr: string }) {
  const row = franchiseAssetsFor(abbr);
  if (!row) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>Franchise assets</SectionLabel>
        <span className="text-xs text-[#94A3B8]">
          <span className="display text-base font-bold text-[#F8FAFC]">#{row.rank}</span> of {franchiseAssets.length} · {fmt(row.total)}
        </span>
      </div>
      <div className="mt-2">
        <PoolBar roster={row.roster} prospects={row.prospects} picks={row.picks} />
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-[#94A3B8]">
        <Dot color={POOL_COLORS.roster} label={`Roster ${fmt(row.roster)}`} />
        <Dot color={POOL_COLORS.prospects} label={`Prospects ${fmt(row.prospects)}`} />
        <Dot color={POOL_COLORS.picks} label={`Picks ${fmt(row.picks)}`} />
      </p>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Full Franchise Asset card for the Trades & Cap tab. */
export function FranchiseAssetCard({ abbr }: { abbr: string }) {
  const row = franchiseAssetsFor(abbr);
  if (!row) return null;
  return (
    <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Total franchise asset value</SectionLabel>
        <Link href="/trade-machine/rankings" className="text-xs font-semibold text-[#38BDF8] hover:underline">
          See all 32 teams →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p>
          <span className="display text-5xl leading-none font-bold">#{row.rank}</span>
          <span className="text-[#94A3B8]"> of {franchiseAssets.length}</span>
        </p>
        <p className="pb-1 text-sm text-[#94A3B8]">
          <span className="display text-2xl font-bold text-[#F8FAFC]">{fmt(row.total)}</span> Asset Value
        </p>
      </div>
      <div className="mt-4">
        <PoolBar roster={row.roster} prospects={row.prospects} picks={row.picks} height="h-4" />
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        <Bucket color={POOL_COLORS.roster} label="Active roster" value={row.roster} note={`${row.rosterCount} players under contract`} total={row.total} />
        <Bucket color={POOL_COLORS.prospects} label="Prospect pipeline" value={row.prospects} note={`${row.prospectCount} developing prospects`} total={row.total} />
        <Bucket color={POOL_COLORS.picks} label="Draft capital" value={row.picks} note={`${row.pickCount} picks, 2027–2029`} total={row.total} />
      </dl>
    </div>
  );
}

function Bucket({ color, label, value, note, total }: { color: string; label: string; value: number; note: string; total: number }) {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </dt>
      <dd className="display text-2xl leading-tight font-bold">
        {fmt(value)} <span className="text-xs font-normal text-[#94A3B8]">{Math.round((value / Math.max(1, total)) * 100)}%</span>
      </dd>
      <dd className="text-[11px] text-[#94A3B8]">{note}</dd>
    </div>
  );
}

/** 2027 | 2028 | 2029 across Rounds 1-7, with each pick's Asset Value and the team's Draft Capital Score. */
export function DraftCapitalMatrix({ abbr, teamName }: { abbr: string; teamName: string }) {
  const summary = draftCapitalFor(abbr);
  const cell = (y: number, r: number) => summary.matrix.find((c) => c.y === y && c.r === r)!;
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Draft capital · 2027–2029</SectionLabel>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {summary.held} picks held · {summary.acquired} acquired · {summary.tradedAway} own picks traded away
          </p>
        </div>
        <p className="text-right">
          <span className="block text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">Draft Capital Score</span>
          <span className="display text-4xl leading-none font-bold text-[#F59E0B]">{fmt(summary.total)}</span>
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">
              <th className="sticky top-0 border-b border-[#262B36] py-2 pr-3 font-semibold">Round</th>
              {capitalYears.map((y) => (
                <th key={y} className="sticky top-0 border-b border-[#262B36] px-2 py-2 font-semibold">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROUNDS.map((r) => (
              <tr key={r}>
                <th scope="row" className="border-b border-[#262B36]/60 py-2 pr-3 text-left align-top font-semibold text-[#F8FAFC]">
                  R{r}
                </th>
                {capitalYears.map((y) => {
                  const c = cell(y, r);
                  return (
                    <td key={y} className="border-b border-[#262B36]/60 px-2 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        {c.held.map((pick, i) => (
                          <span
                            key={`${pick.orig}-${i}`}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-1.5 py-0.5 text-xs ${pick.own ? "border-[#262B36] bg-[#0B0D10]/60" : "border-[#38BDF8]/40 bg-[#38BDF8]/10"}`}
                            title={pick.own ? "Own pick" : `Acquired from ${pick.orig}`}
                          >
                            {pick.own ? <span className="text-[10px] text-[#94A3B8]">Own</span> : <TeamLogo abbr={pick.orig} className="h-4 w-5" />}
                            <b className={`display ${ratingTone(pick.rating)}`}>{formatRating(pick.rating)}</b>
                            {pick.cond ? <span className="text-[9px] font-bold text-[#F59E0B]">COND</span> : null}
                          </span>
                        ))}
                        {c.awayTo ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]" title={c.note ?? `Traded to ${c.awayTo}`}>
                            <s className="decoration-[#EF4444]/70">Own</s> → <TeamLogo abbr={c.awayTo} className="h-3.5 w-4" />
                            {c.awayTo}
                          </span>
                        ) : null}
                        {c.held.length === 0 && !c.awayTo ? <span className="text-xs text-[#94A3B8]/60">—</span> : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[#94A3B8]">
        Numbers are 0–100 Asset Value, the same scale as the Trade Machine. First-rounders count as mid-first picks until the draft order is set. Synced {capitalAsOf}.{" "}
        <Link href="/trade-machine" className="font-semibold text-[#38BDF8] hover:underline">
          Trade {teamName} picks →
        </Link>
      </p>
    </div>
  );
}

/** Trades & Cap tab for a general manager: Pillar 3 summary, trade record and, for the current GM, his franchise's assets. */
export function GmTradesPanel({ person, team, teamName, current, report }: { person: string; team: string; teamName: string; current: boolean; report: GmReport | null }) {
  const asset = report?.asset ?? null;
  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionLabel>Pillar 3 · Asset &amp; Trades</SectionLabel>
            <p className="mt-1 max-w-2xl text-sm text-[#94A3B8]">
              Trade track record plus, for the current GM, how efficiently the roster uses the cap. 0.0 is the league-average GM, and a short tenure is pulled toward it.
            </p>
          </div>
          {asset ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">Asset Score</p>
                <p className={`display text-3xl leading-none font-bold ${asset.score >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                  {asset.score >= 0 ? "+" : "−"}
                  {Math.abs(asset.score).toFixed(1)}
                </p>
              </div>
              <span className={`display flex h-16 w-20 items-center justify-center rounded-xl border-2 text-4xl font-bold ${letterTone(asset.letter)}`}>{asset.letter}</span>
            </div>
          ) : null}
        </div>
        {asset ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Trades" value={String(asset.trades)} />
            <Fact label="Net trade Impact" value={`${asset.net >= 0 ? "+" : "−"}${fmt(Math.abs(asset.net))}`} tone={asset.net >= 0 ? "text-[#10B981]" : "text-[#EF4444]"} />
            <Fact label="Rating" value={`${asset.rating}/100`} />
            <Fact
              label="Contract efficiency"
              value={asset.efficiency == null ? "—" : `${asset.efficiency >= 0 ? "+" : "−"}${Math.abs(asset.efficiency).toFixed(1)}% cap`}
              tone={asset.efficiency == null ? undefined : asset.efficiency >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}
              title="Production the roster delivers minus what that production would cost on the open market, as a share of the cap. Current GMs only."
            />
          </dl>
        ) : (
          <p className="mt-4 text-sm text-[#94A3B8]">
            No grade yet: the public trade log starts in 2009-10, and {person} made fewer than two trades there. The Overall GM Grade uses the pillars that do have data.
          </p>
        )}
      </div>
      {asset ? <TradeRecord report={asset} subject={person} /> : null}
      {current ? (
        <>
          <FranchiseAssetCard abbr={team} />
          <DraftCapitalMatrix abbr={team} teamName={teamName} />
        </>
      ) : null}
    </div>
  );
}

function Fact({ label, value, tone = "text-[#F8FAFC]", title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div title={title} className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-3 py-2">
      <dt className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{label}</dt>
      <dd className={`display text-xl font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

/** Every piece of a trade, players first, each with the Impact it was worth. */
function Pieces({ rows }: { rows: TradePiece[] }) {
  if (!rows.length) return <span className="font-semibold">nothing</span>;
  return (
    <>
      {rows.map(([label, value, kind], index) => (
        <span key={label + index}>
          <span className="inline-block whitespace-nowrap">
            <span className={kind === "p" ? "font-semibold" : ""}>{label}</span>
            <span className="text-[11px] text-[#94A3B8]"> {fmt(value)}</span>
            {index < rows.length - 1 ? "," : ""}
          </span>{" "}
        </span>
      ))}
    </>
  );
}

function SideLine({ side, showTeam }: { side: TradeSide; showTeam?: boolean }) {
  return (
    <li className="min-w-0 rounded-xl border border-[#262B36] bg-[#0B0D10]/50 px-3 py-2.5 text-sm break-words">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#94A3B8]">
          {side.d}
          {showTeam ? ` · ${side.t}` : ""}
        </span>
        <span className={`display text-lg font-bold ${side.net >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
          {side.net >= 0 ? "+" : "−"}
          {fmt(Math.abs(side.net))}
        </span>
      </div>
      <p className="mt-0.5 text-[#F8FAFC]">
        <span className="text-[#94A3B8]">Got </span>
        <Pieces rows={side.in} />
      </p>
      <p className="text-[#F8FAFC]">
        <span className="text-[#94A3B8]">Sent </span>
        <Pieces rows={side.out} />
      </p>
    </li>
  );
}

/** Trade track record: net Impact over five seasons, best and worst deal, latest trades. Used for teams and GMs. */
export function TradeRecord({ report, subject }: { report: Pick<AssetGrade, "trades" | "net" | "best" | "worst" | "recent"> | TeamTradeReport; subject: string }) {
  const trades = "trades" in report ? report.trades : 0;
  if (!trades) {
    return (
      <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-5 text-sm text-[#94A3B8]">
        No trades by {subject} in the public trade log (2009-10 onward).
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
      <SectionLabel>Trade track record</SectionLabel>
      <p className="mt-2 text-sm text-[#94A3B8]">
        {trades} trades · net{" "}
        <span className={`display text-lg font-bold ${report.net >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
          {report.net >= 0 ? "+" : "−"}
          {fmt(Math.abs(report.net))}
        </span>{" "}
        Impact over the five seasons after each deal (what came in minus what went out; picks count the player taken or the expected value of the slot).
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#10B981] uppercase">Best trade</p>
          <ul className="mt-1.5">{report.best ? <SideLine side={report.best} /> : null}</ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#EF4444] uppercase">Worst trade</p>
          <ul className="mt-1.5">{report.worst ? <SideLine side={report.worst} /> : null}</ul>
        </div>
      </div>
      <p className="mt-4 text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">Latest trades</p>
      <ul className="mt-1.5 grid gap-2 lg:grid-cols-2">
        {report.recent.map((side) => (
          <SideLine key={side.id + side.t} side={side} />
        ))}
      </ul>
    </div>
  );
}
