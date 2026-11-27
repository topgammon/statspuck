import Link from "next/link";
import { SectionLabel } from "@/components/entity/bio";
import { capSeasonStart, money } from "@/lib/cap";
import type { ContractRow } from "@/lib/team-contracts";

// Two boxes under the team contracts table:
//   Pending UFAs        - deals that end after this season with the player reaching unrestricted free agency
//   Expiring next season - every deal that ends after the following season (UFA and RFA)

function season(start: number): string {
  return `${start}-${String(start + 1).slice(2)}`;
}

function List({ rows, empty }: { rows: ContractRow[]; empty: string }) {
  if (!rows.length) return <p className="mt-3 text-sm text-[#94A3B8]">{empty}</p>;
  return (
    <ul className="mt-3 divide-y divide-[#262B36]">
      {rows.map((row) => (
        <li key={row.playerId} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            {row.routeId ? (
              <Link href={`/players/${row.routeId}?tab=asset`} className="font-semibold hover:text-[#38BDF8]">
                {row.name}
              </Link>
            ) : (
              <span className="font-semibold">{row.name}</span>
            )}
            <span className="text-xs text-[#94A3B8]">
              {" "}
              · {row.pos}
              {row.age != null ? ` · ${row.age}` : ""}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="tabular-nums text-[#F8FAFC]/90">{money(row.aav)}</span>
            {row.status ? (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${row.status === "UFA" ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#38BDF8]/15 text-[#38BDF8]"}`}>{row.status}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ExpiringContracts({ rows }: { rows: ContractRow[] }) {
  const thisSummer = capSeasonStart + 1;
  const nextSummer = capSeasonStart + 2;
  const pendingUfas = rows.filter((row) => row.expires === thisSummer && row.status === "UFA");
  const nextYear = rows.filter((row) => row.expires === nextSummer);
  const total = (list: ContractRow[]) => list.reduce((sum, row) => sum + row.aav, 0);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#10B981]/30 bg-[#14171F] p-5">
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel>Pending UFAs · July {thisSummer}</SectionLabel>
          <span className="text-xs text-[#94A3B8]">{pendingUfas.length ? `${money(total(pendingUfas))} coming off the cap` : ""}</span>
        </div>
        <p className="mt-1 text-xs text-[#94A3B8]">Contracts ending after {season(capSeasonStart)} where the player can sign anywhere.</p>
        <List rows={pendingUfas} empty="No pending unrestricted free agents." />
      </div>
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel>Expiring after {season(capSeasonStart + 1)}</SectionLabel>
          <span className="text-xs text-[#94A3B8]">{nextYear.length ? `${money(total(nextYear))} total` : ""}</span>
        </div>
        <p className="mt-1 text-xs text-[#94A3B8]">Every deal that runs out in July {nextSummer}, with free-agent status.</p>
        <List rows={nextYear} empty="No contracts expire that summer." />
      </div>
    </div>
  );
}
