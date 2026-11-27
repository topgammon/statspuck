import Link from "next/link";
import type { ReactNode } from "react";
import { SectionLabel } from "@/components/entity/bio";

// The right-hand Hero Box on every Bio Card. Each tab passes its own primary metric,
// a couple of supporting stats (any of which can be a link) and its own Share button.

export type HeroStat = { label: string; value: string; tone?: string; title?: string; href?: string };

export function HeroBox({
  label,
  value,
  valueTone = "text-[#F8FAFC]",
  unit,
  caption,
  badge,
  stats = [],
  action,
  href,
  hrefLabel,
}: {
  label: string;
  value?: string;
  valueTone?: string;
  unit?: string;
  caption?: ReactNode;
  /** Replaces the big number, e.g. a Coming Soon stamp or a letter box. */
  badge?: ReactNode;
  stats?: HeroStat[];
  action?: ReactNode;
  /** Makes the big number a link into its tool or leaderboard. */
  href?: string;
  hrefLabel?: string;
}) {
  const number = badge ?? (
    <span className="flex items-end justify-center gap-1">
      <span className={`display text-6xl leading-none font-bold ${valueTone}`}>{value ?? "—"}</span>
      {unit ? <span className="pb-1.5 text-sm text-[#94A3B8]">{unit}</span> : null}
    </span>
  );
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 p-4 text-center">
      <SectionLabel>{label}</SectionLabel>
      {href ? (
        <Link href={href} title={hrefLabel} className="group rounded-lg py-1 transition hover:bg-white/[0.03]">
          {number}
          {hrefLabel ? <span className="mt-1 block text-[11px] font-semibold text-[#38BDF8] opacity-80 group-hover:opacity-100">{hrefLabel} →</span> : null}
        </Link>
      ) : (
        <div className="py-1">{number}</div>
      )}
      {caption ? <div className="text-xs text-[#94A3B8]">{caption}</div> : null}
      {stats.length ? (
        <dl className={`grid gap-2 ${stats.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {stats.map((item) => {
            const body = (
              <>
                <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{item.label}</dt>
                <dd className={`display text-lg leading-tight font-bold ${item.tone ?? "text-[#F8FAFC]"}`}>{item.value}</dd>
              </>
            );
            return item.href ? (
              <Link key={item.label} href={item.href} title={item.title} className="rounded-lg bg-white/[0.03] px-2 py-1.5 ring-1 ring-transparent transition hover:ring-[#38BDF8]/50">
                {body}
              </Link>
            ) : (
              <div key={item.label} title={item.title} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                {body}
              </div>
            );
          })}
        </dl>
      ) : null}
      {action ? <div className="mt-auto flex justify-center pt-1">{action}</div> : null}
    </div>
  );
}

export function ComingSoonStamp({ text = "Coming soon" }: { text?: string }) {
  return (
    <span className="display ink mx-auto inline-flex -rotate-3 items-center justify-center border-[3px] border-[#38BDF8] px-3 py-1.5 text-lg leading-none font-bold tracking-[0.16em] text-[#bae6fd] uppercase">
      {text}
    </span>
  );
}
