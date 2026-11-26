"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { teamLogoFile } from "@/components/team-logo";
import { letterTone, searchIndex, stampTone, type SearchHit, type SearchIndex } from "@/lib/search";

let cached: Promise<SearchIndex> | null = null;
function loadIndex(): Promise<SearchIndex> {
  if (!cached) {
    cached = fetch("/search-index.json")
      .then((response) => {
        if (!response.ok) throw new Error(`search index ${response.status}`);
        return response.json() as Promise<SearchIndex>;
      })
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const groups = useMemo(() => (index ? searchIndex(index, query) : []), [index, query]);
  const flat = useMemo(() => groups.flatMap((group) => group.hits), [groups]);

  function warm() {
    if (index) return;
    loadIndex()
      .then((data) => {
        setIndex(data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }

  // "/" focuses search from anywhere on the page.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((value) => (flat.length ? (value + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (flat.length ? (value - 1 + flat.length) % flat.length : 0));
    } else if (event.key === "Enter") {
      const hit = flat[active];
      if (hit) {
        event.preventDefault();
        go(hit);
      }
    } else if (event.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length > 0;
  let position = -1;

  return (
    <div ref={boxRef} className="relative w-full">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search StatsPuck
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-[#262B36] bg-[#14171F] px-3 transition focus-within:border-[#38BDF8] focus-within:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]">
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && flat[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onFocus={() => {
            warm();
            setOpen(true);
          }}
          onPointerEnter={warm}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search any player, team, GM, or draft year..."
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[#F8FAFC] outline-none placeholder:text-[#94A3B8]/80"
        />
        <kbd className="hidden rounded-md border border-[#262B36] px-1.5 py-0.5 font-sans text-[11px] text-[#94A3B8] sm:inline-block">
          /
        </kbd>
      </div>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-[#262B36] bg-[#14171F] py-2 shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
        >
          {!index ? (
            <p className="px-4 py-3 text-sm text-[#94A3B8]">{failed ? "Search is unavailable right now." : "Loading search…"}</p>
          ) : groups.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#94A3B8]">No matches for “{query.trim()}”.</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="py-1">
                <p className="px-4 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{group.label}</p>
                {group.hits.map((hit) => {
                  position += 1;
                  const mine = position;
                  return (
                    <button
                      type="button"
                      key={`${hit.kind}-${hit.href}`}
                      id={`${listId}-${mine}`}
                      role="option"
                      aria-selected={mine === active}
                      onMouseEnter={() => setActive(mine)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => go(hit)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                        mine === active ? "bg-[#38BDF8]/10" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <HitRow hit={hit} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
          <p className="mt-1 hidden border-t border-[#262B36] px-4 pt-2 text-[11px] text-[#94A3B8] sm:block">
            ↑ ↓ to move · Enter to open · Esc to close
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Grade({ letter }: { letter: string }) {
  if (!letter) return null;
  return (
    <span className={`display ml-auto shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-bold ${letterTone(letter)}`}>{letter}</span>
  );
}

function Logo({ abbr, name }: { abbr: string; name?: string }) {
  return (
    <img src={`/logos/teams/${teamLogoFile(abbr, name)}.svg`} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
  );
}

function Headshot({ playerId }: { playerId: number }) {
  const [failed, setFailed] = useState(false);
  const src = playerId && !failed ? `https://assets.nhle.com/mugs/nhl/latest/${playerId}.png` : "/player-silhouette.svg";
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-8 w-8 shrink-0 rounded-full border border-[#262B36] bg-[#0B0D10] object-cover object-top"
    />
  );
}

function HitRow({ hit }: { hit: SearchHit }) {
  if (hit.kind === "player") {
    const [, name, year, overall, franchise, playerId, letter, stamp] = hit.entry;
    return (
      <>
        <Headshot playerId={playerId} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[#F8FAFC]">{name}</span>
          <span className="block truncate text-xs text-[#94A3B8]">
            {year} · Pick #{overall} · {franchise}
            {stamp ? (
              <span className={`ml-1.5 font-semibold ${stampTone[stamp] ?? ""}`}>· {stamp === "DEVELOPING" ? "PROSPECT" : stamp}</span>
            ) : null}
          </span>
        </span>
        <Grade letter={letter} />
      </>
    );
  }
  if (hit.kind === "team") {
    const [abbr, name, , letter, rank] = hit.entry;
    return (
      <>
        <Logo abbr={abbr} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[#F8FAFC]">{name}</span>
          <span className="block text-xs text-[#94A3B8]">#{rank} drafting franchise</span>
        </span>
        <Grade letter={letter} />
      </>
    );
  }
  if (hit.kind === "gm") {
    const [, person, team, teamName, start, end, letter] = hit.entry;
    return (
      <>
        <Logo abbr={team} name={teamName} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[#F8FAFC]">{person}</span>
          <span className="block truncate text-xs text-[#94A3B8]">
            {teamName} · {start}–{end ?? "now"}
          </span>
        </span>
        <Grade letter={letter} />
      </>
    );
  }
  const [year, letter] = hit.entry;
  return (
    <>
      <span className="display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#38BDF8]/40 text-[11px] font-bold text-[#38BDF8]">
        ’{String(year).slice(2)}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#F8FAFC]">{year} NHL Draft</span>
        <span className="block text-xs text-[#94A3B8]">Full class graded</span>
      </span>
      <Grade letter={letter} />
    </>
  );
}
