"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Carousel } from "@/components/carousel";
import { TeamLogo } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import { formatRating, ratingTone } from "@/lib/rating";
import { gmTeamHref, playerHref } from "@/lib/routes";
import type { Callout, TreePiece, TreeStep, TreeSummary } from "@/lib/trade-trees";

type Sort = "deep" | "big" | "old" | "new";
type Team = { abbr: string; name: string; short: string };

const PAGE = 24;

export function TradeTrees({ trees, steps, teams, callouts }: { trees: TreeSummary[]; steps: Record<string, TreeStep>; teams: Team[]; callouts: Callout[] }) {
  const [team, setTeam] = useState("ALL");
  const [query, setQuery] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("deep");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const abbr = new URLSearchParams(window.location.search).get("team")?.toUpperCase();
    if (!abbr || !teams.some((t) => t.abbr === abbr)) return;
    const timer = window.setTimeout(() => setTeam(abbr), 0);
    return () => window.clearTimeout(timer);
  }, [teams]);

  const names = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matchesName = (tree: TreeSummary) => {
      if (needle.length < 2) return true;
      const stack = [tree.root];
      while (stack.length) {
        const step = steps[stack.pop() as string];
        if (!step) continue;
        if ([...step.gave, ...step.got].some((p) => p.label.toLowerCase().includes(needle)) || step.drafted.some((d) => d.name.toLowerCase().includes(needle))) return true;
        stack.push(...step.kids);
      }
      return false;
    };
    const list = trees.filter((tree) => (team === "ALL" || tree.team === team) && (!liveOnly || tree.active > 0) && matchesName(tree));
    const sorted = [...list];
    if (sort === "big") sorted.sort((a, b) => b.size - a.size || b.depth - a.depth);
    else if (sort === "old") sorted.sort((a, b) => a.from.localeCompare(b.from));
    else if (sort === "new") sorted.sort((a, b) => b.to.localeCompare(a.to));
    else sorted.sort((a, b) => b.depth - a.depth || b.size - a.size);
    return sorted;
  }, [trees, steps, team, query, liveOnly, sort]);

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setShown(PAGE);
    };
  }

  function openTree(root: string) {
    setTeam("ALL");
    setQuery("");
    setLiveOnly(false);
    setOpen(root);
    window.setTimeout(() => document.getElementById(`tree-${root}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  const forced = open ? trees.find((t) => t.root === open) : null;
  const visible = rows.slice(0, shown);
  const list = forced && !visible.some((t) => t.root === forced.root) ? [forced, ...visible] : visible;

  return (
    <div className="min-w-0">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {callouts.map((callout) => (
          <button
            key={callout.id}
            type="button"
            onClick={() => openTree(callout.root)}
            className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-4 text-left transition hover:border-[#38BDF8]"
          >
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{callout.label}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="display text-5xl leading-none font-bold text-[#F8FAFC]">{callout.big}</span>
              <span className="text-sm text-[#94A3B8]">{callout.unit}</span>
            </p>
            <p className="mt-2 text-sm text-[#94A3B8]">{callout.blurb}</p>
            <p className="mt-2 text-xs font-semibold text-[#38BDF8]">Open the tree →</p>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-[#262B36] bg-[#14171F] p-4">
        <Field label="Team">
          <select value={team} onChange={(e) => change(setTeam)(e.target.value)} className="rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none">
            <option value="ALL">All teams</option>
            {teams.map((t) => (
              <option key={t.abbr} value={t.abbr}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Player or pick">
          <input
            type="search"
            value={query}
            onChange={(e) => change(setQuery)(e.target.value)}
            placeholder="e.g. Hossa or 2006 R1"
            className="w-52 rounded-xl border border-[#262B36] bg-[#0B0D10] px-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/70 focus:border-[#38BDF8] focus:outline-none"
          />
        </Field>
        <Field label="Show">
          <TogglePill<"all" | "live"> value={liveOnly ? "live" : "all"} options={[{ id: "all", label: "All trees" }, { id: "live", label: "Still active" }]} onChange={(v) => change(setLiveOnly)(v === "live")} />
        </Field>
        <Field label="Sort">
          <TogglePill<Sort>
            value={sort}
            options={[
              { id: "deep", label: "Deepest" },
              { id: "big", label: "Biggest" },
              { id: "old", label: "Oldest" },
              { id: "new", label: "Recent" },
            ]}
            onChange={change(setSort)}
          />
        </Field>
      </div>

      <p className="mt-4 text-sm text-[#94A3B8]">
        {rows.length.toLocaleString("en-US")} trade trees with at least two trades. Showing {Math.min(shown, rows.length)}.
      </p>

      <ul className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        {list.map((tree) => (
          <TreeCard key={tree.root} tree={tree} steps={steps} team={names.get(tree.team)} open={open === tree.root} onToggle={() => setOpen(open === tree.root ? null : tree.root)} />
        ))}
        {rows.length === 0 ? <li className="rounded-2xl border border-dashed border-[#262B36] p-6 text-center text-sm text-[#94A3B8]">No trees match those filters.</li> : null}
      </ul>

      {shown < rows.length ? (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-full border border-[#262B36] px-5 py-2 text-sm font-semibold transition hover:border-[#38BDF8] hover:text-[#38BDF8]">
            Show {Math.min(PAGE, rows.length - shown)} more
          </button>
        </div>
      ) : null}
    </div>
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

function TreeCard({ tree, steps, team, open, onToggle }: { tree: TreeSummary; steps: Record<string, TreeStep>; team?: Team; open: boolean; onToggle: () => void }) {
  return (
    <li id={`tree-${tree.root}`} className={`min-w-0 scroll-mt-24 rounded-2xl border bg-[#14171F] ${open ? "border-[#38BDF8]/60" : "border-[#262B36]"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left">
        <TeamLogo abbr={tree.team} name={team?.name} className="h-9 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{tree.title}</p>
          <p className="text-xs text-[#94A3B8]">
            {team?.name ?? tree.team} · {tree.from.slice(0, 4)}–{tree.to.slice(0, 4)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-center">
          <Stat label="Depth" value={String(tree.depth)} />
          <Stat label="Trades" value={String(tree.size)} />
          <Stat label="Active" value={String(tree.active)} tone={tree.active ? "text-[#10B981]" : "text-[#94A3B8]"} />
          <span className="text-[#94A3B8]" aria-hidden>
            {open ? "−" : "+"}
          </span>
        </div>
      </button>
      {open ? <ExpandedTree tree={tree} steps={steps} team={team} /> : null}
    </li>
  );
}

// ---- Expanded tree: Explorer (outline + detail) or Map (the full diagram) ------------------

type Node = { id: string; depth: number; parent: string | null; index: number };

function flatten(root: string, steps: Record<string, TreeStep>): Node[] {
  const out: Node[] = [];
  const walk = (id: string, depth: number, parent: string | null) => {
    if (!steps[id]) return;
    out.push({ id, depth, parent, index: out.length });
    for (const kid of steps[id].kids) walk(kid, depth + 1, id);
  };
  walk(root, 0, null);
  return out;
}

/** Short "what came back" label for outline rows. */
function gotLabel(step: TreeStep): string {
  const players = step.got.filter((p) => p.kind === "p").map((p) => p.label);
  const picks = step.got.filter((p) => p.kind === "k").map((p) => p.label);
  const names = [...players, ...picks];
  if (!names.length) return "nothing back";
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

function sentLabel(step: TreeStep): string {
  const names = [...step.gave.filter((p) => p.kind === "p"), ...step.gave.filter((p) => p.kind === "k")].map((p) => p.label);
  if (!names.length) return "—";
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

function ExpandedTree({ tree, steps, team }: { tree: TreeSummary; steps: Record<string, TreeStep>; team?: Team }) {
  const [view, setView] = useState<"explore" | "map">("explore");
  const nodes = useMemo(() => flatten(tree.root, steps), [tree.root, steps]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const [selected, setSelected] = useState(tree.root);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Rows hidden under a collapsed ancestor.
  const visible = useMemo(() => {
    const hidden = new Set<string>();
    for (const node of nodes) if (node.parent && (collapsed.has(node.parent) || hidden.has(node.parent))) hidden.add(node.id);
    return nodes.filter((node) => !hidden.has(node.id));
  }, [nodes, collapsed]);

  const path = useMemo(() => {
    const out: string[] = [];
    let cursor: string | null = selected;
    while (cursor) {
      out.unshift(cursor);
      cursor = byId.get(cursor)?.parent ?? null;
    }
    return out;
  }, [selected, byId]);

  function select(id: string) {
    // Opening a node inside a collapsed branch expands its ancestors.
    setCollapsed((current) => {
      const next = new Set(current);
      let cursor = byId.get(id)?.parent ?? null;
      while (cursor) {
        next.delete(cursor);
        cursor = byId.get(cursor)?.parent ?? null;
      }
      return next;
    });
    setSelected(id);
    window.setTimeout(() => document.getElementById(`row-${tree.root}-${id}`)?.scrollIntoView({ block: "nearest" }), 0);
  }

  function onKey(event: React.KeyboardEvent) {
    const at = visible.findIndex((node) => node.id === selected);
    const step = steps[selected];
    if (event.key === "ArrowDown" && at < visible.length - 1) select(visible[at + 1].id);
    else if (event.key === "ArrowUp" && at > 0) select(visible[at - 1].id);
    else if (event.key === "ArrowRight" && step?.kids[0]) select(step.kids[0]);
    else if (event.key === "ArrowLeft" && byId.get(selected)?.parent) select(byId.get(selected)!.parent!);
    else return;
    event.preventDefault();
  }

  // Players still on the roster, and the trade that brought each one in.
  const live = useMemo(() => {
    const out: { name: string; step: string; rid: number }[] = [];
    for (const node of nodes) {
      const step = steps[node.id];
      for (const p of step.got) if (p.status === "a") out.push({ name: p.label, step: node.id, rid: p.rid });
      for (const d of step.drafted) if (d.status === "a") out.push({ name: d.name, step: node.id, rid: d.rid });
    }
    return out;
  }, [nodes, steps]);

  const current = steps[selected];
  const currentNode = byId.get(selected);

  return (
    <div className="min-w-0 border-t border-[#262B36] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TogglePill<"explore" | "map">
          value={view}
          options={[
            { id: "explore", label: "Explorer" },
            { id: "map", label: "Full map" },
          ]}
          onChange={setView}
          label="Tree view"
        />
        {live.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Still on the roster</span>
            {live.map((item) => (
              <button
                key={`${item.name}-${item.step}`}
                type="button"
                onClick={() => {
                  setView("explore");
                  select(item.step);
                }}
                className="rounded-full bg-[#10B981]/15 px-2 py-0.5 font-semibold text-[#10B981] transition hover:bg-[#10B981]/25"
                title="Jump to the trade that brought him in"
              >
                {item.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {view === "map" ? (
        <>
          <div className="mt-3">
            <Carousel label="Trade tree">
              <div className="py-2 pr-6">
                <Branch id={tree.root} steps={steps} root />
              </div>
            </Carousel>
          </div>
          <p className="mt-2 text-[11px] text-[#94A3B8]">
            Read left to right. Each card is one trade by {team?.short ?? tree.team}. Anything traded again continues to the right. Numbers are Impact over the five seasons after the deal.
          </p>
        </>
      ) : (
        <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Outline: every trade in the tree, in order, indented by generation. */}
          <div className="min-w-0 rounded-xl border border-[#262B36] bg-[#0B0D10]/60">
            <div className="flex items-center justify-between gap-2 border-b border-[#262B36] px-3 py-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                {nodes.length} trades · {tree.depth} deep
              </span>
              <span className="flex gap-2 text-[10px] font-semibold">
                <button type="button" className="text-[#38BDF8] hover:underline" onClick={() => setCollapsed(new Set())}>
                  Expand all
                </button>
                <button
                  type="button"
                  className="text-[#38BDF8] hover:underline"
                  onClick={() => {
                    setCollapsed(new Set(nodes.filter((node) => node.depth >= 1 && steps[node.id].kids.length).map((node) => node.id)));
                    setSelected(tree.root);
                  }}
                >
                  Collapse
                </button>
              </span>
            </div>
            <ol role="tree" aria-label="Trades in this tree" tabIndex={0} onKeyDown={onKey} className="max-h-[28rem] overflow-y-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-[#38BDF8]">
              {visible.map((node) => {
                const step = steps[node.id];
                const on = node.id === selected;
                const inPath = path.includes(node.id);
                const indent = Math.min(node.depth, 8);
                return (
                  <li key={node.id} id={`row-${tree.root}-${node.id}`} role="treeitem" aria-selected={on} aria-level={node.depth + 1}>
                    <div
                      className={`flex items-center gap-1 pr-2 transition ${on ? "bg-[#38BDF8]/15" : inPath ? "bg-[#38BDF8]/[0.05]" : "hover:bg-white/[0.03]"}`}
                      style={{ paddingLeft: `${0.5 + indent * 0.85}rem` }}
                    >
                      {step.kids.length ? (
                        <button
                          type="button"
                          aria-label={collapsed.has(node.id) ? "Expand" : "Collapse"}
                          onClick={() =>
                            setCollapsed((currentSet) => {
                              const next = new Set(currentSet);
                              if (next.has(node.id)) next.delete(node.id);
                              else next.add(node.id);
                              return next;
                            })
                          }
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#94A3B8] hover:text-white"
                        >
                          <svg viewBox="0 0 12 12" className={`h-3 w-3 transition ${collapsed.has(node.id) ? "" : "rotate-90"}`} aria-hidden>
                            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : (
                        <span className="h-5 w-5 shrink-0" />
                      )}
                      <button type="button" onClick={() => select(node.id)} className="min-w-0 flex-1 py-1.5 text-left">
                        <span className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
                          <span className={`rounded px-1 font-bold ${node.depth === 0 ? "bg-[#E11D48]/20 text-[#E11D48]" : "bg-white/5"}`}>{node.depth === 0 ? "START" : `G${node.depth}`}</span>
                          {step.d}
                          {step.kids.length > 1 ? <span className="text-[#38BDF8]">· splits {step.kids.length} ways</span> : null}
                        </span>
                        <span className={`block truncate text-xs ${on ? "font-semibold text-[#F8FAFC]" : "text-[#F8FAFC]/85"}`}>→ {gotLabel(step)}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="border-t border-[#262B36] px-3 py-1.5 text-[10px] text-[#94A3B8]">↑ ↓ move · → follow · ← go back</p>
          </div>

          {/* Detail: the selected trade, how we got here, and where it led. */}
          <div className="min-w-0">
            <nav aria-label="Path to this trade" className="flex flex-wrap items-center gap-1 text-xs">
              {path.map((id, index) => (
                <span key={id} className="flex items-center gap-1">
                  {index > 0 ? <span className="text-[#94A3B8]">›</span> : null}
                  <button
                    type="button"
                    onClick={() => select(id)}
                    className={`max-w-[12rem] truncate rounded-full border px-2 py-0.5 ${id === selected ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#38BDF8]" : "border-[#262B36] text-[#94A3B8] hover:text-white"}`}
                  >
                    {index === 0 ? "Start" : steps[id].d.slice(0, 7)} · {gotLabel(steps[id])}
                  </button>
                </span>
              ))}
            </nav>
            {current ? (
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
                <div className="[&>div]:w-full">
                  <StepCard step={current} root={selected === tree.root} />
                </div>
                <div className="flex flex-col gap-2">
                  {currentNode?.parent ? (
                    <button
                      type="button"
                      onClick={() => select(currentNode.parent!)}
                      className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 text-left text-xs transition hover:border-[#38BDF8]/60"
                    >
                      <span className="block text-[9px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">← Came from</span>
                      <span className="mt-0.5 block truncate font-semibold">{steps[currentNode.parent].d}</span>
                      <span className="block truncate text-[#94A3B8]">sent {sentLabel(steps[currentNode.parent])}</span>
                    </button>
                  ) : null}
                  <p className="text-[9px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{current.kids.length ? `Led to ${current.kids.length} more ${current.kids.length === 1 ? "trade" : "trades"} →` : "End of this branch"}</p>
                  {current.kids.map((kid) => (
                    <button
                      key={kid}
                      type="button"
                      onClick={() => select(kid)}
                      className="rounded-xl border border-[#38BDF8]/30 bg-[#38BDF8]/[0.05] p-3 text-left text-xs transition hover:border-[#38BDF8]"
                    >
                      <span className="block font-semibold">{steps[kid].d}</span>
                      <span className="block truncate text-[#94A3B8]">sent {sentLabel(steps[kid])}</span>
                      <span className="block truncate text-[#F8FAFC]/85">got {gotLabel(steps[kid])}</span>
                    </button>
                  ))}
                  {!current.kids.length ? (
                    <p className="rounded-xl border border-dashed border-[#262B36] p-3 text-xs text-[#94A3B8]">Nothing from this trade was traded again.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-[11px] text-[#94A3B8]">
              Each trade by {team?.short ?? tree.team}: what went out, what came back. Numbers are Impact over the five seasons after the deal. G1, G2… is how many trades
              removed from the start.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-[#F8FAFC]" }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[9px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</span>
      <span className={`display text-xl leading-tight font-bold ${tone}`}>{value}</span>
    </span>
  );
}

/** A trade card with its follow-up trades branching to the right. */
function Branch({ id, steps, root = false }: { id: string; steps: Record<string, TreeStep>; root?: boolean }) {
  const step = steps[id];
  if (!step) return null;
  return (
    <div className="flex items-center">
      <StepCard step={step} root={root} />
      {step.kids.length ? (
        <>
          <span className="h-px w-8 shrink-0 bg-[#38BDF8]/50" aria-hidden />
          <div className="flex flex-col">
            {step.kids.map((kid, index) => (
              <div key={kid} className="relative flex items-center py-2 pl-8">
                {step.kids.length > 1 ? (
                  <span
                    aria-hidden
                    className={`absolute left-0 border-l border-[#38BDF8]/50 ${index === 0 ? "top-1/2 bottom-0" : index === step.kids.length - 1 ? "top-0 bottom-1/2" : "inset-y-0"}`}
                  />
                ) : null}
                <span aria-hidden className="absolute top-1/2 left-0 h-px w-8 bg-[#38BDF8]/50" />
                <Branch id={kid} steps={steps} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StepCard({ step, root }: { step: TreeStep; root: boolean }) {
  return (
    <div className={`w-64 shrink-0 rounded-xl border p-3 ${root ? "border-[#E11D48]/60 bg-[#E11D48]/[0.05]" : "border-[#262B36] bg-[#0B0D10]/70"}`}>
      <div className="flex items-center gap-2">
        <TeamLogo abbr={step.t} className="h-6 w-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#F8FAFC]">
            {step.d} · {step.t} ↔ {step.o}
          </p>
          {step.gm ? (
            <Link href={`${gmTeamHref(step.gm.slug)}&tab=transactions`} className="block truncate text-[10px] text-[#38BDF8] hover:underline">
              GM {step.gm.person}
            </Link>
          ) : null}
        </div>
        {root ? <span className="rounded-full bg-[#E11D48]/15 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-[#E11D48] uppercase">Start</span> : null}
      </div>
      <Pieces title="Sent" pieces={step.gave} empty="Nothing (acquired outright)" />
      <Pieces title="Got" pieces={step.got} empty="Nothing" />
      {step.drafted.length ? (
        <div className="mt-2 border-t border-[#262B36] pt-2">
          <p className="text-[9px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">Used the pick on</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {step.drafted.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {d.rid ? (
                    <Link href={playerHref(d.rid)} className="font-semibold hover:underline">
                      {d.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{d.name}</span>
                  )}
                  <span className="text-[#94A3B8]"> ({d.pick})</span>
                </span>
                <Status status={d.status} rating={d.rating} rid={d.rid} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Pieces({ title, pieces, empty }: { title: string; pieces: TreePiece[]; empty: string }) {
  return (
    <div className="mt-2">
      <p className="text-[9px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">{title}</p>
      {pieces.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">{empty}</p>
      ) : (
        <ul className="mt-0.5 space-y-0.5 text-xs">
          {pieces.map((p, index) => (
            <li key={p.label + index} className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words">
                {p.kind === "p" && p.rid ? (
                  <Link href={playerHref(p.rid)} className="font-semibold hover:underline">
                    {p.label}
                  </Link>
                ) : (
                  <span className={p.kind === "p" ? "font-semibold" : "text-[#94A3B8]"}>{p.label}</span>
                )}
                <span className="text-[10px] text-[#94A3B8]"> {p.value.toLocaleString("en-US")}</span>
              </span>
              <Status status={p.status} rating={p.rating} rid={p.rid} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What became of a player nobody traded on. Active players link to their Asset Value. */
function Status({ status, rating, rid }: { status: string; rating: number | null; rid: number }) {
  if (status === "a") {
    const chip = (
      <span className="shrink-0 rounded-full bg-[#10B981]/15 px-1.5 py-px text-[9px] font-bold text-[#10B981]" title="Still on this team's roster">
        Active{rating != null ? <span className={`ml-1 ${ratingTone(rating)}`}>{formatRating(rating)}</span> : null}
      </span>
    );
    return rid ? <Link href={playerHref(rid, "asset")}>{chip}</Link> : chip;
  }
  if (status === "x") return <span className="shrink-0 text-[9px] text-[#94A3B8]" title="Plays for another team now">Elsewhere</span>;
  if (status === "r") return <span className="shrink-0 text-[9px] text-[#64748B]" title="Retired or inactive">Retired</span>;
  return null;
}
