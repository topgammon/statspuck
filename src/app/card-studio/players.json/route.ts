import { buildStudioData } from "@/lib/card-studio-data";

// Static data file for Card Studio: /card-studio/players.json
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildStudioData());
}
