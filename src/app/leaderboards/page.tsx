import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardsHub } from "@/components/leaderboards-hub";
import { allBoards } from "@/lib/leaderboards";
import { seasonList } from "@/lib/season-leaders";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Every StatsPuck ranking in one place: Overall Skill, teams, GMs, best contract value, draft steals and development.",
  alternates: { canonical: "/leaderboards" },
};

export default function LeaderboardsPage() {
  const boards = allBoards();
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Leaderboards</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Every ranking, one click deep</h1>
      <p className="mt-2 max-w-2xl text-[#94A3B8]">Sort any board, then click a row to jump straight to that player, team or GM.</p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-[#94A3B8]">Loading leaderboards…</p>}>
          <LeaderboardsHub boards={boards} seasons={seasonList()} />
        </Suspense>
      </div>
    </div>
  );
}
