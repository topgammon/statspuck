"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FilterPills } from "./filter-pills";
import type { Bucket, CohortRow } from "@/lib/development";
import { playerHref } from "@/lib/routes";
import { pct, rateColor, summarize, TIERS, toRows, type Row } from "./shared";

type Outcome = "Regular" | "Depth" | "Missed";
type NodeKey = Bucket | Outcome;

const COLUMNS = ["Draft origin", "D+1", "D+2", "D+3", "D+4", "Career outcome"];
const BUCKET_ORDER: Bucket[] = ["NHL", "AHL", "KHL", "SHL", "Liiga", "Other", "NCAA", "CHL", "USHL", "None"];
const OUTCOME_ORDER: Outcome[] = ["Regular", "Depth", "Missed"];
const OUTCOME_LABEL: Record<Outcome, string> = { Regular: "NHL Regular 100+", Depth: "NHL Depth 25–99", Missed: "Did not make NHL" };
const OUTCOME_COLOR: Record<Outcome, string> = { Regular: "#10B981", Depth: "#38BDF8", Missed: "#475569" };
const NODE_COLOR: Record<Bucket, string> = {
  NHL: "#E11D48", AHL: "#38BDF8", CHL: "#F59E0B", NCAA: "#8B5CF6", USHL: "#A78BFA",
  SHL: "#10B981", Liiga: "#34D399", KHL: "#F97316", Other: "#94A3B8", None: "#475569",
};
const NODE_LABEL: Record<Bucket, string> = {
  NHL: "NHL", AHL: "AHL", CHL: "CHL", NCAA: "NCAA", USHL: "USHL / Jr. A", SHL: "SHL", Liiga: "Liiga", KHL: "KHL", Other: "Other Pro/Euro", None: "Not playing",
};

const W = 1040;
const H = 560;
const TOP = 28;
const BAR = 12;
const GAP = 8;
const COL_X = COLUMNS.map((_, index) => 16 + index * ((W - 160) / (COLUMNS.length - 1)));

type Selection = { kind: "all" } | { kind: "node"; col: number; key: NodeKey } | { kind: "link"; col: number; src: NodeKey; dst: NodeKey };

function outcomeOf(row: Row): Outcome {
  return row.qg >= 100 ? "Regular" : row.qg >= 25 ? "Depth" : "Missed";
}

function keyAt(row: Row, col: number): NodeKey {
  return col === COLUMNS.length - 1 ? outcomeOf(row) : row.path[col] ?? "None";
}

function orderOf(col: number): NodeKey[] {
  return col === COLUMNS.length - 1 ? OUTCOME_ORDER : BUCKET_ORDER;
}

export function PathwayFlow({ cohort, buckets, matureThrough }: { cohort: CohortRow[]; buckets: Bucket[]; matureThrough: number }) {
  const all = useMemo(() => toRows(cohort, buckets), [cohort, buckets]);
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>("all");
  const [pos, setPos] = useState<"all" | "F" | "D" | "G">("all");
  const [origin, setOrigin] = useState<"all" | "CHL" | "US" | "EU">("all");
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [hover, setHover] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      all.filter((row) => {
        if (tier !== "all" && row.tier !== tier) return false;
        if (pos !== "all" && row.group !== pos) return false;
        const start = row.path[0];
        if (origin === "CHL" && start !== "CHL") return false;
        if (origin === "US" && start !== "NCAA" && start !== "USHL") return false;
        if (origin === "EU" && !["SHL", "Liiga", "KHL", "Other"].includes(start)) return false;
        return true;
      }),
    [all, tier, pos, origin],
  );

  const layout = useMemo(() => {
    const total = rows.length || 1;
    const nodes: { col: number; key: NodeKey; n: number; hits: number; x: number; y: number; h: number }[] = [];
    const nodeAt = new Map<string, (typeof nodes)[number]>();
    for (let col = 0; col < COLUMNS.length; col += 1) {
      const counts = new Map<NodeKey, { n: number; hits: number }>();
      for (const row of rows) {
        const key = keyAt(row, col);
        const entry = counts.get(key) ?? { n: 0, hits: 0 };
        entry.n += 1;
        entry.hits += row.qg >= 25 ? 1 : 0;
        counts.set(key, entry);
      }
      const present = orderOf(col).filter((key) => counts.has(key));
      const scale = (H - TOP - 8 - GAP * Math.max(0, present.length - 1)) / total;
      let y = TOP;
      for (const key of present) {
        const { n, hits } = counts.get(key)!;
        const h = Math.max(1.5, n * scale);
        const node = { col, key, n, hits, x: COL_X[col], y, h };
        nodes.push(node);
        nodeAt.set(`${col}:${key}`, node);
        y += h + GAP;
      }
    }
    const links: { col: number; src: NodeKey; dst: NodeKey; n: number; rate: number; path: string; width: number }[] = [];
    for (let col = 0; col < COLUMNS.length - 1; col += 1) {
      const pairs = new Map<string, { src: NodeKey; dst: NodeKey; n: number; hits: number }>();
      for (const row of rows) {
        const src = keyAt(row, col);
        const dst = keyAt(row, col + 1);
        const id = `${src}>${dst}`;
        const entry = pairs.get(id) ?? { src, dst, n: 0, hits: 0 };
        entry.n += 1;
        entry.hits += row.qg >= 25 ? 1 : 0;
        pairs.set(id, entry);
      }
      const order = orderOf(col);
      const nextOrder = orderOf(col + 1);
      const list = [...pairs.values()];
      const srcOffset = new Map<NodeKey, number>();
      const dstOffset = new Map<NodeKey, number>();
      const bySource = [...list].sort((a, b) => order.indexOf(a.src) - order.indexOf(b.src) || nextOrder.indexOf(a.dst) - nextOrder.indexOf(b.dst));
      const placed = new Map<string, { ys: number; yt: number; t: number }>();
      for (const link of bySource) {
        const source = nodeAt.get(`${col}:${link.src}`)!;
        const t = (link.n / source.n) * source.h;
        const offset = srcOffset.get(link.src) ?? 0;
        placed.set(`${link.src}>${link.dst}`, { ys: source.y + offset, yt: 0, t });
        srcOffset.set(link.src, offset + t);
      }
      const byTarget = [...list].sort((a, b) => nextOrder.indexOf(a.dst) - nextOrder.indexOf(b.dst) || order.indexOf(a.src) - order.indexOf(b.src));
      for (const link of byTarget) {
        const target = nodeAt.get(`${col + 1}:${link.dst}`)!;
        const entry = placed.get(`${link.src}>${link.dst}`)!;
        const t2 = (link.n / target.n) * target.h;
        const offset = dstOffset.get(link.dst) ?? 0;
        entry.yt = target.y + offset;
        dstOffset.set(link.dst, offset + t2);
        const x0 = COL_X[col] + BAR;
        const x1 = COL_X[col + 1];
        const mid = (x0 + x1) / 2;
        const t = Math.min(entry.t, t2);
        const path = `M${x0},${entry.ys} C${mid},${entry.ys} ${mid},${entry.yt} ${x1},${entry.yt} L${x1},${entry.yt + t} C${mid},${entry.yt + t} ${mid},${entry.ys + t} ${x0},${entry.ys + t} Z`;
        links.push({ col, src: link.src, dst: link.dst, n: link.n, rate: link.hits / link.n, path, width: t });
      }
    }
    return { nodes, links };
  }, [rows]);

  const picked = useMemo(() => {
    if (selection.kind === "all") return rows;
    if (selection.kind === "node") return rows.filter((row) => keyAt(row, selection.col) === selection.key);
    return rows.filter((row) => keyAt(row, selection.col) === selection.src && keyAt(row, selection.col + 1) === selection.dst);
  }, [rows, selection]);
  const summary = useMemo(() => summarize(picked), [picked]);

  const title =
    selection.kind === "all"
      ? "Every pick in this view"
      : selection.kind === "node"
        ? `${COLUMNS[selection.col]}: ${labelOf(selection.key)}`
        : `${labelOf(selection.src)} (${COLUMNS[selection.col]}) → ${labelOf(selection.dst)} (${COLUMNS[selection.col + 1]})`;

  function reset() {
    setSelection({ kind: "all" });
  }

  return (
    <section className="rounded-2xl border border-[#262B36] bg-[#14171F] p-4 sm:p-5">
      <div className="flex flex-col gap-2.5">
        <FilterPills label="Draft tier" value={tier} options={TIERS} onChange={(value) => { setTier(value); reset(); }} />
        <div className="flex flex-wrap gap-x-6 gap-y-2.5">
          <FilterPills
            label="Position"
            value={pos}
            options={[
              { id: "all", label: "All" },
              { id: "F", label: "F" },
              { id: "D", label: "D" },
              { id: "G", label: "G" },
            ]}
            onChange={(value) => { setPos(value); reset(); }}
          />
          <FilterPills
            label="Origin"
            value={origin}
            options={[
              { id: "all", label: "All origins" },
              { id: "CHL", label: "CHL" },
              { id: "US", label: "NCAA/USHL" },
              { id: "EU", label: "Europe/Other" },
            ]}
            onChange={(value) => { setOrigin(value); reset(); }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px]" role="img" aria-label="Development pathway flow">
            {COLUMNS.map((label, col) => (
              <text key={label} x={COL_X[col]} y={14} fill="#94A3B8" fontSize="12" fontWeight="600" letterSpacing="0.08em">
                {label.toUpperCase()}
              </text>
            ))}
            <g>
              {layout.links.map((link) => {
                const id = `${link.col}:${link.src}>${link.dst}`;
                const active =
                  (selection.kind === "link" && selection.col === link.col && selection.src === link.src && selection.dst === link.dst) ||
                  (selection.kind === "node" && ((selection.col === link.col && selection.key === link.src) || (selection.col === link.col + 1 && selection.key === link.dst)));
                const dim = selection.kind !== "all" && !active;
                const color = rateColor(link.rate);
                return (
                  <path
                    key={id}
                    d={link.path}
                    fill={color}
                    opacity={hover === id || active ? 0.9 : dim ? 0.12 : 0.45}
                    style={link.rate >= 0.6 && !dim ? { filter: `drop-shadow(0 0 3px ${color})` } : undefined}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHover(id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setSelection({ kind: "link", col: link.col, src: link.src, dst: link.dst })}
                  >
                    <title>{`${labelOf(link.src)} → ${labelOf(link.dst)}: ${link.n} players, ${pct(link.rate)} made the NHL`}</title>
                  </path>
                );
              })}
            </g>
            <g>
              {layout.nodes.map((node) => {
                const last = node.col === COLUMNS.length - 1;
                const color = last ? OUTCOME_COLOR[node.key as Outcome] : NODE_COLOR[node.key as Bucket];
                const active = selection.kind === "node" && selection.col === node.col && selection.key === node.key;
                return (
                  <g key={`${node.col}:${node.key}`} className="cursor-pointer" onClick={() => setSelection({ kind: "node", col: node.col, key: node.key })}>
                    <rect x={node.x} y={node.y} width={BAR} height={node.h} rx={2} fill={color} stroke={active ? "#F8FAFC" : "none"} strokeWidth={1.5} />
                    {node.h >= 11 ? (
                      <text x={node.x + BAR + 5} y={node.y + Math.min(node.h / 2, 14) + 4} fill="#F8FAFC" fontSize="11">
                        {labelOf(node.key)} <tspan fill="#94A3B8">{node.n.toLocaleString()}</tspan>
                      </text>
                    ) : null}
                    <title>{`${labelOf(node.key)}: ${node.n} players, ${pct(node.hits / node.n)} made the NHL`}</title>
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
            <span>Ribbon width = players. Colour = share who made the NHL (25+ career Impact):</span>
            {[
              ["60%+", "#10B981"],
              ["35–59%", "#38BDF8"],
              ["15–34%", "#5B7BA6"],
              ["under 15%", "#3A4150"],
            ].map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Inspect</p>
            {selection.kind !== "all" ? (
              <button type="button" onClick={reset} className="text-xs text-[#38BDF8] hover:underline">
                Clear
              </button>
            ) : null}
          </div>
          <p className="display mt-1 text-lg leading-snug font-bold">{title}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Click any column block or ribbon to inspect it.</p>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Box label="Players" value={summary.n.toLocaleString()} />
            <Box label="Made NHL (25+)" value={summary.n ? pct(summary.rate25) : "—"} tone="text-[#38BDF8]" />
            <Box label="Regular (100+)" value={summary.n ? pct(summary.rate100) : "—"} tone="text-[#10B981]" />
            <Box label="Avg years to NHL" value={summary.yearsToNhl == null ? "—" : `D+${summary.yearsToNhl.toFixed(1)}`} />
            <Box label="Avg career Impact" value={summary.n ? summary.avgImpact.toFixed(0) : "—"} />
            <Box label="NHL by D+6" value={summary.n ? pct(summary.reachedNhl / summary.n) : "—"} />
          </dl>
          {summary.examples.length ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">Top examples</p>
              <ul className="mt-2 space-y-1.5">
                {summary.examples.map((row) => (
                  <li key={row.id}>
                    <Link href={playerHref(row.id, "development")} className="flex items-center justify-between gap-2 text-sm hover:text-white">
                      <span className="truncate text-[#F8FAFC]">{row.name}</span>
                      <span className="shrink-0 text-xs text-[#94A3B8]">
                        {row.year} #{row.overall} · {row.qg.toFixed(0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-4 text-[11px] text-[#94A3B8]">
            Picks from 2005–{matureThrough}, so every player has six full seasons. League = where he played the most games that season.
          </p>
        </aside>
      </div>
    </section>
  );
}

function labelOf(key: NodeKey): string {
  return (OUTCOME_LABEL as Record<string, string>)[key] ?? NODE_LABEL[key as Bucket];
}

function Box({ label, value, tone = "text-[#F8FAFC]" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
      <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</dt>
      <dd className={`display text-xl font-bold ${tone}`}>{value}</dd>
    </div>
  );
}
