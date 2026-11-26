import type { Metadata } from "next";
import { ClassBoard, type ClassSummary } from "@/components/class-board";
import { draftClasses, picks } from "@/lib/data";

export const metadata: Metadata = {
  title: "Draft classes",
  description: "Every NHL draft class since 2005, graded on quality games versus the slot.",
};

export default function DraftsPage() {
  const totals = new Map<number, { total: number; regulars: number }>();
  for (const pick of picks) {
    const row = totals.get(pick.year) ?? { total: 0, regulars: 0 };
    row.total += 1;
    if (pick.qg >= 100) row.regulars += 1;
    totals.set(pick.year, row);
  }
  const rows: ClassSummary[] = draftClasses.map((row) => {
    const extra = totals.get(row.year) ?? { total: row.n, regulars: 0 };
    return {
      year: row.year,
      letter: row.n > 0 ? row.letter : null,
      rating: row.n > 0 ? row.rating : null,
      avg: row.n > 0 ? row.avg : null,
      graded: row.n,
      developing: row.developing,
      total: extra.total,
      regulars: extra.regulars,
    };
  });

  return (
    <div>
      <h1 className="display text-5xl font-bold">Draft classes</h1>
      <p className="mt-3 max-w-2xl text-zinc-400">
        Each year is graded on a weighted score versus the slot. Earlier picks count more. A class under half graded is an early sample, so the letter is only the players who have already arrived.
      </p>
      <ClassBoard rows={rows} />
    </div>
  );
}
