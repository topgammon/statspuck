import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with StatsPuck: feedback, data corrections, media and partnership questions.",
  alternates: { canonical: "/contact" },
};

// Placeholder contact page. The form is not wired up yet: the button is disabled.

const TOPICS = ["General feedback", "Data correction", "Feature idea", "Media / press", "Partnerships"];

export default function ContactPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-[0.2em] text-[#E11D48] uppercase">Contact</p>
      <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Get in touch</h1>
      <p className="mt-2 text-[#94A3B8]">Spotted a wrong number, have an idea for a tool, or want to work together? Send us a note.</p>

      <form className="mt-6 grid gap-4 rounded-2xl border border-[#262B36] bg-[#14171F] p-5" aria-describedby="contact-note">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[#94A3B8]">Name</span>
            <input name="name" className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-3 py-2 outline-none focus:border-[#38BDF8]" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[#94A3B8]">Email</span>
            <input name="email" type="email" className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-3 py-2 outline-none focus:border-[#38BDF8]" />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-[#94A3B8]">Topic</span>
          <select name="topic" className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-3 py-2 outline-none focus:border-[#38BDF8]">
            {TOPICS.map((topic) => (
              <option key={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[#94A3B8]">Message</span>
          <textarea name="message" rows={6} className="rounded-lg border border-[#262B36] bg-[#0B0D10] px-3 py-2 outline-none focus:border-[#38BDF8]" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled className="cursor-not-allowed rounded-lg bg-[#E11D48]/50 px-5 py-2 text-sm font-bold text-white">
            Send message
          </button>
          <p id="contact-note" className="text-xs text-[#94A3B8]">
            Coming soon: the contact form is not connected yet.
          </p>
        </div>
      </form>
    </div>
  );
}
