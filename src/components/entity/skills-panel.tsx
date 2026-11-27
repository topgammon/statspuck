import Link from "next/link";
import { ArchetypePill, SectionLabel } from "@/components/entity/bio";
import { InfoTip } from "@/components/info-tip";
import { skillColor, skillTone, type SkillProfile } from "@/lib/skills";

// Skills tab: 6-axis radar plus progress bars, all on the 0-99 scale.

export function SkillsPanel({ skills, name, note }: { skills: SkillProfile | null; name: string; note?: string }) {
  if (!skills) {
    return (
      <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-6 sm:p-8">
        <SectionLabel>Skills</SectionLabel>
        <h2 className="display mt-3 text-2xl font-bold">Not enough NHL games yet</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
          {note ??
            `Skill ratings need 40+ NHL games (30 for goalies) in ${name}'s last three seasons. Until then, his Career tab shows how he is tracking against his draft slot.`}
        </p>
        <Link href="/leaderboards?board=players" className="mt-4 inline-block text-sm font-semibold text-[#38BDF8] hover:underline">
          See the Overall Skill leaderboard →
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Skill radar</SectionLabel>
          <ArchetypePill archetype={skills.archetype} small />
        </div>
        <Radar skills={skills} />
        <p className="mt-2 text-center text-xs text-[#94A3B8]">
          {skills.window} · {skills.gp} GP · ranked against today&apos;s NHL regulars at his position
        </p>
      </div>
      <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel>Breakdown · 0–99</SectionLabel>
          <Link href="/leaderboards?board=players" className="text-xs font-semibold text-[#38BDF8] hover:underline">
            Skill leaderboard →
          </Link>
        </div>
        <ul className="mt-4 space-y-3.5">
          {skills.axes.map((axis) => (
            <li key={axis.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-[#F8FAFC]">
                  {axis.label}
                  {axis.proxy ? <span className="rounded bg-white/5 px-1 text-[9px] font-bold tracking-wider text-[#94A3B8] uppercase">proxy</span> : null}
                  <InfoTip text={axis.tip} align="start" />
                </span>
                <span className={`display text-lg font-bold ${skillTone(axis.value)}`}>{axis.value ?? "Soon"}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]">
                {axis.value != null ? (
                  <div className="h-full rounded-full" style={{ width: `${axis.value}%`, background: skillColor(axis.value) }} />
                ) : (
                  <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#262B36_0_6px,transparent_6px_12px)]" />
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-5 text-[#94A3B8]">
          The Overall Skill Rating leads with Impact per game, then adds these six axes weighted for his position, and compares him with every NHL regular. About 72 is a
          league-average regular, 85+ is a first-liner or top-pair defenseman, and 95+ is the league&apos;s elite. Each axis is a percentile: about 65 is the middle of the league.
        </p>
      </div>
    </div>
  );
}

function Radar({ skills }: { skills: SkillProfile }) {
  const size = 320;
  const c = size / 2;
  const r = 112;
  const n = skills.axes.length;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
    return [c + Math.cos(angle) * r * (value / 99), c + Math.sin(angle) * r * (value / 99)];
  };
  const rings = [25, 50, 75, 99];
  const shape = skills.axes.map((axis, index) => point(index, axis.value ?? 0).map((v) => v.toFixed(1)).join(",")).join(" ");
  const color = skillColor(skills.overall);
  return (
    <svg viewBox={`-56 -18 ${size + 112} ${size + 36}`} className="mx-auto mt-2 h-auto w-full max-w-[22rem]" role="img" aria-label={`Skill radar: ${skills.axes.map((a) => `${a.label} ${a.value ?? "not rated"}`).join(", ")}`}>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={skills.axes.map((_, index) => point(index, ring).map((v) => v.toFixed(1)).join(",")).join(" ")}
          fill="none"
          stroke="#262B36"
          strokeWidth="1"
        />
      ))}
      {skills.axes.map((axis, index) => {
        const [x, y] = point(index, 99);
        return <line key={axis.id} x1={c} y1={c} x2={x} y2={y} stroke="#262B36" strokeWidth="1" />;
      })}
      <polygon points={shape} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {skills.axes.map((axis, index) => {
        if (axis.value == null) return null;
        const [x, y] = point(index, axis.value);
        return <circle key={axis.id} cx={x} cy={y} r="3.5" fill="#0B0D10" stroke={color} strokeWidth="2" />;
      })}
      {skills.axes.map((axis, index) => {
        const [x, y] = point(index, 128);
        const anchor = Math.abs(x - c) < 8 ? "middle" : x > c ? "start" : "end";
        const short = axis.label.replace("High-Danger / ", "").replace(" & Stamina", "");
        return (
          <g key={axis.id}>
            <text x={x} y={y - 2} textAnchor={anchor} fontSize="11" fontWeight="600" fill="#94A3B8">
              {short}
            </text>
            <text x={x} y={y + 12} textAnchor={anchor} fontSize="12" fontWeight="700" fill={axis.value == null ? "#64748B" : "#F8FAFC"}>
              {axis.value ?? "Soon"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
