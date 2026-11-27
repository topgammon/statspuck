import type { Metadata } from "next";
import Link from "next/link";
import { GameEdgePanel } from "@/components/entity/game-edge-panel";

export const metadata: Metadata = {
  title: "Game Edge",
  description: "Coming soon: goal-type breakdowns, line chemistry, goalie tendencies and pregame matchup edges from NHL play-by-play.",
  alternates: { canonical: "/game-edge" },
};

export default function GameEdgePage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-[#38BDF8] uppercase">Coming soon</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Game Edge</h1>
      <p className="mt-2 max-w-2xl text-[#94A3B8]">
        Pregame tactical scouting built from NHL play-by-play: how teams score, which lines click, and where goalies leak. Every player and team profile already has a Game Edge tab
        waiting for it.
      </p>
      <div className="mt-6">
        <GameEdgePanel subject="every NHL team" />
      </div>
      <p className="mt-6 text-sm">
        <Link href="/leaderboards" className="font-semibold text-[#38BDF8] hover:underline">
          Explore the live Leaderboards meanwhile →
        </Link>
      </p>
    </div>
  );
}
