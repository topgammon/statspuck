/** Country code badge used next to birthplaces and in draft tables. */
export function CountryBadge({ code, name }: { code: string | null | undefined; name?: string }) {
  if (!code) return null;
  return (
    <span
      title={name ?? code}
      className="inline-flex shrink-0 items-center rounded border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-1 py-px font-mono text-[10px] leading-tight font-bold tracking-wider text-[#38BDF8]"
    >
      {code}
    </span>
  );
}
