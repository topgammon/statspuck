import treesJson from "../../data/draft-rater/trade_trees.json";
import { gmOn } from "./gm-grades";
import { assetFor } from "./valuation";

// Trade trees: when a team trades away something it got in an earlier trade (or the player it drafted with a
// pick it got in a trade), that later deal grows the same tree. Built nightly by pipelines/draft-rater/fetch_trades.py.

type RawPiece = [string, number, "p" | "k", number, number, string];
type RawDraft = [string, string, number, number, string];
type RawStep = { d: string; t: string; o: string; gave: [string, number, "p" | "k", number, number][]; got: RawPiece[]; draft: RawDraft[]; kids: string[] };
type RawTree = { root: string; size: number; depth: number; from: string; to: string; active: number; team: string };
type File = { asOf: string; trees: RawTree[]; steps: Record<string, RawStep> };

const file = treesJson as unknown as File;

export type TreePiece = {
  label: string;
  value: number;
  kind: "p" | "k";
  /** NHL player id (0 for picks and unknown players). */
  pid: number;
  /** /players/[id] route id, 0 if the player has no profile. */
  rid: number;
  /** For players nobody traded on: "a" on this team now, "x" with another team, "r" retired or inactive. */
  status: string;
  /** Asset Value of a player still on this team's roster. */
  rating: number | null;
};

export type TreeStep = {
  d: string;
  t: string;
  o: string;
  gm: { slug: string; person: string } | null;
  gave: TreePiece[];
  got: TreePiece[];
  /** Players this team drafted with a pick it got in the trade. */
  drafted: { name: string; pick: string; rid: number; status: string; rating: number | null }[];
  kids: string[];
};

export type TreeSummary = {
  root: string;
  team: string;
  size: number;
  depth: number;
  from: string;
  to: string;
  years: number;
  active: number;
  title: string;
  /** Players from this tree who are still on the team's roster today. */
  activeNames: string[];
};

const piece = (raw: [string, number, "p" | "k", number, number] | RawPiece): TreePiece => {
  const pid = raw[3];
  const status = (raw as RawPiece)[5] ?? "";
  return { label: raw[0], value: raw[1], kind: raw[2], pid, rid: raw[4], status, rating: status === "a" && pid ? (assetFor(pid)?.rating ?? null) : null };
};

export const treeSteps: Record<string, TreeStep> = {};
for (const [key, step] of Object.entries(file.steps)) {
  treeSteps[key] = {
    d: step.d,
    t: step.t,
    o: step.o,
    gm: gmOn(step.t, step.d),
    gave: step.gave.map(piece),
    got: step.got.map(piece),
    drafted: step.draft.map(([name, pick, pid, rid, status]) => ({ name, pick, rid, status, rating: status === "a" && pid ? (assetFor(pid)?.rating ?? null) : null })),
    kids: step.kids,
  };
}

function titleOf(step: TreeStep): string {
  const players = step.gave.filter((p) => p.kind === "p").map((p) => p.label);
  const picks = step.gave.filter((p) => p.kind === "k").map((p) => p.label);
  const names = [...players, ...picks];
  if (names.length === 0) {
    const first = step.got[0]?.label;
    return first ? `Acquired ${first}` : "Trade";
  }
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
}

function activeNames(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const step = treeSteps[stack.pop() as string];
    if (!step) continue;
    for (const p of step.got) if (p.status === "a") out.push(p.label);
    for (const d of step.drafted) if (d.status === "a") out.push(d.name);
    stack.push(...step.kids);
  }
  return out;
}

export const treeList: TreeSummary[] = file.trees.map((tree) => ({
  root: tree.root,
  team: tree.team,
  size: tree.size,
  depth: tree.depth,
  from: tree.from,
  to: tree.to,
  years: Math.round((new Date(tree.to).getTime() - new Date(tree.from).getTime()) / (365.25 * 86_400_000)),
  active: tree.active,
  title: titleOf(treeSteps[tree.root]),
  activeNames: activeNames(tree.root),
}));

export type Callout = { id: string; label: string; big: string; unit: string; blurb: string; root: string };

function pick(list: TreeSummary[], score: (t: TreeSummary) => number): TreeSummary | null {
  return [...list].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** The headline trees: longest active chain, deepest ever, biggest, and longest-running. */
export function treeCallouts(): Callout[] {
  const live = treeList.filter((t) => t.active > 0);
  const out: Callout[] = [];
  const longest = pick(live, (t) => t.depth * 1000 + t.size);
  if (longest) out.push({ id: "active", label: "Longest active trade tree", big: String(longest.depth), unit: "trades deep", blurb: `${longest.title} (${longest.team}, ${longest.from.slice(0, 4)}). Still on the roster: ${longest.activeNames.slice(0, 3).join(", ")}.`, root: longest.root });
  const deepest = pick(treeList, (t) => t.depth * 1000 + t.size);
  if (deepest && deepest.root !== longest?.root) out.push({ id: "deepest", label: "Deepest tree ever", big: String(deepest.depth), unit: "trades deep", blurb: `${deepest.title} (${deepest.team}, ${deepest.from.slice(0, 4)}–${deepest.to.slice(0, 4)}).`, root: deepest.root });
  const biggest = pick(treeList, (t) => t.size * 1000 + t.depth);
  if (biggest) out.push({ id: "biggest", label: "Biggest tree", big: String(biggest.size), unit: "trades in the tree", blurb: `${biggest.title} (${biggest.team}, ${biggest.from.slice(0, 4)}).`, root: biggest.root });
  const oldest = pick(live, (t) => t.years * 1000 + t.size);
  if (oldest) out.push({ id: "oldest", label: "Longest-running active tree", big: String(oldest.years), unit: "years of trades", blurb: `${oldest.title} (${oldest.team}, ${oldest.from.slice(0, 4)}). Still growing: ${oldest.activeNames.slice(0, 2).join(", ")} on the roster.`, root: oldest.root });
  return out;
}
