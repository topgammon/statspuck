import type { Metadata } from "next";
import { CapMeter } from "@/components/cap-meter";
import { money, RosterCard } from "@/components/perfect-roster-view";
import { contracts } from "@/lib/cap";
import { RosterBuilder } from "@/components/roster-builder";
import { perfectRoster, rosterPool } from "@/lib/perfect-roster";

export const metadata: Metadata = {
  title: "Perfect Roster",
  description: "The best possible 20-man NHL roster that fits under the salary cap, picked from every active player by Overall Skill and recent Impact.",
  alternates: { canonical: "/perfect-roster" },
};

export default function PerfectRosterPage() {
  const roster = perfectRoster();
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Perfect Roster</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">The best team money can legally buy</h1>
      <p className="mt-2 max-w-3xl text-[#94A3B8]">
        Every active NHL player on his real contract. We pick the 20 who give the most Overall Skill and recent Impact while the total cap hit stays under the {contracts.season} ceiling:
        4 left wings, 4 centres, 4 right wings, 3 left-shot and 3 right-shot defensemen, and 2 goalies. Solved exactly, then recalculated every night.
      </p>
      <a href="#build" className="mt-3 inline-block rounded-lg bg-[#38BDF8] px-4 py-2 text-sm font-bold text-[#0B0D10] hover:bg-[#7dd3fc]">
        Build your own roster →
      </a>
      {!roster ? (
        <p className="mt-6 text-sm text-[#94A3B8]">Not enough contract data to build a roster right now.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 rounded-2xl border border-[#262B36] bg-[#14171F] p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
            <CapMeter used={roster.total} ceiling={roster.ceiling} floor={roster.floor} label={`Cap used · ${contracts.season}`} />
            <dl className="grid grid-cols-3 gap-4 text-center lg:min-w-80">
              <div>
                <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Cap used</dt>
                <dd className="display text-2xl font-bold">{money(roster.total)}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Space left</dt>
                <dd className="display text-2xl font-bold text-[#10B981]">{money(roster.ceiling - roster.total)}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">Avg skill</dt>
                <dd className="display text-2xl font-bold">
                  {Math.round(([...roster.forwards.flatMap((l) => [l.LW, l.C, l.RW]), ...roster.defense.flatMap((p) => [p.LD, p.RD]), ...roster.goalies].reduce((s, p) => s + p.skill, 0) / 20))}
                </dd>
              </div>
            </dl>
          </div>

          <section className="mt-6">
            <h2 className="display text-2xl font-bold">Forward lines</h2>
            <div className="mt-3 grid gap-3">
              {roster.forwards.map((line, i) => (
                <div key={i} className="grid gap-2 rounded-2xl border border-[#262B36] bg-[#14171F] p-3 sm:grid-cols-[4rem_repeat(3,minmax(0,1fr))] sm:items-center">
                  <p className="display text-lg font-bold text-[#94A3B8]">Line {i + 1}</p>
                  <RosterCard player={line.LW} label="LW" />
                  <RosterCard player={line.C} label="C" />
                  <RosterCard player={line.RW} label="RW" />
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <h2 className="display text-2xl font-bold">Defense pairs</h2>
              <div className="mt-3 grid gap-3">
                {roster.defense.map((pair, i) => (
                  <div key={i} className="grid gap-2 rounded-2xl border border-[#262B36] bg-[#14171F] p-3 sm:grid-cols-[4rem_repeat(2,minmax(0,1fr))] sm:items-center">
                    <p className="display text-lg font-bold text-[#94A3B8]">Pair {i + 1}</p>
                    <RosterCard player={pair.LD} label="LD" />
                    <RosterCard player={pair.RD} label="RD" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="display text-2xl font-bold">Goalies</h2>
              <div className="mt-3 grid gap-3 rounded-2xl border border-[#262B36] bg-[#14171F] p-3">
                {roster.goalies.map((goalie, i) => (
                  <RosterCard key={goalie.playerId} player={goalie} label={i === 0 ? "Starter" : "Backup"} />
                ))}
              </div>
            </div>
          </section>

          <p className="mt-6 text-xs text-[#94A3B8]">
            Value = Overall Skill + recent Impact pace (Impact per 82 for skaters, per season for goalies) + a line chemistry bonus of up to ±3 for players whose 5-on-5 linemates
            get better (or worse) shot share with them on the ice (Game Edge WOWY).
            Chosen from {roster.pool} active players with a contract and a current Skill rating. Lines are ordered by value, not real-world deployment.
          </p>

          <RosterBuilder
            pool={rosterPool()}
            perfectIds={[
              ...roster.forwards.flatMap((l) => [l.LW.playerId, l.C.playerId, l.RW.playerId]),
              ...roster.defense.flatMap((p) => [p.LD.playerId, p.RD.playerId]),
              ...roster.goalies.map((g) => g.playerId),
            ]}
            perfectValue={roster.value}
            ceiling={roster.ceiling}
            floor={roster.floor}
            season={contracts.season}
          />
        </>
      )}
    </div>
  );
}
