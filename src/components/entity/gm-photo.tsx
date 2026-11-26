"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

const SILHOUETTE = "/gm-silhouette.svg";

/** GM photo from Wikimedia Commons, with the suit-and-tie silhouette if there is none or it fails to load. */
export function GmPhoto({
  photoUrl,
  name,
  color = "#38BDF8",
  className = "h-28 w-28",
}: {
  photoUrl: string | null | undefined;
  name: string;
  color?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const missing = !photoUrl || failed;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl border-2 bg-[#14171F] ${className}`}
      style={{ borderColor: color, boxShadow: `0 0 0 4px ${color}22` }}
    >
      <img
        src={missing ? SILHOUETTE : photoUrl}
        alt={missing ? "" : `${name}`}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover object-top"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
