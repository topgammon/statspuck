"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Carousel } from "@/components/carousel";
import { TeamLogo } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import { formatRating, ratingTone } from "@/lib/rating";
import { gmHref, playerHref } from "@/lib/routes";
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
      {open ? (
        <div className="min-w-0 border-t border-[#262B36] p-4">
          <Carousel label="Trade tree">
            <div className="py-2 pr-6">
              <Branch id={tree.root} steps={steps} root />
            </div>
          </Carousel>
          <p className="mt-2 text-[11px] text-[#94A3B8]">
            Read left to right. Each card is one trade by {team?.short ?? tree.team}: what went out, what came back. Anything that was traded again continues to the right. Numbers are Impact over the five seasons after the deal.
          </p>
        </div>
      ) : null}
    </li>
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
            <Link href={gmHref(step.gm.slug, "trades-cap")} className="block truncate text-[10px] text-[#38BDF8] hover:underline">
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
