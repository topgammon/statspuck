/* eslint-disable @next/next/no-img-element */

/** StatsPuck logo on a white sticker badge so the black linework stays crisp on the dark canvas. */
export function StatsPuckBadge({ height = 44 }: { height?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white p-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_4px_14px_rgba(0,0,0,0.45)]"
      style={{ height }}
    >
      <img
        src="/statspuck-logo-480.png"
        alt="StatsPuck"
        width={480}
        height={320}
        className="h-full w-auto rounded-md"
      />
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
