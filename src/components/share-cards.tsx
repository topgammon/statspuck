"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { ShareFormat } from "@/components/share-modal";
import { teamLogoFile } from "@/components/team-logo";
import { signed } from "@/lib/format";
import type { ScoutingReport } from "@/lib/scouting";
import { publicPath } from "@/lib/site";
import type { PickRow, UndraftedPlayer, YearPoint } from "@/lib/types";

// Brand kit
const BG = "#0B0D10";
const PANEL = "#14171F";
const LINE = "#262B36";
const INK = "#F8FAFC";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const RED = "#E11D48";
const CYAN = "#38BDF8";
const GOLD = "#F59E0B";
const EMERALD = "#10B981";
const LOSS = "#EF4444";

const DISPLAY = "var(--font-oswald), Oswald, 'Arial Narrow', sans-serif";
const BODY = "var(--font-barlow), Barlow, system-ui, sans-serif";

const SILHOUETTE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#14171F"/><circle cx="40" cy="30" r="14" fill="#2A303C"/><path d="M12 80c6-20 16-28 28-28s22 8 28 28" fill="#2A303C"/></svg>`,
)}`;

export function useSameOriginImage(remote: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!remote) {
      setSrc(null);
      return;
    }
    let alive = true;
    let objectUrl = "";
    fetch(`/api/image-proxy?url=${encodeURIComponent(remote)}`)
      .then((response) => {
        if (!response.ok) throw new Error("proxy");
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setSrc(objectUrl);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [remote]);
  return src;
}

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

function dims(format: ShareFormat) {
  const wide = format === "wide";
  return {
    wide,
    width: wide ? 1200 : 1080,
    height: wide ? 630 : 1080,
    pad: wide ? 52 : 72,
    footer: wide ? 74 : 104,
    gap: wide ? 22 : 32,
  };
}

function Frame({
  format,
  accent,
  children,
  product = { name: "Draft Rater", path: "/draft-rater" },
}: {
  format: ShareFormat;
  accent: string;
  children: ReactNode;
  product?: { name: string; path: string };
}) {
  const d = dims(format);
  return (
    <div
      style={{
        position: "relative",
        width: d.width,
        height: d.height,
        background: BG,
        color: INK,
        overflow: "hidden",
        fontFamily: BODY,
        textAlign: "left",
        lineHeight: 1.25,
      }}
    >
      {/* Soft accent glow so every card carries its team or brand color without shouting. */}
      <div
        style={{
          position: "absolute",
          top: -d.height * 0.45,
          right: -d.width * 0.2,
          width: d.width * 0.8,
          height: d.height * 1.1,
          background: `radial-gradient(closest-side, ${hexA(accent, 0.22)}, ${hexA(accent, 0)})`,
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.35)})` }} />
      <div
        style={{
          position: "absolute",
          top: d.pad,
          left: d.pad,
          right: d.pad,
          bottom: d.footer + (d.wide ? 26 : 40),
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: d.gap,
        }}
      >
        {children}
      </div>
      <footer
        style={{
          position: "absolute",
          left: d.pad,
          right: d.pad,
          bottom: 0,
          height: d.footer,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${LINE}`,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* White badge keeps the logo's black linework readable on the dark card. */}
          <span
            style={{
              height: d.wide ? 42 : 54,
              width: d.wide ? 42 : 54,
              borderRadius: 10,
              background: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/statspuck-logo-480.png" alt="StatsPuck" style={{ height: "100%", width: "100%", objectFit: "contain" }} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 22 : 28, letterSpacing: 1 }}>STATSPUCK</span>
            <span style={{ color: MUTED, fontSize: d.wide ? 14 : 18, letterSpacing: 2, textTransform: "uppercase" }}>{product.name}</span>
          </span>
        </span>
        <span style={{ color: MUTED, fontSize: d.wide ? 18 : 24, letterSpacing: 0.4 }}>
          statspuck.com<span style={{ color: DIM }}>{product.path}</span>
        </span>
      </footer>
    </div>
  );
}

function Eyebrow({ children, size = 16, color = MUTED }: { children: ReactNode; size?: number; color?: string }) {
  return (
    <div style={{ color, fontSize: size, letterSpacing: 2.4, textTransform: "uppercase", fontWeight: 600, ...ellipsis }}>{children}</div>
  );
}

function Title({ children, size, wrap }: { children: ReactNode; size: number; wrap?: boolean }) {
  const lines: CSSProperties = wrap
    ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }
    : ellipsis;
  return (
    <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, lineHeight: 1.02, letterSpacing: 0.2, marginTop: 8, ...lines }}>{children}</div>
  );
}

function GradeBadge({ letter, rating, size, label = "Grade" }: { letter: string | null; rating: number | null; size: number; label?: string }) {
  const color = gradeColor(letter);
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: 24,
        background: PANEL,
        border: `1px solid ${LINE}`,
        boxShadow: `inset 0 0 0 1px ${hexA(color, 0.08)}, 0 0 60px ${hexA(color, 0.12)}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ color: MUTED, fontSize: size * 0.085, letterSpacing: 2.4, textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.5, lineHeight: 1, color, marginTop: size * 0.03 }}>{letter ?? "—"}</div>
      <div style={{ color: MUTED, fontSize: size * 0.09, marginTop: size * 0.04, height: size * 0.11 }}>{rating == null ? "" : `${rating} / 100`}</div>
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  valueColor,
  noteColor,
  big,
  text,
}: {
  label: string;
  value: string;
  note?: string;
  valueColor?: string;
  noteColor?: string;
  big?: boolean;
  text?: boolean;
}) {
  const valueSize = text ? (big ? 34 : 26) : big ? 52 : 40;
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 18,
        padding: big ? "22px 26px" : "16px 20px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ color: MUTED, fontSize: big ? 16 : 13, letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 600, ...ellipsis }}>{label}</div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: valueSize,
          lineHeight: 1.1,
          color: valueColor ?? INK,
          marginTop: big ? 12 : 8,
          ...ellipsis,
        }}
      >
        {value}
      </div>
      <div style={{ color: noteColor ?? MUTED, fontSize: big ? 18 : 15, marginTop: 4, height: big ? 24 : 20, ...ellipsis }}>{note ?? ""}</div>
    </div>
  );
}

function Grid({ columns, gap, children }: { columns: number; gap: number; children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }}>{children}</div>;
}

function Logo({ abbr, name, size = 72 }: { abbr: string; name?: string; size?: number }) {
  const [markup, setMarkup] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(publicPath(`/logos/teams/${teamLogoFile(abbr, name)}.svg`))
      .then((response) => response.text())
      .then((text) => {
        if (alive) setMarkup(text);
      })
      .catch(() => {
        if (alive) setMarkup("");
      });
    return () => {
      alive = false;
    };
  }, [abbr, name]);
  const h = Math.round(size * 0.72);
  return (
    <span
      style={{ width: size, height: h, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      dangerouslySetInnerHTML={{
        __html: markup ? markup.replace("<svg", `<svg width="${size}" height="${h}" style="width:${size}px;height:${h}px"`) : "",
      }}
    />
  );
}

function Stamps({ stamps, size = 15 }: { stamps: string[]; size?: number }) {
  if (stamps.length === 0) return null;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {stamps.slice(0, 3).map((stamp) => {
        const color = stampColor(stamp);
        return (
          <span
            key={stamp}
            style={{
              border: `1.5px solid ${hexA(color, 0.7)}`,
              background: hexA(color, 0.1),
              color,
              borderRadius: 999,
              padding: "5px 12px",
              fontFamily: DISPLAY,
              fontWeight: 700,
              letterSpacing: 1.4,
              fontSize: size,
              lineHeight: 1,
            }}
          >
            {stamp === "DEVELOPING" ? "PROSPECT" : stamp}
          </span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Card models                                                         */
/* ------------------------------------------------------------------ */

export type ShareCardModel =
  | { kind: "player"; pick: PickRow; color: string }
  | { kind: "undrafted"; player: UndraftedPlayer; color: string }
  | {
      kind: "team";
      name: string;
      abbr: string;
      color: string;
      rank: number;
      letter: string;
      rating: number;
      avg: number;
      report: ScoutingReport;
      byYear: YearPoint[];
    }
  | {
      kind: "gm";
      person: string;
      team: string;
      teamName: string;
      color: string;
      tenure: string;
      letter: string;
      rating: number | null;
      avg: number | null;
      graded: number;
      developing: number;
      report: ScoutingReport;
      best: PickRow | null;
      worst: PickRow | null;
      notable: PickRow[];
    }
  | {
      kind: "class";
      year: number;
      early: boolean;
      letter: string | null;
      rating: number | null;
      avg: number | null;
      regulars: number;
      leader: PickRow | null;
      steal: PickRow | null;
      bust: PickRow | null;
      bestTeam: string;
      top: PickRow[];
    }
  | {
      kind: "board";
      subtitle: string;
      mode: "Teams" | "GMs";
      rows: { rank: number; name: string; abbr?: string; letter: string; score: number; color: string }[];
    }
  | { kind: "trade"; headline: string; sub: string; sides: TradeSide[]; capNotes: string[] }
  | { kind: "assets"; subtitle: string; rows: { rank: number; name: string; abbr: string; total: number; roster: number; prospects: number; picks: number }[] };

export type TradeSide = {
  abbr: string;
  name: string;
  color: string;
  grade: string;
  /** Total Asset Value coming in. */
  total: number;
  /** Net cap change in dollars. */
  capDelta: number;
  receives: { label: string; sub: string; rating: number; color: string }[];
};

export function ShareCardView({ format, card }: { format: ShareFormat; card: ShareCardModel }) {
  if (card.kind === "assets") return <AssetsShareCard format={format} subtitle={card.subtitle} rows={card.rows} />;
  if (card.kind === "trade") return <TradeShareCard format={format} headline={card.headline} sub={card.sub} sides={card.sides} capNotes={card.capNotes} />;
  if (card.kind === "player") return <PlayerShareCard format={format} pick={card.pick} color={card.color} />;
  if (card.kind === "undrafted") return <UndraftedShareCard format={format} player={card.player} color={card.color} />;
  if (card.kind === "team") {
    const { kind: _kind, ...props } = card;
    return <TeamShareCard format={format} {...props} />;
  }
  if (card.kind === "gm") {
    const { kind: _kind, ...props } = card;
    return <GmShareCard format={format} {...props} />;
  }
  if (card.kind === "class") {
    const { kind: _kind, ...props } = card;
    return <ClassShareCard format={format} {...props} />;
  }
  return <BoardShareCard format={format} subtitle={card.subtitle} mode={card.mode} rows={card.rows} />;
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

export function PlayerShareCard({ format, pick, color }: { format: ShareFormat; pick: PickRow; color: string }) {
  const remote = pick.hasHeadshot && pick.playerId ? `https://assets.nhle.com/mugs/nhl/latest/${pick.playerId}.png` : null;
  const photo = useSameOriginImage(remote);
  const d = dims(format);
  const moved = pick.overall - pick.redraft;
  const rate = pick.group === "G" ? (pick.savePct == null ? "—" : pick.savePct.toFixed(3)) : pick.ppg == null ? "—" : pick.ppg.toFixed(2);
  const letter = pick.developing ? "—" : pick.letter;
  const rating = pick.developing ? null : pick.rating;
  const nameSize = d.wide ? fitSize(pick.name, 64, 16) : 80;

  const tiles = (
    <Grid columns={4} gap={d.wide ? 14 : 18}>
      <Tile
        label="Redraft"
        value={`#${pick.redraft}`}
        note={moved === 0 ? "Same slot" : moved > 0 ? `▲ ${moved} spots` : `▼ ${Math.abs(moved)} spots`}
        noteColor={moved > 0 ? EMERALD : moved < 0 ? LOSS : MUTED}
      />
      <Tile label="Score vs slot" value={signed(pick.score)} valueColor={scoreColor(pick.score)} note="Impact" />
      <Tile label="Impact" value={pick.qg.toFixed(0)} note={`Expected ${pick.expected == null ? "—" : pick.expected.toFixed(0)}`} />
      <Tile label={pick.group === "G" ? "Games · SV%" : "Games · PPG"} value={`${pick.gpCareer}`} note={`${pick.group === "G" ? "SV%" : "PPG"} ${rate}`} />
    </Grid>
  );

  const photoBox = (w: number, h: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo || SILHOUETTE}
      alt=""
      width={w}
      height={h}
      style={{
        width: w,
        height: h,
        flex: "none",
        objectFit: "cover",
        objectPosition: "center top",
        borderRadius: 22,
        border: `1px solid ${LINE}`,
        background: `linear-gradient(180deg, ${hexA(color, 0.35)}, ${PANEL})`,
      }}
    />
  );

  const identity = (
    <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      <Eyebrow size={d.wide ? 15 : 18}>
        {pick.year} draft · Round {pick.round} · {pick.pos}
      </Eyebrow>
      <Title size={nameSize} wrap={!d.wide}>
        {pick.name}
      </Title>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: d.wide ? 14 : 18, color: MUTED, fontSize: d.wide ? 20 : 24, minWidth: 0 }}>
        <span style={{ color: INK, fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 26 : 32 }}>#{pick.overall}</span>
        <Logo abbr={pick.team} name={pick.teamName} size={d.wide ? 44 : 54} />
        <span style={ellipsis}>{pick.teamName}</span>
      </div>
      <div style={{ marginTop: d.wide ? 16 : 22 }}>
        <Stamps stamps={pick.stamps} size={d.wide ? 14 : 17} />
      </div>
    </div>
  );

  if (d.wide) {
    return (
      <Frame format={format} accent={color}>
        <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
          {photoBox(196, 236)}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {identity}
            <div style={{ marginTop: "auto" }}>
              <Spark seasons={pick.seasons ?? []} expected={pick.expectedPath ?? []} color={color} width={560} height={56} />
            </div>
          </div>
          <GradeBadge letter={letter} rating={rating} size={196} />
        </div>
        {tiles}
      </Frame>
    );
  }

  return (
    <Frame format={format} accent={color}>
      <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
        {photoBox(260, 300)}
        {identity}
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch" }}>
        <GradeBadge letter={letter} rating={rating} size={230} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: PANEL,
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: MUTED, fontSize: 15, letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 600 }}>Career pace</span>
            <SparkLegend color={color} />
          </div>
          <Spark seasons={pick.seasons ?? []} expected={pick.expectedPath ?? []} color={color} width={620} height={130} />
        </div>
      </div>
      {tiles}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Undrafted player                                                    */
/* ------------------------------------------------------------------ */

export function UndraftedShareCard({ format, player, color }: { format: ShareFormat; player: UndraftedPlayer; color: string }) {
  const photo = useSameOriginImage(`https://assets.nhle.com/mugs/nhl/latest/${player.playerId}.png`);
  const d = dims(format);
  const rate = player.group === "G" ? (player.savePct == null ? "—" : player.savePct.toFixed(3)) : player.ppg == null ? "—" : player.ppg.toFixed(2);
  const nameSize = d.wide ? fitSize(player.name, 64, 16) : 80;
  const size = d.wide ? 196 : 230;
  const tiles = (
    <Grid columns={4} gap={d.wide ? 14 : 18}>
      <Tile label="Impact" value={player.qg.toFixed(0)} note="Career, since 2005-06" />
      <Tile label="Games" value={String(player.gpCareer)} note="NHL regular season" />
      <Tile label={player.group === "G" ? "SV%" : "PPG"} value={rate} />
      <Tile
        label="Dev credit"
        value={player.devCredit == null ? "—" : signed(player.devCredit)}
        valueColor={player.devCredit == null ? INK : EMERALD}
        note={player.franchise ?? "—"}
      />
    </Grid>
  );
  const badge = (
    <div
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: 24,
        background: PANEL,
        border: `1px solid ${hexA("#38BDF8", 0.5)}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "#38BDF8",
      }}
    >
      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 30 : 36, letterSpacing: 3 }}>UNDRAFTED</span>
      <span style={{ color: MUTED, fontSize: d.wide ? 16 : 19 }}>NHL debut {player.debut}</span>
    </div>
  );
  const identity = (
    <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      <Eyebrow size={d.wide ? 15 : 18}>Undrafted · {player.pos}</Eyebrow>
      <Title size={nameSize} wrap={!d.wide}>
        {player.name}
      </Title>
      {player.firstTeam ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: d.wide ? 14 : 18, color: MUTED, fontSize: d.wide ? 20 : 24, minWidth: 0 }}>
          <span style={{ color: INK, fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 22 : 28 }}>First NHL team</span>
          <Logo abbr={player.firstTeam} name={player.firstTeamName ?? undefined} size={d.wide ? 44 : 54} />
          <span style={ellipsis}>{player.firstTeamName}</span>
        </div>
      ) : null}
      <div style={{ marginTop: d.wide ? 16 : 22 }}>
        <Stamps stamps={player.stamps} size={d.wide ? 14 : 17} />
      </div>
    </div>
  );
  const photoBox = (w: number, h: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo || SILHOUETTE}
      alt=""
      width={w}
      height={h}
      style={{
        width: w,
        height: h,
        flex: "none",
        objectFit: "cover",
        objectPosition: "center top",
        borderRadius: 22,
        border: `1px solid ${LINE}`,
        background: `linear-gradient(180deg, ${hexA(color, 0.35)}, ${PANEL})`,
      }}
    />
  );
  if (d.wide) {
    return (
      <Frame format={format} accent={color}>
        <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
          {photoBox(196, 236)}
          {identity}
          {badge}
        </div>
        {tiles}
      </Frame>
    );
  }
  return (
    <Frame format={format} accent={color}>
      <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
        {photoBox(260, 300)}
        {identity}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>{badge}</div>
      {tiles}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export function TeamShareCard({
  format,
  name,
  abbr,
  color,
  rank,
  letter,
  rating,
  avg,
  report,
  byYear,
}: {
  format: ShareFormat;
  name: string;
  abbr: string;
  color: string;
  rank: number;
  letter: string;
  rating: number;
  avg: number;
  report: ScoutingReport;
  byYear: YearPoint[];
}) {
  const d = dims(format);
  const tiles = [
    <Tile key="bust" label="1st-round busts" value={pct(report.bust.rate)} note={report.bust.n ? `${report.bust.count} of ${report.bust.n} picks` : "No sample yet"} big={!d.wide} />,
    <Tile key="late" label="Late-round hits" value={pct(report.late.rate)} note={report.late.n ? `${report.late.count} of ${report.late.n} picks` : "No sample yet"} big={!d.wide} />,
    <Tile key="gem" label="Gem rate" value={pct(report.gemRate)} note={`${report.steals} steals · ${report.bloomers} bloomers`} big={!d.wide} />,
    <Tile key="best" label="Best group" value={report.best?.label ?? "—"} text note={report.best ? `${signed(report.best.score)} vs slot` : ""} noteColor={scoreColor(report.best?.score)} big={!d.wide} />,
  ];
  return (
    <Frame format={format} accent={color}>
      <div style={{ display: "flex", alignItems: "center", gap: d.wide ? 28 : 36 }}>
        <Logo abbr={abbr} name={name} size={d.wide ? 120 : 150} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow size={d.wide ? 15 : 18}>Franchise draft grade · #{rank} of 32</Eyebrow>
          <Title size={d.wide ? fitSize(name, 60, 20) : 76} wrap={!d.wide}>
            {name}
          </Title>
          <div style={{ marginTop: d.wide ? 12 : 16, fontSize: d.wide ? 22 : 26, color: MUTED }}>
            Draft Score <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: scoreColor(avg) }}>{signed(avg)}</span>
          </div>
        </div>
        <GradeBadge letter={letter} rating={rating} size={d.wide ? 170 : 230} />
      </div>
      <Grid columns={d.wide ? 4 : 2} gap={d.wide ? 14 : 18}>
        {tiles}
      </Grid>
      <ChartPanel title="Score vs the slot by draft class" compact={d.wide}>
        <Bars points={byYear} width={d.wide ? 1050 : 880} height={d.wide ? 92 : 190} />
      </ChartPanel>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* GM                                                                  */
/* ------------------------------------------------------------------ */

export function GmShareCard({
  format,
  person,
  team,
  teamName,
  color,
  tenure,
  letter,
  rating,
  avg,
  graded,
  developing,
  report,
  best,
  worst,
  notable,
}: {
  format: ShareFormat;
  person: string;
  team: string;
  teamName: string;
  color: string;
  tenure: string;
  letter: string;
  rating: number | null;
  avg: number | null;
  graded: number;
  developing: number;
  report: ScoutingReport;
  best: PickRow | null;
  worst: PickRow | null;
  notable: PickRow[];
}) {
  const d = dims(format);
  const meta = `${graded} graded${developing ? ` · ${developing} ${developing === 1 ? "prospect" : "prospects"}` : ""}`;
  return (
    <Frame format={format} accent={color}>
      <div style={{ display: "flex", alignItems: "center", gap: d.wide ? 28 : 36 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Logo abbr={team} name={teamName} size={d.wide ? 52 : 64} />
            <Eyebrow size={d.wide ? 15 : 18}>
              General manager · {teamName} · {tenure}
            </Eyebrow>
          </div>
          <Title size={d.wide ? fitSize(person, 66, 18) : 80} wrap={!d.wide}>
            {person}
          </Title>
          <div style={{ marginTop: d.wide ? 12 : 16, fontSize: d.wide ? 22 : 26, color: MUTED, ...ellipsis }}>
            Draft Score <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: scoreColor(avg) }}>{signed(avg)}</span> · {meta}
          </div>
        </div>
        <GradeBadge letter={letter} rating={rating} size={d.wide ? 170 : 230} />
      </div>
      <Grid columns={d.wide ? 4 : 2} gap={d.wide ? 14 : 18}>
        <Tile label="Best pick" value={best?.name ?? "—"} text note={best ? `${best.year} #${best.overall} · ${signed(best.score)}` : ""} noteColor={scoreColor(best?.score)} big={!d.wide} />
        <Tile label="Worst pick" value={worst?.name ?? "—"} text note={worst ? `${worst.year} #${worst.overall} · ${signed(worst.score)}` : ""} noteColor={scoreColor(worst?.score)} big={!d.wide} />
        <Tile label="1st-round busts" value={pct(report.bust.rate)} note={report.bust.n ? `${report.bust.count} of ${report.bust.n} picks` : "No sample yet"} big={!d.wide} />
        <Tile label="Late-round hits" value={pct(report.late.rate)} note={report.late.n ? `${report.late.count} of ${report.late.n} picks` : "No sample yet"} big={!d.wide} />
      </Grid>
      {notable.length > 0 ? (
        <ChartPanel title="Top picks" compact={d.wide}>
          <div style={{ display: "grid", gridTemplateColumns: d.wide ? `repeat(${Math.min(3, notable.length)}, minmax(0, 1fr))` : "1fr", gap: d.wide ? 24 : 6 }}>
            {notable.slice(0, 3).map((pick, index) => (
              <PickLine key={pick.id} index={index + 1} pick={pick} large={!d.wide} />
            ))}
          </div>
        </ChartPanel>
      ) : (
        <div />
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Draft class                                                         */
/* ------------------------------------------------------------------ */

export function ClassShareCard({
  format,
  year,
  early,
  letter,
  rating,
  avg,
  regulars,
  leader,
  steal,
  bust,
  bestTeam,
  top,
}: {
  format: ShareFormat;
  year: number;
  early: boolean;
  letter: string | null;
  rating: number | null;
  avg: number | null;
  regulars: number;
  leader: PickRow | null;
  steal: PickRow | null;
  bust: PickRow | null;
  bestTeam: string;
  top: PickRow[];
}) {
  const d = dims(format);
  const shown = top.slice(0, 5);
  return (
    <Frame format={format} accent={RED}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow size={d.wide ? 15 : 18} color={early ? CYAN : MUTED}>
            {early ? "Draft class · early sample" : "NHL draft class grade"}
          </Eyebrow>
          <Title size={d.wide ? 84 : 104}>{year} Draft</Title>
          <div style={{ marginTop: d.wide ? 12 : 16, fontSize: d.wide ? 22 : 26, color: MUTED, ...ellipsis }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: scoreColor(avg) }}>{signed(avg)}</span> vs the slot · {regulars} NHL regulars
          </div>
        </div>
        <GradeBadge letter={letter} rating={rating} size={d.wide ? 170 : 230} />
      </div>
      <Grid columns={d.wide ? 4 : 2} gap={d.wide ? 14 : 18}>
        <Tile label="#1 in redraft" value={leader?.name ?? "—"} text note={leader ? `Picked #${leader.overall}` : ""} big={!d.wide} />
        <Tile label="Steal" value={steal?.name ?? "—"} text note={steal ? `#${steal.overall} · ${signed(steal.score)}` : "None yet"} noteColor={steal ? EMERALD : MUTED} big={!d.wide} />
        <Tile label="Biggest bust" value={bust?.name ?? "—"} text note={bust ? `#${bust.overall} · ${signed(bust.score)}` : "None yet"} noteColor={bust ? LOSS : MUTED} big={!d.wide} />
        <Tile label="Best team" value={bestTeam} text note={rating == null ? "" : `Class rated ${rating}/100`} big={!d.wide} />
      </Grid>
      {shown.length > 0 ? (
        <ChartPanel title="Redraft top 5" compact={d.wide}>
          <div style={{ display: "grid", gridTemplateColumns: d.wide ? `repeat(${shown.length}, minmax(0, 1fr))` : "1fr", gap: d.wide ? 16 : 4 }}>
            {shown.map((pick, index) => (
              <div
                key={pick.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  minWidth: 0,
                  padding: d.wide ? (index === 0 ? 0 : "0 0 0 16px") : "6px 0",
                  borderLeft: d.wide && index > 0 ? `1px solid ${LINE}` : undefined,
                }}
              >
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: index === 0 ? GOLD : DIM, fontSize: d.wide ? 20 : 26, width: d.wide ? 18 : 28, flex: "none" }}>{index + 1}</span>
                <span style={{ fontSize: d.wide ? 18 : 26, fontWeight: 600, flex: 1, ...ellipsis }}>{pick.name}</span>
                <span style={{ color: MUTED, fontSize: d.wide ? 15 : 22, flex: "none" }}>#{pick.overall}</span>
              </div>
            ))}
          </div>
        </ChartPanel>
      ) : (
        <div />
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

export function BoardShareCard({
  format,
  subtitle,
  rows,
  mode,
}: {
  format: ShareFormat;
  subtitle: string;
  mode: "Teams" | "GMs";
  rows: { rank: number; name: string; abbr?: string; letter: string; score: number; color: string }[];
}) {
  const d = dims(format);
  const shown = rows.slice(0, 10);
  const rowH = d.wide ? 50 : 62;
  return (
    <Frame format={format} accent={RED}>
      <div>
        <Eyebrow size={d.wide ? 15 : 18}>{subtitle}</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, marginTop: 8 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 50 : 68, lineHeight: 1.02 }}>Who actually wins the NHL draft?</div>
        </div>
        <div style={{ marginTop: 10, color: MUTED, fontSize: d.wide ? 19 : 24 }}>
          {mode === "Teams" ? "Top 10 franchises" : "Top 10 general managers"} by draft grade · Draft Score, 0.0 = NHL average
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: d.wide ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gridAutoFlow: d.wide ? "column" : "row",
          gridTemplateRows: d.wide ? `repeat(${Math.ceil(shown.length / 2)}, ${rowH}px)` : undefined,
          columnGap: 20,
          rowGap: d.wide ? 8 : 8,
        }}
      >
        {shown.map((row) => (
          <div
            key={`${row.rank}-${row.name}`}
            style={{
              height: rowH,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "0 18px",
              background: PANEL,
              border: `1px solid ${LINE}`,
              borderRadius: 14,
              minWidth: 0,
            }}
          >
            <span style={{ width: 26, flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 20 : 24, color: row.rank === 1 ? GOLD : DIM }}>{row.rank}</span>
            {row.abbr ? <Logo abbr={row.abbr} size={d.wide ? 40 : 50} /> : null}
            <span style={{ flex: 1, fontSize: d.wide ? 19 : 24, fontWeight: 600, ...ellipsis }}>{row.name}</span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: gradeColor(row.letter), fontSize: d.wide ? 24 : 30, width: 44, textAlign: "center", flex: "none" }}>{row.letter}</span>
            <span style={{ width: d.wide ? 70 : 90, textAlign: "right", flex: "none", fontSize: d.wide ? 17 : 22, color: scoreColor(row.score) }}>{signed(row.score)}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Trade Machine                                                       */
/* ------------------------------------------------------------------ */

export function AssetsShareCard({
  format,
  subtitle,
  rows,
}: {
  format: ShareFormat;
  subtitle: string;
  rows: { rank: number; name: string; abbr: string; total: number; roster: number; prospects: number; picks: number }[];
}) {
  const d = dims(format);
  const shown = rows.slice(0, 10);
  const rowH = d.wide ? 50 : 62;
  const top = Math.max(1, ...shown.map((row) => row.total));
  return (
    <Frame format={format} accent={RED} product={{ name: "Trade Machine", path: "/trade-machine/rankings" }}>
      <div>
        <Eyebrow size={d.wide ? 15 : 18}>{subtitle}</Eyebrow>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 50 : 68, lineHeight: 1.02, marginTop: 8 }}>Franchise Asset Rankings</div>
        <div style={{ marginTop: 10, color: MUTED, fontSize: d.wide ? 19 : 24 }}>Roster + prospects + draft picks, on one Asset Value scale</div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: d.wide ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gridAutoFlow: d.wide ? "column" : "row",
          gridTemplateRows: d.wide ? `repeat(${Math.ceil(shown.length / 2)}, ${rowH}px)` : undefined,
          columnGap: 20,
          rowGap: 8,
        }}
      >
        {shown.map((row) => (
          <div key={row.abbr} style={{ height: rowH, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, minWidth: 0 }}>
            <span style={{ width: 26, flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 20 : 24, color: row.rank === 1 ? GOLD : DIM }}>{row.rank}</span>
            <Logo abbr={row.abbr} size={d.wide ? 40 : 50} />
            <span style={{ flex: 1, fontSize: d.wide ? 19 : 24, fontWeight: 600, ...ellipsis }}>{row.name}</span>
            <span style={{ width: d.wide ? 90 : 130, height: d.wide ? 10 : 14, flex: "none", borderRadius: 999, overflow: "hidden", display: "flex", background: BG }}>
              <span style={{ width: `${(row.roster / top) * 100}%`, background: CYAN }} />
              <span style={{ width: `${(row.prospects / top) * 100}%`, background: "#8B5CF6" }} />
              <span style={{ width: `${(row.picks / top) * 100}%`, background: GOLD }} />
            </span>
            <span style={{ width: d.wide ? 60 : 80, textAlign: "right", flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 22 : 28 }}>{Math.round(row.total).toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function TradeShareCard({ format, headline, sub, sides, capNotes }: { format: ShareFormat; headline: string; sub: string; sides: TradeSide[]; capNotes: string[] }) {
  const d = dims(format);
  const three = sides.length >= 3;
  const maxRows = d.wide ? (three ? 3 : 4) : three ? 5 : 6;
  const capText = (value: number) => `${value >= 0 ? "+" : "−"}$${(Math.abs(value) / 1_000_000).toFixed(2)}M`;
  return (
    <Frame format={format} accent={RED} product={{ name: "Trade Machine", path: "/trade-machine" }}>
      <div>
        <Eyebrow size={d.wide ? 15 : 18}>Trade Machine · Verdict</Eyebrow>
        <Title size={fitSize(headline, d.wide ? 54 : 72, d.wide ? 30 : 24)}>{headline}</Title>
        <div style={{ marginTop: 8, color: MUTED, fontSize: d.wide ? 19 : 24, ...ellipsis }}>{sub}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${d.wide || sides.length < 3 ? sides.length : 1}, minmax(0, 1fr))`, gap: d.wide ? 18 : 20 }}>
        {sides.map((side) => {
          const shown = side.receives.slice(0, maxRows);
          const extra = side.receives.length - shown.length;
          return (
            <div key={side.abbr} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 18, padding: d.wide ? "16px 20px" : "20px 26px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Logo abbr={side.abbr} size={d.wide ? 48 : 60} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 24 : 30, ...ellipsis }}>{side.name}</div>
                  <div style={{ color: MUTED, fontSize: d.wide ? 13 : 16, letterSpacing: 1.6, textTransform: "uppercase" }}>Receives</div>
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: d.wide ? 46 : 58, lineHeight: 1, color: gradeColor(side.grade) }}>{side.grade}</div>
              </div>
              <div style={{ marginTop: d.wide ? 10 : 14, display: "flex", flexDirection: "column", gap: d.wide ? 5 : 8 }}>
                {shown.length === 0 ? <div style={{ color: DIM, fontSize: d.wide ? 16 : 20 }}>Nothing</div> : null}
                {shown.map((row) => (
                  <div key={row.label + row.sub} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: d.wide ? 17 : 22 }}>
                    <span style={{ flex: 1, fontWeight: 600, ...ellipsis }}>
                      {row.label} <span style={{ color: DIM, fontWeight: 400, fontSize: d.wide ? 14 : 18 }}>{row.sub}</span>
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: row.color, flex: "none" }}>{row.rating}</span>
                  </div>
                ))}
                {extra > 0 ? <div style={{ color: DIM, fontSize: d.wide ? 14 : 18 }}>+{extra} more</div> : null}
              </div>
              <div style={{ marginTop: d.wide ? 10 : 14, paddingTop: d.wide ? 8 : 12, borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", color: MUTED, fontSize: d.wide ? 15 : 20 }}>
                <span>
                  Asset Value <b style={{ color: INK }}>{side.total}</b>
                </span>
                <span>
                  Cap <b style={{ color: side.capDelta > 0 ? LOSS : EMERALD }}>{capText(side.capDelta)}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ color: capNotes.length ? GOLD : MUTED, fontSize: d.wide ? 16 : 21, ...ellipsis }}>{capNotes.length ? capNotes.join(" · ") : "Cap check passed for every team."}</div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function ChartPanel({ title, compact, children }: { title: string; compact?: boolean; children: ReactNode }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 18, padding: compact ? "14px 20px" : "22px 26px" }}>
      <div style={{ color: MUTED, fontSize: compact ? 13 : 16, letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 600, marginBottom: compact ? 8 : 14 }}>{title}</div>
      {children}
    </div>
  );
}

function PickLine({ index, pick, large }: { index: number; pick: PickRow; large?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0, padding: large ? "6px 0" : 0 }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: index === 1 ? GOLD : DIM, fontSize: large ? 26 : 20, width: large ? 28 : 16, flex: "none" }}>{index}</span>
      <span style={{ flex: 1, fontSize: large ? 26 : 18, fontWeight: 600, ...ellipsis }}>{pick.name}</span>
      <span style={{ flex: "none", fontSize: large ? 22 : 16, color: scoreColor(pick.score) }}>{signed(pick.score)}</span>
      <span style={{ flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: large ? 24 : 18, color: gradeColor(pick.letter), width: large ? 40 : 30, textAlign: "right" }}>{pick.letter ?? "—"}</span>
    </div>
  );
}

function SparkLegend({ color }: { color: string }) {
  return (
    <span style={{ display: "flex", gap: 18, color: MUTED, fontSize: 15 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 18, height: 3, background: sparkColor(color), borderRadius: 2 }} /> Actual
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 18, height: 0, borderTop: `2px dashed ${DIM}` }} /> Expected
      </span>
    </span>
  );
}

function Spark({ seasons, expected, color, width, height }: { seasons: number[]; expected: number[]; color: string; width: number; height: number }) {
  const count = Math.min(seasons.length, expected.length);
  if (count < 2) return <div style={{ height }} />;
  let run = 0;
  const actual: number[] = [];
  for (let index = 0; index < count; index += 1) {
    run += seasons[index] ?? 0;
    actual.push(run);
  }
  const line = expected.slice(0, count);
  const max = Math.max(1, ...actual, ...line);
  const x = (index: number) => 4 + (index / (count - 1)) * (width - 8);
  const y = (value: number) => height - 4 - (value / max) * (height - 10);
  const path = (values: number[]) => values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const stroke = sparkColor(color);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Career pace versus expectation" style={{ display: "block", maxWidth: "100%" }}>
      <path d={`${path(actual)} L${x(count - 1)},${height} L${x(0)},${height} Z`} fill={hexA(stroke, 0.12)} />
      <path d={path(line)} fill="none" stroke={DIM} strokeWidth="2" strokeDasharray="6 6" />
      <path d={path(actual)} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Bars({ points, width, height }: { points: YearPoint[]; width: number; height: number }) {
  const rows = points.filter((point) => point.n >= 1).slice(-18);
  if (rows.length === 0) return <div style={{ height }} />;
  const peak = Math.max(8, ...rows.map((point) => Math.abs(point.avg)));
  const labelH = 18;
  const plotH = height - labelH;
  const mid = plotH / 2;
  const slot = width / rows.length;
  const bar = Math.min(34, slot * 0.62);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Score by draft class" style={{ display: "block", maxWidth: "100%" }}>
      <line x1={0} x2={width} y1={mid} y2={mid} stroke={LINE} strokeWidth="1" />
      {rows.map((point, index) => {
        const h = Math.max(2, (Math.abs(point.avg) / peak) * (mid - 2));
        const x = index * slot + (slot - bar) / 2;
        const showLabel = rows.length <= 10 || index % 2 === 0 || index === rows.length - 1;
        return (
          <g key={point.year}>
            <rect x={x} y={point.avg >= 0 ? mid - h : mid} width={bar} height={h} rx="3" fill={point.avg >= 0 ? EMERALD : LOSS} />
            {showLabel ? (
              <text x={x + bar / 2} y={height - 3} textAnchor="middle" fill={DIM} fontSize="13" fontFamily={BODY}>
                {`'${String(point.year).slice(2)}`}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function gradeColor(letter: string | null | undefined): string {
  const first = (letter ?? "").charAt(0);
  if (first === "A") return GOLD;
  if (first === "B") return EMERALD;
  if (first === "C") return INK;
  if (first === "D" || first === "F") return LOSS;
  return MUTED;
}

function stampColor(stamp: string): string {
  if (stamp === "ELITE") return GOLD;
  if (stamp === "STEAL") return EMERALD;
  if (stamp === "BUST") return LOSS;
  if (stamp === "LATE BLOOMER") return "#8B5CF6";
  if (stamp === "STALLED") return "#F97316";
  if (stamp === "DEVELOPING") return "#3B82F6";
  if (stamp === "UNDRAFTED") return "#38BDF8";
  return DIM;
}

function scoreColor(value: number | null | undefined): string {
  if (value == null || value === 0) return INK;
  return value > 0 ? EMERALD : LOSS;
}

/** Team colors can be very dark; lift them so lines stay visible on the obsidian background. */
function sparkColor(color: string): string {
  return luminance(color) < 0.12 ? CYAN : color;
}

function pct(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** Shrinks long names so they fit on one line. */
function fitSize(text: string, base: number, maxChars: number): number {
  if (text.length <= maxChars) return base;
  return Math.max(Math.round(base * 0.6), Math.round((base * maxChars) / text.length));
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function hexA(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function luminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
