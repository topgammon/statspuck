import Link from "next/link";
import { ArchetypePill, ProspectTierPill, SectionLabel } from "@/components/entity/bio";
import { TabLink } from "@/components/entity/entity-tabs";
import { classify } from "@/lib/archetypes";
import { contractLine, money, playerContract } from "@/lib/cap";
import { ageAtSeason, nhlerFor, nhlersFile, type Group } from "@/lib/nhlers";
import { formatRating, ratingFill, ratingTone } from "@/lib/rating";
import { ageCurve, assetFor, curveAt, DISCOUNT, EXTENSION_WEIGHT, ELC_CONTROL_WEIGHT, PREMIUM, primeWindow, type PlayerAsset } from "@/lib/valuation";

// The Asset Value tab on /players/[id]: score, contract surplus breakdown, age-curve projection.

function signedMoney(value: number): string {
  const text = money(Math.abs(value));
  return value < 0 ? `−${text}` : `+${text}`;
}

const GROUP_LABEL: Record<Group, string> = { F: "forwards", D: "defensemen", G: "goalies" };
const SINGULAR: Record<Group, string> = { F: "forward", D: "defenseman", G: "goalie" };

export function AssetValuePanel({
  playerId,
  name,
  tier,
}: {
  playerId: number | null;
  name: string;
  tier?: { label: string; level: 0 | 1 | 2 | 3; tip: string } | null;
}) {
  const asset = assetFor(playerId);
  const contract = playerContract(playerId);
  const record = nhlerFor(playerId);
  if (!asset || !contract || playerId == null) {
    return (
      <div className="rounded-2xl border border-dashed border-[#262B36] bg-[#14171F]/60 p-6 sm:p-8">
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase ring-1 ring-[#262B36]">Asset Value</span>
        <h2 className="display mt-4 text-3xl font-bold">No active NHL contract for {name}</h2>
        <p className="mt-2 max-w-2xl text-[#94A3B8]">
          Asset Value prices active NHL players who are under contract: recent Impact, the age curve, and what the contract is worth against what the player is worth. Prospects and
          free agents join once they sign.
        </p>
        {tier ? (
          <div className="mt-4 flex items-center gap-3">
            <ProspectTierPill tier={tier} />
            <span className="text-sm text-[#94A3B8]">{tier.tip}</span>
          </div>
        ) : null}
        <Link href="/trade-machine" className="mt-5 inline-block text-sm font-semibold text-[#38BDF8] hover:underline">
          Open the Trade Machine →
        </Link>
      </div>
    );
  }

  const archetype = classify(record);
  const prime = primeWindow(asset.group);
  const term = asset.years.filter((year) => year.kind === "term");
  const control = asset.years.filter((year) => year.kind === "control");
  const ratingText = formatRating(asset.rating);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-[#E11D48]/40 bg-[#14171F] p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Asset Value</SectionLabel>
            <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">Live</span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className={`display text-7xl leading-none font-bold ${ratingTone(asset.rating)}`}>{ratingText}</span>
            <span className="pb-2 text-sm text-[#94A3B8]">/ 100</span>
          </div>
          <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-[#0B0D10] ring-1 ring-[#262B36]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, asset.rating))}%`, background: ratingFill(asset.rating) }} />
          </div>
          <p className="mt-3 text-sm text-[#94A3B8]">
            {asset.rating < 0
              ? "Underwater contract: a team would want something back to take him."
              : asset.rating >= 70
                ? "Franchise-level trade value."
                : asset.rating >= 40
                  ? "Strong trade value."
                  : asset.rating >= 15
                    ? "Solid, useful trade value."
                    : "Modest trade value."}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
            <Tile label="Net surplus" value={signedMoney(asset.value)} tone={asset.value < 0 ? "text-[#EF4444]" : "text-[#10B981]"} title="Contract surplus over the deal plus team-control value after it, in discounted dollars." />
            <Tile label="Contract" value={`${asset.yearsLeft} ${asset.yearsLeft === 1 ? "yr" : "yrs"}`} title={contractLine(contract)} />
            <Tile label="Age" value={String(asset.age)} />
            <Tile label="Trajectory" value={`${asset.trajectory.toFixed(2)}×`} tone={asset.trajectory >= 1.03 ? "text-[#10B981]" : asset.trajectory <= 0.97 ? "text-[#F97316]" : "text-[#F8FAFC]"} title="Average of his next five seasons of Impact compared with this one. Above 1.00 means he is still climbing." />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ArchetypePill archetype={archetype} />
            <ProspectTierPill tier={tier ?? null} />
          </div>
          <Link
            href={`/trade-machine?player=${playerId}`}
            className="display mt-5 flex items-center justify-center rounded-xl bg-[#E11D48] px-4 py-3 text-lg font-bold tracking-wide text-white transition hover:bg-[#f43f5e]"
          >
            Test in Trade Machine →
          </Link>
        </div>

        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5 text-sm text-[#94A3B8]">
          <SectionLabel>How it is built</SectionLabel>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            <li>
              Recent form: Impact per 82 games over the last two seasons, weighted toward this one ({asset.form.rate.toFixed(0)} now
              {asset.form.raw != null ? `, ${asset.form.raw.toFixed(0)} from his own games` : ""}).
            </li>
            <li>
              Age curve: the average {GROUP_LABEL[asset.group]} peaks at {prime.from}–{prime.to}. Younger players project up, players past that window project down.
            </li>
            <li>
              Price: what the league really pays for that Impact. Production is valued at {PREMIUM.toFixed(1)}× market because roster spots and cap room are scarce.
            </li>
            <li>
              Surplus: that value minus his {money(asset.aav)} AAV, summed over the contract and discounted {Math.round((1 - DISCOUNT) * 100)}% a year. Re-sign rights count at{" "}
              {Math.round((asset.elc ? ELC_CONTROL_WEIGHT : EXTENSION_WEIGHT) * 100)}%.
            </li>
          </ol>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>Age-curve projection</SectionLabel>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Projected Impact per {asset.group === "G" ? "season" : "82 games"} for {name}, against the average {SINGULAR[asset.group]} at each age.
          </p>
          <AgeChart asset={asset} playerId={playerId} />
        </div>

        <div className="rounded-2xl border border-[#262B36] bg-[#14171F] p-5">
          <SectionLabel>Contract surplus breakdown</SectionLabel>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">
                  <th className="sticky top-0 py-1.5 pr-3 font-semibold">Season</th>
                  <th className="py-1.5 pr-3 font-semibold">Age</th>
                  <th className="py-1.5 pr-3 text-right font-semibold" title="Projected Impact per 82 games after the age curve">Proj. Impact</th>
                  <th className="py-1.5 pr-3 text-right font-semibold" title="What the open market pays for that production">Market value</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Paid (AAV)</th>
                  <th className="py-1.5 text-right font-semibold" title="Market value at premium minus what he is paid, discounted to today">Surplus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262B36]">
                {term.map((year) => (
                  <Row key={year.season} year={year} />
                ))}
                {control.length ? (
                  <tr>
                    <td colSpan={6} className="pt-3 pb-1 text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
                      After the contract · re-sign rights
                    </td>
                  </tr>
                ) : null}
                {control.map((year) => (
                  <Row key={year.season} year={year} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#262B36]">
                  <td colSpan={5} className="py-2 pr-3 text-right text-[#94A3B8]">
                    Contract surplus
                  </td>
                  <td className={`py-2 text-right font-bold ${asset.termSurplus < 0 ? "text-[#EF4444]" : "text-[#10B981]"}`}>{signedMoney(asset.termSurplus)}</td>
                </tr>
                {control.length ? (
                  <tr>
                    <td colSpan={5} className="pr-3 pb-1 text-right text-[#94A3B8]">
                      Team control after the deal
                    </td>
                    <td className="pb-1 text-right font-bold text-[#10B981]">{signedMoney(asset.control)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td colSpan={5} className="pr-3 text-right font-semibold text-[#F8FAFC]">
                    Net surplus
                  </td>
                  <td className={`display text-right text-lg font-bold ${asset.value < 0 ? "text-[#EF4444]" : "text-[#10B981]"}`}>{signedMoney(asset.value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Overview card that points to the Asset Value tab. */
export function AssetTeaser({ playerId }: { playerId: number | null }) {
  const asset = assetFor(playerId);
  return (
    <div className="rounded-xl border border-[#E11D48]/40 bg-[#14171F] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="display text-lg font-bold">Asset Value</p>
        <span className="rounded-full bg-[#E11D48]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#E11D48] uppercase">Live</span>
      </div>
      {asset ? (
        <p className="mt-1 text-sm text-[#94A3B8]">
          <span className={`display text-2xl font-bold ${ratingTone(asset.rating)}`}>{formatRating(asset.rating)}</span> / 100 · {signedMoney(asset.value)} net surplus ·{" "}
          {asset.yearsLeft} {asset.yearsLeft === 1 ? "yr" : "yrs"} left
        </p>
      ) : (
        <p className="mt-1 text-sm text-[#94A3B8]">Priced once he is under an active NHL contract.</p>
      )}
      <TabLink tab="asset" className="mt-2 text-sm font-semibold text-[#38BDF8] hover:underline">
        Open Asset Value →
      </TabLink>
    </div>
  );
}

function Tile({ label, value, tone = "text-[#F8FAFC]", title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div title={title} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <dt className="text-[10px] tracking-[0.12em] text-[#94A3B8] uppercase">{label}</dt>
      <dd className={`display text-lg leading-tight font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

function Row({ year }: { year: PlayerAsset["years"][number] }) {
  const control = year.kind === "control";
  return (
    <tr className={control ? "text-[#94A3B8]" : ""}>
      <td className="py-1.5 pr-3">
        {year.season}-{String(year.season + 1).slice(2)}
      </td>
      <td className="py-1.5 pr-3">{year.age}</td>
      <td className="py-1.5 pr-3 text-right">{year.rate.toFixed(0)}</td>
      <td className="py-1.5 pr-3 text-right">{money(year.market)}</td>
      <td className="py-1.5 pr-3 text-right">{control ? "market" : money(year.aav)}</td>
      <td className={`py-1.5 text-right font-semibold ${year.surplus < 0 ? "text-[#EF4444]" : "text-[#10B981]"}`}>{signedMoney(year.surplus)}</td>
    </tr>
  );
}

/** League-average Impact by age with this player's projected line on top. */
function AgeChart({ asset, playerId }: { asset: PlayerAsset; playerId: number }) {
  const group = asset.group;
  const record = nhlerFor(playerId);
  const prime = primeWindow(group);
  const W = 640;
  const H = 270;
  const pad = { l: 44, r: 16, t: 16, b: 36 };
  const minAge = 18;
  const maxAge = Math.max(38, ...asset.years.map((year) => year.age));
  const history = (record?.ss ?? [])
    .filter(([, gp, , starts]) => (group === "G" ? starts >= 10 : gp >= 15))
    .map(([season, gp, impact]) => ({
      age: ageAtSeason(record?.bd, season) ?? 0,
      rate: group === "G" ? impact / (season === nhlersFile.season && nhlersFile.lastComplete < season ? nhlersFile.progress : 1) : (impact / gp) * 82,
    }))
    .filter((point) => point.age >= minAge);

  const ages: number[] = [];
  for (let age = minAge; age <= maxAge; age++) ages.push(age);
  const leagueValues = ages.map((age) => curveAt(group, age));
  const values = [...leagueValues, ...asset.years.map((year) => year.rate), ...history.map((h) => h.rate)];
  const lo = Math.max(0, Math.floor((Math.min(...values) - 6) / 10) * 10);
  const hi = Math.ceil((Math.max(...values) + 6) / 10) * 10;
  const x = (age: number) => pad.l + ((age - minAge) / (maxAge - minAge)) * (W - pad.l - pad.r);
  const y = (value: number) => pad.t + (1 - (value - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = (points: { age: number; rate: number }[]) => points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)} ${y(p.rate).toFixed(1)}`).join(" ");

  const sampled = ageCurve(group);
  const sampleEnd = sampled.length ? sampled[sampled.length - 1].age : maxAge;
  const league = ages.map((age) => ({ age, rate: curveAt(group, age) }));
  const termPoints = [{ age: asset.age, rate: asset.years[0]?.rate ?? asset.form.rate }, ...asset.years.filter((year) => year.kind === "term" && year.age > asset.age).map((year) => ({ age: year.age, rate: year.rate }))];
  const controlStart = asset.years.filter((year) => year.kind === "term").slice(-1)[0];
  const controlPoints = [
    ...(controlStart ? [{ age: controlStart.age, rate: controlStart.rate }] : []),
    ...asset.years.filter((year) => year.kind === "control").map((year) => ({ age: year.age, rate: year.rate })),
  ];
  const yTicks: number[] = [];
  for (let value = lo; value <= hi; value += (hi - lo) / 4) yTicks.push(value);

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Projected Impact by age for ${record?.n ?? "this player"} against the league average`}>
        <rect x={x(prime.from)} y={pad.t} width={x(prime.to) - x(prime.from)} height={H - pad.t - pad.b} fill="#38BDF8" opacity="0.08" />
        <text x={(x(prime.from) + x(prime.to)) / 2} y={pad.t + 12} textAnchor="middle" fontSize="10" fill="#38BDF8" opacity="0.9">
          Prime {prime.from}–{prime.to}
        </text>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} stroke="#262B36" strokeWidth="1" />
            <text x={pad.l - 8} y={y(tick) + 3} textAnchor="end" fontSize="10" fill="#94A3B8">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {ages.filter((age) => age % 2 === 0).map((age) => (
          <text key={age} x={x(age)} y={H - pad.b + 16} textAnchor="middle" fontSize="10" fill="#94A3B8">
            {age}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#94A3B8">
          Age
        </text>
        <path d={line(league.filter((p) => p.age <= sampleEnd))} fill="none" stroke="#94A3B8" strokeWidth="2" opacity="0.8" />
        {league.some((p) => p.age > sampleEnd) ? <path d={line(league.filter((p) => p.age >= sampleEnd))} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 4" opacity="0.5" /> : null}
        {controlPoints.length > 1 ? <path d={line(controlPoints)} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeDasharray="5 5" opacity="0.7" /> : null}
        {termPoints.length > 1 ? <path d={line(termPoints)} fill="none" stroke="#38BDF8" strokeWidth="3" /> : null}
        {history.map((point) => (
          <circle key={point.age} cx={x(point.age)} cy={y(point.rate)} r="4" fill="#0B0D10" stroke="#F8FAFC" strokeWidth="2" />
        ))}
        <circle cx={x(asset.age)} cy={y(asset.years[0]?.rate ?? asset.form.rate)} r="5.5" fill="#E11D48" stroke="#F8FAFC" strokeWidth="2" />
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#94A3B8]">
        <Key color="#94A3B8" label={`League average (${GROUP_LABEL[group]})`} />
        <Key color="#38BDF8" label="Projection through the contract" />
        <Key color="#38BDF8" dashed label="After the contract" />
        <Key color="#E11D48" dot label={`Today, age ${asset.age}`} />
        <Key color="#F8FAFC" ring label="His actual seasons" />
      </ul>
      <p className="mt-2 text-xs text-[#94A3B8]">
        Curve built from every NHL season since 2005-06 by comparing the same player with himself a year later, which avoids the bias of only the best teenagers playing. Dashed gray is
        extended past the ages we have enough data for.
      </p>
    </div>
  );
}

function Key({ color, label, dashed, dot, ring }: { color: string; label: string; dashed?: boolean; dot?: boolean; ring?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      {dot || ring ? (
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ring ? "#0B0D10" : color, border: ring ? `2px solid ${color}` : undefined }} />
      ) : (
        <span className="inline-block w-5 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
      )}
      {label}
    </li>
  );
}
