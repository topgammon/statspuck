import { TRADE_MACHINE_SECTIONS, ToolNav } from "@/components/tool-nav";

export default function TradeMachineLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ToolNav tool="Trade Machine" sections={TRADE_MACHINE_SECTIONS} />
      {children}
    </>
  );
}
