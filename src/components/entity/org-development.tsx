import Link from "next/link";
import { DevLeaderboard, type DevLeaderRow } from "@/components/entity/dev-leaderboard";
import { DEV_SCORE_TIP, scoreClass, signed } from "@/lib/format";
import { playerHref } from "@/lib/routes";
import { letterTone } from "@/lib/search";
import type { DevGrade } from "@/lib/types";
import { SectionLabel } from "./bio";

export type DevGem = { id: number; name: string; year: number; overall: number; q6: number; dev: number };

function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function delta(actual: number | null, expected: number | null): { text: string; tone: string } {
  if (actual == null || expected == null) return { text: "", tone: "text-[#94A3B8]" };
  const diff = Math.round((actual - expected) * 100);
  if (diff === 0) return { text: "even", tone: "text-[#94A3B8]" };
  return diff > 0 ? { text: `+${diff} pts`, tone: "text-[#10B981]" } : { text: `${diff} pts`, tone: "text-[#EF4444]" };
}

/** The Development tab for a team or GM: grade, graduation by round, best developed picks, and the league board. */
export function OrgDevelopment({
  subject,
  dev,
  gems,
  board,
  highlight,
  matureThrough,
  note,
}: {
  subject: string;
  dev: DevGrade | null | undefined;
  gems: DevGem[];
  board: DevLeaderRow[];
  highlight?: string;
  matureThrough: number;
  note?: string;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-[#38BDF8]/40 bg-[#14171F] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>Development Grade</SectionLabel>
              <p className="mt-1 text-sm text-[#94A3B8]">{subject}</p>
            </div>
            <span className={`display rounded-xl border px-3 py-1 text-4xl leading-none font-bold ${letterTone(dev?.letter)}`}>{dev?.letter ?? "—"}</span>
          </div>
          {dev ? (
            <>
              <p className="mt-4 text-sm text-[#94A3B8]" title={DEV_SCORE_TIP}>
                Dev Score <span className={`display text-2xl font-bold ${scoreClass(dev.avg)}`}>{signed(dev.avg)}</span>
                {dev.rank ? <span> · #{dev.rank} of {board.length}</span> : null}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#94A3B8]">
                {DEV_SCORE_TIP} Based on {dev.n} picks from {matureThrough} and earlier, so every pick has had six full seasons.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-[#94A3B8]">No picks have had six full seasons yet, so there is no Development Grade.</p>
          )}
          {note ? <p className="mt-3 text-xs text-[#94A3B8]">{note}</p> : null}
        </div>

        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>NHL graduation by round (by year six)</SectionLabel>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] tracking-wide text-[#94A3B8] uppercase">
                <tr>
                  <th className="py-2 pr-3 font-medium">Round</th>
                  <th className="py-2 pr-3 font-medium">Picks</th>
                  <th className="py-2 pr-3 font-medium" title="Reached 25 Impact by year six">Made NHL (25+)</th>
                  <th className="py-2 pr-3 font-medium" title="Reached 100 Impact by year six">Regular (100+)</th>
                </tr>
              </thead>
              <tbody>
                {(dev?.rounds ?? []).map((row) => {
                  const d25 = delta(row.rate25, row.expected25);
                  const d100 = delta(row.rate100, row.expected100);
                  return (
                    <tr key={row.label} className="border-t border-[#262B36]">
                      <td className="py-2.5 pr-3 font-semibold">{row.label}</td>
                      <td className="py-2.5 pr-3 text-[#94A3B8]">{row.n}</td>
                      <td className="py-2.5 pr-3">
                        <span className="display text-lg font-bold">{pct(row.rate25)}</span>{" "}
                        <span className={`text-xs ${d25.tone}`}>{d25.text}</span>
                        <span className="block text-[11px] text-[#94A3B8]">expected {pct(row.expected25)} · NHL {pct(row.league25)}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="display text-lg font-bold">{pct(row.rate100)}</span>{" "}
                        <span className={`text-xs ${d100.tone}`}>{d100.text}</span>
                        <span className="block text-[11px] text-[#94A3B8]">expected {pct(row.expected100)} · NHL {pct(row.league100)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!dev ? <p className="py-3 text-sm text-[#94A3B8]">No mature picks yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>Best developed picks</SectionLabel>
        {gems.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {gems.map((gem) => (
              <Link key={gem.id} href={playerHref(gem.id, "development")} className="rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-3 hover:border-[#38BDF8]/60">
                <p className="font-semibold">{gem.name}</p>
                <p className="text-xs text-[#94A3B8]">
                  {gem.year} · #{gem.overall}
                </p>
                <p className="mt-2 text-xs text-[#94A3B8]">
                  <span className="display text-lg font-bold text-[#10B981]">{signed(gem.dev)}</span> dev · {gem.q6.toFixed(0)} Impact by Y6
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#94A3B8]">None yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <SectionLabel>League-wide team development leaderboard</SectionLabel>
        <div className="mt-3">
          <DevLeaderboard rows={board} highlight={highlight} />
        </div>
      </div>
    </div>
  );
}
