import Link from "next/link";
import { StatsPuckBadge } from "@/components/wordmark";

const modules = [
  {
    href: "/draft-rater",
    name: "Draft Rater",
    status: "Live",
    blurb: "Every NHL pick since 2005 graded against its draft slot. Teams and GMs ranked on scouting skill, not lottery luck.",
  },
  { name: "Development Path Lab", status: "Coming soon", blurb: "Which league routes actually get prospects to the NHL." },
  { name: "Trade Machine", status: "Coming soon", blurb: "Every player and pick valued on one scale." },
  { name: "Matchup Lab", status: "Coming soon", blurb: "Goal types, goalie tendencies, and pregame edges." },
];

export default function HubPage() {
  return (
    <div>
      <section className="flex flex-col items-start gap-6">
        <StatsPuckBadge height={120} />
        <p className="text-sm tracking-[0.18em] text-[#E11D48] uppercase">Hockey intelligence</p>
        <h1 className="display max-w-3xl text-5xl leading-[0.95] font-bold sm:text-6xl">
          Hockey decisions, boiled down to the math.
        </h1>
        <p className="max-w-2xl text-lg text-[#94A3B8]">
          Clear, objective answers for fans, fantasy players, agents, and front offices.
        </p>
        <Link
          href="/draft-rater"
          className="rounded-lg bg-[#E11D48] px-5 py-3 font-semibold text-white transition hover:bg-[#be123c]"
        >
          Open the Draft Rater →
        </Link>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        {modules.map((item) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="display text-2xl font-bold">{item.name}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${
                    item.href ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#38BDF8]/10 text-[#38BDF8]"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-[#94A3B8]">{item.blurb}</p>
            </>
          );
          return item.href ? (
            <Link
              key={item.name}
              href={item.href}
              className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5 transition hover:border-[#E11D48]"
            >
              {body}
            </Link>
          ) : (
            <div key={item.name} className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5 opacity-80">
              {body}
            </div>
          );
        })}
      </section>
    </div>
  );
}
