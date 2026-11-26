"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PickBrowser } from "@/components/pick-browser";
import { Trend } from "@/components/pick-table";
import type { Era, PickRow, YearPoint } from "@/lib/types";

export function TeamBreakdown({
  eras,
  color,
  byYear,
  picks,
}: {
  eras: Era[];
  color: string;
  byYear: YearPoint[];
  picks: PickRow[];
}) {
  const [year, setYear] = useState("all");
  const picksRef = useRef<HTMLElement>(null);
  const years = [...new Set(picks.map((pick) => pick.year))].sort((a, b) => b - a);

  function chooseYear(next: number) {
    const value = String(next);
    const clearing = year === value;
    setYear(clearing ? "all" : value);
    if (!clearing) picksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const captions = Object.fromEntries(
    byYear.map((point) => [
      String(point.year),
      {
        label: `${point.year} draft class`,
        letter: point.letter,
        avg: point.avg,
        n: point.n,
        developing: point.developing,
      },
    ]),
  );

  return (
    <>
      {eras.length > 0 ? (
        <section className="mt-10">
          <h2 className="display text-2xl font-bold">GM eras</h2>
          <p className="mt-1 text-sm text-zinc-500">
            The general manager who held the job on draft day, back to 2005. Every graduated pick counts equally, with a #1 overall hit capped at +250.
          </p>
          <div className="mt-3 grid gap-2">
            {eras.map((item) => (
              <Link
                key={item.slug}
                href={`/draft-rater/eras/${item.slug}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 hover:bg-white/[0.03]"
              >
                <span>
                  <span className="font-medium">{item.person}</span>
                  <span className="ml-2 text-sm text-zinc-500">
                    {item.startYear}–{item.endYear ?? "present"}
                    {item.developing > 0 ? ` · ${item.developing} ${item.developing === 1 ? "prospect" : "prospects"}` : ""}
                  </span>
                </span>
                <span className="display text-2xl font-bold" style={{ color }}>
                  {item.letter ?? "—"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="display text-2xl font-bold">By draft class</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Each bar is the average of graded picks. The line is a 3-year rolling average. Click a year to filter the picks below. Click it again, or choose All years, to reset.
        </p>
        <Trend points={byYear} selected={year} onSelect={chooseYear} />
      </section>

      <section ref={picksRef} id="picks" className="mt-10 scroll-mt-6">
        <h2 className="display text-2xl font-bold">Picks</h2>
        <div className="mt-3">
          <PickBrowser picks={picks} years={years} captions={captions} year={year} onYearChange={setYear} />
        </div>
      </section>
    </>
  );
}
