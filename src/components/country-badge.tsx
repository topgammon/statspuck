/* eslint-disable @next/next/no-img-element */
import { flagUrl, iocCode } from "@/lib/countries";

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

/** Flag + NHL/IOC code, e.g. [flag] CAN. Falls back to the code alone if we have no flag. */
export function CountryFlag({ code, name }: { code: string | null | undefined; name?: string }) {
  if (!code) return null;
  const flag = flagUrl(code);
  return (
    <span title={name ?? code} className="inline-flex items-center gap-1.5">
      {flag ? <img src={flag} alt="" width={20} height={14} loading="lazy" className="h-3.5 w-5 rounded-[2px] object-cover ring-1 ring-white/15" /> : null}
      <span className="font-semibold tracking-wide">{iocCode(code)}</span>
    </span>
  );
}
