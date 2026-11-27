import { buildTradeData } from "@/lib/trade-data";

// Static Trade Machine data for Card Studio's Trade Proposal card: /card-studio/trade.json
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildTradeData());
}
