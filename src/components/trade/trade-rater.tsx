"use client";

import { useMemo, useState } from "react";
import type { TradeSide as ShareSide } from "@/components/share-cards";
import { ShareLauncher } from "@/components/share-modal";
import { TeamLogo } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import { gradeTone, ratingFill } from "@/lib/rating";
import type { TradePiece } from "@/lib/gm-grades";
import type { RatedTrade } from "@/lib/trade-rater";

type Sort = "new" | "old" | "lopsided" | "even";

const PAGE = 30;
const fmt = (value: number) => Math.round(value).toLocaleString("en-US");

function seasonOf(date: string): string {
  const year = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export function TradeRater({
  trades,
  teams,
  earlyAfter,
  from,
}: {
  trades: RatedTrade[];
  teams: { abbr: string; name: string; short: string }[];
  /** Trades dated after this are still unfolding. */
  earlyAfter: string;
  from: string;
}) {
  const [team, setTeam] = useState("ALL");
  const [season, setSeason] = useState("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [shown, setShown] = useState(PAGE);

  const nameOf = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams]);
  const seasons = useMemo(() => [...new Set(trades.map((trade) => seasonOf(trade.d)))], [trades]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = trades.filter((trade) => {
      if (team !== "ALL" && !trade.sides.some((side) => side.t === team)) return false;
      if (season !== "ALL" && seasonOf(trade.d) !== season) return false;
      if (needle.length >= 2) {
        const hit = trade.sides.some((side) => [...side.in, ...side.out].some((piece) => piece[0].toLowerCase().includes(needle)));
        if (!hit) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    if (sort === "old") sorted.sort((a, b) => a.d.localeCompare(b.d));
    else if (sort === "lopsided") sorted.sort((a, b) => b.margin - a.margin);
    else if (sort === "even") sorted.sort((a, b) => a.margin - b.margin);
    return sorted;
  }, [trades, team, season, query, sort]);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setShown(PAGE);
    };
  }

  const visible = rows.slice(0, shown);

  return (
    <section>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
        <Field label="Team">
          <select value={team} onChange={(e) => reset(setTeam)(e.target.value)} className="rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none">
            <option value="ALL">All teams</option>
            {teams.map((t) => (
              <option key={t.abbr} value={t.abbr}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Season">
          <select value={season} onChange={(e) => reset(setSeason)(e.target.value)} className="rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none">
            <option value="ALL">All seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Player or pick">
          <input
            type="search"
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            placeholder="e.g. Larkin or 2027 R1"
            className="w-52 rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/70 focus:border-[#38BDF8] focus:outline-none"
          />
        </Field>
        <Field label="Sort">
          <TogglePill<Sort>
            value={sort}
            options={[
              { id: "new", label: "Newest" },
              { id: "old", label: "Oldest" },
              { id: "lopsided", label: "Most lopsided" },
              { id: "even", label: "Most even" },
            ]}
            onChange={reset(setSort)}
          />
        </Field>
      </div>

      <p className="mt-4 text-sm text-[#94A3B8]">
        {rows.length.toLocaleString("en-US")} trades since {from}. Showing {Math.min(shown, rows.length)}.
      </p>

      <ul className="mt-3 grid gap-4">
        {visible.map((trade) => (
          <TradeCard key={trade.id} trade={trade} nameOf={nameOf} early={trade.d > earlyAfter} />
        ))}
        {rows.length === 0 ? <li className="rounded-2xl border border-dashed border-[#262B36] p-6 text-center text-sm text-[#94A3B8]">No trades match those filters.</li> : null}
      </ul>

      {shown < rows.length ? (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-full border border-[#262B36] px-5 py-2 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8] hover:text-[#38BDF8]">
            Show {Math.min(PAGE, rows.length - shown)} more
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{label}</span>
      {children}
    </label>
  );
}

function TradeCard({ trade, nameOf, early }: { trade: RatedTrade; nameOf: Map<string, { name: string; short: string }>; early: boolean }) {
  const winner = trade.winner ? nameOf.get(trade.winner) : null;
  const degree = trade.margin >= 0.25 ? "Lopsided win" : trade.margin >= 0.12 ? "Clear win" : "Narrow win";
  const headline = winner ? `${winner.short} win` : "Fair trade";
  const sub = winner ? `${degree} · ${trade.d}` : `About even · ${trade.d}`;

  const shareSides: ShareSide[] = trade.sides.map((side) => ({
    abbr: side.t,
    name: nameOf.get(side.t)?.name ?? side.t,
    color: "#38BDF8",
    grade: side.grade,
    total: Math.round(side.in.reduce((sum, piece) => sum + piece[1], 0)),
    capDelta: null,
    receives: side.in.slice(0, 8).map(([label, value, kind]) => ({ label, sub: kind === "p" ? "" : "pick", rating: Math.round(value), color: ratingFill(value / 4) })),
  }));

  return (
    <li className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">
            {trade.d} · {seasonOf(trade.d)}
            {early ? <span className="ml-2 rounded-full bg-[#F59E0B]/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#F59E0B]">Early read</span> : null}
          </p>
          <p className={`display text-2xl font-bold ${winner ? "text-[#10B981]" : "text-[#F8FAFC]"}`}>
            {headline} <span className="text-sm font-normal text-[#94A3B8]">{winner ? degree.toLowerCase() : ""}</span>
          </p>
        </div>
        <ShareLauncher
          fileSlug={`${trade.id}`.toLowerCase()}
          title={`${headline} · ${trade.d}`}
          summary={`${headline} in the ${trade.d} trade, graded on what the pieces became (StatsPuck Trade Rater).`}
          path="/trade-machine/rater"
          card={{ kind: "trade", headline, sub, sides: shareSides, capNotes: [], eyebrow: "Trade Rater · Past trade", note: "Graded on Impact over the five seasons after the deal." }}
        />
      </div>

      <div className={`mt-4 grid gap-3 ${trade.sides.length > 2 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
        {trade.sides.map((side) => {
          const info = nameOf.get(side.t);
          const total = side.in.reduce((sum, piece) => sum + piece[1], 0);
          return (
            <div key={side.t} className={`min-w-0 rounded-xl border p-3.5 ${side.t === trade.winner ? "border-[#10B981]/40 bg-[#10B981]/[0.04]" : "border-[#262B36] bg-[#0B0D10]/50"}`}>
              <div className="flex items-center gap-3">
                <TeamLogo abbr={side.t} name={info?.name} className="h-9 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{info?.name ?? side.t}</p>
                  <p className="text-xs text-[#94A3B8]">
                    Gets {fmt(total)} · net{" "}
                    <span className={side.net >= 0 ? "font-semibold text-[#10B981]" : "font-semibold text-[#EF4444]"}>
                      {side.net >= 0 ? "+" : "−"}
                      {fmt(Math.abs(side.net))}
                    </span>
                  </p>
                </div>
                <span className={`display text-4xl leading-none font-bold ${gradeTone(side.grade)}`}>{side.grade}</span>
              </div>
              <Group title="Receives" pieces={side.in} />
              <Group title="Sends" pieces={side.out} />
            </div>
          );
        })}
      </div>
    </li>
  );
}

function Group({ title, pieces }: { title: string; pieces: TradePiece[] }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{title}</p>
      {pieces.length === 0 ? (
        <p className="mt-1 text-sm text-[#94A3B8]">Nothing</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm">
          {pieces.map(([label, value, kind], index) => (
            <li key={label + index} className="flex items-center justify-between gap-3">
              <span className={kind === "p" ? "font-semibold text-[#F8FAFC]" : "text-[#94A3B8]"}>
                {label}
                {kind === "k" ? <span className="ml-1.5 text-[10px] tracking-wider uppercase">pick</span> : null}
              </span>
              <span className="display text-[#94A3B8]">{fmt(value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
