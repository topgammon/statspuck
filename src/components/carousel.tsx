"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** A row of cards that scrolls sideways inside itself, with arrow buttons at the edges like a store carousel. */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const measure = () => setEdges({ left: node.scrollLeft > 4, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4 });
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  function move(direction: -1 | 1) {
    const node = track.current;
    if (node) node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative min-w-0" role="region" aria-label={label}>
      <div ref={track} className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <Arrow side="left" show={edges.left} onClick={() => move(-1)} />
      <Arrow side="right" show={edges.right} onClick={() => move(1)} />
    </div>
  );
}

function Arrow({ side, show, onClick }: { side: "left" | "right"; show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={`absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[#262B36] bg-[#0B0D10]/90 text-[#F8FAFC] shadow-lg backdrop-blur transition hover:border-[#38BDF8] hover:text-[#38BDF8] ${side === "left" ? "-left-3" : "-right-3"}`}
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={side === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
      </svg>
    </button>
  );
}
