"use client";

import { domToBlob } from "modern-screenshot";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ShareCardView, type ShareCardModel } from "@/components/share-cards";
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
        className="inline-flex items-center gap-2 rounded-full bg-[#E11D48] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff4545]"
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
  const size = SIZE[format];
  const frame = 680;
  const scale = Math.min(frame / size.width, 520 / size.height);
  const url = canonicalUrl(path, search);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      link.download = `statspuck-draft-rater-${fileSlug}.png`;
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Share card">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close share dialog" onClick={onClose} />
      <div className="relative max-h-[94vh] w-full max-w-3xl overflow-auto rounded-3xl border border-white/10 bg-[#0c0d12] p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Share card</p>
            <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/15 px-3 py-1 text-sm text-zinc-300 hover:text-white">
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-white/10 p-0.5">
            {(Object.keys(SIZE) as ShareFormat[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormat(id)}
                className={`rounded-full px-3 py-1.5 text-xs tracking-wide uppercase ${format === id ? "bg-white/10 text-white" : "text-zinc-400"}`}
              >
                {SIZE[id].label} {SIZE[id].width}×{SIZE[id].height}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">{format === "wide" ? "X, Reddit, and link previews" : "Discord, Instagram, and mobile"}</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ height: size.height * scale }}>
          <div className="mx-auto" style={{ width: size.width * scale, height: size.height * scale }}>
            <div style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <div ref={cardRef}>
                <ShareCardView format={format} card={card} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Action label={busy === "copy" ? "Copying" : "Copy image"} onClick={copyImage} disabled={busy !== ""}>
            <CopyIcon />
          </Action>
          <Action label={busy === "save" ? "Saving" : "Save image"} onClick={saveImage} disabled={busy !== ""}>
            <DownloadIcon />
          </Action>
          <Action label="Copy link" onClick={copyLink}>
            <LinkIcon />
          </Action>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <IconButton label="X" onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post)}`)}>
            <XIcon />
          </IconButton>
          <IconButton label="Reddit" onClick={() => openShare(`https://www.reddit.com/submit?title=${encodeURIComponent(summary)}&url=${encodeURIComponent(url)}`)}>
            <RedditIcon />
          </IconButton>
          <IconButton label="Bluesky" onClick={() => openShare(`https://bsky.app/intent/compose?text=${encodeURIComponent(post)}`)}>
            <BlueskyIcon />
          </IconButton>
          <IconButton label="Facebook" onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}>
            <FacebookIcon />
          </IconButton>
        </div>
        {toast ? <p className="mt-3 text-sm text-[#3ddc97]">{toast}</p> : null}
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
      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-sm text-zinc-100 hover:bg-white/5 disabled:opacity-50"
    >
      {children}
      {label}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-sm text-zinc-100 hover:bg-white/5">
      {children}
      {label}
    </button>
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
