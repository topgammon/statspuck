import { CountryBadge } from "@/components/country-badge";
import type { VitalItem } from "@/components/entity/bio";
import { countryName } from "@/lib/countries";
import { meta } from "@/lib/data";
import type { PickGroup, Vitals } from "@/lib/types";
import { ageOn, birthLabel, birthplace, feetInches } from "@/lib/vitals";

/** Height, weight, hand, age, birthplace and origin for the Bio Card vitals row. */
export function vitalItems(v: Vitals | null, group: PickGroup, origin: { label: string; value: string | null }): VitalItem[] {
  const items: VitalItem[] = [];
  const hand = group === "G" ? "Catches" : "Shoots";
  if (v) {
    items.push({ label: "Height", value: feetInches(v.h) });
    items.push({ label: "Weight", value: v.w ? `${v.w} lbs` : null });
    items.push({ label: hand, value: v.sc ? `${hand} ${v.sc}` : null });
    const age = ageOn(v.bd, meta.asOf);
    const born = birthLabel(v.bd);
    items.push({ label: "Age", value: age == null ? null : String(age), title: born ? `Born ${born}` : undefined });
    const place = birthplace(v);
    if (v.ctry || place) {
      items.push({
        label: "Born",
        title: [born, place, countryName(v.ctry)].filter(Boolean).join(" · "),
        value: (
          <>
            <CountryBadge code={v.ctry} name={countryName(v.ctry)} />
            <span className="truncate">{place ?? countryName(v.ctry)}</span>
          </>
        ),
      });
    }
  }
  items.push({ label: origin.label, value: origin.value });
  return items;
}

/** "London (OHL)", "USNTDP (USHL)" collapses to the club when the league repeats it. */
export function originLabel(club: string | null | undefined, league: string | null | undefined): string | null {
  if (club && league && club !== league) return `${club} (${league})`;
  return club ?? league ?? null;
}
