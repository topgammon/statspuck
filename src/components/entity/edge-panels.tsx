/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CHANCE_KEYS, CHANCE_NAME, goalieZoneValues, perGame, shareOf, SHOT_KEYS, SHOT_NAME, signed, ZONE_KEYS, ZONE_NAME, type SG } from "@/components/game-edge/edge-math";
import { SeasonViews, SvTable, UnitTable } from "@/components/game-edge/game-edge-hub";
import { InfoTip } from "@/components/info-tip";
import { HalfRinkShots, HalfRinkZones } from "@/components/rink";
import { edgeCurrentSeason, goalieEdge, leagueEdgeFor, leagueGoalieFor, playerEdge, playerIdHref, teamEdge, type EdgeView, type RefSplit } from "@/lib/game-edge";

// Live Game Edge tabs for team and player profiles (replace the old Coming Soon mockups).


function Card({ title, tip, children, action }: { title: string; tip?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="display flex items-center gap-2 text-xl font-bold">
          {title} {tip ? <InfoTip text={tip} /> : null}
        </h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function RefSplitsCard({ best, worst, subject }: { best: RefSplit[]; worst: RefSplit[]; subject: string }) {
  const row = (r: RefSplit, tone: string) => (
    <li key={r.slug}>
      <Link href={`/ref-watch/${r.slug}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-white/[0.04]">
        <span className="flex-1 truncate font-semibold">{r.name}</span>
        <span className="text-[11px] text-[#94A3B8]">{r.games} GP</span>
        <span className="w-14 text-right font-semibold tabular-nums" style={{ color: tone }}>
          {signed(r.delta, 2)}
        </span>
      </Link>
    </li>
  );
  return (
    <Card
      title="Ref Watch splits"
      tip={`Net power-play differential per game (drawn minus taken) for ${subject} under each active referee, vs ${subject}'s usual. Shrunk for small samples.`}
      action={
        <Link href="/ref-watch" className="text-xs font-semibold text-[#38BDF8] hover:underline">
          Ref Watch →
        </Link>
      }
    >
      {best.length || worst.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Fares best under</p>
            <ul className="mt-1">{best.map((r) => row(r, "#10B981"))}</ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Fares worst under</p>
            <ul className="mt-1">{worst.map((r) => row(r, "#EF4444"))}</ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#94A3B8]">Not enough games under any one referee yet.</p>
      )}
    </Card>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; compare?: number; note?: string; tone?: string }[] }) {
  const max = Math.max(0.01, ...rows.map((r) => Math.max(r.value, r.compare ?? 0)));
  return (
    <ul className="grid gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs">
          <span className="truncate text-[#94A3B8]">{r.label}</span>
          <span className="relative h-2.5 rounded-full bg-[#0B0D10]">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.tone ?? "#38BDF8" }} />
            {r.compare != null ? <span className="absolute -inset-y-0.5 w-0.5 bg-[#F8FAFC]/70" style={{ left: `${(r.compare / max) * 100}%` }} title="League average" /> : null}
          </span>
          <span className="text-right font-semibold tabular-nums">{r.note ?? `${(r.value * 100).toFixed(0)}%`}</span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ Team

const SEASON_LABEL = `${edgeCurrentSeason}-${String(edgeCurrentSeason + 1).slice(2)}`;

/** Team Game Edge tab: this season by default, with a switch to add last season. */
export function TeamGameEdge({ abbr, name }: { abbr: string; name: string }) {
  return <SeasonViews season={SEASON_LABEL} current={<TeamEdgeView abbr={abbr} name={name} view="season" />} two={<TeamEdgeView abbr={abbr} name={name} view="two" />} />;
}

function TeamEdgeView({ abbr, name, view }: { abbr: string; name: string; view: EdgeView }) {
  const t = teamEdge(abbr, view);
  const leagueEdge = leagueEdgeFor(view);
  const leagueGoalie = leagueGoalieFor(view);
  if (!t) return <p className="text-sm text-[#94A3B8]">No play-by-play sample for {name} yet.</p>;
  const hrefs = (ids: number[]) => Object.fromEntries(ids.map((id) => [id, playerIdHref(id, "game-edge")]).filter((e): e is [number, string] => Boolean(e[1])));
  const unitIds = [...t.lines, ...t.pairs].flatMap((u) => u.ids);
  const goalies = t.goalies.map((id) => goalieEdge(id, view)).filter((g) => Boolean(g)).slice(0, 2);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#94A3B8]">
          {t.games} games this season{view === "two" ? " + last season" : ""} ·{" "}
          <Link href="/game-edge" className="font-semibold text-[#38BDF8] hover:underline">
            Build a pregame matchup report →
          </Link>
        </p>
        <p className="text-xs text-[#94A3B8]">
          PP {t.ppPct != null ? (t.ppPct * 100).toFixed(1) : "—"}% · PK {t.pkPct != null ? (t.pkPct * 100).toFixed(1) : "—"}% · takes {t.taken.toFixed(2)} / draws {t.drawn.toFixed(2)} penalties a game
        </p>
      </div>
      <Card title="Offensive vs defensive goal-type profile" tip="Goals per game by chance type: scored (blue) and allowed (red). The white tick is the league average per team.">
        <div className="grid gap-5 md:grid-cols-2">
          {(
            [
              ["Goals for", t.for, "#38BDF8"],
              ["Goals against", t.against, "#E11D48"],
            ] as const
          ).map(([label, table, tone]) => (
            <div key={label}>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{label} per game</p>
              <Bars
                rows={CHANCE_KEYS.map((k) => {
                  const v = perGame(table as Partial<Record<string, SG>>, k, t.weightGames);
                  return { label: CHANCE_NAME[k], value: v, compare: perGame(leagueEdge.for, k, leagueEdge.teamGames), note: v.toFixed(2), tone };
                })}
              />
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <UnitTable title="Top 5v5 lines (by ice time)" rows={t.lines} hrefs={hrefs(unitIds)} />
        <UnitTable title="Top 5v5 D-pairs" rows={t.pairs} hrefs={hrefs(unitIds)} />
      </div>
      <Card title="Goalie tandem tendencies" tip="Save % by ice zone vs league (shrunk for small samples). Green = better than league.">
        {goalies.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {goalies.map((g, i) => (
              <div key={g!.id}>
                <p className="text-sm font-semibold">
                  <span className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{i === 0 ? "Starter" : "Backup"} · </span>
                  {playerIdHref(g!.id) ? (
                    <Link href={playerIdHref(g!.id, "game-edge")!} className="hover:text-[#38BDF8]">
                      {g!.name}
                    </Link>
                  ) : (
                    g!.name
                  )}{" "}
                  <span className="text-xs text-[#94A3B8]">SV {g!.sv?.toFixed(3).replace(/^0/, "")}</span>
                </p>
                <div className="mx-auto mt-2 max-w-[16rem]">
                  <HalfRinkZones values={goalieZoneValues(g!, leagueGoalie)} label={`${g!.name} save % by zone`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">No goalie sample yet.</p>
        )}
      </Card>
      <RefSplitsCard best={t.refs.best} worst={t.refs.worst} subject={name} />
    </div>
  );
}

// ------------------------------------------------------------------ Player

/** Player Game Edge tab: this season by default, with a switch to add last season. */
export function PlayerGameEdge({ playerId, name, goalie }: { playerId: number | null; name: string; goalie: boolean }) {
  if (playerId == null) return <p className="text-sm text-[#94A3B8]">No NHL play-by-play for {name}.</p>;
  return (
    <SeasonViews
      season={SEASON_LABEL}
      current={<PlayerEdgeView playerId={playerId} name={name} goalie={goalie} view="season" />}
      two={<PlayerEdgeView playerId={playerId} name={name} goalie={goalie} view="two" />}
    />
  );
}

function PlayerEdgeView({ playerId, name, goalie, view }: { playerId: number; name: string; goalie: boolean; view: EdgeView }) {
  const leagueGoalie = leagueGoalieFor(view);
  const span = view === "two" ? "this season or last" : "this season";
  if (goalie) {
    const g = goalieEdge(playerId, view);
    if (!g) return <p className="text-sm text-[#94A3B8]">Not enough shots faced {span} for a goalie tendency map yet.</p>;
    const zones = goalieZoneValues(g, leagueGoalie);
    const weakest = ZONE_KEYS.filter((z) => zones[z].delta != null).sort((a, b) => (zones[a].delta ?? 0) - (zones[b].delta ?? 0))[0];
    return (
      <div className="grid gap-5">
        <Card title="Goalie tendency map" tip="Save % by ice zone vs league, shrunk for small samples.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="mx-auto w-full max-w-xs">
              <HalfRinkZones values={zones} label={`${name} save % by zone`} />
              {weakest ? (
                <p className="mt-2 text-xs text-[#94A3B8]">
                  Weak spot: <b className="text-[#EF4444]">{ZONE_NAME[weakest]}</b> ({zones[weakest].text}% vs league).
                </p>
              ) : null}
            </div>
            <div className="grid gap-4">
              <SvTable title="By chance type" keys={CHANCE_KEYS} names={CHANCE_NAME} table={g.chance} league={leagueGoalie.chance} />
              <SvTable title="By shot type" keys={SHOT_KEYS} names={SHOT_NAME} table={g.type} league={leagueGoalie.type} />
            </div>
          </div>
        </Card>
      </div>
    );
  }
  const p = playerEdge(playerId, view);
  if (!p) return <p className="text-sm text-[#94A3B8]">Not enough NHL shots or 5-on-5 ice time {span} for Game Edge yet.</p>;
  const shotRows = [...SHOT_KEYS.filter((k) => (p.type[k]?.[0] ?? 0) > 0)];
  const rebound = p.chance.rebound;
  const typeTotal = Object.values(p.type).reduce((s, v) => s + v[0], 0) || 1;
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Shot & goal heatmap" tip="Every unblocked shot in the offensive zone (blue = volume, red dots = goals). ">
          <div className="mx-auto max-w-sm">
            <HalfRinkShots cells={p.cells} label={`${name} shot heatmap`} />
          </div>
          <p className="mt-2 text-xs text-[#94A3B8]">
            {Math.round(p.shots)} shots on goal · {Math.round(p.goals)} goals · net on the right
          </p>
        </Card>
        <Card title="Shot-type breakdown" tip="Share of his shots on goal by official NHL shot type, plus rebounds (shots within 2.5 s of a save).">
          <Bars
            rows={[
              ...shotRows.map((k) => ({
                label: SHOT_NAME[k],
                value: p.type[k][0] / typeTotal,
                note: `${((p.type[k][0] / typeTotal) * 100).toFixed(0)}% · ${p.type[k][0] ? ((100 * p.type[k][1]) / p.type[k][0]).toFixed(0) : 0}% sh`,
              })),
              ...(rebound ? [{ label: "Rebounds", value: rebound[0] / typeTotal, tone: "#8B5CF6", note: `${((rebound[0] / typeTotal) * 100).toFixed(0)}% · ${rebound[0] ? ((100 * rebound[1]) / rebound[0]).toFixed(0) : 0}% sh` }] : []),
            ]}
          />
          <p className="mt-3 text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Goals by chance type</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CHANCE_KEYS.filter((k) => (p.chance[k]?.[1] ?? 0) >= 0.5).map((k) => (
              <span key={k} className="rounded-full border border-[#262B36] px-2 py-0.5 text-[11px]">
                {CHANCE_NAME[k]} {(shareOf(p.chance, k) * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </Card>
      </div>
      <Card
        title="Top linemates by WOWY chemistry"
        tip="5-on-5 shot-attempt share (CF%) together, and how much better it is than each player apart (With Or Without You), shrunk for small samples. 40+ minutes together."
        action={<span className="text-xs text-[#94A3B8]">Chemistry lift {signed(p.lift, 1)} CF% · 5v5 CF% {p.cf5?.toFixed(1) ?? "—"}</span>}
      >
        {p.mates.length ? (
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-[0.1em] text-[#94A3B8] uppercase">
              <tr>
                <th className="py-1 text-left font-semibold">Linemate</th>
                <th className="py-1 text-right font-semibold">TOI together</th>
                <th className="py-1 text-right font-semibold">CF% together</th>
                <th className="py-1 text-right font-semibold">WOWY</th>
              </tr>
            </thead>
            <tbody>
              {p.mates.map((m) => {
                const href = playerIdHref(m.id, "game-edge");
                return (
                  <tr key={m.id} className="border-t border-[#262B36]">
                    <td className="py-1.5">
                      {href ? (
                        <Link href={href} className="font-semibold hover:text-[#38BDF8]">
                          {m.name}
                        </Link>
                      ) : (
                        m.name
                      )}
                    </td>
                    <td className="py-1.5 text-right text-[#94A3B8] tabular-nums">{Math.round(m.toi)} min</td>
                    <td className="py-1.5 text-right tabular-nums">{m.cf.toFixed(1)}</td>
                    <td className={`py-1.5 text-right font-semibold tabular-nums ${m.delta >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{signed(m.delta, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[#94A3B8]">Not enough 5-on-5 time with any one linemate yet.</p>
        )}
      </Card>
      <RefSplitsCard best={p.refs.best} worst={p.refs.worst} subject={name} />
    </div>
  );
}
