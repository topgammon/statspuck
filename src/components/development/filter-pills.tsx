"use client";

/** A row of single-choice filter pills that wraps on small screens. */
export function FilterPills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {label ? <span className="mr-1 text-[11px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">{label}</span> : null}
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              active ? "border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]" : "border-[#262B36] text-[#94A3B8] hover:border-[#38BDF8]/50 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
