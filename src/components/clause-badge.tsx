/** NMC / NTC / M-NTC / M-NMC trade-protection badge. Full protection is orange, partial amber. */
export function ClauseBadge({ clause, text, small = false }: { clause: string | null | undefined; text?: string | null; small?: boolean }) {
  if (!clause) return null;
  const full = clause === "NMC" || clause === "NTC";
  return (
    <span
      title={text ?? (full ? "Full trade protection: the player must agree to any trade." : "Partial trade protection: the player lists teams he cannot be traded to.")}
      className={`display inline-flex shrink-0 items-center rounded border font-bold tracking-[0.12em] ${small ? "px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px]"} ${
        full ? "border-[#F97316]/60 bg-[#F97316]/10 text-[#FDBA74]" : "border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#FCD34D]"
      }`}
    >
      {clause}
    </span>
  );
}
