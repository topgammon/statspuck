"use client";

import { domToBlob } from "modern-screenshot";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ShareCardView, type ShareCardModel } from "@/components/share-cards";
import { TogglePill } from "@/components/toggle-pill";
import { canonicalUrl } from "@/lib/site";

export type ShareFormat = "wide" | "square";

const SIZE = {
  wide: { width: 1200, height: 630, label: "Landscape" },
  square: { width: 1080, height: 1080, label: "Square" },
};

export function ShareLauncher({
  fileSlug,
  title,
  summary,
  path,
  search = "",
  card,
}: {
  fileSlug: string;
  title: string;
  summary: string;
  path: string;
  search?: string;
  card: ShareCardModel;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-[#E11D48] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_-8px_rgba(225,29,72,0.7)] transition-colors hover:bg-[#F43F5E]"
      >
        <ShareIcon />
        Share
      </button>
      {open ? (
        <ShareModal
          fileSlug={fileSlug}
          title={title}
          summary={summary}
          path={path}
          search={search}
          card={card}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ShareModal({
  fileSlug,
  title,
  summary,
  path,
  search,
  card,
  onClose,
}: {
  fileSlug: string;
  title: string;
  summary: string;
  path: string;
  search: string;
  card: ShareCardModel;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ShareFormat>("wide");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const size = SIZE[format];
  // Fit the whole card inside the preview area, never crop it.
  const scale = stage.width > 0 ? Math.min(stage.width / size.width, stage.height / size.height) : 0;
  const url = canonicalUrl(path, search);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () =>
      setStage({ width: node.clientWidth, height: Math.max(220, Math.min(560, window.innerHeight * 0.56)) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  function note(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function pngBlob(): Promise<Blob> {
    const node = cardRef.current;
    if (!node) throw new Error("Card is not ready");
    return domToBlob(node, {
      scale: 2,
      width: size.width,
      height: size.height,
      style: { transform: "none" },
      backgroundColor: "#0B0D10",
    });
  }

  async function copyImage() {
    setBusy("copy");
    try {
      const blob = await pngBlob();
      if (!navigator.clipboard?.write) {
        note("Clipboard images need a secure browser");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      note("Image copied!");
    } catch {
      note("Could not copy the image");
    } finally {
      setBusy("");
    }
  }

  async function saveImage() {
    setBusy("save");
    try {
      const blob = await pngBlob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `statspuck-${card.kind === "trade" ? "trade-machine" : "draft-rater"}-${fileSlug}.png`;
      link.click();
      URL.revokeObjectURL(href);
      note("Image saved");
    } catch {
      note("Could not save the image");
    } finally {
      setBusy("");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      note("Link copied!");
    } catch {
      note(url);
    }
  }

  function openShare(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const post = `${summary} ${url}`;

  const previewW = Math.floor(size.width * scale);
  const previewH = Math.floor(size.height * scale);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Share card">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close share dialog" onClick={onClose} />
      <div className="relative max-h-[96dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#262B36] bg-[#14171F] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#262B36] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.18em] text-[#94A3B8] uppercase">Share</p>
            <h2 className="truncate text-lg font-semibold text-[#F8FAFC]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 flex-none place-items-center rounded-full text-[#94A3B8] hover:bg-white/5 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TogglePill
              label="Card size"
              value={format}
              options={(Object.keys(SIZE) as ShareFormat[]).map((id) => ({ id, label: SIZE[id].label }))}
              onChange={setFormat}
            />
            <p className="text-xs text-[#94A3B8]">
              {size.width}×{size.height} · {format === "wide" ? "Best for X, Reddit, link previews" : "Best for Instagram, Discord, phones"}
            </p>
          </div>

          <div ref={stageRef} className="mt-4 flex w-full justify-center">
            <div
              className="overflow-hidden rounded-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-[#262B36]"
              style={{ width: previewW, height: previewH, visibility: scale > 0 ? "visible" : "hidden" }}
            >
              <div style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <div ref={cardRef}>
                  <ShareCardView format={format} card={card} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={saveImage}
              disabled={busy !== ""}
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#F43F5E] disabled:opacity-60 sm:col-span-1"
            >
              <DownloadIcon />
              {busy === "save" ? "Saving…" : "Download PNG"}
            </button>
            <Action label={busy === "copy" ? "Copying…" : "Copy image"} onClick={copyImage} disabled={busy !== ""}>
              <CopyIcon />
            </Action>
            <Action label="Copy link" onClick={copyLink}>
              <LinkIcon />
            </Action>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-[11px] tracking-[0.18em] text-[#94A3B8] uppercase">Post to</span>
            <span className="h-px flex-1 bg-[#262B36]" />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <SocialButton label="X" onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post)}`)}>
              <XIcon />
            </SocialButton>
            <SocialButton label="Reddit" onClick={() => openShare(`https://www.reddit.com/submit?title=${encodeURIComponent(summary)}&url=${encodeURIComponent(url)}`)}>
              <RedditIcon />
            </SocialButton>
            <SocialButton label="Bluesky" onClick={() => openShare(`https://bsky.app/intent/compose?text=${encodeURIComponent(post)}`)}>
              <BlueskyIcon />
            </SocialButton>
            <SocialButton label="Facebook" onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}>
              <FacebookIcon />
            </SocialButton>
          </div>
        </div>

        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          {toast ? (
            <span className="rounded-full border border-[#10B981]/40 bg-[#0B0D10] px-4 py-2 text-sm text-[#10B981] shadow-lg">{toast}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Action({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#262B36] bg-[#0B0D10] px-4 py-3 text-sm font-medium text-[#F8FAFC] transition-colors hover:border-[#38BDF8]/50 hover:bg-white/[0.03] disabled:opacity-60"
    >
      {children}
      {label}
    </button>
  );
}

function SocialButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={`Post to ${label}`}
      title={`Post to ${label}`}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[#262B36] bg-[#0B0D10] py-3 text-[#94A3B8] transition-colors hover:border-white/20 hover:text-white"
    >
      <span className="[&_svg]:h-5 [&_svg]:w-5">{children}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="currentColor">
      {children}
    </svg>
  );
}

function ShareIcon() {
  return (
    <Glyph>
      <path d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4zM6 6h5V4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-2v5H6V6z" />
    </Glyph>
  );
}
function CopyIcon() {
  return (
    <Glyph>
      <path d="M8 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10h-2V7H10v2H8V7zm-4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8zm2 0v8h8v-8H6z" />
    </Glyph>
  );
}
function DownloadIcon() {
  return (
    <Glyph>
      <path d="M12 3v10.2l3.3-3.3 1.4 1.4L12 16.9 7.3 11.3l1.4-1.4 3.3 3.3V3h2zM5 19h14v2H5v-2z" />
    </Glyph>
  );
}
function LinkIcon() {
  return (
    <Glyph>
      <path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.2-3.2a3 3 0 0 1 4.2 4.2l-1.8 1.8-1.4-1.4 1.8-1.8a1 1 0 0 0-1.4-1.4l-3.2 3.2a1 1 0 0 1-1.4 0zm2.8-2.8a1 1 0 0 1 0 1.4l-3.2 3.2a1 1 0 1 1-1.4-1.4l1.8-1.8-1.4-1.4-1.8 1.8a3 3 0 0 0 4.2 4.2l3.2-3.2a1 1 0 0 1-1.4-1.8z" />
    </Glyph>
  );
}
function XIcon() {
  return (
    <Glyph>
      <path d="M14.7 10.3 21.5 3h-1.6l-5.9 6.4L9.2 3H3.5l7.1 10.1L3.5 21h1.6l6.3-6.8L15.2 21h5.7l-7.4-10.7zM12.2 13.2l-.7-1L6 4.4h2.4l4.5 6.3.7 1 5.8 8.1h-2.4l-4.8-6.6z" />
    </Glyph>
  );
}
function RedditIcon() {
  return (
    <Glyph>
      <path d="M14.5 3.2 15.8 8a6.7 6.7 0 0 1 3.3.9l1.6-1.1a1.4 1.4 0 1 1 .7 1.2l-1.3.9a6.6 6.6 0 0 1-1.1 7.4 8.8 8.8 0 0 1-6.2 2.5 8.8 8.8 0 0 1-6.2-2.5 6.6 6.6 0 0 1-1.1-7.4L4.2 9a1.4 1.4 0 1 1 .7-1.2L6.5 8.9A6.7 6.7 0 0 1 9.8 8l1.3-4.8a.8.8 0 0 1 1-.5l2.2.6a1.3 1.3 0 1 1-.8 1.1zM8.7 13.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm6.6 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 17.6c1.2 0 2.2-.4 2.8-1l.8 1c-.9.9-2.2 1.4-3.6 1.4s-2.7-.5-3.6-1.4l.8-1c.6.6 1.6 1 2.8 1z" />
    </Glyph>
  );
}
function BlueskyIcon() {
  return (
    <Glyph>
      <path d="M12 13.2c-1.3-2.5-4.8-7.2-8-6.4-2.4.6-2.2 4.2-.6 5.8 1.8 1.8 4.4 1.6 6.6.8-2.2.6-4.4 1.6-5.2 3.4-1 2.2.2 4.6 2.6 4.2 2-.4 3.4-2.2 4.6-4.2 1.2 2 2.6 3.8 4.6 4.2 2.4.4 3.6-2 2.6-4.2-.8-1.8-3-2.8-5.2-3.4 2.2.8 4.8 1 6.6-.8 1.6-1.6 1.8-5.2-.6-5.8-3.2-.8-6.7 3.9-8 6.4z" />
    </Glyph>
  );
}
function FacebookIcon() {
  return (
    <Glyph>
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
    </Glyph>
  );
}
