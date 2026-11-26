"use client";

/**
 * Segmented toggle pill. Clicking anywhere on it changes the value:
 * clicking an inactive side selects it, clicking the active side moves to the next option
 * (for a two-option pill that simply flips it).
 */
export function TogglePill<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  function pick(id: T) {
    if (id !== value) {
      onChange(id);
      return;
    }
    const index = options.findIndex((option) => option.id === id);
    onChange(options[(index + 1) % options.length].id);
  }
  return (
    <div role="group" aria-label={label} className="inline-flex cursor-pointer rounded-full border border-white/10 bg-white/[0.02] p-0.5 select-none">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => pick(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs tracking-wide uppercase transition-colors ${active ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
