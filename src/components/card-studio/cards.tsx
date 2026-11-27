"use client";

import type { CSSProperties, ReactNode } from "react";
import { fitSize, gradeColor, hexA, Logo, stampColor, useSameOriginImage } from "@/components/share-cards";
import { TrophyArt } from "@/components/trophy-art";
import type { StudioClass, StudioClassPick, StudioPlayer, StudioTeam } from "@/lib/card-studio-data";
import type { TradeResult } from "@/lib/trade-calc";

// Card Studio graphics. Every template renders at its exact export size
// (1200×630, 1080×1080 or 1080×1920) with inline styles only, so the PNG export
// matches the preview pixel for pixel. Headshots go through /api/image-proxy.

export type StudioFormat = "wide" | "square" | "tall";

export const FORMATS: Record<StudioFormat, { width: number; height: number; label: string; note: string }> = {
  wide: { width: 1200, height: 630, label: "Landscape", note: "1200×630 · X, Reddit" },
  square: { width: 1080, height: 1080, label: "Square", note: "1080×1080 · Instagram, Discord" },
  tall: { width: 1080, height: 1920, label: "Vertical", note: "1080×1920 · TikTok, Stories" },
};

const BG = "#0B0D10";
const PANEL = "#14171F";
const LINE = "#262B36";
const INK = "#F8FAFC";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const GOLD = "#F59E0B";
const EMERALD = "#10B981";
const LOSS = "#EF4444";
const CYAN = "#38BDF8";
const DISPLAY = "var(--font-oswald), Oswald, 'Arial Narrow', sans-serif";
const BODY = "var(--font-barlow), Barlow, system-ui, sans-serif";
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

const SILHOUETTE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#14171F"/><circle cx="40" cy="30" r="14" fill="#2A303C"/><path d="M12 80c6-20 16-28 28-28s22 8 28 28" fill="#2A303C"/></svg>`,
)}`;

export type CardCommon = { format: StudioFormat; accent: string; subtitle: string; handle: string };

function sz(format: StudioFormat) {
  const wide = format === "wide";
  const tall = format === "tall";
  return {
    wide,
    tall,
    width: FORMATS[format].width,
    height: FORMATS[format].height,
    pad: wide ? 46 : tall ? 80 : 62,
    footer: wide ? 68 : tall ? 132 : 96,
    /** Font scale. */
    k: wide ? 1 : tall ? 1.5 : 1.22,
    gap: wide ? 16 : tall ? 44 : 24,
  };
}

/* ------------------------------------------------------------------ */
/* Frame + shared pieces                                               */
/* ------------------------------------------------------------------ */

function Frame({ format, accent, handle, children }: { format: StudioFormat; accent: string; handle: string; children: ReactNode }) {
  const s = sz(format);
  return (
    <div style={{ position: "relative", width: s.width, height: s.height, background: BG, color: INK, overflow: "hidden", fontFamily: BODY, textAlign: "left", lineHeight: 1.25 }}>
      <div
        style={{
          position: "absolute",
          top: -s.height * 0.35,
          right: -s.width * 0.25,
          width: s.width * 0.9,
          height: s.width * 0.9,
          background: `radial-gradient(closest-side, ${hexA(accent, 0.2)}, ${hexA(accent, 0)})`,
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: s.tall ? 10 : 6, background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.25)})` }} />
      <div
        style={{
          position: "absolute",
          top: s.pad,
          left: s.pad,
          right: s.pad,
          bottom: s.footer + s.pad * 0.45,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: s.gap,
        }}
      >
        {children}
      </div>
      <footer
        style={{
          position: "absolute",
          left: s.pad,
          right: s.pad,
          bottom: 0,
          height: s.footer,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${LINE}`,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 14 * s.k }}>
          {/* White sticker badge keeps the logo's black linework readable on the dark card. */}
          <span
            style={{
              height: 44 * s.k,
              width: 44 * s.k,
              borderRadius: 10 * s.k,
              background: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.15)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/statspuck-logo-480.png" alt="StatsPuck" style={{ height: "100%", width: "100%", objectFit: "contain" }} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22 * s.k, letterSpacing: 1 }}>STATSPUCK</span>
            <span style={{ color: MUTED, fontSize: 13 * s.k, letterSpacing: 2, textTransform: "uppercase" }}>Card Studio</span>
          </span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
          {handle ? <span style={{ color: INK, fontSize: 19 * s.k, fontWeight: 600 }}>{handle}</span> : null}
          <span style={{ color: MUTED, fontSize: (handle ? 14 : 18) * s.k, letterSpacing: 0.4 }}>statspuck.com</span>
        </span>
      </footer>
    </div>
  );
}

function Header({ format, eyebrow, title, subtitle, accent, right, maxChars = 26 }: { format: StudioFormat; eyebrow: string; title: string; subtitle?: string; accent: string; right?: ReactNode; maxChars?: number }) {
  const s = sz(format);
  const base = s.wide ? 50 : s.tall ? 92 : 68;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 * s.k }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: accent, fontSize: 14 * s.k, letterSpacing: 2.6, textTransform: "uppercase", fontWeight: 700, ...ellipsis }}>{eyebrow}</div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: fitSize(title, base, s.tall ? Math.round(maxChars * 0.75) : maxChars),
            lineHeight: 1.04,
            marginTop: 6 * s.k,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        {subtitle ? <div style={{ color: MUTED, fontSize: 18 * s.k, marginTop: 6 * s.k, ...ellipsis }}>{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

function Photo({ playerId, available, color, width, height, radius = 18 }: { playerId: number | null; available: boolean; color: string; width: number; height: number; radius?: number }) {
  const photo = useSameOriginImage(available && playerId ? `https://assets.nhle.com/mugs/nhl/latest/${playerId}.png` : null);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo || SILHOUETTE}
      alt=""
      width={width}
      height={height}
      style={{
        width,
        height,
        flex: "none",
        objectFit: "cover",
        objectPosition: "center top",
        borderRadius: radius,
        border: `1px solid ${LINE}`,
        background: `linear-gradient(180deg, ${hexA(color, 0.4)}, ${PANEL})`,
      }}
    />
  );
}

/** Rubber-ink stamp, slightly tilted, like it was pressed onto the card. */
function InkStamp({ stamp, size }: { stamp: string; size: number }) {
  const color = stampColor(stamp);
  return (
    <span
      style={{
        display: "inline-block",
        border: `${Math.max(2, size * 0.14)}px solid ${hexA(color, 0.85)}`,
        outline: `1px solid ${hexA(color, 0.35)}`,
        outlineOffset: 2,
        color,
        borderRadius: 6,
        padding: `${size * 0.22}px ${size * 0.55}px`,
        fontFamily: DISPLAY,
        fontWeight: 700,
        letterSpacing: size * 0.14,
        fontSize: size,
        lineHeight: 1,
        transform: "rotate(-4deg)",
        opacity: 0.92,
        textTransform: "uppercase",
      }}
    >
      {stamp === "DEVELOPING" ? "PROSPECT" : stamp}
    </span>
  );
}

function Pill({ children, color = CYAN, size }: { children: ReactNode; color?: string; size: number }) {
  return (
    <span style={{ display: "inline-block", border: `1px solid ${hexA(color, 0.55)}`, background: hexA(color, 0.12), color, borderRadius: 999, padding: `${size * 0.3}px ${size * 0.8}px`, fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: 0.6 }}>
      {children}
    </span>
  );
}

function skillColor(value: number | null): string {
  if (value == null) return DIM;
  if (value >= 90) return GOLD;
  if (value >= 80) return EMERALD;
  if (value >= 65) return CYAN;
  if (value >= 50) return INK;
  return "#F97316";
}

function ratingColor(value: number | null): string {
  if (value == null) return DIM;
  if (value < 0) return LOSS;
  if (value >= 70) return GOLD;
  if (value >= 40) return EMERALD;
  if (value >= 15) return CYAN;
  return MUTED;
}

function feet(inches: number | null): string | null {
  return inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : null;
}

function vitalsLine(p: StudioPlayer): string {
  return [p.age != null ? `Age ${p.age}` : null, feet(p.ht), p.wt ? `${p.wt} lbs` : null, p.sh ? `${p.g === "G" ? "Catches" : "Shoots"} ${p.sh}` : null].filter(Boolean).join(" · ");
}

const money = (value: number) => `$${(value / 1_000_000).toFixed(2)}M`;
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}`;
const lastName = (name: string) => name.split(" ").slice(1).join(" ") || name;
const shortAward = (name: string) => name.replace(" Memorial", "").replace(" Trophy", "").replace(" Award", "").replace("Maurice “Rocket” ", "Rocket ").replace("NHL ", "");

function teamLine(p: StudioPlayer, teams: Map<string, StudioTeam>): string {
  if (p.t) return teams.get(p.t)?.name ?? p.t;
  return p.active ? "Free agent" : "Retired";
}

/* ------------------------------------------------------------------ */
/* 1. Head-to-Head Player Comparison                                   */
/* ------------------------------------------------------------------ */

type CompareRow = { label: string; a: number | null; b: number | null; aText: string; bText: string; max?: number; winner?: "high" | "low" | "none" };

export function CompareCard({ format, accent, subtitle, handle, a, b, teams }: CardCommon & { a: StudioPlayer; b: StudioPlayer; teams: Map<string, StudioTeam> }) {
  const s = sz(format);
  const sameAxes = a.ax.length > 0 && a.ax.length === b.ax.length && a.ax.every((axis, i) => axis[0] === b.ax[i]?.[0]);
  const rows: CompareRow[] = [
    { label: "Overall Skill", a: a.sk, b: b.sk, aText: a.sk == null ? "—" : String(a.sk), bText: b.sk == null ? "—" : String(b.sk), max: 99 },
    ...(sameAxes ? a.ax.map(([label, value], i): CompareRow => ({ label, a: value, b: b.ax[i][1], aText: value == null ? "—" : String(value), bText: b.ax[i][1] == null ? "—" : String(b.ax[i][1]), max: 99 })) : []),
    { label: "Career Impact", a: a.qg, b: b.qg, aText: a.qg.toLocaleString("en-US"), bText: b.qg.toLocaleString("en-US") },
    { label: "Cap Hit (% of Cap)", a: a.cap, b: b.cap, aText: a.cap == null ? "—" : `${a.cap.toFixed(1)}%`, bText: b.cap == null ? "—" : `${b.cap.toFixed(1)}%`, max: 17, winner: "none" },
    { label: "Asset Value", a: a.av, b: b.av, aText: a.av == null ? "—" : String(a.av), bText: b.av == null ? "—" : String(b.av), max: 100 },
  ];

  const side = (p: StudioPlayer, align: "left" | "right") => {
    const photoW = s.wide ? 112 : s.tall ? 250 : 170;
    const flip = align === "right";
    return (
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: s.tall ? "column" : flip ? "row-reverse" : "row", alignItems: s.tall ? (flip ? "flex-end" : "flex-start") : "center", gap: 16 * s.k, textAlign: flip ? "right" : "left" }}>
        <Photo playerId={p.id} available={p.hs} color={p.c} width={photoW} height={Math.round(photoW * 1.18)} />
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", alignItems: flip ? "flex-end" : "flex-start", gap: 5 * s.k, width: "100%" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: fitSize(p.n, 36 * s.k, s.wide ? 15 : 14), lineHeight: 1.02, ...ellipsis, maxWidth: "100%" }}>{p.n}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 15 * s.k, flexDirection: flip ? "row-reverse" : "row", maxWidth: "100%" }}>
            {p.t ? <Logo abbr={p.t} size={30 * s.k} /> : null}
            <span style={ellipsis}>
              {p.pos} · {teamLine(p, teams)}
            </span>
          </div>
          <div style={{ color: DIM, fontSize: 13 * s.k, ...ellipsis, maxWidth: "100%" }}>{vitalsLine(p)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: flip ? "flex-end" : "flex-start", marginTop: 2 }}>
            {p.arch ? <Pill size={11 * s.k}>{p.arch}</Pill> : null}
            {p.st
              .filter((stamp) => stamp !== "RETIRED" || !p.active)
              .slice(0, 2)
              .map((stamp) => (
                <Pill key={stamp} size={11 * s.k} color={stampColor(stamp)}>
                  {stamp === "DEVELOPING" ? "PROSPECT" : stamp}
                </Pill>
              ))}
          </div>
        </div>
      </div>
    );
  };

  const shown = s.wide ? rows : rows;
  const rowH = s.wide ? Math.min(36, Math.floor(300 / Math.ceil(shown.length / 2))) : s.tall ? 74 : 46;
  const renderRow = (row: CompareRow) => {
    const max = row.max ?? Math.max(1, row.a ?? 0, row.b ?? 0);
    const aw = Math.max(0, Math.min(1, (row.a ?? 0) / max));
    const bw = Math.max(0, Math.min(1, (row.b ?? 0) / max));
    const mode = row.winner ?? "high";
    const aWins = mode !== "none" && row.a != null && row.b != null && (mode === "high" ? row.a > row.b : row.a < row.b);
    const bWins = mode !== "none" && row.a != null && row.b != null && (mode === "high" ? row.b > row.a : row.b < row.a);
    const barH = s.wide ? 10 : s.tall ? 18 : 12;
    return (
      <div key={row.label} style={{ height: rowH, display: "grid", gridTemplateColumns: `${58 * s.k}px 1fr ${s.wide ? 150 : 210 * (s.k / 1.22)}px 1fr ${58 * s.k}px`, alignItems: "center", gap: 10 * s.k }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20 * s.k, textAlign: "right", color: aWins ? accent : INK }}>{row.aText}</span>
        <span style={{ height: barH, borderRadius: 99, background: PANEL, border: `1px solid ${LINE}`, display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
          <span style={{ width: `${aw * 100}%`, background: aWins ? accent : hexA(INK, 0.35), borderRadius: 99 }} />
        </span>
        <span style={{ textAlign: "center", color: MUTED, fontSize: 12.5 * s.k, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 600, ...ellipsis }}>{row.label}</span>
        <span style={{ height: barH, borderRadius: 99, background: PANEL, border: `1px solid ${LINE}`, display: "flex", overflow: "hidden" }}>
          <span style={{ width: `${bw * 100}%`, background: bWins ? accent : hexA(INK, 0.35), borderRadius: 99 }} />
        </span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20 * s.k, color: bWins ? accent : INK }}>{row.bText}</span>
      </div>
    );
  };

  const half = Math.ceil(shown.length / 2);
  return (
    <Frame format={format} accent={accent} handle={handle}>
      <Header format={format} accent={accent} eyebrow="Head-to-Head" title={`${lastName(a.n)} vs ${lastName(b.n)}`} subtitle={subtitle} />
      <div style={{ display: "flex", alignItems: s.tall ? "flex-start" : "center", gap: 18 * s.k }}>
        {side(a, "left")}
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30 * s.k, color: accent, flex: "none", alignSelf: "center" }}>VS</span>
        {side(b, "right")}
      </div>
      <div style={{ background: hexA(PANEL, 0.7), border: `1px solid ${LINE}`, borderRadius: 18 * s.k, padding: `${10 * s.k}px ${16 * s.k}px` }}>
        {s.wide ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 26 }}>
            <div>
              {shown.slice(0, half).map((row) => (
                renderRow(row)
              ))}
            </div>
            <div>
              {shown.slice(half).map((row) => (
                renderRow(row)
              ))}
            </div>
          </div>
        ) : (
          shown.map((row) => renderRow(row))
        )}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Single Player Scouting Card                                      */
/* ------------------------------------------------------------------ */

function Tile({ label, value, note, color, k }: { label: string; value: string; note?: string; color?: string; k: number }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 16 * k, padding: `${12 * k}px ${16 * k}px`, minWidth: 0 }}>
      <div style={{ color: MUTED, fontSize: 12 * k, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, ...ellipsis }}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34 * k, lineHeight: 1.1, marginTop: 4 * k, color: color ?? INK, ...ellipsis }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 13 * k, marginTop: 2, height: 17 * k, ...ellipsis }}>{note ?? ""}</div>
    </div>
  );
}

export function ScoutCard({ format, accent, subtitle, handle, p, teams }: CardCommon & { p: StudioPlayer; teams: Map<string, StudioTeam> }) {
  const s = sz(format);
  const photoW = s.wide ? 168 : s.tall ? 330 : 230;
  const heroW = s.wide ? 176 : s.tall ? 300 : 230;
  const trophies = p.aw.slice(0, s.wide ? 4 : 5);
  const draft = p.dr;
  const draftNote = draft ? `${draft.y} #${draft.o} · Redraft #${draft.rx}` : "Undrafted";
  const tiles = [
    { label: "Draft Grade", value: draft ? (draft.dev ? "—" : (draft.l ?? "—")) : "UFA", note: draftNote, color: draft && !draft.dev ? gradeColor(draft.l) : CYAN },
    { label: "Contract Surplus", value: p.sur == null ? "—" : `${p.sur}`, note: p.aav != null ? `${money(p.aav)} · ${p.cap?.toFixed(1)}% Cap` : "No NHL contract", color: p.sur == null ? INK : p.sur >= 60 ? EMERALD : p.sur < 40 ? LOSS : INK },
    { label: "Career Impact", value: p.qg.toLocaleString("en-US"), note: `${p.gp.toLocaleString("en-US")} NHL games` },
    { label: "Asset Value", value: p.av == null ? "—" : String(p.av), note: "0–100 trade scale", color: ratingColor(p.av) },
  ];

  const hero = (
    <div
      style={{
        width: heroW,
        flex: "none",
        alignSelf: "stretch",
        borderRadius: 22 * s.k,
        background: PANEL,
        border: `1px solid ${LINE}`,
        boxShadow: `0 0 60px ${hexA(skillColor(p.sk), 0.16)}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 12 * s.k,
        textAlign: "center",
      }}
    >
      <div style={{ color: MUTED, fontSize: 13 * s.k, letterSpacing: 2.2, textTransform: "uppercase", fontWeight: 600 }}>Overall Skill</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 96 * s.k, lineHeight: 1, color: skillColor(p.sk), marginTop: 6 * s.k }}>{p.sk ?? "—"}</div>
      <div style={{ color: MUTED, fontSize: 15 * s.k, marginTop: 4 * s.k }}>{p.sk == null ? "Not rated yet" : "out of 99"}</div>
    </div>
  );

  const stamps = p.st.filter((stamp) => stamp !== "RETIRED" || !p.active).slice(0, 3);
  const identity = (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 * s.k }}>
      <div style={{ color: accent, fontSize: 14 * s.k, letterSpacing: 2.6, textTransform: "uppercase", fontWeight: 700, ...ellipsis }}>Scouting Report</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: fitSize(p.n, (s.wide ? 52 : 64) * (s.tall ? 1.3 : 1), s.wide ? 17 : 15), lineHeight: 1.02, ...ellipsis }}>{p.n}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: MUTED, fontSize: 18 * s.k, minWidth: 0 }}>
        {p.t ? <Logo abbr={p.t} size={36 * s.k} /> : null}
        <span style={ellipsis}>
          {p.pos} · {teamLine(p, teams)}
        </span>
      </div>
      <div style={{ color: DIM, fontSize: 15 * s.k, ...ellipsis }}>{vitalsLine(p)}</div>
      {subtitle ? <div style={{ color: INK, fontSize: 16 * s.k, ...ellipsis }}>{subtitle}</div> : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 * s.k, marginTop: 4 * s.k }}>
        {p.arch ? <Pill size={13 * s.k}>{p.arch}</Pill> : null}
        {stamps.map((stamp) => (
          <InkStamp key={stamp} stamp={stamp} size={13 * s.k} />
        ))}
      </div>
    </div>
  );

  const bars = p.ax.length ? (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${s.wide ? 3 : 2}, minmax(0, 1fr))`, gap: `${10 * s.k}px ${22 * s.k}px` }}>
      {p.ax.map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 * s.k, color: MUTED, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 600 }}>
            <span style={ellipsis}>{label}</span>
            <span style={{ color: value == null ? DIM : INK, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 * s.k }}>{value ?? "SOON"}</span>
          </div>
          <div style={{ height: 9 * s.k, borderRadius: 99, background: BG, border: `1px solid ${LINE}`, marginTop: 5 * s.k, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${value ?? 0}%`, background: skillColor(value), borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  ) : null;

  const trophyStrip = trophies.length ? (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18 * s.k, flexWrap: "nowrap", overflow: "hidden" }}>
      {trophies.map(([name, count]) => (
        <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, maxWidth: 120 * s.k }}>
          <span style={{ position: "relative" }}>
            <TrophyArt name={name} gold={name !== "Stanley Cup"} size={(s.wide ? 40 : 54) * s.k} />
            {count > 1 ? (
              <span style={{ position: "absolute", top: -6, right: -14 * s.k, background: "#E11D48", color: "#fff", borderRadius: 99, padding: `1px ${5 * s.k}px`, fontFamily: DISPLAY, fontWeight: 700, fontSize: 12 * s.k }}>×{count}</span>
            ) : null}
          </span>
          <span style={{ marginTop: 4, fontSize: 11 * s.k, color: MUTED, textAlign: "center", ...ellipsis, maxWidth: "100%" }}>{shortAward(name)}</span>
        </div>
      ))}
    </div>
  ) : null;

  if (s.wide) {
    return (
      <Frame format={format} accent={accent} handle={handle}>
        <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
          <Photo playerId={p.id} available={p.hs} color={p.c} width={photoW} height={Math.round(photoW * 1.2)} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8 }}>
            {identity}
            {trophyStrip}
          </div>
          {hero}
        </div>
        {bars}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          {tiles.map((tile) => (
            <Tile key={tile.label} {...tile} k={0.85} />
          ))}
        </div>
      </Frame>
    );
  }
  return (
    <Frame format={format} accent={accent} handle={handle}>
      <div style={{ display: "flex", gap: 28 * s.k, alignItems: s.tall ? "flex-start" : "center", flexDirection: s.tall ? "column" : "row" }}>
        <div style={{ display: "flex", gap: 28 * s.k, alignItems: "center", width: s.tall ? "100%" : undefined }}>
          <Photo playerId={p.id} available={p.hs} color={p.c} width={photoW} height={Math.round(photoW * 1.18)} radius={22 * s.k} />
          {s.tall ? hero : null}
        </div>
        {identity}
      </div>
      <div style={{ display: "flex", gap: 20 * s.k, alignItems: "stretch" }}>
        {s.tall ? null : hero}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 * s.k }}>{bars}</div>
      </div>
      {trophyStrip}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 * s.k }}>
        {tiles.map((tile) => (
          <Tile key={tile.label} {...tile} k={s.k * 0.9} />
        ))}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Trade Proposal                                                   */
/* ------------------------------------------------------------------ */

export function TradeCard({ format, accent, subtitle, handle, result }: CardCommon & { result: TradeResult }) {
  const s = sz(format);
  const { calcs } = result;
  const two = calcs.length === 2;
  const stack = s.tall || calcs.length === 3;
  const maxRows = s.wide ? (calcs.length === 3 ? 3 : 4) : s.tall ? 6 : 5;
  const lean = two ? Math.max(-1, Math.min(1, calcs[0].margin / 0.5)) : 0;
  const capText = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;

  const balance = two ? (
    <div>
      <div style={{ color: MUTED, fontSize: 12 * s.k, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 * s.k }}>Trade value balance</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 * s.k }}>
        <Logo abbr={calcs[0].team.abbr} size={50 * s.k} />
        <div style={{ position: "relative", flex: 1, height: 18 * s.k, borderRadius: 99, background: BG, border: `1px solid ${LINE}`, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, background: hexA(MUTED, 0.6) }} />
          {!result.empty ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: lean < 0 ? `${50 + lean * 50}%` : "50%",
                width: `${Math.abs(lean) * 50}%`,
                background: result.fair ? MUTED : `linear-gradient(90deg, ${EMERALD}, #34D399)`,
              }}
            />
          ) : null}
        </div>
        <Logo abbr={calcs[1].team.abbr} size={50 * s.k} />
      </div>
    </div>
  ) : null;

  return (
    <Frame format={format} accent={accent} handle={handle}>
      <Header format={format} accent={accent} eyebrow="Trade Proposal · Verdict" title={result.headline} subtitle={subtitle || result.sub} maxChars={30} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: (s.tall ? 48 : 16) * s.k }}>
      {balance}
      <div style={{ display: "grid", gridTemplateColumns: stack ? (s.wide ? `repeat(${calcs.length}, minmax(0, 1fr))` : "1fr") : `repeat(${calcs.length}, minmax(0, 1fr))`, gap: (s.tall ? 28 : 16) * s.k }}>
        {calcs.map((calc) => {
          const rows = calc.rowsIn.slice(0, maxRows);
          const extra = calc.rowsIn.length - rows.length;
          return (
            <div key={calc.team.abbr} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 18 * s.k, padding: `${14 * s.k}px ${18 * s.k}px`, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 * s.k }}>
                <Logo abbr={calc.team.abbr} size={44 * s.k} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22 * s.k, ...ellipsis }}>{calc.team.name}</div>
                  <div style={{ color: MUTED, fontSize: 12 * s.k, letterSpacing: 1.6, textTransform: "uppercase" }}>Receives</div>
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 44 * s.k, lineHeight: 1, color: gradeColor(calc.grade) }}>{calc.grade}</div>
              </div>
              <div style={{ marginTop: 10 * s.k, display: "flex", flexDirection: "column", gap: 6 * s.k }}>
                {rows.length === 0 ? <div style={{ color: DIM, fontSize: 16 * s.k }}>Nothing</div> : null}
                {rows.map((row) => (
                  <div key={row.label + row.sub} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17 * s.k }}>
                    <span style={{ flex: 1, fontWeight: 600, ...ellipsis }}>
                      {row.label} <span style={{ color: DIM, fontWeight: 400, fontSize: 14 * s.k }}>{row.sub}</span>
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: row.color, flex: "none" }}>{row.rating}</span>
                  </div>
                ))}
                {extra > 0 ? <div style={{ color: DIM, fontSize: 14 * s.k }}>+{extra} more</div> : null}
              </div>
              <div style={{ marginTop: 10 * s.k, paddingTop: 8 * s.k, borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 15 * s.k }}>
                <span>
                  Asset Value <b style={{ color: INK }}>{Math.round(calc.incoming)}</b>
                </span>
                <span>
                  Cap <b style={{ color: calc.capDelta > 0 ? LOSS : EMERALD }}>{capText(calc.capDelta)}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      </div>
      <div style={{ color: result.issues.length ? GOLD : EMERALD, fontSize: 16 * s.k, ...(s.wide ? ellipsis : { lineHeight: 1.35 }) }}>
        {result.empty ? "Add players or picks to build the trade." : result.issues.length ? `⚠ ${result.issues.join(" · ")}` : "✓ Cap check passed: every team stays between the floor and the ceiling."}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Custom Top-5 Ranking                                             */
/* ------------------------------------------------------------------ */

export type RankRow = {
  key: string;
  name: string;
  sub: string;
  value: string;
  valueColor?: string;
  image: { kind: "player"; id: number; hs: boolean; color: string } | { kind: "team"; abbr: string };
};

function RankImage({ image, size }: { image: RankRow["image"]; size: number }) {
  if (image.kind === "team") {
    return (
      <span style={{ width: size, height: size, flex: "none", borderRadius: size * 0.22, background: PANEL, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Logo abbr={image.abbr} size={size * 0.8} />
      </span>
    );
  }
  return <Photo playerId={image.id} available={image.hs} color={image.color} width={size} height={size} radius={size * 0.22} />;
}

export function RankCard({ format, accent, subtitle, handle, title, metric, rows }: CardCommon & { title: string; metric: string; rows: RankRow[] }) {
  const s = sz(format);
  const shown = rows.slice(0, 5);
  const img = s.wide ? 52 : s.tall ? 150 : 92;
  return (
    <Frame format={format} accent={accent} handle={handle}>
      <Header format={format} accent={accent} eyebrow={metric} title={title || `Top 5 · ${metric}`} subtitle={subtitle} maxChars={32} />
      <div style={{ display: "flex", flexDirection: "column", gap: (s.wide ? 8 : 14) * s.k, flex: 1, justifyContent: "center" }}>
        {shown.length === 0 ? <div style={{ color: DIM, fontSize: 20 * s.k, textAlign: "center" }}>Pick up to five players or teams.</div> : null}
        {shown.map((row, index) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16 * s.k,
              padding: `${(s.wide ? 6 : 12) * s.k}px ${18 * s.k}px`,
              background: index === 0 ? hexA(accent, 0.1) : PANEL,
              border: `1px solid ${index === 0 ? hexA(accent, 0.5) : LINE}`,
              borderRadius: 16 * s.k,
              minWidth: 0,
            }}
          >
            <span style={{ width: 34 * s.k, flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: 34 * s.k, color: index === 0 ? GOLD : DIM, textAlign: "center" }}>{index + 1}</span>
            <RankImage image={row.image} size={img} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: (s.wide ? 24 : 28) * s.k, lineHeight: 1.1, ...ellipsis }}>{row.name}</span>
              <span style={{ color: MUTED, fontSize: 14 * s.k, ...ellipsis }}>{row.sub}</span>
            </span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: (s.wide ? 32 : 40) * s.k, color: row.valueColor ?? INK, flex: "none" }}>{row.value}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Draft Class / Redraft Spotlight                                  */
/* ------------------------------------------------------------------ */

export function DraftCard({ format, accent, subtitle, handle, cls, colors }: CardCommon & { cls: StudioClass; colors: Map<string, string> }) {
  const s = sz(format);
  const img = s.wide ? 34 : s.tall ? 86 : 52;
  const list = (title: string, picks: StudioClassPick[], kind: "redraft" | "steal") => (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 18 * s.k, padding: `${12 * s.k}px ${16 * s.k}px`, minWidth: 0, flex: 1 }}>
      <div style={{ color: kind === "steal" ? EMERALD : accent, fontSize: 13 * s.k, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 * s.k }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: (s.wide ? 5 : 10) * s.k }}>
        {picks.length === 0 ? <div style={{ color: DIM, fontSize: 15 * s.k }}>Too early to call.</div> : null}
        {picks.map((pick, index) => (
          <div key={pick.r} style={{ display: "flex", alignItems: "center", gap: 12 * s.k, minWidth: 0 }}>
            <span style={{ width: 20 * s.k, flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: 20 * s.k, color: index === 0 ? GOLD : DIM }}>{index + 1}</span>
            <Photo playerId={pick.id} available={pick.hs} color={colors.get(pick.tm) ?? CYAN} width={img} height={img} radius={img * 0.25} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 18 * s.k, fontWeight: 600, ...ellipsis }}>{pick.n}</span>
              <span style={{ color: MUTED, fontSize: 13 * s.k, ...ellipsis }}>
                {kind === "steal" ? `Round ${pick.rd} · #${pick.o}` : `Picked #${pick.o}`} · {pick.tm}
              </span>
            </span>
            {kind === "steal" ? (
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20 * s.k, color: (pick.s ?? 0) >= 0 ? EMERALD : LOSS, flex: "none" }}>{pick.s == null ? "—" : signed(pick.s)}</span>
            ) : (
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flex: "none" }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20 * s.k }}>{pick.qg.toLocaleString("en-US")}</span>
                <span style={{ color: DIM, fontSize: 10 * s.k, letterSpacing: 1.2, textTransform: "uppercase" }}>Impact</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  const badge = (
    <div
      style={{
        width: (s.wide ? 130 : 170) * (s.tall ? 1.2 : 1),
        height: (s.wide ? 130 : 170) * (s.tall ? 1.2 : 1),
        flex: "none",
        borderRadius: 22 * s.k,
        background: PANEL,
        border: `1px solid ${LINE}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ color: MUTED, fontSize: 12 * s.k, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>Class grade</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 64 * s.k, lineHeight: 1, color: gradeColor(cls.l), marginTop: 4 }}>{cls.l ?? "—"}</div>
      <div style={{ color: MUTED, fontSize: 13 * s.k, marginTop: 4 }}>{cls.rating == null ? "" : `${cls.rating} / 100`}</div>
    </div>
  );
  return (
    <Frame format={format} accent={accent} handle={handle}>
      <Header format={format} accent={accent} eyebrow="Redraft Spotlight" title={`${cls.y} NHL Draft`} subtitle={subtitle || "If the class were picked again today, by career Impact"} right={badge} />
      <div style={{ display: "flex", flexDirection: s.wide ? "row" : "column", gap: 16 * s.k, flex: s.wide ? undefined : 1 }}>
        {list("Top 5 in the redraft", cls.top, "redraft")}
        {list("Biggest late-round steals", cls.steals, "steal")}
      </div>
    </Frame>
  );
}
