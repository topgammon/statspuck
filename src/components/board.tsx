"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShareLauncher } from "@/components/share-modal";
import { TeamLogo, TeamName } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import { InfoTip } from "@/components/info-tip";
import { DRAFT_SCORE_TIP, letterRank, scoreClass, signed } from "@/lib/format";
import { gradeEras, gradeTeams, heroSet, type GmGrade, type RoundFilter } from "@/lib/grade";
import type { Era, PickRow, TeamGrade, TeamInfo } from "@/lib/types";
import { gmHref, playerHref, teamHref } from "@/lib/routes";
import { draftRaterBase } from "@/lib/site";

type SortKey = "rank" | "name" | "letter" | "avg" | "n" | "developing" | "years";
type GroupId = "ALL" | "F" | "D" | "G";
type View = "cards" | "table";
type BoardTab = "teams" | "gms";
type GmScope = "current" | "all";

const groups: { id: GroupId; label: string }[] = [
  { id: "ALL", label: "All positions" },
  { id: "F", label: "Forwards" },
  { id: "D", label: "Defense" },
  { id: "G", label: "Goalies" },
];

const rounds: { id: RoundFilter; label: string }[] = [
  { id: "all", label: "All rounds" },
  { id: "1", label: "Round 1" },
  { id: "23", label: "Rounds 2–3" },
  { id: "47", label: "Rounds 4–7" },
];

export function Board({
  picks,
  teams,
  eras,
  official,
  firstYear,
  latestYear,
}: {
  picks: PickRow[];
  teams: TeamInfo[];
  eras: Era[];
  official: TeamGrade[];
  firstYear: number;
  latestYear: number;
}) {
  const [minYear, setMinYear] = useState(firstYear);
  const [maxYear, setMaxYear] = useState(latestYear);
  const [group, setGroup] = useState<GroupId>("ALL");
  const [round, setRound] = useState<RoundFilter>("all");
  const [tab, setTab] = useState<BoardTab>("teams");
  const [gmScope, setGmScope] = useState<GmScope>("current");
  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDesc, setSortDesc] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const filter = useMemo(
    () => ({ minYear, maxYear, group, round }),
    [minYear, maxYear, group, round],
  );
  const isDefault = minYear === firstYear && maxYear === latestYear && group === "ALL" && round === "all";
  const heroes = useMemo(() => heroSet(picks, teams, filter), [picks, teams, filter]);
  const teamRows = useMemo(() => {
    if (isDefault) return official;
    return gradeTeams(picks, teams, filter);
  }, [isDefault, official, picks, teams, filter]);
  const gmRows = useMemo(() => {
    const source = gmScope === "current" ? eras.filter((era) => era.endYear == null) : eras;
    return gradeEras(picks, source, filter, 15);
  }, [picks, eras, filter, gmScope]);

  const years = [];
  for (let year = firstYear; year <= latestYear; year += 1) years.push(year);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = Number(params.get("from"));
    const through = Number(params.get("through"));
    const pos = params.get("pos");
    const roundParam = params.get("round");
    const tabParam = params.get("tab");
    const viewParam = params.get("view");
    const gmParam = params.get("gms");
    if (from >= firstYear && from <= latestYear) setMinYear(from);
    if (through >= firstYear && through <= latestYear) setMaxYear(through);
    if (pos === "ALL" || pos === "F" || pos === "D" || pos === "G") setGroup(pos);
    if (roundParam === "all" || roundParam === "1" || roundParam === "23" || roundParam === "47") setRound(roundParam);
    if (tabParam === "teams" || tabParam === "gms") setTab(tabParam);
    if (viewParam === "cards" || viewParam === "table") setView(viewParam);
    if (gmParam === "current" || gmParam === "all") setGmScope(gmParam);
    setHydrated(true);
  }, [firstYear, latestYear]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();
    params.set("from", String(minYear));
    params.set("through", String(maxYear));
    params.set("pos", group);
    params.set("round", round);
    params.set("tab", tab);
    params.set("view", view);
    if (tab === "gms") params.set("gms", gmScope);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [hydrated, minYear, maxYear, group, round, tab, view, gmScope]);

  function toggle(key: SortKey) {
    if (sortKey === key) setSortDesc((value) => !value);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (needle.length < 2) return [];
    const ranked = picks
      .filter((pick) => !pick.forfeited && pick.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aStart = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStart = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStart - bStart || a.name.localeCompare(b.name);
      });
    return ranked.slice(0, 8);
  }, [picks, needle]);

  const officialRank = new Map(official.map((team) => [team.abbr, team.rank]));
  const rankedTeams = teamRows.map((team, index) => ({
    team,
    rank: isDefault && "rank" in team ? (officialRank.get(team.abbr) ?? index + 1) : index + 1,
  }));
  const sortedTeams = [...rankedTeams].sort((a, b) => compareRows(sortKey, sortDesc, a.rank, b.rank, teamValue(a.team, sortKey), teamValue(b.team, sortKey), a.team.name, b.team.name));
  const sortedGms = gmRows
    .map((gm, index) => ({ gm, rank: index + 1 }))
    .sort((a, b) => compareRows(sortKey === "developing" ? "n" : sortKey, sortDesc, a.rank, b.rank, gmValue(a.gm, sortKey), gmValue(b.gm, sortKey), a.gm.person, b.gm.person));

  return (
    <section className="mt-8">
      <div className="mb-4 flex justify-end">
        <ShareLauncher
          fileSlug={tab === "gms" ? "gm-board" : "draft-board"}
          title="Draft board"
          summary={`Who actually wins the NHL draft? ${minYear}–${maxYear}.`}
          path={draftRaterBase}
          search={boardSearch({ minYear, maxYear, group, round, tab, view, gmScope })}
          card={{
            kind: "board",
            mode: tab === "gms" ? "GMs" : "Teams",
            subtitle: `${minYear}–${maxYear} · ${groups.find((item) => item.id === group)?.label ?? "All positions"} · ${rounds.find((item) => item.id === round)?.label ?? "All rounds"}`,
            rows:
              tab === "gms"
                ? sortedGms.slice(0, 10).map(({ gm, rank }) => ({ rank, name: gm.person, letter: gm.letter, score: gm.avg, color: gm.color }))
                : sortedTeams.slice(0, 10).map(({ team, rank }) => ({ rank, name: team.name, abbr: team.abbr, letter: team.letter, score: team.avg, color: team.color })),
          }}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ClassCard row={heroes.bestClass} />
        <PickCard title="Biggest bust" pick={heroes.bust} empty="No graduated first-round picks in this view" />
        <GemCard row={heroes.gems} />
        <BustRateCard row={heroes.bustRate} />
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="relative min-w-0 text-xs text-zinc-400 lg:min-w-72 lg:flex-1">
            Player search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a player"
              className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
            {matches.length > 0 ? (
              <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-white/10 bg-[#0B0D10] py-1 shadow-lg">
                {matches.map((pick) => (
                  <li key={pick.id}>
                    <Link href={playerHref(pick.id, "draft")} className="block px-3 py-2 hover:bg-white/[0.06]" onMouseDown={(event) => event.preventDefault()}>
                      <span className="font-medium text-zinc-100">{pick.name}</span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {pick.year} · {pick.franchise} · #{pick.overall}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <label className="text-xs text-zinc-400">
            From
            <select className="mt-1 block rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white" value={minYear} onChange={(event) => setMinYear(Number(event.target.value))}>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Through
            <select className="mt-1 block rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white" value={maxYear} onChange={(event) => setMaxYear(Number(event.target.value))}>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Position
            <select className="mt-1 block rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2 text-sm text-white" value={group} onChange={(event) => setGroup(event.target.value as GroupId)}>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {rounds.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRound(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs tracking-wide uppercase ${round === item.id ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-zinc-400 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {!isDefault ? (
        <p className="mt-3 text-sm text-zinc-400">
          The cards and the board follow this filter. Prospects under 25 Impact stay out of the average. A team’s grade is the plain average of its graduated picks, with a #1 overall hit capped at +250.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segment
          value={tab}
          options={[
            { id: "teams", label: "Teams" },
            { id: "gms", label: "GMs" },
          ]}
          onChange={(value) => setTab(value as BoardTab)}
        />
        <Segment
          value={view}
          options={[
            { id: "cards", label: "Cards" },
            { id: "table", label: "Table" },
          ]}
          onChange={(value) => setView(value as View)}
        />
      </div>
      {tab === "gms" ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">
            {gmScope === "current"
              ? "Current general managers with at least 15 graded picks."
              : "Every general manager since 2005 with at least 15 graded picks."}
          </p>
          <Segment
            value={gmScope}
            options={[
              { id: "current", label: "Current" },
              { id: "all", label: "All-time" },
            ]}
            onChange={(value) => setGmScope(value as GmScope)}
          />
        </div>
      ) : null}

      {tab === "teams" ? (
        view === "cards" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedTeams.map(({ team, rank }) => (
              <Link key={team.abbr} href={teamHref(team.abbr, "draft")} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">#{rank}</p>
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <TeamLogo abbr={team.abbr} name={team.name} />
                      {team.name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500" title={DRAFT_SCORE_TIP}>
                      Draft Score <span className={`font-semibold ${scoreClass(team.avg)}`}>{signed(team.avg)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="display text-4xl leading-none font-bold" style={{ color: team.color }}>
                      {team.letter}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{team.rating}/100</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {team.n} graded
                  {team.developing > 0 ? ` · ${team.developing} ${team.developing === 1 ? "prospect" : "prospects"}` : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <table className="sheet w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs tracking-wide text-zinc-500">
                <tr>
                  <SortHeader label="#" sortKey="rank" active={sortKey} desc={sortDesc} onClick={toggle} />
                  <SortHeader label="Team" sortKey="name" active={sortKey} desc={sortDesc} onClick={toggle} />
                  <SortHeader label="Grade" sortKey="letter" active={sortKey} desc={sortDesc} onClick={toggle} />
                  <SortHeader label="Draft Score" sortKey="avg" active={sortKey} desc={sortDesc} onClick={toggle} tip={DRAFT_SCORE_TIP} />
                  <SortHeader label="Graded" sortKey="n" active={sortKey} desc={sortDesc} onClick={toggle} />
                  <SortHeader label="Prospect" sortKey="developing" active={sortKey} desc={sortDesc} onClick={toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map(({ team, rank }) => (
                  <tr key={team.abbr}>
                    <td className="border-t border-white/10 px-3 py-3 text-zinc-500">{rank}</td>
                    <td className="border-t border-white/10 px-3 py-3">
                      <Link href={teamHref(team.abbr, "draft")} className="flex items-center gap-3 font-medium hover:text-white">
                        <TeamLogo abbr={team.abbr} name={team.name} />
                        {team.name}
                      </Link>
                    </td>
                    <td className="border-t border-white/10 px-3 py-3">
                      <span className="display text-2xl font-bold" style={{ color: team.color }}>
                        {team.letter}
                      </span>
                      <span className="ml-2 text-zinc-500">{team.rating}</span>
                    </td>
                    <td className={`border-t border-white/10 px-3 py-3 font-medium ${scoreClass(team.avg)}`}>{signed(team.avg)}</td>
                    <td className="border-t border-white/10 px-3 py-3 text-zinc-300">{team.n}</td>
                    <td className="border-t border-white/10 px-3 py-3 text-zinc-400">{team.developing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : sortedGms.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No general manager in this view has 15 graded picks.</p>
      ) : view === "cards" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedGms.map(({ gm, rank }) => (
            <Link key={gm.slug} href={gmHref(gm.slug, "draft")} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" style={{ borderLeftColor: gm.color, borderLeftWidth: 4 }}>
              <p className="text-xs text-zinc-500">#{rank}</p>
              <h3 className="mt-1 text-lg font-semibold">{gm.person}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                <TeamName abbr={gm.team} name={gm.teamName} logoClassName="h-5 w-8" /> · {gm.startYear}–{gm.endYear ?? "now"}
              </p>
              <p className="mt-2 text-sm text-zinc-500" title={DRAFT_SCORE_TIP}>
                Draft Score <span className={`font-semibold ${scoreClass(gm.avg)}`}>{signed(gm.avg)}</span>
              </p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-xs text-zinc-500">{gm.n} graded</p>
                <p className="display text-4xl leading-none font-bold" style={{ color: gm.color }}>
                  {gm.letter}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <table className="sheet w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="text-xs tracking-wide text-zinc-500">
              <tr>
                <SortHeader label="#" sortKey="rank" active={sortKey} desc={sortDesc} onClick={toggle} />
                <SortHeader label="GM" sortKey="name" active={sortKey} desc={sortDesc} onClick={toggle} />
                <SortHeader label="Years" sortKey="years" active={sortKey} desc={sortDesc} onClick={toggle} />
                <SortHeader label="Grade" sortKey="letter" active={sortKey} desc={sortDesc} onClick={toggle} />
                <SortHeader label="Draft Score" sortKey="avg" active={sortKey} desc={sortDesc} onClick={toggle} tip={DRAFT_SCORE_TIP} />
                <SortHeader label="Graded" sortKey="n" active={sortKey} desc={sortDesc} onClick={toggle} />
              </tr>
            </thead>
            <tbody>
              {sortedGms.map(({ gm, rank }) => (
                <tr key={gm.slug}>
                  <td className="border-t border-white/10 px-3 py-3 text-zinc-500">{rank}</td>
                  <td className="border-t border-white/10 px-3 py-3">
                    <Link href={gmHref(gm.slug, "draft")} className="font-medium hover:text-white">
                      {gm.person}
                    </Link>
                  </td>
                  <td className="border-t border-white/10 px-3 py-3 text-zinc-300">
                    {gm.team} · {gm.startYear}–{gm.endYear ?? "now"}
                  </td>
                  <td className="border-t border-white/10 px-3 py-3">
                    <span className="display text-2xl font-bold" style={{ color: gm.color }}>
                      {gm.letter}
                    </span>
                  </td>
                  <td className={`border-t border-white/10 px-3 py-3 font-medium ${scoreClass(gm.avg)}`}>{signed(gm.avg)}</td>
                  <td className="border-t border-white/10 px-3 py-3 text-zinc-300">{gm.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClassCard({ row }: { row: ReturnType<typeof heroSet>["bestClass"] }) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Best draft class</p>
        <p className="mt-2 text-lg text-zinc-400">None in this view</p>
      </div>
    );
  }
  return (
    <Link href={`/draft-rater/drafts/${row.year}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">Best draft class</p>
      <p className="mt-2 text-lg font-semibold">
        <TeamName abbr={row.franchise} name={row.franchiseName} /> {row.year}
      </p>
      <p className={`display mt-1 text-3xl font-bold ${scoreClass(row.avg)}`}>{signed(row.avg)}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {row.letter} · {row.n} graded picks, average vs the slot
      </p>
    </Link>
  );
}

function GemCard({ row }: { row: ReturnType<typeof heroSet>["gems"] }) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Most gems drafted</p>
        <p className="mt-2 text-lg text-zinc-400">None in this view</p>
      </div>
    );
  }
  return (
    <Link href={teamHref(row.franchise, "draft")} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">Most gems drafted</p>
      <p className="mt-2 text-lg font-semibold">
        <TeamName abbr={row.franchise} name={row.franchiseName} />
      </p>
      <p className="display mt-1 text-3xl font-bold text-[#3ddc97]">{row.count}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {(row.rate * 100).toFixed(1)}% gem rate · {row.count} of {row.evaluated}
      </p>
    </Link>
  );
}

function BustRateCard({ row }: { row: ReturnType<typeof heroSet>["bustRate"] }) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Highest bust rate</p>
        <p className="mt-2 text-lg text-zinc-400">Need 5 evaluated first-round picks</p>
      </div>
    );
  }
  return (
    <Link href={teamHref(row.franchise, "draft")} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">Highest bust rate</p>
      <p className="mt-2 text-lg font-semibold">
        <TeamName abbr={row.franchise} name={row.franchiseName} />
      </p>
      <p className="display mt-1 text-3xl font-bold text-[#ff4d4d]">{Math.round(row.rate * 100)}%</p>
      <p className="mt-1 text-sm text-zinc-500">
        {row.count} of {row.n} busts
      </p>
    </Link>
  );
}

function boardSearch(input: { minYear: number; maxYear: number; group: string; round: string; tab: string; view: string; gmScope: string }): string {
  const params = new URLSearchParams();
  params.set("from", String(input.minYear));
  params.set("through", String(input.maxYear));
  params.set("pos", input.group);
  params.set("round", input.round);
  params.set("tab", input.tab);
  params.set("view", input.view);
  if (input.tab === "gms") params.set("gms", input.gmScope);
  return `?${params.toString()}`;
}

function PickCard({ title, pick, empty }: { title: string; pick: PickRow | null; empty: string }) {
  if (!pick) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
        <p className="mt-2 text-lg text-zinc-400">{empty}</p>
      </div>
    );
  }
  return (
    <Link href={playerHref(pick.id, "draft")} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{title}</p>
      <p className="mt-2 text-lg font-semibold">{pick.name}</p>
      <p className={`display mt-1 text-3xl font-bold ${scoreClass(pick.score)}`}>{signed(pick.score)}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {pick.year} · #{pick.overall} · <TeamName abbr={pick.franchise} name={pick.franchiseName} logoClassName="h-5 w-8" />
      </p>
    </Link>
  );
}

function Segment({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return <TogglePill value={value} options={options} onChange={onChange} />;
}

function SortHeader({ label, sortKey, active, desc, onClick, tip }: { label: string; sortKey: SortKey; active: SortKey; desc: boolean; onClick: (key: SortKey) => void; tip?: string }) {
  const on = active === sortKey;
  return (
    <th className="px-3 py-3 font-medium">
      <span className="inline-flex items-center gap-1.5">
        <button type="button" className="hover:text-white" onClick={() => onClick(sortKey)}>
          {label}
          {on ? (desc ? " ↓" : " ↑") : ""}
        </button>
        {tip ? <InfoTip text={tip} /> : null}
      </span>
    </th>
  );
}

function teamValue(team: { name: string; letter: string; avg: number; n: number; developing: number }, key: SortKey): string | number | null {
  if (key === "name") return team.name;
  if (key === "letter") return letterRank(team.letter);
  if (key === "avg") return team.avg;
  if (key === "n") return team.n;
  if (key === "developing") return team.developing;
  if (key === "years") return team.name;
  return null;
}

function gmValue(gm: GmGrade, key: SortKey): string | number | null {
  if (key === "name") return gm.person;
  if (key === "letter") return letterRank(gm.letter);
  if (key === "avg") return gm.avg;
  if (key === "n" || key === "developing") return gm.n;
  if (key === "years") return gm.startYear;
  return null;
}

function compareRows(key: SortKey, desc: boolean, rankA: number, rankB: number, valueA: string | number | null, valueB: string | number | null, nameA: string, nameB: string): number {
  const direction = desc ? -1 : 1;
  if (key === "rank") return (rankA - rankB) * direction;
  if (valueA == null && valueB == null) return nameA.localeCompare(nameB);
  if (valueA == null) return 1;
  if (valueB == null) return -1;
  if (typeof valueA === "string" && typeof valueB === "string") return valueA.localeCompare(valueB) * direction;
  return (Number(valueA) - Number(valueB)) * direction;
}
