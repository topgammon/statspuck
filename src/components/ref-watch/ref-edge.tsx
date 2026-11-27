"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { TeamLogo } from "@/components/team-logo";
import { StyleBadge } from "@/components/ref-watch/ref-table";

// Tonight's Pregame Ref Edge calculator.
// Expected power plays for each side =
//   (opponent penalties taken + own penalties drawn) / 2   (team discipline)
//   x crew whistle factor (isolated crew calls/60 vs league)
//   +/- half the crew's net home-PP bias
//   +/- the two teams' friction with this crew (net PP differential under these refs vs their norm).
// Expected PP goals = expected PPs x average of own PP% and opponent's (1 - PK%).

export type EdgeTeam = { abbr: string; name: string; taken: number; drawn: number; ppPct: number | null; pkPct: number | null; refs: Record<string, [number, number]> };
export type EdgeRef = { slug: string; name: string; rate: number; delta: number; home: number; style: string; grade: string; games: number };
export type EdgeGame = { id: number; start: string; away: string; home: string; refs: string[] };

const sign = (v: number, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;

export function refEdge(home: EdgeTeam, away: EdgeTeam, crew: EdgeRef[], leagueRate: number) {
  const crewRate = leagueRate + crew.reduce((s, r) => s + r.delta, 0);
  const factor = crew.length ? crewRate / leagueRate : 1;
  let expHome = ((away.taken + home.drawn) / 2) * factor;
  let expAway = ((home.taken + away.drawn) / 2) * factor;
  const bias = crew.length ? crew.reduce((s, r) => s + r.home, 0) / crew.length : 0;
  expHome += bias / 2;
  expAway -= bias / 2;
  const friction = (team: EdgeTeam) => {
    const known = crew.map((r) => team.refs[r.slug]).filter(Boolean) as [number, number][];
    return known.length ? known.reduce((s, v) => s + v[1], 0) / known.length : 0;
  };
  const fH = friction(home);
  const fA = friction(away);
  expHome += (fH - fA) / 4;
  expAway -= (fH - fA) / 4;
  const conv = (pp: number | null, pk: number | null) => ((pp ?? 0.2) + (1 - (pk ?? 0.8))) / 2;
  const goalsHome = expHome * conv(home.ppPct, away.pkPct);
  const goalsAway = expAway * conv(away.ppPct, home.pkPct);
  return { expHome, expAway, net: expHome - expAway, goalsNet: goalsHome - goalsAway, factor, bias, fH, fA, crewRate };
}

export function RefEdgeCalculator({
  teams,
  refs,
  games: initialGames,
  date,
  leagueRate,
}: {
  teams: EdgeTeam[];
  refs: EdgeRef[];
  games: EdgeGame[];
  date: string;
  leagueRate: number;
}) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams]);
  const bySlug = useMemo(() => new Map(refs.map((r) => [r.slug, r])), [refs]);
  const byName = useMemo(() => new Map(refs.map((r) => [r.name.toLowerCase(), r.slug])), [refs]);
  const [games, setGames] = useState(initialGames);
  const [live, setLive] = useState(false);
  const [gameId, setGameId] = useState<number | "custom">(initialGames[0]?.id ?? "custom");
  const [home, setHome] = useState(initialGames[0]?.home ?? teams[0]?.abbr ?? "");
  const [away, setAway] = useState(initialGames[0]?.away ?? teams[1]?.abbr ?? "");
  const sortedRefs = useMemo(() => [...refs].sort((a, b) => a.name.localeCompare(b.name)), [refs]);
  const [crew, setCrew] = useState<[string, string]>(() => {
    const g = initialGames[0];
    return [g?.refs[0] ?? sortedRefs[0]?.slug ?? "", g?.refs[1] ?? sortedRefs[1]?.slug ?? ""];
  });

  // Refresh today's slate and posted referees from our same-origin function (if deployed).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/nhl-today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { games?: { id: number; start: string; away: string; home: string; refs: string[] }[] } | null) => {
        if (cancelled || !data?.games?.length) return;
        const mapped = data.games.map((g) => ({ ...g, refs: g.refs.map((n) => byName.get(n.toLowerCase())).filter((s): s is string => Boolean(s)) }));
        setGames(mapped);
        setLive(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [byName]);

  function pickGame(id: number | "custom") {
    setGameId(id);
    if (id === "custom") return;
    const g = games.find((x) => x.id === id);
    if (!g) return;
    setHome(g.home);
    setAway(g.away);
    if (g.refs.length) setCrew([g.refs[0], g.refs[1] ?? g.refs[0]]);
  }

  const h = byAbbr.get(home);
  const a = byAbbr.get(away);
  const crewRefs = [...new Set(crew)].map((s) => bySlug.get(s)).filter((r): r is EdgeRef => Boolean(r));
  const result = h && a && home !== away ? refEdge(h, a, crewRefs, leagueRate) : null;
  const current = gameId === "custom" ? null : games.find((g) => g.id === gameId);
  const assigned = current?.refs.length ? "Assigned crew loaded" : "Crew not posted yet: pick any two refs to test";
  const edgeTeam = result ? (result.net >= 0 ? h : a) : null;

  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#38BDF8] uppercase">Tonight&apos;s Pregame Ref Edge</p>
          <p className="text-xs text-[#94A3B8]">
            {games.length ? `${games.length} games · ${date}` : "No NHL games today: use a custom matchup."} {live ? "· live" : ""}
          </p>
        </div>
      </div>

      {games.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pickGame(g.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${gameId === g.id ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-[#262B36] bg-[#0B0D10]/60 hover:border-[#38BDF8]/60"}`}
            >
              <TeamLogo abbr={g.away} className="h-4 w-5" /> {g.away} @ {g.home} <TeamLogo abbr={g.home} className="h-4 w-5" />
              {g.refs.length ? <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" title="Referees posted" /> : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => pickGame("custom")}
            className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${gameId === "custom" ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-dashed border-[#262B36] text-[#94A3B8]"}`}
          >
            Custom matchup
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Away team" value={away} onChange={(v) => { setAway(v); setGameId("custom"); }} options={teams.map((t) => [t.abbr, t.name])} />
        <Select label="Home team" value={home} onChange={(v) => { setHome(v); setGameId("custom"); }} options={teams.map((t) => [t.abbr, t.name])} />
        <Select label="Referee 1" value={crew[0]} onChange={(v) => setCrew([v, crew[1]])} options={sortedRefs.map((r) => [r.slug, r.name])} />
        <Select label="Referee 2" value={crew[1]} onChange={(v) => setCrew([crew[0], v])} options={sortedRefs.map((r) => [r.slug, r.name])} />
      </div>
      {gameId !== "custom" ? <p className="mt-1 text-[11px] text-[#94A3B8]">{assigned}</p> : null}

      {result && h && a ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-4">
            <p className="text-[11px] tracking-[0.12em] text-[#94A3B8] uppercase">Pregame Ref Edge</p>
            <p className="display mt-1 text-3xl font-bold">
              {sign(Math.abs(result.net))} <span className="text-base font-semibold text-[#94A3B8]">expected net PP opportunities</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
              Edge: {edgeTeam ? <TeamLogo abbr={edgeTeam.abbr} className="h-5 w-6" /> : null}
              <span className="text-[#10B981]">{Math.abs(result.net) < 0.05 ? "Even" : edgeTeam?.name}</span>
              <span className="text-xs font-normal text-[#94A3B8]">≈ {sign(Math.abs(result.goalsNet))} power-play goals</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <Fact label={`${a.abbr} expected PPs`} value={result.expAway.toFixed(2)} />
              <Fact label={`${h.abbr} expected PPs`} value={result.expHome.toFixed(2)} />
            </div>
          </div>
          <div className="grid gap-2 text-sm">
            <Row label="Crew whistle" tip="Combined isolated calls per 60 of the two referees vs the league average." value={`${result.crewRate.toFixed(2)}/60 · ${sign((result.factor - 1) * 100, 0)}%`} />
            <Row label="Crew home bias" tip="Average net home power plays per 60 vs league baseline for the two refs." value={sign(result.bias)} />
            <Row label={`${h.abbr} friction`} tip="This team's net PP differential per game under these refs vs its usual, shrunk for small samples." value={sign(result.fH)} />
            <Row label={`${a.abbr} friction`} tip="This team's net PP differential per game under these refs vs its usual, shrunk for small samples." value={sign(result.fA)} />
            <Row label="Discipline" tip="Penalties taken / drawn per game (recency weighted)." value={`${h.abbr} ${h.taken.toFixed(2)}/${h.drawn.toFixed(2)} · ${a.abbr} ${a.taken.toFixed(2)}/${a.drawn.toFixed(2)}`} />
            <Row label="PP% / PK%" tip="Power-play and penalty-kill rates from play-by-play (recency weighted)." value={`${h.abbr} ${pct(h.ppPct)}/${pct(h.pkPct)} · ${a.abbr} ${pct(a.ppPct)}/${pct(a.pkPct)}`} />
            <div className="flex flex-wrap gap-2 pt-1">
              {crewRefs.map((r) => (
                <Link key={r.slug} href={`/ref-watch/${r.slug}`} className="flex items-center gap-2 rounded-lg border border-[#262B36] px-2 py-1 text-xs hover:border-[#38BDF8]">
                  <span className="font-semibold">{r.name}</span> <StyleBadge style={r.style} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#94A3B8]">Pick two different teams.</p>
      )}
    </div>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="grid gap-1 text-xs text-[#94A3B8]">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-2.5 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#38BDF8]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className="text-[9px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</p>
      <p className="display text-lg font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#262B36] bg-[#0B0D10]/40 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[#94A3B8]">
        {label} <InfoTip text={tip} />
      </span>
      <span className="text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}
