"use client";

import { useState } from "react";
import { BUY_ME_A_COFFEE_URL, CONSULTING_HREF, SHARE_URL } from "@/lib/support-links";

// "About & Support StatsPuck": the quiet sign-off at the bottom of the home page.

export function AboutSupport() {
  const [toast, setToast] = useState("");

  async function share() {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setToast("Link Copied!");
    } catch {
      setToast(SHARE_URL);
    }
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <section id="about" className="mt-14 scroll-mt-24">
      <div className="relative overflow-hidden rounded-2xl border border-[#262B36] bg-[#14171F] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#E11D48] via-[#38BDF8]/60 to-transparent" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#E11D48] uppercase">About & Support</p>
            <h2 className="display mt-1 text-2xl font-bold sm:text-3xl">Built independently in Calgary.</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#94A3B8] sm:text-base">
              <p>
                StatsPuck is a one-person project: every grade, rating and tool on this site is designed, coded and checked by a single hockey fan who wanted clear answers instead
                of hot takes.
              </p>
              <p>
                It is <span className="font-semibold text-[#F8FAFC]">100% free with zero ads</span>, and it will stay that way. The goal behind it is simple: to build the kind of
                work that earns a seat in NHL hockey operations, or helps teams and player agencies make better decisions.
              </p>
              <p>If StatsPuck has helped you win an argument, a fantasy league or a negotiation, the best thank-you is to pass it along.</p>
            </div>
          </div>

          <div className="grid gap-2.5">
            <button
              type="button"
              onClick={share}
              className="flex items-center justify-between gap-3 rounded-xl bg-[#E11D48] px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_6px_20px_-8px_rgba(225,29,72,0.7)] transition hover:bg-[#F43F5E]"
            >
              <span>Share StatsPuck</span>
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M8 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10h-2V7H10v2H8V7zm-4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8zm2 0v8h8v-8H6z" />
              </svg>
            </button>
            {/* Placeholder link: swap BUY_ME_A_COFFEE_URL in src/lib/support-links.ts */}
            <a
              href={BUY_ME_A_COFFEE_URL}
              target={BUY_ME_A_COFFEE_URL.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-[#262B36] bg-[#0B0D10]/60 px-4 py-3 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8]/60"
            >
              <span>Buy Me a Coffee</span>
              <span className="text-[#38BDF8]">☕</span>
            </a>
            <a
              href={CONSULTING_HREF}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#38BDF8]/40 bg-[#38BDF8]/[0.06] px-4 py-3 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8]"
            >
              <span>Front Office & Consulting Inquiries</span>
              <span className="text-[#38BDF8]">→</span>
            </a>
          </div>
        </div>
      </div>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
        {toast ? <span className="rounded-full border border-[#10B981]/40 bg-[#0B0D10] px-4 py-2 text-sm text-[#10B981] shadow-lg">{toast}</span> : null}
      </div>
    </section>
  );
}
