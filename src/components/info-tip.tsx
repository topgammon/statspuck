"use client";

import { useState } from "react";

export function InfoTip({ text, align = "center" }: { text: string; align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);
  const place = align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2";

  return (
    <span className="group relative inline-flex normal-case">
      <button
        type="button"
        aria-expanded={open}
        aria-label="About this number"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] leading-none font-semibold text-zinc-400 hover:border-white/50 hover:text-white"
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      <span
        role="tooltip"
        className={`${open ? "block" : "hidden"} ${place} absolute top-6 z-30 w-64 rounded-lg border border-white/10 bg-[#12141b] px-3 py-2 text-left text-xs leading-5 font-normal tracking-normal text-zinc-300 normal-case shadow-xl group-hover:block group-focus-within:block`}
      >
        {text}
      </span>
    </span>
  );
}
