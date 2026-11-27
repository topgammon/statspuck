/* eslint-disable @next/next/no-img-element */

/** StatsPuck logo. The PNG is transparent, so it sits straight on the canvas (no white badge). */
export function StatsPuckBadge({ height = 44 }: { height?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ height }}>
      <img src="/statspuck-logo-480.png" alt="StatsPuck" width={480} height={320} className="h-full w-auto" />
    </span>
  );
}

export function StatsPuckLockup({ module }: { module?: string }) {
  return (
    <span className="flex items-center gap-3">
      <StatsPuckBadge />
      <span className="leading-none">
        <span className="display block text-xl font-bold tracking-[0.04em]">STATSPUCK</span>
        <span className="mt-1 block text-[11px] tracking-[0.08em] text-[#94A3B8] uppercase">
          {module ?? "statspuck.com"}
        </span>
      </span>
    </span>
  );
}
