import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerProfile } from "@/components/entity/player-profile";
import { pickImage, picks, picksById, undrafted, undraftedById } from "@/lib/data";
import { signed } from "@/lib/format";
import { playerHref } from "@/lib/routes";
type Params = { id: string };

export function generateStaticParams() {
  return [
    ...picks.filter((pick) => !pick.forfeited).map((pick) => ({ id: String(pick.id) })),
    ...undrafted.map((player) => ({ id: String(player.id) })),
  ];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const pick = picksById.get(Number(id));
  if (!pick) {
    const player = undraftedById.get(Number(id));
    if (!player) return {};
    const description = `${player.name}, undrafted ${player.pos}, NHL debut ${player.debut}${player.firstTeamName ? ` with the ${player.firstTeamName}` : ""}. ${player.qg.toFixed(1)} career Impact in ${player.gpCareer} games.`;
    return {
      title: player.name,
      description,
      alternates: { canonical: playerHref(player.id) },
      openGraph: { title: player.name, description },
    };
  }
  const title = pick.name;
  const description = pick.developing
    ? `${pick.name}, ${pick.year} pick ${pick.overall}, still a prospect at ${signed(pick.score)} versus the slot.`
    : `${pick.name}, ${pick.year} pick ${pick.overall}, ${pick.letter} and ${signed(pick.score)} Impact versus the slot. Redraft ${pick.redraft}.`;
  const image = pickImage(pick.id, pick.franchise);
  return {
    title,
    description,
    alternates: { canonical: playerHref(pick.id) },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}


export default async function PlayerPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const pick = picksById.get(Number(id));
  if (pick) return <PlayerProfile subject={{ kind: "pick", pick }} />;
  const player = undraftedById.get(Number(id));
  if (!player) notFound();
  return <PlayerProfile subject={{ kind: "undrafted", player }} />;
}