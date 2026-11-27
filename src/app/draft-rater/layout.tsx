import type { Metadata } from "next";
import { DRAFT_RATER_SECTIONS, ToolNav } from "@/components/tool-nav";
import { meta } from "@/lib/data";
import { updatedLabel } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: `${site.name} · StatsPuck`, template: `%s · ${site.name} · StatsPuck` },
  description: site.description,
  openGraph: {
    siteName: "StatsPuck",
    type: "website",
    images: [{ url: "/draft-rater/og/home.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/draft-rater/og/home.png"] },
};

export default function DraftRaterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ToolNav tool="Draft Rater" sections={DRAFT_RATER_SECTIONS} hideOn={["/draft-rater/methodology"]} />
      {children}
      <p className="mt-16 text-right text-sm text-[#94A3B8]">{updatedLabel(meta.asOf)}.</p>
    </>
  );
}
