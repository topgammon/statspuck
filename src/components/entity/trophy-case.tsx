import fs from "node:fs";
import path from "node:path";
import { SectionLabel } from "@/components/entity/bio";
import { TrophyArt } from "@/components/trophy-art";
import { isMajor, type Award } from "@/lib/awards";

// Trophy Case on the player Career tab: every NHL award he has won, as little cups on a shelf.

function season(start: number): string {
  return `${start}-${String(start + 1).slice(2)}`;
}

// FOUNDER: to use a real trophy photo instead of the drawing, drop a transparent PNG into
// public/trophy-art/ named after the award (e.g. public/trophy-art/stanley-cup.png,
// public/trophy-art/hart-memorial-trophy.png). The site picks it up on the next build.
const ART_DIR = path.join(process.cwd(), "public", "trophy-art");

export function trophySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[“”"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function photoFor(name: string): string | null {
  const file = `${trophySlug(name)}.png`;
  return fs.existsSync(path.join(ART_DIR, file)) ? `/trophy-art/${file}` : null;
}

function Cup({ name, gold }: { name: string; gold: boolean }) {
  const photo = photoFor(name);
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className="h-16 w-auto max-w-16 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]" />;
  }
  return <TrophyArt name={name} gold={gold} size={64} />;
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
              <Cup name={award.name} gold={isMajor(award.name)} />
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
