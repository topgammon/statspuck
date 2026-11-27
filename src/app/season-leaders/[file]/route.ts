import { seasonFile, seasonList } from "@/lib/season-leaders";

// One static JSON file per season (/season-leaders/2025.json) for the Season Leaders board.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return seasonList().map((season) => ({ file: `${season}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  return Response.json(seasonFile(Number(file.replace(/\.json$/, ""))));
}
