"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PickBrowser } from "@/components/pick-browser";
import { ShareLauncher } from "@/components/share-modal";
import { ScoutingPanels } from "@/components/scouting-panels";
import { TeamName } from "@/components/team-logo";
import { TogglePill } from "@/components/toggle-pill";
import { gradeOwned } from "@/lib/grade";
import { signed } from "@/lib/format";
import type { ScoutingReport } from "@/lib/scouting";
import type { Era, PickRow } from "@/lib/types";

export function EraProfile({
  era,
  teamPicks,
  careerPicks,
  pool,
  multiTeam,
  teamReport,
  careerReport,
}: {
  era: Era;
  teamPicks: PickRow[];
  careerPicks: PickRow[];
  pool: number[];
  multiTeam: boolean;
  teamReport: ScoutingReport;
  careerReport: ScoutingReport;
}) {
  const [scope, setScope] = useState<"team" | "career">("team");
  const rows = scope === "career" ? careerPicks : teamPicks;
  const stored = scope === "team";
  const computed = useMemo(() => gradeOwned(rows, pool), [rows, pool]);
  const avg = stored ? era.avg : computed.avg;
  const letter = stored ? era.letter : computed.letter;
  const rating = stored ? era.rating : computed.rating;
  const graded = stored ? era.n : computed.n;
  const developing = stored ? era.developing : computed.developing;
  const report = scope === "team" ? teamReport : careerReport;
  const ranked = useMemo(() => {
    const included = rows.filter((pick) => pick.included && pick.score != null);
    const byScore = [...included].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.overall - b.overall);
    return { best: byScore[0] ?? null, worst: byScore[byScore.length - 1] ?? null, notable: byScore.slice(0, 3) };
  }, [rows]);
  const years = [...new Set(rows.map((pick) => pick.year))].sort((a, b) => b - a);
  const teams = [...new Map(rows.map((pick) => [pick.franchise, pick.franchiseName])).entries()].map(([id, label]) => ({ id, label }));
  const tenure = `${era.startYear}–${era.endYear ?? "present"}`;
  const fileSlug = era.person.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div>
      <p className="text-sm text-zinc-500">
        <Link href={`/draft-rater/teams/${era.team.toLowerCase()}`} className="hover:text-white">
          <TeamName abbr={era.team} name={era.teamName} logoClassName="h-5 w-8" />
        </Link>
      </p>
      <p className="mt-4 text-sm tracking-wide text-zinc-500 uppercase">{era.role}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold sm:text-5xl">{era.person}</h1>
          <p className="mt-2 text-zinc-400">
            {scope === "team" ? tenure : "All teams"}
            {avg != null ? ` · ${signed(avg)} vs the slot · ${graded} graded` : ""}
            {developing > 0 ? ` · ${developing} ${developing === 1 ? "prospect" : "prospects"}` : ""}
          </p>
        </div>
        <p className="display text-7xl leading-none font-bold" style={{ color: era.color }}>
          {letter ?? "—"}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <TogglePill
          value={scope}
          options={[
            { id: "team", label: `${era.teamName} only` },
            { id: "career", label: "All teams" },
          ]}
          onChange={setScope}
        />
        <ShareLauncher
          fileSlug={fileSlug}
          title={`${era.person} draft grade`}
          summary={`${era.person} ${letter ?? "has no letter yet"}, ${signed(avg)} versus the slot.`}
          path={`/eras/${era.slug}`}
          card={{
            kind: "gm",
            person: era.person,
            team: era.team,
            teamName: era.teamName,
            color: era.color,
            tenure: scope === "team" ? tenure : "All teams",
            letter: letter ?? "—",
            rating,
            avg,
            graded,
            developing,
            report,
            best: ranked.best,
            worst: ranked.worst,
            notable: ranked.notable,
          }}
        />
      </div>
      {letter ? (
        <p className="mt-3 text-sm text-zinc-500">
          {rating}/100 among general managers. {scope === "team" ? `${era.teamName} drafts only.` : "Every franchise he has run."} The average weighs scouting decisions, not the lottery slot, and a short run is pulled toward zero.
        </p>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">A letter needs at least five graded picks. Prospects under 25 quality games stay in the list below and out of the average.</p>
      )}
      {era.note && scope === "team" ? <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">{era.note}</p> : null}
      {!multiTeam && scope === "career" ? <p className="mt-3 text-sm text-zinc-500">This run is his only NHL stop in the book, so the career view matches {era.teamName}.</p> : null}
      <ScoutingPanels report={report} />
      <section className="mt-10">
        <h2 className="display text-2xl font-bold">Picks</h2>
        <div className="mt-3">
          <PickBrowser picks={rows} years={years} teams={scope === "career" ? teams : undefined} showTeam={scope === "career"} />
        </div>
      </section>
    </div>
  );
}
