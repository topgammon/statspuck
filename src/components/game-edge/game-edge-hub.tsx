"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InfoTip } from "@/components/info-tip";
import { HalfRinkZones } from "@/components/rink";
import { TeamLogo } from "@/components/team-logo";
import { refEdge, type EdgeRef, type EdgeTeam } from "@/components/ref-watch/ref-edge";
import { StyleBadge } from "@/components/ref-watch/ref-table";
import {
  CHANCE_KEYS,
  CHANCE_NAME,
  goalieZoneValues,
  leagueSvOf,
  matchupFit,
  perGame,
  shareOf,
  SHOT_KEYS,
  SHOT_NAME,
  shrunkSv,
  signed,
  ZONE_KEYS,
  ZONE_NAME,
  type GoalieLike,
  type SG,
} from "@/components/game-edge/edge-math";

export type HubTeam = EdgeTeam & {
  weightGames: number;
  for: Partial<Record<string, SG>>;
  against: Partial<Record<string, SG>>;
  shotFor: Record<string, SG>;
  shotAgainst: Record<string, SG>;
  pp: Record<string, number>;
  pk: Record<string, number>;
  goalies: number[];
};
export type HubGoalie = GoalieLike & { team: string | null; sv: number | null };
export type HubUnit = { team: string; ids: number[]; names: string[]; toi: number; cf: number; gf: number | null; goals: [number, number]; delta: number };
export type HubLeague = {
  for: Partial<Record<string, SG>>;
  shot: Record<string, SG>;
  teamGames: number;
  goalie: { chance: Partial<Record<string, SG>>; zone: Partial<Record<string, SG>>; type: Record<string, SG> };
  sv: number | null;
};
type Game = { id: number; start: string; away: string; home: string; refs: string[] };
export type HubView = { teams: HubTeam[]; goalies: HubGoalie[]; league: HubLeague; lines: HubUnit[]; pairs: HubUnit[] };

type Tab = "matchups" | "goalies" | "chemistry";

/** "This season only" (default) vs "include last season" switch, shared by the hub and profile tabs. */
export function SeasonSwitch({ two, onChange, season }: { two: boolean; onChange: (two: boolean) => void; season: string }) {
  return (
    <div className="inline-flex rounded-full border border-[#262B36] bg-[#14171F] p-0.5 text-xs font-semibold" role="group" aria-label="Seasons included">
      <button type="button" aria-pressed={!two} onClick={() => onChange(false)} className={`rounded-full px-3 py-1.5 ${!two ? "bg-[#38BDF8] text-[#0B0D10]" : "text-[#94A3B8] hover:text-white"}`}>
        {season} only
      </button>
      <button type="button" aria-pressed={two} onClick={() => onChange(true)} className={`rounded-full px-3 py-1.5 ${two ? "bg-[#38BDF8] text-[#0B0D10]" : "text-[#94A3B8] hover:text-white"}`}>
        + last season
      </button>
    </div>
  );
}

/** Client wrapper for server-rendered profile panels: shows the this-season or two-season version. */
export function SeasonViews({ season, two, current }: { season: string; two: React.ReactNode; current: React.ReactNode }) {
  const [both, setBoth] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeasonSwitch two={both} onChange={setBoth} season={season} />
        <span className="text-xs text-[#94A3B8]">{both ? "This season and last season, equal weight" : "This season only"}</span>
      </div>
      {both ? two : current}
    </div>
  );
}

export function GameEdgeHub({
  views,
  games: initialGames,
  date,
  refs,
  leagueRate,
  hrefs,
  season,
}: {
  views: Record<"season" | "two", HubView>;
  games: Game[];
  date: string;
  refs: EdgeRef[];
  leagueRate: number;
  hrefs: Record<number, string>;
  season: string;
}) {
  const [both, setBoth] = useState(false);
  const { teams, goalies, league, lines, pairs } = views[both ? "two" : "season"];
  const [tab, setTab] = useState<Tab>("matchups");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "goalies" || t === "chemistry") setTab(t);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function pick(t: Tab) {
    setTab(t);
    try {
      const url = new URL(window.location.href);
      if (t === "matchups") url.searchParams.delete("tab");
      else url.searchParams.set("tab", t);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* ignore */
    }
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SeasonSwitch two={both} onChange={setBoth} season={season} />
        <span className="text-xs text-[#94A3B8]">{both ? "Using this season and last season at equal weight." : "Using this season's games only (default)."}</span>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {(
          [
            ["matchups", "Matchup Reports"],
            ["goalies", "Goalie Tendencies"],
            ["chemistry", "Line Chemistry"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => pick(id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${tab === id ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]" : "border-[#262B36] bg-[#14171F] text-[#94A3B8] hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "matchups" ? <Matchups teams={teams} goalies={goalies} league={league} initialGames={initialGames} date={date} refs={refs} leagueRate={leagueRate} /> : null}
        {tab === "goalies" ? <GoalieExplorer goalies={goalies} league={league} hrefs={hrefs} /> : null}
        {tab === "chemistry" ? <Chemistry lines={lines} pairs={pairs} hrefs={hrefs} /> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Matchup reports

function Matchups({
  teams,
  goalies,
  league,
  initialGames,
  date,
  refs,
  leagueRate,
}: {
  teams: HubTeam[];
  goalies: HubGoalie[];
  league: HubLeague;
  initialGames: Game[];
  date: string;
  refs: EdgeRef[];
  leagueRate: number;
}) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams]);
  const bySlug = useMemo(() => new Map(refs.map((r) => [r.slug, r])), [refs]);
  const byName = useMemo(() => new Map(refs.map((r) => [r.name.toLowerCase(), r.slug])), [refs]);
  const [games, setGames] = useState(initialGames);
  const [gameId, setGameId] = useState<number | "custom">(initialGames[0]?.id ?? "custom");
  const [away, setAway] = useState(initialGames[0]?.away ?? teams[0].abbr);
  const [home, setHome] = useState(initialGames[0]?.home ?? teams[1].abbr);
  const [view, setView] = useState<"chance" | "shot">("chance");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/nhl-today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { games?: Game[] } | null) => {
        if (cancelled || !data?.games?.length) return;
        setGames(data.games.map((g) => ({ ...g, refs: g.refs.map((n) => byName.get(n.toLowerCase())).filter((s): s is string => Boolean(s)) })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [byName]);

  const A = byAbbr.get(away);
  const H = byAbbr.get(home);
  const game = gameId === "custom" ? null : games.find((g) => g.id === gameId);
  const crew = (game?.refs ?? []).map((s) => bySlug.get(s)).filter((r): r is EdgeRef => Boolean(r));

  return (
    <div>
      {games.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGameId(g.id);
                setAway(g.away);
                setHome(g.home);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${gameId === g.id ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-[#262B36] bg-[#14171F] hover:border-[#38BDF8]/60"}`}
            >
              <TeamLogo abbr={g.away} className="h-4 w-5" /> {g.away} @ {g.home} <TeamLogo abbr={g.home} className="h-4 w-5" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#94A3B8]">No NHL games on {date}. Build a custom matchup below.</p>
      )}
      <div className="mt-3 grid gap-3 rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <TeamSelect label="Away" value={away} teams={teams} onChange={(v) => { setAway(v); setGameId("custom"); }} />
        <span className="hidden pb-2 text-center text-[#94A3B8] sm:block">@</span>
        <TeamSelect label="Home" value={home} teams={teams} onChange={(v) => { setHome(v); setGameId("custom"); }} />
      </div>

      {A && H && away !== home ? (
        <div className="mt-5 grid gap-5">
          {/* 1. Scoring vs scored-on */}
          <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="display flex items-center gap-2 text-xl font-bold">
                How each team scores vs gets scored on
                <InfoTip text="Left: share of this team's goals from each chance type. Right: how many goals of that type the opponent allows per game vs the league average. Highlighted rows are where a strength meets a weakness." />
              </h3>
              <div className="flex gap-1 text-xs">
                {(
                  [
                    ["chance", "Chance types"],
                    ["shot", "Shot types"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setView(id)} className={`rounded-full px-3 py-1 font-semibold ${view === id ? "bg-[#38BDF8] text-[#0B0D10]" : "border border-[#262B36] text-[#94A3B8]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <AttackVsDefense attack={A} defense={H} league={league} view={view} />
              <AttackVsDefense attack={H} defense={A} league={league} view={view} />
            </div>
          </section>

          {/* 2. Goalies */}
          <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
            <h3 className="display flex items-center gap-2 text-xl font-bold">
              Goalie tendency & start recommendation
              <InfoTip text="Matchup fit = the save % each goalie would post on the opponent's shot mix (by chance type, shrunk for small samples) minus what a league-average goalie would post. Higher is better." />
            </h3>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <GoalieMatchup team={H} opp={A} goalies={goalies} league={league} />
              <GoalieMatchup team={A} opp={H} goalies={goalies} league={league} />
            </div>
          </section>

          {/* 3. PP vs PK + refs */}
          <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
            <h3 className="display flex items-center gap-2 text-xl font-bold">
              Power play vs penalty kill
              <InfoTip text="Where each power play's shots on goal come from (flank one-timer areas, point shots and tips, or the slot / net-front) against where the opponent's penalty kill gives up shots." />
            </h3>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <PpVsPk pp={A} pk={H} />
              <PpVsPk pp={H} pk={A} />
            </div>
            <div className="mt-4 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-4 text-sm">
              {crew.length ? (
                (() => {
                  const r = refEdge(H, A, crew, leagueRate);
                  const edgeTeam = r.net >= 0 ? H : A;
                  return (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[11px] tracking-[0.12em] text-[#94A3B8] uppercase">Tonight&apos;s crew</span>
                      {crew.map((c) => (
                        <Link key={c.slug} href={`/ref-watch/${c.slug}`} className="flex items-center gap-1.5 font-semibold hover:text-[#38BDF8]">
                          {c.name} <StyleBadge style={c.style} />
                        </Link>
                      ))}
                      <span className="ml-auto font-semibold">
                        Ref Edge: {signed(Math.abs(r.net), 2)} net PPs · <span className="text-[#10B981]">{edgeTeam.name}</span>
                      </span>
                    </div>
                  );
                })()
              ) : (
                <p className="text-[#94A3B8]">
                  Referees for this game aren&apos;t posted yet.{" "}
                  <Link href="/ref-watch" className="font-semibold text-[#38BDF8] hover:underline">
                    Test any crew in the Ref Edge calculator →
                  </Link>
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#94A3B8]">Pick two different teams.</p>
      )}
    </div>
  );
}

function TeamSelect({ label, value, teams, onChange }: { label: string; value: string; teams: HubTeam[]; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-[#94A3B8]">
      {label}
      <span className="flex items-center gap-2">
        <TeamLogo abbr={value} className="h-8 w-10" />
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#262B36] bg-[#0B0D10] px-2.5 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#38BDF8]">
          {teams.map((t) => (
            <option key={t.abbr} value={t.abbr}>
              {t.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function AttackVsDefense({ attack, defense, league, view }: { attack: HubTeam; defense: HubTeam; league: HubLeague; view: "chance" | "shot" }) {
  const keys = view === "chance" ? CHANCE_KEYS : SHOT_KEYS;
  const names: Record<string, string> = view === "chance" ? CHANCE_NAME : SHOT_NAME;
  const forTable = view === "chance" ? attack.for : attack.shotFor;
  const againstTable = view === "chance" ? defense.against : defense.shotAgainst;
  const leagueTable = view === "chance" ? league.for : league.shot;
  const rows = keys
    .map((k) => {
      const share = shareOf(forTable, k);
      const leagueShare = shareOf(leagueTable, k);
      const allowed = perGame(againstTable, k, defense.weightGames);
      const leagueAllowed = perGame(leagueTable, k, league.teamGames);
      const vuln = leagueAllowed > 0 ? allowed / leagueAllowed - 1 : 0;
      return { k, share, leagueShare, vuln, hot: share > leagueShare * 1.08 && vuln > 0.1 };
    })
    .filter((r) => r.share > 0 || r.vuln !== 0);
  const top = [...rows].sort((a, b) => b.share - a.share)[0];
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <TeamLogo abbr={attack.abbr} className="h-5 w-6" /> {attack.abbr} attack <span className="text-[#94A3B8]">vs</span> <TeamLogo abbr={defense.abbr} className="h-5 w-6" /> {defense.abbr} defense
      </p>
      <table className="mt-2 w-full text-xs">
        <thead className="text-[10px] tracking-[0.1em] text-[#94A3B8] uppercase">
          <tr>
            <th className="py-1 text-left font-semibold">Type</th>
            <th className="py-1 text-right font-semibold">{attack.abbr} goal share</th>
            <th className="py-1 text-right font-semibold">{defense.abbr} allows vs avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className={`border-t border-[#262B36] ${r.hot ? "bg-[#10B981]/10" : ""}`}>
              <td className="py-1.5">{names[r.k] ?? r.k}</td>
              <td className="py-1.5 text-right tabular-nums">
                {(r.share * 100).toFixed(0)}% <span className="text-[#94A3B8]">({(r.leagueShare * 100).toFixed(0)}%)</span>
              </td>
              <td className={`py-1.5 text-right font-semibold tabular-nums ${r.vuln > 0.1 ? "text-[#EF4444]" : r.vuln < -0.1 ? "text-[#10B981]" : ""}`}>{signed(r.vuln * 100, 0, "%")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {top ? (
        <p className="mt-2 text-xs text-[#94A3B8]">
          {attack.abbr} scores most via <b className="text-[#F8FAFC]">{names[top.k]}</b> ({(top.share * 100).toFixed(0)}% of goals).{" "}
          {defense.abbr} allows {top.vuln >= 0 ? `${(top.vuln * 100).toFixed(0)}% more` : `${(-top.vuln * 100).toFixed(0)}% fewer`} of those than average.
        </p>
      ) : null}
    </div>
  );
}

function GoalieMatchup({ team, opp, goalies, league }: { team: HubTeam; opp: HubTeam; goalies: HubGoalie[]; league: HubLeague }) {
  const tandem = team.goalies.map((id) => goalies.find((g) => g.id === id)).filter((g): g is HubGoalie => Boolean(g)).slice(0, 2);
  if (!tandem.length) return <p className="text-sm text-[#94A3B8]">No goalie sample for {team.abbr} yet.</p>;
  const fits = tandem.map((g) => ({ g, fit: matchupFit(g, opp.for, league.goalie.chance) }));
  const best = [...fits].sort((a, b) => b.fit - a.fit)[0];
  // The opponent's main goal source and how each goalie handles it.
  const oppTop = [...CHANCE_KEYS].sort((a, b) => shareOf(opp.for, b) - shareOf(opp.for, a))[0];
  const oppTop2 = [...CHANCE_KEYS].sort((a, b) => shareOf(opp.for, b) - shareOf(opp.for, a))[1];
  const lsv = leagueSvOf(league.goalie.chance, oppTop);
  const note = (() => {
    const starter = fits[0];
    const delta = (shrunkSv(starter.g.chance[oppTop] as SG | undefined, lsv) - lsv) * 100;
    const share = (shareOf(opp.for, oppTop) + shareOf(opp.for, oppTop2)) * 100;
    let text = `${opp.abbr} gets ${share.toFixed(0)}% of its goals from ${CHANCE_NAME[oppTop].toLowerCase()} and ${CHANCE_NAME[oppTop2].toLowerCase()}. ${starter.g.name} is ${signed(delta, 1, "%")} vs league on ${CHANCE_NAME[oppTop].toLowerCase()}`;
    if (fits[1] && best.g.id !== starter.g.id && best.fit - starter.fit > 0.15) text += `; ${best.g.name} is the stronger matchup fit.`;
    else text += `; ${starter.g.name} is the right call.`;
    return text;
  })();
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <TeamLogo abbr={team.abbr} className="h-5 w-6" /> {team.abbr} goalies vs {opp.abbr}
      </p>
      <div className="mt-2 grid gap-2">
        {fits.map(({ g, fit }, i) => (
          <div key={g.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${g.id === best.g.id ? "border-[#10B981]/60 bg-[#10B981]/5" : "border-[#262B36] bg-[#0B0D10]/60"}`}>
            <img src={`https://assets.nhle.com/mugs/nhl/latest/${g.id}.png`} alt="" className="h-10 w-10 rounded-full border border-[#262B36] bg-[#14171F] object-cover object-top" onError={(e) => { e.currentTarget.src = "/player-silhouette.svg"; }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{i === 0 ? "Starter" : "Backup"}</span>
              <span className="block truncate text-sm font-semibold">{g.name}</span>
              <span className="block text-[11px] text-[#94A3B8]">SV {g.sv != null ? g.sv.toFixed(3).replace(/^0/, "") : "—"} · {Math.round(g.sa)} shots</span>
            </span>
            <span className="text-right">
              <span className={`display block text-lg font-bold ${fit >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{signed(fit, 2)}</span>
              <span className="block text-[10px] text-[#94A3B8]">fit</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#94A3B8]">{note}</p>
    </div>
  );
}

const PP_LABEL: Record<string, string> = { flank: "Flank one-timers", point: "Point / tips", netfront: "Slot / net-front" };

function PpVsPk({ pp, pk }: { pp: HubTeam; pk: HubTeam }) {
  const ppTotal = pp.pp.total || 1;
  const pkTotal = pk.pk.total || 1;
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <TeamLogo abbr={pp.abbr} className="h-5 w-6" /> {pp.abbr} PP {pct(pp.ppPct)} <span className="text-[#94A3B8]">vs</span> <TeamLogo abbr={pk.abbr} className="h-5 w-6" /> {pk.abbr} PK {pct(pk.pkPct)}
      </p>
      <ul className="mt-2 grid gap-2 text-xs">
        {(["flank", "point", "netfront"] as const).map((k) => {
          const a = (pp.pp[k] ?? 0) / ppTotal;
          const b = (pk.pk[k] ?? 0) / pkTotal;
          return (
            <li key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-[#94A3B8]">{PP_LABEL[k]}</span>
              <span className="grid gap-0.5">
                <Bar value={a} color="#38BDF8" label={`${pp.abbr} PP ${(a * 100).toFixed(0)}%`} />
                <Bar value={b} color="#E11D48" label={`${pk.abbr} PK allows ${(b * 100).toFixed(0)}%`} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 flex-1 rounded-full bg-[#0B0D10]">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
      </span>
      <span className="w-32 shrink-0 text-[10px] text-[#94A3B8]">{label}</span>
    </span>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

// ------------------------------------------------------------------ Goalie explorer

function GoalieExplorer({ goalies, league, hrefs }: { goalies: HubGoalie[]; league: HubLeague; hrefs: Record<number, string> }) {
  const [query, setQuery] = useState("");
  const [id, setId] = useState(goalies[0]?.id);
  const list = goalies.filter((g) => !query || g.name.toLowerCase().includes(query.toLowerCase()) || (g.team ?? "").toLowerCase() === query.toLowerCase());
  const g = goalies.find((x) => x.id === id) ?? goalies[0];
  if (!g) return <p className="text-sm text-[#94A3B8]">No goalie data yet.</p>;
  const zones = goalieZoneValues(g, league.goalie);
  const weakest = ZONE_KEYS.filter((z) => zones[z].delta != null).sort((a, b) => (zones[a].delta ?? 0) - (zones[b].delta ?? 0))[0];
  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-[#262B36] bg-[#14171F] p-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search goalie or team" className="w-full rounded-lg border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm outline-none focus:border-[#38BDF8]" />
        <ul className="mt-2 max-h-[32rem] overflow-y-auto">
          {list.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setId(x.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${x.id === g.id ? "bg-[#38BDF8]/10 text-[#38BDF8]" : "hover:bg-white/[0.04]"}`}>
                {x.team ? <TeamLogo abbr={x.team} className="h-4 w-5" /> : null}
                <span className="flex-1 truncate">{x.name}</span>
                <span className="text-xs text-[#94A3B8] tabular-nums">{x.sv != null ? x.sv.toFixed(3).replace(/^0/, "") : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <img src={`https://assets.nhle.com/mugs/nhl/latest/${g.id}.png`} alt="" className="h-14 w-14 rounded-full border border-[#262B36] object-cover object-top" onError={(e) => { e.currentTarget.src = "/player-silhouette.svg"; }} />
          <div className="flex-1">
            <p className="display text-2xl font-bold">{hrefs[g.id] ? <Link href={hrefs[g.id]} className="hover:text-[#38BDF8]">{g.name}</Link> : g.name}</p>
            <p className="text-xs text-[#94A3B8]">
              {g.team ?? ""} · SV {g.sv?.toFixed(3).replace(/^0/, "") ?? "—"} (league {league.sv?.toFixed(3).replace(/^0/, "") ?? "—"}) · {Math.round(g.sa)} shots
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[11px] tracking-[0.12em] text-[#94A3B8] uppercase">Save % vs league by ice zone</p>
            <div className="mx-auto mt-2 max-w-xs">
              <HalfRinkZones values={zones} label={`${g.name} save percentage by zone vs league`} />
            </div>
            {weakest ? (
              <p className="mt-2 text-xs text-[#94A3B8]">
                Weak spot: <b className="text-[#EF4444]">{ZONE_NAME[weakest]}</b> ({zones[weakest].text}% vs league). Green = better than league, red = worse.
              </p>
            ) : null}
          </div>
          <div className="grid gap-4">
            <SvTable title="By chance type" keys={CHANCE_KEYS} names={CHANCE_NAME} table={g.chance} league={league.goalie.chance} />
            <SvTable title="By shot type" keys={SHOT_KEYS} names={SHOT_NAME} table={g.type} league={league.goalie.type} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SvTable({ title, keys, names, table, league }: { title: string; keys: string[]; names: Record<string, string>; table: Partial<Record<string, SG>>; league: Partial<Record<string, SG>> }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.12em] text-[#94A3B8] uppercase">{title}</p>
      <table className="mt-1 w-full text-xs">
        <tbody>
          {keys
            .filter((k) => (table[k]?.[0] ?? 0) >= 3)
            .map((k) => {
              const lsv = leagueSvOf(league, k);
              const sv = shrunkSv(table[k], lsv, 30);
              const d = (sv - lsv) * 100;
              return (
                <tr key={k} className="border-t border-[#262B36]">
                  <td className="py-1">{names[k] ?? k}</td>
                  <td className="py-1 text-right text-[#94A3B8] tabular-nums">{Math.round(table[k]![0])} shots</td>
                  <td className="py-1 text-right tabular-nums">{(1 - table[k]![1] / table[k]![0]).toFixed(3).replace(/^0/, "")}</td>
                  <td className={`w-14 py-1 text-right font-semibold tabular-nums ${d >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{signed(d, 1)}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ Line chemistry

function Chemistry({ lines, pairs, hrefs }: { lines: HubUnit[]; pairs: HubUnit[]; hrefs: Record<number, string> }) {
  const [team, setTeam] = useState("ALL");
  const teamsList = [...new Set([...lines, ...pairs].map((u) => u.team))].sort();
  const f = (rows: HubUnit[]) => rows.filter((r) => team === "ALL" || r.team === team);
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-[#94A3B8]">
        Team
        <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-2.5 py-1.5 text-sm text-[#F8FAFC]">
          <option value="ALL">All teams</option>
          {teamsList.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <UnitTable title="Top 5v5 forward lines" rows={f(lines)} hrefs={hrefs} />
        <UnitTable title="Top 5v5 defense pairs" rows={f(pairs)} hrefs={hrefs} />
      </div>
      <p className="mt-3 text-xs text-[#94A3B8]">
        WOWY chemistry = the unit&apos;s 5-on-5 shot-attempt share (Corsi %) together minus each member&apos;s share without the others, shrunk for small samples. Built from NHL shift charts;
        only units whose players are still teammates are listed.
      </p>
    </div>
  );
}

export function UnitTable({ title, rows, hrefs }: { title: string; rows: HubUnit[]; hrefs: Record<number, string> }) {
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
      <p className="display text-lg font-bold">{title}</p>
      {rows.length ? (
        <table className="mt-2 w-full text-xs">
          <thead className="text-[10px] tracking-[0.1em] text-[#94A3B8] uppercase">
            <tr>
              <th className="py-1 text-left font-semibold">Unit</th>
              <th className="py-1 text-right font-semibold">TOI</th>
              <th className="py-1 text-right font-semibold">CF%</th>
              <th className="py-1 text-right font-semibold">GF-GA</th>
              <th className="py-1 text-right font-semibold">Chem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={`${u.team}-${u.ids.join("-")}`} className="border-t border-[#262B36] align-top">
                <td className="py-1.5">
                  <span className="flex items-start gap-1.5">
                    <TeamLogo abbr={u.team} className="mt-0.5 h-4 w-5 shrink-0" />
                    <span>
                      {u.names.map((n, i) => (
                        <span key={u.ids[i]}>
                          {i ? " · " : ""}
                          {hrefs[u.ids[i]] ? (
                            <Link href={hrefs[u.ids[i]]} className="hover:text-[#38BDF8]">
                              {n}
                            </Link>
                          ) : (
                            n
                          )}
                        </span>
                      ))}
                    </span>
                  </span>
                </td>
                <td className="py-1.5 text-right text-[#94A3B8] tabular-nums">{Math.round(u.toi)}m</td>
                <td className="py-1.5 text-right tabular-nums">{u.cf.toFixed(1)}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {Math.round(u.goals[0])}-{Math.round(u.goals[1])}
                </td>
                <td className={`py-1.5 text-right font-semibold tabular-nums ${u.delta >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{signed(u.delta, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-[#94A3B8]">No units with enough ice time yet.</p>
      )}
    </div>
  );
}
