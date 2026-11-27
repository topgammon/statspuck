import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonStamp } from "@/components/entity/hero-box";

export const metadata: Metadata = {
  title: "Ref Watch",
  description: "Coming soon: referee crew assignments, call tendencies and a pregame Ref Edge for every NHL game.",
  alternates: { canonical: "/ref-watch" },
};

const PIECES = [
  { title: "Crew tendencies", body: "Penalties called per game by each referee, by type, against the league average." },
  { title: "Home / away splits", body: "Whether a crew's calls lean toward the home side." },
  { title: "Team differentials", body: "Power-play opportunities for and against each team under each crew." },
  { title: "Pregame Ref Edge", body: "Tonight's assigned crew turned into one simple edge for each side." },
];

export default function RefWatchPage() {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[#38BDF8] uppercase">Coming soon</p>
          <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Ref Watch</h1>
          <p className="mt-2 max-w-2xl text-[#94A3B8]">Referee transparency reports from public NHL game data. No opinions, just how each crew actually calls the game.</p>
        </div>
        <ComingSoonStamp />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {PIECES.map((piece) => (
          <div key={piece.title} className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/70 p-5">
            <p className="display text-xl font-bold">{piece.title}</p>
            <p className="mt-1 text-sm text-[#94A3B8]">{piece.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm">
        <Link href="/leaderboards" className="font-semibold text-[#38BDF8] hover:underline">
          Explore the live Leaderboards meanwhile →
        </Link>
      </p>
    </div>
  );
}
