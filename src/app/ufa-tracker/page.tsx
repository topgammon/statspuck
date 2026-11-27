import type { Metadata } from "next";
import { UfaTracker } from "@/components/ufa-tracker";
import { capSeasonStart, capShare, contracts } from "@/lib/cap";
import { nextContract } from "@/lib/contract-comps";
import type { Board, BoardRow } from "@/lib/leaderboards";
import { ageAtSeason, nhlerFor, nhlersFile } from "@/lib/nhlers";
import { profileRows } from "@/lib/profiles";
import { playerHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "UFA & RFA Tracker",
  description: "Every NHL player heading to unrestricted or restricted free agency in the next two summers, with skill, recent Impact and a projected next contract.",
  alternates: { canonical: "/ufa-tracker" },
};

function season(start: number): string {
  return `${start}-${String(start + 1).slice(2)}`;
}

export default function UfaTrackerPage() {
  const summers = [capSeasonStart + 1, capSeasonStart + 2];
  const rows: BoardRow[] = [];
  for (const row of profileRows()) {
    const contract = row.active ? row.contract : null;
    if (!contract || !summers.includes(contract.expires)) continue;
    const status = contract.status ?? null;
    if (!status) continue;
    const next = nextContract(row.playerId);
    const age = ageAtSeason(nhlerFor(row.playerId)?.bd, nhlersFile.season);
    rows.push({
      href: playerHref(row.routeId, "asset"),
      tags: [status.toLowerCase(), `pos:${row.group}`, `y${contract.expires}`],
      name: row.name,
      sub: `${row.team ?? "—"} · signs July ${contract.expires}`,
      image: { kind: "player", playerId: row.playerId, headshot: row.hasHeadshot },
      values: {
        status,
        age: age != null ? age + 1 : null,
        pos: row.pos,
        archetype: row.skills?.archetype ?? "—",
        skill: row.skills?.current ? row.skills.overall : null,
        impact: row.recentRate == null ? null : Math.round(row.recentRate * 10) / 10,
        aav: contract.aav,
        nextAav: next?.aav ?? null,
        nextTerm: next?.term ?? null,
        nextAsset: next?.asset ?? null,
        cap: Math.round(capShare(contract.aav) * 1000) / 10,
      },
    });
  }
  rows.sort((a, b) => ((b.values.nextAav as number) ?? 0) - ((a.values.nextAav as number) ?? 0));

  const board: Board = {
    id: "contracts",
    label: "UFA & RFA Tracker",
    blurb: "",
    rankBy: "nextAav",
    columns: [
      { key: "status", label: "Status", format: "text", tip: "UFA: can sign with any team. RFA: his team keeps matching rights (qualifying offer, offer sheets, arbitration)." },
      { key: "age", label: "Age", format: "int", tip: "Age on July 1 when he hits free agency" },
      { key: "pos", label: "Pos", format: "text" },
      { key: "archetype", label: "Role", format: "text" },
      { key: "skill", label: "Skill", format: "skill", desc: true, tip: "Overall Skill Rating, 0-99" },
      { key: "impact", label: "Impact / 82", format: "dec1", desc: true, tip: "Impact per 82 games over the last two seasons" },
      { key: "aav", label: "Expiring AAV", format: "money", desc: true },
      { key: "nextAav", label: "Proj. AAV", format: "money", desc: true, tip: "Projected next contract from the 5 closest comparable contracts, at today's cap" },
      { key: "nextTerm", label: "Proj. term", format: "int", desc: true, tip: "Projected length in years (median of the comparables)" },
      { key: "nextAsset", label: "Proj. Asset Value", format: "int", desc: true, tip: "Asset Value (0-100) on the projected new deal" },
    ],
    rows,
  };

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">UFA &amp; RFA Tracker</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Who hits the market next</h1>
      <p className="mt-2 max-w-2xl text-[#94A3B8]">
        Every NHL player whose contract ends after {season(capSeasonStart)} or {season(capSeasonStart + 1)}, with his skill, recent Impact and a projected next contract built from the closest
        comparable deals. Status comes from {contracts.source ? "public contract records" : "the cap data"}.
      </p>
      <div className="mt-6">
        <UfaTracker board={board} summers={summers} />
      </div>
    </div>
  );
}
