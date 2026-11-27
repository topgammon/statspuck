import type { ReactNode } from "react";

// Hand-drawn vector illustrations of the NHL trophies: transparent background, one
// recognizable silhouette per award (the Cup's stacked bands, the Vezina's net, the
// Conn Smythe's maple leaf...). Original StatsPuck drawings, not photos or league art.
// Pure SVG with no ids, so it renders on the server, in the browser and in PNG exports.

export type TrophyKind = "stanley" | "leaf" | "net" | "bowl" | "lidcup" | "twocup" | "tallcup" | "pillar" | "crystal" | "plaque";

const KIND_BY_NAME: Record<string, TrophyKind> = {
  "Stanley Cup": "stanley",
  "Conn Smythe Trophy": "leaf",
  "Vezina Trophy": "net",
  "James Norris Memorial Trophy": "bowl",
  "Hart Memorial Trophy": "lidcup",
  "Art Ross Trophy": "tallcup",
  "Calder Memorial Trophy": "twocup",
  "Frank J. Selke Trophy": "twocup",
  "Maurice “Rocket” Richard Trophy": "pillar",
  "Ted Lindsay Award": "crystal",
  "William M. Jennings Trophy": "plaque",
  "Lady Byng Memorial Trophy": "lidcup",
  "King Clancy Memorial Trophy": "plaque",
  "Bill Masterton Memorial Trophy": "tallcup",
  "Mark Messier NHL Leadership Award": "crystal",
  "NHL Foundation Player Award": "crystal",
  "E.J. McGuire Award of Excellence": "plaque",
  "Lester Patrick Trophy": "plaque",
};

export function trophyKind(name: string): TrophyKind {
  return KIND_BY_NAME[name] ?? "twocup";
}

const SILVER = "#D7DEE7";
const SILVER_DARK = "#9AA6B5";
const SHINE = "#F8FAFC";
const GOLD = "#F5B83D";
const GOLD_DARK = "#B7791F";
const WOOD = "#7A4A26";
const WOOD_DARK = "#55331A";

function Art({ kind, gold }: { kind: TrophyKind; gold: boolean }): ReactNode {
  const metal = gold ? GOLD : SILVER;
  const deep = gold ? GOLD_DARK : SILVER_DARK;
  switch (kind) {
    case "stanley":
      return (
        <>
          {/* Bowl */}
          <path d="M17 6h26c0 7-5.5 12-13 12S17 13 17 6Z" fill={metal} />
          <path d="M20 7.5h5c0 4 1.6 6.6 3.6 8-4.6-.6-8.2-3.8-8.6-8Z" fill={SHINE} opacity="0.6" />
          <rect x="15.5" y="4.5" width="29" height="2.6" rx="1.3" fill={deep} />
          {/* Collar and stem */}
          <rect x="26" y="18" width="8" height="5" fill={deep} />
          <rect x="22" y="23" width="16" height="5" rx="1" fill={metal} />
          {/* Stacked bands, widening to the barrel */}
          <rect x="19" y="28" width="22" height="7" rx="1" fill={deep} />
          <rect x="17" y="35" width="26" height="8" rx="1" fill={metal} />
          <rect x="15" y="43" width="30" height="9" rx="1" fill={deep} />
          <rect x="13" y="52" width="34" height="10" rx="1.2" fill={metal} />
          <rect x="11" y="62" width="38" height="12" rx="1.6" fill={deep} />
          {/* Engraving lines */}
          <path d="M14 66h32M14 70h32M15 56h30M17 47h26" stroke={SHINE} strokeOpacity="0.35" strokeWidth="0.8" />
          <rect x="18.5" y="30" width="2" height="42" fill={SHINE} opacity="0.35" />
        </>
      );
    case "leaf":
      return (
        <>
          {/* Maple leaf on a wooden stand */}
          <path
            d="M30 6l4 9 5-3-1.5 9 7-4-2 7 6 1-6 6 2 3-9-1v8h-11v-8l-9 1 2-3-6-6 6-1-2-7 7 4L21 12l5 3 4-9Z"
            fill={metal}
          />
          <path d="M30 9l2.5 6.5L30 40V9Z" fill={SHINE} opacity="0.45" />
          <rect x="27" y="45" width="6" height="7" fill={deep} />
          <path d="M14 52h32l3 22H11l3-22Z" fill={WOOD} />
          <path d="M14 52h32l.6 4H13.4l.6-4Z" fill={WOOD_DARK} />
          <rect x="22" y="60" width="16" height="7" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "net":
      return (
        <>
          {/* A goal net on a plinth */}
          <path d="M12 44V22c0-6 4-10 10-10h16c6 0 10 4 10 10v22" fill="none" stroke={metal} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M16 42V23c0-4 3-7 7-7h14c4 0 7 3 7 7v19" fill="none" stroke={SHINE} strokeOpacity="0.35" strokeWidth="0.9" />
          <path d="M18 18v26M24 15v29M30 15v29M36 15v29M42 18v26M14 24h32M14 30h32M14 36h32" stroke={metal} strokeOpacity="0.55" strokeWidth="0.9" />
          <rect x="8" y="44" width="44" height="4" rx="1.5" fill={deep} />
          <path d="M12 48h36l3 26H9l3-26Z" fill={WOOD} />
          <path d="M12 48h36l.5 4h-37l.5-4Z" fill={WOOD_DARK} />
          <rect x="20" y="58" width="20" height="8" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "bowl":
      return (
        <>
          {/* Wide silver bowl on a pedestal */}
          <path d="M6 16h48c0 12-10.5 20-24 20S6 28 6 16Z" fill={metal} />
          <rect x="4" y="13.5" width="52" height="4" rx="2" fill={deep} />
          <path d="M10 18h8c.6 6 4 10.5 8.5 13-8-1-14.8-5.5-16.5-13Z" fill={SHINE} opacity="0.55" />
          <path d="M24 36h12l-2 9h-8l-2-9Z" fill={deep} />
          <rect x="20" y="45" width="20" height="4" rx="1" fill={metal} />
          <path d="M14 49h32l3 25H11l3-25Z" fill={WOOD} />
          <path d="M14 49h32l.5 4H13.5l.5-4Z" fill={WOOD_DARK} />
          <rect x="21" y="58" width="18" height="8" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "lidcup":
      return (
        <>
          {/* Lidded chalice with a finial */}
          <circle cx="30" cy="5" r="2.8" fill={metal} />
          <path d="M19 15c0-5 5-8 11-8s11 3 11 8H19Z" fill={deep} />
          <rect x="17" y="14.5" width="26" height="3" rx="1.5" fill={metal} />
          <path d="M18 17.5h24v6c0 8-5.4 13.5-12 13.5S18 31.5 18 23.5v-6Z" fill={metal} />
          <path d="M21 19h4.5v6c0 4 1.4 7 3 8.5-4.4-.8-7.5-4.4-7.5-9v-5.5Z" fill={SHINE} opacity="0.55" />
          <path d="M18 21h-5c0 6 3 9.5 7 10M42 21h5c0 6-3 9.5-7 10" fill="none" stroke={metal} strokeWidth="2.2" strokeLinecap="round" />
          <rect x="27" y="37" width="6" height="8" fill={deep} />
          <path d="M20 45h20l2 6H18l2-6Z" fill={metal} />
          <path d="M14 51h32l3 23H11l3-23Z" fill={WOOD} />
          <path d="M14 51h32l.5 4H13.5l.5-4Z" fill={WOOD_DARK} />
          <rect x="21" y="59" width="18" height="8" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "twocup":
      return (
        <>
          {/* Classic two-handled loving cup */}
          <path d="M16 8h28v12c0 9-6.3 15-14 15S16 29 16 20V8Z" fill={metal} />
          <rect x="14.5" y="6" width="31" height="3" rx="1.5" fill={deep} />
          <path d="M19.5 10h5v10c0 4.5 1.6 7.6 3.4 9.2-5-.8-8.4-4.8-8.4-9.6V10Z" fill={SHINE} opacity="0.55" />
          <path d="M16 11H9c0 8 3.5 12.5 9 13M44 11h7c0 8-3.5 12.5-9 13" fill="none" stroke={metal} strokeWidth="2.6" strokeLinecap="round" />
          <rect x="27" y="35" width="6" height="9" fill={deep} />
          <path d="M19 44h22l2.5 6h-27l2.5-6Z" fill={metal} />
          <path d="M13 50h34l3 24H10l3-24Z" fill={WOOD} />
          <path d="M13 50h34l.5 4h-35l.5-4Z" fill={WOOD_DARK} />
          <rect x="21" y="59" width="18" height="8" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "tallcup":
      return (
        <>
          {/* Tall urn with a lid */}
          <circle cx="30" cy="4.5" r="2.5" fill={metal} />
          <path d="M22 12c0-4 3.5-6 8-6s8 2 8 6H22Z" fill={deep} />
          <path d="M21 12h18l-1.5 22c-.4 4-3.5 7-7.5 7s-7.1-3-7.5-7L21 12Z" fill={metal} />
          <path d="M24 13.5h4l.2 20c0 2.5.8 4.5 2 5.6-3-.3-5.2-2.6-5.4-5.6L24 13.5Z" fill={SHINE} opacity="0.55" />
          <path d="M21 16h-5c0 7 2.5 11 6.5 12M39 16h5c0 7-2.5 11-6.5 12" fill="none" stroke={metal} strokeWidth="2.2" strokeLinecap="round" />
          <rect x="27.5" y="41" width="5" height="7" fill={deep} />
          <path d="M21 48h18l2 5H19l2-5Z" fill={metal} />
          <path d="M15 53h30l3 21H12l3-21Z" fill={WOOD} />
          <path d="M15 53h30l.5 4h-31l.5-4Z" fill={WOOD_DARK} />
          <rect x="22" y="60" width="16" height="7" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "pillar":
      return (
        <>
          {/* Tapered column topped with a puck and crossed sticks */}
          <path d="M20 22l-6 9M40 22l6 9" stroke={deep} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="30" cy="14" rx="9" ry="3.4" fill={deep} />
          <rect x="21" y="10.5" width="18" height="3.6" fill="#1F2937" />
          <ellipse cx="30" cy="10.5" rx="9" ry="3.4" fill="#374151" />
          <path d="M23 20h14l-2.5 34h-9L23 20Z" fill={metal} />
          <path d="M25.5 21h3l-1 32h-2.2L25.5 21Z" fill={SHINE} opacity="0.5" />
          <rect x="19" y="17" width="22" height="3.5" rx="1.5" fill={deep} />
          <path d="M14 54h32l3 20H11l3-20Z" fill={WOOD} />
          <path d="M14 54h32l.5 4h-33l.5-4Z" fill={WOOD_DARK} />
          <rect x="22" y="61" width="16" height="7" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "crystal":
      return (
        <>
          {/* Faceted glass award */}
          <path d="M30 4l13 14-4 34H21l-4-34L30 4Z" fill="#BAE6FD" fillOpacity="0.55" stroke={SHINE} strokeOpacity="0.8" strokeWidth="1" />
          <path d="M30 4v48M17 18h26M30 4l-9 48M30 4l9 48" stroke={SHINE} strokeOpacity="0.45" strokeWidth="0.8" />
          <path d="M22 20l8-10v16l-8-6Z" fill={SHINE} opacity="0.5" />
          <path d="M14 52h32l3 22H11l3-22Z" fill="#1F2937" />
          <path d="M14 52h32l.5 4h-33l.5-4Z" fill="#111827" />
          <rect x="21" y="60" width="18" height="7" rx="1" fill={metal} opacity="0.9" />
        </>
      );
    case "plaque":
    default:
      return (
        <>
          {/* Shield plaque on a stand */}
          <path d="M14 8h32v22c0 10-7 17-16 21-9-4-16-11-16-21V8Z" fill={WOOD} />
          <path d="M18 12h24v17c0 7.6-5 13-12 16.4C23 42 18 36.6 18 29V12Z" fill={metal} />
          <path d="M21 15h6v14c0 5 1.6 9 4 11.6-6-2.2-10-6.6-10-11.6V15Z" fill={SHINE} opacity="0.5" />
          <circle cx="30" cy="25" r="5" fill={deep} />
          <path d="M24 51h12v6H24z" fill={deep} />
          <path d="M14 57h32l3 17H11l3-17Z" fill={WOOD} />
          <path d="M14 57h32l.5 4h-33l.5-4Z" fill={WOOD_DARK} />
        </>
      );
  }
}

/** A trophy drawing. `gold` tints the metal for the biggest awards. */
export function TrophyArt({ name, gold = false, size = 56, className, style }: { name: string; gold?: boolean; size?: number; className?: string; style?: React.CSSProperties }) {
  const kind = trophyKind(name);
  return (
    <svg
      viewBox="0 0 60 78"
      width={(size * 60) / 78}
      height={size}
      className={className}
      style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))", ...style }}
      role="img"
      aria-label={name}
    >
      <Art kind={kind} gold={gold && kind !== "stanley" && kind !== "crystal"} />
    </svg>
  );
}
