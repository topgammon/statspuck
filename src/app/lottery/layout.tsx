import { DRAFT_RATER_SECTIONS, ToolNav } from "@/components/tool-nav";

// The lottery simulator lives with the Draft Rater tool, so it shares its section tabs.
export default function LotteryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ToolNav tool="Draft Rater" sections={DRAFT_RATER_SECTIONS} />
      {children}
    </>
  );
}
