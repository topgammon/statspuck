import type { Metadata } from "next";
import { CardStudio } from "@/components/card-studio/studio";

export const metadata: Metadata = {
  title: "Card Studio",
  description:
    "Make share-ready NHL graphics in one click: head-to-head player comparisons, scouting cards, trade proposals, custom Top 5 rankings and redraft spotlights, in landscape, square and vertical sizes.",
  alternates: { canonical: "/card-studio" },
};

export default function CardStudioPage() {
  return <CardStudio />;
}
