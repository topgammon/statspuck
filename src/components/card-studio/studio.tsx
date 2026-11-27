"use client";

import { domToBlob } from "modern-screenshot";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CompareCard, DraftCard, FORMATS, RankCard, ScoutCard, TeamCompareCard, TradeCard, type RankRow, type StudioFormat } from "@/components/card-studio/cards";
import { hexA, luminance } from "@/components/share-cards";
import { TeamLogo } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import type { StudioData, StudioPlayer, StudioTeam } from "@/lib/card-studio-data";
import { computeTrade, decodeTrade, encodeTrade, indexTrade, pickKey, pickRating, playerRating, type TradeItem } from "@/lib/trade-calc";
import type { TradeData } from "@/lib/trade-data";
import { publicPath } from "@/lib/site";

// Card Studio: pick a template, choose who is on it, pick a size and accent, export a PNG.
// All numbers come from /card-studio/players.json (and trade.json for trades), built with the site.

type Template = "compare" | "scout" | "trade" | "top5" | "draft";
type AccentId = "crimson" | "cyan" | "team";
type PresetId = "skill" | "impact" | "contract" | "steals" | "asset";

const TEMPLATES: { id: Template; label: string; blurb: string }[] = [
  { id: "compare", label: "Head-to-Head", blurb: "Two players or two teams" },
  { id: "scout", label: "Scouting Card", blurb: "One player, every number" },
  { id: "trade", label: "Trade Proposal", blurb: "Both sides + verdict" },
  { id: "top5", label: "Top-5 Ranking", blurb: "Your title, your list" },
  { id: "draft", label: "Redraft Spotlight", blurb: "Any draft class" },
];

const ACCENTS: { id: AccentId; label: string; color?: string }[] = [
  { id: "crimson", label: "StatsPuck Crimson", color: "#E11D48" },
  { id: "cyan", label: "Ice Cyan", color: "#38BDF8" },
  { id: "team", label: "Primary Team Color" },
];

const PRESETS: Record<PresetId, { label: string; title: string; get: (p: StudioPlayer) => number | null; fmt: (v: number) => string; sub?: (p: StudioPlayer) => string; color?: (v: number) => string }> = {
  skill: { label: "Overall Skill", title: "Top 5 Players by Overall Skill", get: (p) => (p.active ? p.sk : null), fmt: (v) => String(v), color: (v) => (v >= 90 ? "#F59E0B" : v >= 80 ? "#10B981" : "#38BDF8") },
  impact: { label: "Career Impact", title: "Top 5 by Career Impact", get: (p) => p.qg, fmt: (v) => v.toLocaleString("en-US"), sub: (p) => `${p.pos} · ${p.gp.toLocaleString("en-US")} GP` },
  contract: {
    label: "Best Contract Value",
    title: "Top 5 Bargain Contracts in the NHL",
    get: (p) => (p.active && !p.elc ? p.ipc : null),
    fmt: (v) => v.toFixed(1),
    sub: (p) => `${p.pos} · $${((p.aav ?? 0) / 1_000_000).toFixed(2)}M · ${p.cap?.toFixed(1)}% Cap`,
    color: () => "#10B981",
  },
  steals: { label: "Top Draft Steals", title: "Top 5 Draft Steals Since 2005", get: (p) => (p.st.includes("STEAL") && p.dr?.s != null ? p.dr.s : null), fmt: (v) => `+${v}`, sub: (p) => `${p.dr?.y} · Pick #${p.dr?.o} · ${p.dr?.tm}`, color: () => "#10B981" },
  asset: { label: "Highest Asset Value", title: "Top 5 Trade Assets in the NHL", get: (p) => (p.active ? p.av : null), fmt: (v) => String(v), color: (v) => (v >= 70 ? "#F59E0B" : "#10B981") },
};

/** Lighten very dark team colors so they still read as an accent on the black card. */
function liftColor(color: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
  for (let step = 0; step < 6 && luminance(`#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`) < 0.09; step++) {
    [r, g, b] = [r, g, b].map((v) => Math.round(v + (255 - v) * 0.22));
  }
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CardStudio() {
  const [data, setData] = useState<StudioData | null>(null);
  const [trade, setTrade] = useState<TradeData | null>(null);
  const [failed, setFailed] = useState(false);

  const [template, setTemplate] = useState<Template>("compare");
  const [format, setFormat] = useState<StudioFormat>("wide");
  const [accentId, setAccentId] = useState<AccentId>("crimson");
  const [subtitle, setSubtitle] = useState("");
  const [handle, setHandle] = useState("@statspuck");

  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);
  const [compareKind, setCompareKind] = useState<"players" | "teams">("players");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [scoutId, setScoutId] = useState<number | null>(null);
  const [preset, setPreset] = useState<PresetId>("skill");
  const [rankSource, setRankSource] = useState<"preset" | "custom">("preset");
  const [rankTeam, setRankTeam] = useState("ALL");
  const [picksList, setPicksList] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [year, setYear] = useState<number>(2015);
  const [slots, setSlots] = useState<string[]>([]);
  const [items, setItems] = useState<TradeItem[]>([]);
  const [ready, setReady] = useState(false);
  const initialSearch = useRef<string | null>(null);

  // Load the studio data once.
  useEffect(() => {
    initialSearch.current = window.location.search;
    fetch(publicPath("/card-studio/players.json"))
      .then((response) => {
        if (!response.ok) throw new Error("data");
        return response.json() as Promise<StudioData>;
      })
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const needsTrade = template === "trade";
  useEffect(() => {
    if (!needsTrade || trade) return;
    fetch(publicPath("/card-studio/trade.json"))
      .then((response) => response.json() as Promise<TradeData>)
      .then(setTrade)
      .catch(() => setFailed(true));
  }, [needsTrade, trade]);

  const players = useMemo(() => data?.players ?? [], [data]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const teams = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.abbr, team])), [data]);
  const colors = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.abbr, team.color])), [data]);
  const sortedTeams = useMemo(() => [...(data?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const tradeIndex = useMemo(() => (trade ? indexTrade(trade) : null), [trade]);

  // Read the deep link (?template=...&player=...) once the data is in.
  useEffect(() => {
    if (!data || ready) return;
    const params = new URLSearchParams(initialSearch.current ?? window.location.search);
    const t = params.get("template") as Template | null;
    const ids = (params.get("player") ?? "").split(",").map(Number).filter((id) => byId.has(id));
    const ranked = [...players].filter((p) => p.active && p.sk != null).sort((x, y) => (y.sk ?? 0) - (x.sk ?? 0));
    const timer = window.setTimeout(() => {
      if (t && TEMPLATES.some((item) => item.id === t)) setTemplate(t);
      const a = Number(params.get("a")) || ids[0] || ranked[0]?.id || null;
      const b = Number(params.get("b")) || ids[1] || ranked.find((p) => p.id !== a)?.id || null;
      setAId(byId.has(a ?? -1) ? a : (ranked[0]?.id ?? null));
      setBId(byId.has(b ?? -1) ? b : (ranked[1]?.id ?? null));
      setScoutId(ids[0] ?? ranked[0]?.id ?? null);
      const pre = params.get("preset") as PresetId | null;
      if (pre && PRESETS[pre]) setPreset(pre);
      const team = params.get("team")?.toUpperCase();
      if (team && teams.has(team)) setRankTeam(team);
      const list = (params.get("players") ?? "").split(",").filter(Boolean);
      if (list.length) {
        setRankSource("custom");
        setPicksList(list.map((entry) => (/^\d+$/.test(entry) ? `p:${entry}` : entry)).slice(0, 5));
      }
      const customTitle = params.get("title");
      if (customTitle) {
        setTitle(customTitle);
        setTitleTouched(true);
      }
      const y = Number(params.get("year"));
      const years = data.classes.map((cls) => cls.y);
      setYear(years.includes(y) ? y : (years.find((value) => value <= new Date().getFullYear() - 10) ?? years[0]));
      const sub = params.get("sub");
      if (sub) setSubtitle(sub);
      const sortedAbbrs = [...teams.keys()].sort();
      const ta = params.get("ta")?.toUpperCase();
      const tb = params.get("tb")?.toUpperCase();
      setTeamA(ta && teams.has(ta) ? ta : (sortedAbbrs[0] ?? ""));
      setTeamB(tb && teams.has(tb) ? tb : (sortedAbbrs[1] ?? ""));
      if (ta || tb) setCompareKind("teams");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, ready, byId, players, teams]);

  // Trades load once the trade data arrives (from ?t=&i= or ?player=&to=, else two default teams).
  useEffect(() => {
    if (!trade || !tradeIndex || slots.length) return;
    // Use the address the page was opened with: the URL sync below rewrites it before trades load.
    const loaded = decodeTrade(initialSearch.current ?? window.location.search, trade, tradeIndex);
    const sorted = [...trade.teams].sort((x, y) => x.name.localeCompare(y.name));
    const timer = window.setTimeout(() => {
      if (loaded) {
        setSlots(loaded.slots.slice(0, 2));
        setItems(loaded.items.filter((item) => loaded.slots.slice(0, 2).includes(item.from) && loaded.slots.slice(0, 2).includes(item.to)));
      } else {
        setSlots([sorted[0].abbr, sorted[1].abbr]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [trade, tradeIndex, slots.length]);

  const tradeResult = useMemo(() => (trade && tradeIndex && slots.length >= 2 ? computeTrade(trade, tradeIndex, slots, items) : null), [trade, tradeIndex, slots, items]);

  // Top-5 rows.
  const rankRows: RankRow[] = useMemo(() => {
    const def = PRESETS[preset];
    const playerRow = (p: StudioPlayer): RankRow => {
      const value = def.get(p);
      return {
        key: `p:${p.id}`,
        name: p.n,
        sub: def.sub ? def.sub(p) : `${p.pos} · ${p.t ? (teams.get(p.t)?.short ?? p.t) : p.active ? "Free agent" : "Retired"}`,
        value: value == null ? "—" : def.fmt(value),
        valueColor: value == null ? "#64748B" : def.color?.(value),
        image: { kind: "player", id: p.id, hs: p.hs, color: p.c },
      };
    };
    if (rankSource === "custom") {
      return picksList
        .map((entry): RankRow | null => {
          if (entry.startsWith("t:")) {
            const team = teams.get(entry.slice(2));
            return team ? { key: entry, name: team.name, sub: "Draft Rater grade", value: team.l ?? "—", valueColor: "#F59E0B", image: { kind: "team", abbr: team.abbr } } : null;
          }
          const p = byId.get(Number(entry.slice(2)));
          return p ? playerRow(p) : null;
        })
        .filter((row): row is RankRow => row != null);
    }
    return players
      .filter((p) => def.get(p) != null && (rankTeam === "ALL" || p.t === rankTeam || (preset === "steals" && p.dr?.tm === rankTeam)))
      .sort((x, y) => (def.get(y) ?? 0) - (def.get(x) ?? 0))
      .slice(0, 5)
      .map(playerRow);
  }, [preset, rankSource, picksList, players, byId, teams, rankTeam]);

  const autoTitle = rankTeam !== "ALL" && rankSource === "preset" ? `Top 5 ${teams.get(rankTeam)?.short ?? rankTeam} · ${PRESETS[preset].label}` : rankSource === "custom" ? "My Top 5" : PRESETS[preset].title;
  const rankTitle = titleTouched ? title : autoTitle;

  const a = aId != null ? byId.get(aId) : undefined;
  const b = bId != null ? byId.get(bId) : undefined;
  const scout = scoutId != null ? byId.get(scoutId) : undefined;
  const cls = data?.classes.find((item) => item.y === year);

  // Accent color.
  const teamColor = (() => {
    if (template === "compare") return compareKind === "teams" ? colors.get(teamA) : a?.c;
    if (template === "scout") return scout?.c;
    if (template === "trade") return tradeResult?.calcs[0]?.team.color;
    if (template === "top5") return rankTeam !== "ALL" ? colors.get(rankTeam) : rankRows[0]?.image.kind === "player" ? rankRows[0].image.color : undefined;
    if (template === "draft") return cls?.top[0] ? colors.get(cls.top[0].tm) : undefined;
    return undefined;
  })();
  const accent = accentId === "team" ? liftColor(teamColor ?? "#E11D48") : (ACCENTS.find((item) => item.id === accentId)!.color as string);

  // Keep the address bar in sync so any card can be shared as a link.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    params.set("template", template);
    if (template === "compare" && compareKind === "teams" && teamA && teamB) {
      params.set("ta", teamA);
      params.set("tb", teamB);
    } else if (template === "compare" && aId && bId) {
      params.set("a", String(aId));
      params.set("b", String(bId));
    }
    if (template === "scout" && scoutId) params.set("player", String(scoutId));
    if (template === "top5") {
      params.set("preset", preset);
      if (rankTeam !== "ALL") params.set("team", rankTeam);
      if (rankSource === "custom" && picksList.length) params.set("players", picksList.map((entry) => (entry.startsWith("p:") ? entry.slice(2) : entry)).join(","));
      if (titleTouched && title) params.set("title", title);
    }
    if (template === "draft") params.set("year", String(year));
    let query = params.toString();
    if (template === "trade" && slots.length >= 2) query += `&${encodeTrade(slots, items)}`;
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
  }, [ready, template, aId, bId, compareKind, teamA, teamB, scoutId, preset, rankTeam, rankSource, picksList, title, titleTouched, year, slots, items]);

  const common = { format, accent, subtitle, handle };
  let card: ReactNode = null;
  if (data) {
    if (template === "compare" && compareKind === "teams") {
      const ta = teams.get(teamA);
      const tb = teams.get(teamB);
      if (ta && tb) card = <TeamCompareCard {...common} a={ta} b={tb} />;
    } else if (template === "compare" && a && b) card = <CompareCard {...common} a={a} b={b} teams={teams} />;
    if (template === "scout" && scout) card = <ScoutCard {...common} p={scout} teams={teams} />;
    if (template === "trade" && tradeResult) card = <TradeCard {...common} result={tradeResult} />;
    if (template === "top5") card = <RankCard {...common} title={rankTitle} metric={rankSource === "custom" ? `Hand-picked · ${PRESETS[preset].label}` : PRESETS[preset].label} rows={rankRows} />;
    if (template === "draft" && cls) card = <DraftCard {...common} cls={cls} colors={colors} />;
  }

  const fileSlug = (() => {
    if (template === "compare" && compareKind === "teams") return `${teamA}-vs-${teamB}`;
    if (template === "compare") return `${a?.n ?? "a"}-vs-${b?.n ?? "b"}`;
    if (template === "scout") return scout?.n ?? "scout";
    if (template === "trade") return slots.join("-");
    if (template === "top5") return rankTitle;
    return `${year}-redraft`;
  })()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div>
      <section className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Card Studio</p>
        <h1 className="display mt-2 text-5xl leading-[0.95] font-bold sm:text-6xl">Make the graphic. Win the argument.</h1>
        <p className="mt-4 text-lg text-[#94A3B8]">
          Five share-ready templates built on live StatsPuck numbers. Pick the players, choose a size for X, Instagram or TikTok, and export a crisp PNG in one click.
        </p>
      </section>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Template">
        {TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={template === item.id}
            onClick={() => setTemplate(item.id)}
            className={`min-w-[9.5rem] shrink-0 rounded-xl border px-3 py-2.5 text-left transition ${
              template === item.id ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-[#262B36] bg-[#14171F] hover:border-[#38BDF8]/50"
            }`}
          >
            <span className="display block text-base font-bold text-[#F8FAFC]">{item.label}</span>
            <span className="block text-[11px] text-[#94A3B8]">{item.blurb}</span>
          </button>
        ))}
      </div>

      {failed ? <p className="mt-6 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-4 text-sm text-[#FCA5A5]">Could not load the card data. Refresh the page to try again.</p> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <Panel title="Who's on it">
            {!data ? <p className="text-sm text-[#94A3B8]">Loading players…</p> : null}
            {data && template === "compare" ? (
              <div className="space-y-3">
                <TogglePill<"players" | "teams">
                  label="Compare"
                  value={compareKind}
                  options={[
                    { id: "players", label: "Players" },
                    { id: "teams", label: "Teams" },
                  ]}
                  onChange={setCompareKind}
                />
                {compareKind === "players" ? (
                  <>
                    <PlayerPicker label="Player A" players={players} teams={teams} value={a} onPick={setAId} />
                    <PlayerPicker label="Player B" players={players} teams={teams} value={b} onPick={setBId} />
                  </>
                ) : (
                  (
                    [
                      ["Team A", teamA, setTeamA],
                      ["Team B", teamB, setTeamB],
                    ] as const
                  ).map(([label, value, set]) => (
                    <label key={label} className="block text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                      {label}
                      <select value={value} onChange={(event) => set(event.target.value)} className={`${inputClass} mt-1.5`}>
                        {sortedTeams.map((team) => (
                          <option key={team.abbr} value={team.abbr}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))
                )}
              </div>
            ) : null}
            {data && template === "scout" ? <PlayerPicker label="Player" players={players} teams={teams} value={scout} onPick={setScoutId} /> : null}
            {data && template === "draft" ? (
              <label className="block text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                Draft year
                <select value={year} onChange={(event) => setYear(Number(event.target.value))} className={`${inputClass} mt-1.5`}>
                  {data.classes.map((item) => (
                    <option key={item.y} value={item.y}>
                      {item.y} NHL Draft{item.l ? ` · ${item.l}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {data && template === "top5" ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                  Graphic title
                  <input
                    value={rankTitle}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setTitleTouched(true);
                    }}
                    maxLength={60}
                    placeholder="Top 5 Bargain Contracts in the NHL"
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
                <TogglePill<"preset" | "custom"> label="List source" value={rankSource} options={[{ id: "preset", label: "Auto-fill" }, { id: "custom", label: "Hand-pick" }]} onChange={setRankSource} />
                <label className="block text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                  Metric
                  <select value={preset} onChange={(event) => setPreset(event.target.value as PresetId)} className={`${inputClass} mt-1.5`}>
                    {(Object.keys(PRESETS) as PresetId[]).map((id) => (
                      <option key={id} value={id}>
                        {PRESETS[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                {rankSource === "preset" ? (
                  <label className="block text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                    Team
                    <select value={rankTeam} onChange={(event) => setRankTeam(event.target.value)} className={`${inputClass} mt-1.5`}>
                      <option value="ALL">Whole NHL</option>
                      {sortedTeams.map((team) => (
                        <option key={team.abbr} value={team.abbr}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="space-y-2">
                    <PlayerPicker
                      label={`Add a player or team (${picksList.length}/5)`}
                      players={players}
                      teams={teams}
                      includeTeams
                      disabled={picksList.length >= 5}
                      onPick={(id) => setPicksList((list) => (list.includes(`p:${id}`) || list.length >= 5 ? list : [...list, `p:${id}`]))}
                      onPickTeam={(abbr) => setPicksList((list) => (list.includes(`t:${abbr}`) || list.length >= 5 ? list : [...list, `t:${abbr}`]))}
                    />
                    <ol className="space-y-1.5">
                      {picksList.map((entry, index) => {
                        const label = entry.startsWith("t:") ? (teams.get(entry.slice(2))?.name ?? entry) : (byId.get(Number(entry.slice(2)))?.n ?? entry);
                        return (
                          <li key={entry} className="flex items-center gap-2 rounded-lg border border-[#262B36] bg-[#0B0D10]/60 px-2.5 py-1.5 text-sm">
                            <span className="w-4 text-xs font-bold text-[#94A3B8]">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
                            <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => setPicksList((list) => swap(list, index, index - 1))} className="px-1 text-[#94A3B8] hover:text-white disabled:opacity-30">
                              ↑
                            </button>
                            <button type="button" aria-label={`Remove ${label}`} onClick={() => setPicksList((list) => list.filter((value) => value !== entry))} className="px-1 text-[#94A3B8] hover:text-[#EF4444]">
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            ) : null}
            {data && template === "trade" ? (
              trade && tradeIndex && slots.length >= 2 ? (
                <TradeBuilder trade={trade} slots={slots} items={items} setSlots={setSlots} setItems={setItems} />
              ) : (
                <p className="text-sm text-[#94A3B8]">Loading rosters and picks…</p>
              )
            ) : null}
          </Panel>

          <Panel title="Style">
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Format</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(FORMATS) as StudioFormat[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormat(id)}
                      aria-pressed={format === id}
                      className={`rounded-lg border px-2 py-2 text-left transition ${format === id ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-[#262B36] hover:border-[#38BDF8]/50"}`}
                    >
                      <span className="block text-xs font-bold text-[#F8FAFC]">{FORMATS[id].label}</span>
                      <span className="block text-[10px] leading-tight text-[#94A3B8]">{FORMATS[id].note}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Accent</p>
                <div className="grid gap-1.5">
                  {ACCENTS.map((item) => {
                    const swatch = item.color ?? liftColor(teamColor ?? "#E11D48");
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAccentId(item.id)}
                        aria-pressed={accentId === item.id}
                        className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition ${accentId === item.id ? "border-[#38BDF8] bg-[#38BDF8]/10" : "border-[#262B36] hover:border-[#38BDF8]/50"}`}
                      >
                        <span className="h-4 w-4 rounded-full ring-1 ring-white/20" style={{ background: swatch }} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                Custom subtitle (optional)
                <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={80} placeholder="e.g. Who would you rather have?" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                Author handle (optional)
                <input value={handle} onChange={(event) => setHandle(event.target.value)} maxLength={32} placeholder="@statspuck" className={`${inputClass} mt-1.5`} />
              </label>
            </div>
          </Panel>
        </aside>

        <Preview format={format} fileSlug={fileSlug || "card"} accent={accent}>
          {card}
        </Preview>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm font-normal tracking-normal text-[#F8FAFC] normal-case placeholder:text-[#94A3B8]/60 focus:border-[#38BDF8] focus:outline-none";

function swap<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[#E11D48] uppercase">{title}</p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Player / team search                                                */
/* ------------------------------------------------------------------ */

function PlayerPicker({
  label,
  players,
  teams,
  value,
  onPick,
  onPickTeam,
  includeTeams = false,
  disabled = false,
}: {
  label: string;
  players: StudioPlayer[];
  teams: Map<string, StudioTeam>;
  value?: StudioPlayer;
  onPick: (id: number) => void;
  onPickTeam?: (abbr: string) => void;
  includeTeams?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = normalize(query.trim());
  const teamMatches = includeTeams && q ? [...teams.values()].filter((team) => normalize(team.name).includes(q) || team.abbr.toLowerCase() === q).slice(0, 3) : [];
  const matches = q
    ? players
        .filter((p) => normalize(p.n).includes(q))
        .sort((x, y) => Number(y.active) - Number(x.active) || (y.sk ?? 0) - (x.sk ?? 0) || y.qg - x.qg)
        .slice(0, 8)
    : [];
  return (
    <div className="relative">
      <p className="mb-1.5 text-xs font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{label}</p>
      {value ? (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-[#38BDF8]/40 bg-[#38BDF8]/[0.06] px-2.5 py-1.5 text-sm">
          {value.t ? <TeamLogo abbr={value.t} className="h-5 w-6" /> : null}
          <span className="min-w-0 flex-1 truncate font-semibold">{value.n}</span>
          <span className="text-xs text-[#94A3B8]">{value.pos}</span>
        </div>
      ) : null}
      <input
        type="search"
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={disabled ? "List is full" : includeTeams ? "Search players or teams" : value ? "Search to swap player" : "Search any NHL player"}
        className={inputClass}
      />
      {open && (matches.length || teamMatches.length) ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[#262B36] bg-[#0B0D10] p-1 shadow-2xl">
          {teamMatches.map((team) => (
            <li key={team.abbr}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPickTeam?.(team.abbr);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#38BDF8]/10"
              >
                <TeamLogo abbr={team.abbr} className="h-5 w-6" />
                <span className="flex-1 truncate font-semibold">{team.name}</span>
                <span className="text-[10px] text-[#94A3B8]">TEAM</span>
              </button>
            </li>
          ))}
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(p.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#38BDF8]/10"
              >
                {p.t ? <TeamLogo abbr={p.t} className="h-5 w-6" /> : <span className="h-5 w-6" />}
                <span className="flex-1 truncate font-semibold">{p.n}</span>
                <span className="text-[10px] text-[#94A3B8]">
                  {p.pos} · {p.t ?? (p.active ? "FA" : "Retired")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trade builder (simplified Trade Machine)                            */
/* ------------------------------------------------------------------ */

function TradeBuilder({
  trade,
  slots,
  items,
  setSlots,
  setItems,
}: {
  trade: TradeData;
  slots: string[];
  items: TradeItem[];
  setSlots: (slots: string[]) => void;
  setItems: (update: (items: TradeItem[]) => TradeItem[]) => void;
}) {
  const sorted = useMemo(() => [...trade.teams].sort((a, b) => a.name.localeCompare(b.name)), [trade.teams]);
  const [side, setSide] = useState(0);
  const [query, setQuery] = useState("");
  const abbr = slots[side];
  const other = slots[1 - side];
  const inTrade = new Set(items.map((item) => item.key));
  const q = normalize(query.trim());
  const roster = trade.players.filter((p) => p.team === abbr && (!q || normalize(p.name).includes(q))).slice(0, 40);
  const picks = q ? [] : trade.picks.filter((pick) => pick.team === abbr);

  function changeTeam(index: number, next: string) {
    const old = slots[index];
    setSlots(slots.map((value, i) => (i === index ? next : value)));
    setItems((current) => current.filter((item) => item.from !== old && item.to !== old));
  }
  function toggle(kind: "player" | "pick", id: string, tier?: TradeItem["tier"]) {
    const key = kind === "player" ? `p:${id}` : id;
    setItems((current) => (current.some((item) => item.key === key) ? current.filter((item) => item.key !== key) : [...current, { key, kind, id, from: abbr, to: other, retain: 0, tier }]));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {slots.slice(0, 2).map((value, index) => (
          <select
            key={index}
            value={value}
            onChange={(event) => changeTeam(index, event.target.value)}
            aria-label={`Team ${index + 1}`}
            className="rounded-xl border border-[#262B36] bg-[#0B0D10] px-2 py-2 text-sm font-semibold text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
          >
            {sorted.map((team) => (
              <option key={team.abbr} value={team.abbr} disabled={slots.includes(team.abbr) && team.abbr !== value}>
                {team.name}
              </option>
            ))}
          </select>
        ))}
      </div>
      <TogglePill<"0" | "1">
        label="Which team is sending"
        value={String(side) as "0" | "1"}
        options={[
          { id: "0", label: `${slots[0]} send` },
          { id: "1", label: `${slots[1]} send` },
        ]}
        onChange={(value) => setSide(Number(value))}
      />
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${abbr} roster`} className={inputClass} />
      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {roster.map((p) => {
          const on = inTrade.has(`p:${p.id}`);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle("player", String(p.id))}
                aria-pressed={on}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition ${on ? "border-[#E11D48] bg-[#E11D48]/10" : "border-[#262B36] hover:border-[#38BDF8]/50"}`}
              >
                <span className="w-4 text-center font-bold text-[#94A3B8]">{on ? "✓" : "+"}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <span className="text-[11px] text-[#94A3B8]">{p.pos}</span>
                <span className="display w-8 text-right font-bold">{Math.round(playerRating(trade, p, 0))}</span>
              </button>
            </li>
          );
        })}
        {picks.map((pick) => {
          const key = pickKey(pick);
          const on = inTrade.has(key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle("pick", key, pick.defaultTier)}
                aria-pressed={on}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition ${on ? "border-[#E11D48] bg-[#E11D48]/10" : "border-[#262B36] hover:border-[#38BDF8]/50"}`}
              >
                <span className="w-4 text-center font-bold text-[#94A3B8]">{on ? "✓" : "+"}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {pick.year} Round {pick.round}
                  {pick.from !== pick.team ? ` (${pick.from})` : ""}
                </span>
                <span className="display w-8 text-right font-bold">{Math.round(pickRating(trade, pick, pick.defaultTier))}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <a href={`/trade-machine?${encodeTrade(slots, items)}`} className="block text-sm font-semibold text-[#38BDF8] hover:underline">
        Fine-tune in the Trade Machine (retention, clauses) →
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview + export                                                    */
/* ------------------------------------------------------------------ */

function Preview({ format, fileSlug, accent, children }: { format: StudioFormat; fileSlug: string; accent: string; children: ReactNode }) {
  const size = FORMATS[format];
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStage({ width: node.clientWidth, height: Math.max(320, Math.min(760, window.innerHeight * 0.72)) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const scale = stage.width > 0 ? Math.min(stage.width / size.width, stage.height / size.height) : 0;

  function note(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function pngBlob(): Promise<Blob> {
    const node = cardRef.current?.firstElementChild as HTMLElement | null;
    if (!node) throw new Error("Card is not ready");
    return domToBlob(node, { scale: format === "tall" ? 1.5 : 2, width: size.width, height: size.height, style: { transform: "none" }, backgroundColor: "#0B0D10" });
  }

  async function copyImage() {
    setBusy("copy");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        note("This browser can't copy images. Use Download PNG.");
        return;
      }
      // Safari needs the ClipboardItem to be created inside the click, with a promise.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob() })]);
      note("PNG copied to clipboard!");
    } catch {
      note("Could not copy the image");
    } finally {
      setBusy("");
    }
  }

  async function download() {
    setBusy("save");
    try {
      const blob = await pngBlob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `statspuck-${fileSlug}-${format}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      note("PNG downloaded");
    } catch {
      note("Could not save the image");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">
            Preview · {size.width}×{size.height}
          </p>
          <span className="h-2 w-10 rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.2)})` }} />
        </div>
        <div ref={stageRef} className="mt-3 flex w-full justify-center">
          <div
            className="overflow-hidden rounded-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-[#262B36]"
            style={{ width: Math.floor(size.width * scale), height: Math.floor(size.height * scale), visibility: scale > 0 && children ? "visible" : "hidden" }}
          >
            <div ref={cardRef} style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              {children}
            </div>
          </div>
        </div>
        {!children ? <p className="py-10 text-center text-sm text-[#94A3B8]">Pick who goes on the card to see the preview.</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copyImage}
            disabled={busy !== "" || !children}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#F43F5E] disabled:opacity-50"
          >
            {busy === "copy" ? "Copying…" : "Copy PNG to Clipboard"}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={busy !== "" || !children}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#262B36] bg-[#0B0D10] px-4 py-3 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8]/60 disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Download PNG"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[#94A3B8]">The address bar always holds a link to this exact card, so you can bookmark or share it.</p>
      </div>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
        {toast ? <span className="rounded-full border border-[#10B981]/40 bg-[#0B0D10] px-4 py-2 text-sm text-[#10B981] shadow-lg">{toast}</span> : null}
      </div>
    </section>
  );
}
