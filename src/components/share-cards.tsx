"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ShareFormat } from "@/components/share-modal";
import { teamLogoFile } from "@/components/team-logo";
import { signed } from "@/lib/format";
import type { ScoutingReport } from "@/lib/scouting";
import { publicPath } from "@/lib/site";
import type { PickRow, YearPoint } from "@/lib/types";

const INK = "#f4f4f5";
const MUTED = "#a1a1aa";
const DIM = "#71717a";
const GREEN = "#3ddc97";
const RED = "#ff4d4d";
const BG = "#0B0D10";

const SILHOUETTE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#14161c"/><circle cx="40" cy="28" r="14" fill="#3a3d46"/><path d="M14 78c6-20 16-28 26-28s20 8 26 28" fill="#3a3d46"/></svg>`,
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

function Frame({ format, color, children }: { format: ShareFormat; color: string; children: ReactNode }) {
  const wide = format === "wide";
  return (
    <div
      style={{
        position: "relative",
        width: wide ? 1200 : 1080,
        height: wide ? 630 : 1080,
        background: BG,
        color: INK,
        overflow: "hidden",
        fontFamily: "Barlow, sans-serif",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: color }} />
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 10, background: color }} />
      <div style={{ position: "absolute", inset: wide ? "28px 36px 86px" : "36px 40px 96px" }}>{children}</div>
      <footer
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: wide ? 74 : 84,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 36px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "#090a0e",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* White sticker badge keeps the logo's black linework readable on the dark card. */}
          <span
            style={{
              height: wide ? 50 : 58,
              padding: 3,
              borderRadius: 8,
              background: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.6)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/statspuck-logo-480.png" alt="StatsPuck" style={{ height: "100%", width: "auto", borderRadius: 6 }} />
          </span>
          <span>
            <span style={{ display: "block", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: 0.6 }}>STATSPUCK · DRAFT RATER</span>
            <span style={{ display: "block", color: MUTED, fontSize: 14 }}>statspuck.com/draft-rater</span>
          </span>
        </span>
      </footer>
    </div>
  );
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
  return (
    <span
      style={{ width: size, height: size * 0.68, display: "inline-flex", alignItems: "center" }}
      dangerouslySetInnerHTML={{
        __html: markup
          ? markup.replace("<svg", `<svg width="${size}" height="${Math.round(size * 0.68)}" style="width:${size}px;height:${Math.round(size * 0.68)}px"`)
          : "",
      }}
    />
  );
}

function Stamps({ stamps }: { stamps: string[] }) {
  if (stamps.length === 0) return null;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {stamps.map((stamp) => (
        <span
          key={stamp}
          style={{
            border: `3px solid ${stampColor(stamp)}`,
            color: stampColor(stamp),
            padding: "4px 8px",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            letterSpacing: 1.2,
            fontSize: 16,
          }}
        >
          {stamp === "DEVELOPING" ? "PROSPECT" : stamp}
        </span>
      ))}
    </span>
  );
}

function stampColor(stamp: string): string {
  if (stamp === "ELITE") return "#f6e3a1";
  if (stamp === "STEAL") return "#f6e3a1";
  if (stamp === "BUST") return "#ff8b8b";
  if (stamp === "LATE BLOOMER") return "#7ddec8";
  if (stamp === "STALLED") return "#fdba74";
  if (stamp === "DEVELOPING") return "#7dd3fc";
  return "#c5ccd6";
}

function scoreColor(value: number | null | undefined): string {
  if (value == null || value === 0) return INK;
  return value > 0 ? GREEN : RED;
}

export type ShareCardModel =
  | { kind: "player"; pick: PickRow; color: string }
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
    };

export function ShareCardView({ format, card }: { format: ShareFormat; card: ShareCardModel }) {
  if (card.kind === "player") return <PlayerShareCard format={format} pick={card.pick} color={card.color} />;
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

export function PlayerShareCard({ format, pick, color }: { format: ShareFormat; pick: PickRow; color: string }) {
  const remote = pick.hasHeadshot && pick.playerId ? `https://assets.nhle.com/mugs/nhl/latest/${pick.playerId}.png` : null;
  const photo = useSameOriginImage(remote);
  const moved = pick.overall - pick.redraft;
  const wide = format === "wide";
  const rate = pick.group === "G" ? (pick.savePct == null ? "—" : pick.savePct.toFixed(3)) : pick.ppg == null ? "—" : pick.ppg.toFixed(2);
  return (
    <Frame format={format} color={color}>
      <div style={{ display: "flex", gap: wide ? 28 : 22, height: "100%", flexDirection: wide ? "row" : "column" }}>
        <img
          src={photo || SILHOUETTE}
          alt=""
          width={wide ? 230 : 220}
          height={wide ? 280 : 220}
          style={{ width: wide ? 230 : 220, height: wide ? 280 : 220, objectFit: "cover", objectPosition: "center top", borderRadius: 18, border: `4px solid ${color}`, background: "#14161c" }}
        />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ color: MUTED, letterSpacing: 1.6, fontSize: 16, textTransform: "uppercase" }}>
                {pick.year} · Round {pick.round} · {pick.pos}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 64 : 72, lineHeight: 0.95, marginTop: 6 }}>{pick.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, color: MUTED, fontSize: 20 }}>
                <span style={{ color: INK, fontFamily: "Oswald, sans-serif", fontSize: 28 }}>#{pick.overall}</span>
                <Logo abbr={pick.team} name={pick.teamName} size={54} />
                <span>{pick.teamName}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: DIM, letterSpacing: 1.4, fontSize: 14 }}>GRADE</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 108 : 120, lineHeight: 0.85, color }}>{pick.developing ? "—" : pick.letter}</div>
              <div style={{ color: MUTED, fontSize: 18 }}>{pick.developing || pick.rating == null ? "" : `${pick.rating}/100`}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Stamps stamps={pick.stamps} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 12, marginTop: 16 }}>
            <Stat label="Redraft" value={`#${pick.redraft}`} note={moved === 0 ? "Even" : moved > 0 ? `▲ +${moved}` : `▼ ${moved}`} noteColor={moved > 0 ? GREEN : moved < 0 ? RED : MUTED} />
            <Stat label="Score vs slot" value={signed(pick.score)} valueColor={scoreColor(pick.score)} />
            <Stat label="Quality / expected" value={`${pick.qg.toFixed(0)} / ${pick.expected == null ? "—" : pick.expected.toFixed(0)}`} />
            <Stat label={pick.group === "G" ? "GP · SV%" : "GP · PPG"} value={`${pick.gpCareer} · ${rate}`} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <Spark seasons={pick.seasons ?? []} expected={pick.expectedPath ?? []} color={color} />
          </div>
        </div>
      </div>
    </Frame>
  );
}

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
  const wide = format === "wide";
  return (
    <Frame format={format} color={color}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Logo abbr={abbr} name={name} size={84} />
            <div>
              <div style={{ color: MUTED, letterSpacing: 1.5, fontSize: 16 }}>#{rank} OF 32</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 58 : 64, lineHeight: 0.95 }}>{name}</div>
            </div>
          </div>
          <div style={{ marginTop: 18, fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 28, color: scoreColor(avg) }}>{signed(avg)} vs the slot</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 120 : 140, lineHeight: 0.8, color }}>{letter}</div>
          <div style={{ color: MUTED, fontSize: 22 }}>{rating}/100</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 12, marginTop: 22 }}>
        <Stat label="1st-round busts" value={pct(report.bust.rate)} note={report.bust.n ? `${report.bust.count} of ${report.bust.n}` : "No sample"} />
        <Stat label="Late-round hits" value={pct(report.late.rate)} note={report.late.n ? `${report.late.count} of ${report.late.n}` : "No graduates"} />
        <Stat label="Gems" value={pct(report.gemRate)} note={`${report.steals} steals · ${report.bloomers} bloomers`} />
        <Stat label="Best group" value={report.best?.label ?? "—"} note={report.best ? signed(report.best.score) : ""} />
      </div>
      <div style={{ marginTop: 18 }}>
        <Bars points={byYear} />
      </div>
    </Frame>
  );
}

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
  const wide = format === "wide";
  return (
    <Frame format={format} color={color}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: MUTED, fontSize: 18 }}>
            <Logo abbr={team} name={teamName} size={64} />
            {teamName} · {tenure}
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 64 : 72, lineHeight: 0.95, marginTop: 8 }}>{person}</div>
          <div style={{ marginTop: 8, color: scoreColor(avg), fontSize: 26, fontFamily: "Oswald, sans-serif" }}>{signed(avg)} vs the slot</div>
          <div style={{ color: MUTED, marginTop: 4 }}>{graded} graded{developing ? ` · ${developing} ${developing === 1 ? "prospect" : "prospects"}` : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 110 : 128, lineHeight: 0.8, color }}>{letter}</div>
          <div style={{ color: MUTED }}>{rating == null ? "" : `${rating}/100`}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "1.2fr 1fr 1fr" : "1fr", gap: 14, marginTop: 18 }}>
        <div>
          <Mini label="Best pick" pick={best} />
          <Mini label="Worst pick" pick={worst} />
        </div>
        <Stat label="1st-round busts" value={pct(report.bust.rate)} note={report.bust.n ? `${report.bust.count} of ${report.bust.n}` : "No sample"} />
        <Stat label="Late-round hits" value={pct(report.late.rate)} note={report.late.n ? `${report.late.count} of ${report.late.n}` : "No graduates"} />
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ color: DIM, letterSpacing: 1.4, fontSize: 13 }}>TOP PICKS</div>
        {notable.map((pick) => (
          <div key={pick.id} style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 18 }}>
            <span>{pick.name}</span>
            <span style={{ color: scoreColor(pick.score) }}>{signed(pick.score)} · {pick.letter ?? "—"}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

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
  const wide = format === "wide";
  return (
    <Frame format={format} color="#E11D48">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: MUTED, letterSpacing: 1.6 }}>{early ? "EARLY SAMPLE" : "DRAFT CLASS"}</div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 72 : 84, lineHeight: 0.9 }}>{year} draft</div>
          <div style={{ marginTop: 8, fontSize: 24, color: scoreColor(avg) }}>{signed(avg)} vs the slot · {regulars} NHL regulars</div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 120 : 140, lineHeight: 0.8 }}>{letter ?? "—"}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 12, marginTop: 16 }}>
        <Stat label="#1 in redraft" value={leader?.name ?? "—"} note={leader ? `#${leader.overall} pick` : ""} />
        <Stat label="Steal" value={steal?.name ?? "—"} note={steal ? signed(steal.score) : ""} />
        <Stat label="Biggest bust" value={bust?.name ?? "—"} note={bust ? signed(bust.score) : ""} />
        <Stat label="Best team" value={bestTeam} note={rating == null ? "" : `${rating}/100 class`} />
      </div>
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: 4 }}>
        {top.map((pick, index) => (
          <div key={pick.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
            <span>{index + 1}. {pick.name}</span>
            <span style={{ color: MUTED }}>#{pick.overall}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

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
  const wide = format === "wide";
  const shown = rows.slice(0, 10);
  return (
    <Frame format={format} color="#E11D48">
      <div style={{ color: MUTED, letterSpacing: 1.6, fontSize: 16 }}>{subtitle}</div>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: wide ? 54 : 64, lineHeight: 0.95, marginTop: 4 }}>Who actually wins the NHL draft?</div>
      <div style={{ marginTop: 8, color: DIM }}>{mode === "Teams" ? "Top franchises" : "Top general managers"}</div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", columnGap: 28 }}>
        {shown.map((row) => (
          <div key={`${row.rank}-${row.name}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ width: 28, color: DIM }}>{row.rank}</span>
            {row.abbr ? <Logo abbr={row.abbr} size={36} /> : null}
            <span style={{ flex: 1, fontSize: 18 }}>{row.name}</span>
            <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, color: row.color, fontSize: 22 }}>{row.letter}</span>
            <span style={{ width: 72, textAlign: "right", color: scoreColor(row.score) }}>{signed(row.score)}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Stat({ label, value, note, valueColor, noteColor }: { label: string; value: string; note?: string; valueColor?: string; noteColor?: string }) {
  return (
    <div>
      <div style={{ color: DIM, letterSpacing: 1.2, fontSize: 12, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 28, lineHeight: 1.05, color: valueColor ?? INK, marginTop: 2 }}>{value}</div>
      {note ? <div style={{ color: noteColor ?? MUTED, fontSize: 14, marginTop: 2 }}>{note}</div> : null}
    </div>
  );
}

function Mini({ label, pick }: { label: string; pick: PickRow | null }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: DIM, letterSpacing: 1.2, fontSize: 12 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 20 }}>{pick?.name ?? "—"}</div>
      <div style={{ color: scoreColor(pick?.score), fontSize: 16 }}>{pick ? `${signed(pick.score)} · ${pick.year} #${pick.overall}` : ""}</div>
    </div>
  );
}

function pct(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function Spark({ seasons, expected, color }: { seasons: number[]; expected: number[]; color: string }) {
  const count = Math.min(seasons.length, expected.length);
  if (count < 2) return null;
  let run = 0;
  const actual: number[] = [];
  for (let index = 0; index < count; index += 1) {
    run += seasons[index] ?? 0;
    actual.push(run);
  }
  const line = expected.slice(0, count);
  const max = Math.max(1, ...actual, ...line);
  const width = 520;
  const height = 78;
  const x = (index: number) => (index / (count - 1)) * width;
  const y = (value: number) => height - 6 - (value / max) * (height - 12);
  const path = (values: number[]) => values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pace versus expectation">
      <path d={path(line)} fill="none" stroke="#52525b" strokeWidth="3" />
      <path d={path(actual)} fill="none" stroke={color} strokeWidth="3.5" />
    </svg>
  );
}

function Bars({ points }: { points: YearPoint[] }) {
  const rows = points.filter((point) => point.n >= 1).slice(-16);
  if (rows.length === 0) return null;
  const peak = Math.max(8, ...rows.map((point) => Math.abs(point.avg)));
  return (
    <svg width="100%" viewBox={`0 0 ${rows.length * 36} 70`} role="img" aria-label="Score by draft class">
      {rows.map((point, index) => {
        const height = (Math.abs(point.avg) / peak) * 28;
        const y = point.avg >= 0 ? 32 - height : 32;
        return <rect key={point.year} x={index * 36 + 6} y={y} width="22" height={Math.max(2, height)} fill={point.avg >= 0 ? GREEN : RED} rx="2" />;
      })}
    </svg>
  );
}
