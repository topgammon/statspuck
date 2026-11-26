"use client";

import { useState } from "react";
import { publicPath } from "@/lib/site";

const fallback = "/player-silhouette.svg";

export function PlayerHeadshot({
  playerId,
  name,
  available = false,
  color = "#E11D48",
  className = "h-36 w-36",
}: {
  playerId: number | null;
  name: string;
  available?: boolean;
  color?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const missing = playerId == null || !available || failed;
  const src = missing ? publicPath(fallback) : `https://assets.nhle.com/mugs/nhl/latest/${playerId}.png`;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl border-2 bg-[#14161c] ${className}`}
      style={{ borderColor: color, boxShadow: `0 0 0 4px ${color}22` }}
    >
      <img
        src={src}
        alt={missing ? "" : `${name} headshot`}
        className="h-full w-full object-cover object-top"
        onError={() => {
          if (!failed) setFailed(true);
        }}
      />
    </div>
  );
}
