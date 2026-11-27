import { SectionLabel } from "@/components/entity/bio";
import { isMajor, type Award } from "@/lib/awards";

// Trophy Case on the player Career tab: every NHL award he has won, as little cups on a shelf.

function season(start: number): string {
  return `${start}-${String(start + 1).slice(2)}`;
}

function Cup({ gold }: { gold: boolean }) {
  const metal = gold ? "#F59E0B" : "#CBD5E1";
  const shine = gold ? "#FCD34D" : "#F1F5F9";
  return (
    <svg viewBox="0 0 48 56" className="h-14 w-12 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]" aria-hidden>
      <path d="M12 6h24v12c0 8-5.4 14-12 14S12 26 12 18V6Z" fill={metal} />
      <path d="M15 8h5v11c0 4 1.4 7 3 8.5-4.5-.8-8-4.6-8-9.5V8Z" fill={shine} opacity="0.55" />
      <path d="M12 9H6v4c0 5 3 8 7 8.5M36 9h6v4c0 5-3 8-7 8.5" fill="none" stroke={metal} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="21" y="31" width="6" height="9" fill={metal} />
      <rect x="14" y="40" width="20" height="5" rx="1.5" fill={metal} />
      <rect x="11" y="45" width="26" height="7" rx="2" fill="#262B36" stroke={metal} strokeOpacity="0.5" />
    </svg>
  );
}

export function TrophyCase({ awards, name }: { awards: Award[]; name: string }) {
  if (!awards.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-5">
        <SectionLabel>Trophy case</SectionLabel>
        <p className="mt-2 text-sm text-[#94A3B8]">No NHL awards for {name} yet.</p>
      </div>
    );
  }
  const total = awards.reduce((sum, award) => sum + award.seasons.length, 0);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#F59E0B]/30 bg-[#14171F] p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#F59E0B]/[0.07] to-transparent" />
      <div className="relative flex items-center justify-between gap-2">
        <SectionLabel>Trophy case</SectionLabel>
        <span className="text-xs text-[#94A3B8]">
          {total} NHL award{total === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {awards.map((award) => (
          <li key={award.name} className="flex flex-col items-center rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-2 pt-3 pb-2 text-center" title={award.seasons.map(season).join(", ")}>
            <span className="relative">
              <Cup gold={isMajor(award.name)} />
              {award.seasons.length > 1 ? (
                <span className="display absolute -top-1 -right-3 rounded-full bg-[#E11D48] px-1.5 text-xs font-bold text-white">×{award.seasons.length}</span>
              ) : null}
            </span>
            <span className="mt-2 text-xs leading-tight font-semibold">{award.name.replace(" Memorial", "")}</span>
            <span className="mt-1 text-[10px] leading-tight text-[#94A3B8]">{award.seasons.map(season).join(" · ")}</span>
          </li>
        ))}
      </ul>
      {/* The shelf */}
      <div className="relative mt-3 h-1.5 rounded-full bg-gradient-to-r from-transparent via-[#F59E0B]/40 to-transparent" />
    </div>
  );
}
