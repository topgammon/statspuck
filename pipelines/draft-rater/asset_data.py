"""Build data/draft-rater/nhlers.json: the raw ingredients for Archetypes and Asset Value.

For every NHL player in the database:
  - Impact, games and starts for his last three played seasons (the same Impact the Draft Rater uses)
  - box-score and ice-time totals over those seasons (the archetype classifier works from these)
  - birth date, height and weight where we know them

Also derives the empirical Age-to-Impact curve from every NHL season since 2005-06:
average Impact per 82 games by age, separately for forwards, defensemen and goalies.
The site does all the valuation math from this file, so the formulas stay readable in TypeScript.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path

from fetch_nhl import connect, season_calendar
from grade_quality import ice_group, league_context, load_inputs, season_progress, season_quality

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
OUT = DATA / "nhlers.json"
AGE_MIN, AGE_MAX = 18, 40
MIN_AGE_SAMPLE = 25
SKATER_MIN_GP = 20
GOALIE_MIN_STARTS = 15


def season_age(birth: str, season: int) -> int | None:
    """Age on October 1 of the season's start year."""
    try:
        year, month, day = (int(part) for part in birth[:10].split("-"))
    except ValueError:
        return None
    age = season - year
    if month > 10 or (month == 10 and day > 1):
        age -= 1
    return age


def birth_dates(conn) -> dict[int, dict]:
    """player_id -> {bd, h, w}. Draft table first, then vitals (undrafted), then the live roster feed."""
    out: dict[int, dict] = {}
    for row in conn.execute("SELECT player_id, birth_date, height, weight FROM picks WHERE player_id IS NOT NULL AND birth_date IS NOT NULL"):
        out[row["player_id"]] = {"bd": row["birth_date"], "h": row["height"], "w": row["weight"]}
    vitals_path = DATA / "vitals.json"
    undrafted_path = DATA / "undrafted.json"
    if vitals_path.exists() and undrafted_path.exists():
        vitals = json.loads(vitals_path.read_text(encoding="utf-8"))
        for player in json.loads(undrafted_path.read_text(encoding="utf-8")):
            v = vitals.get(str(player["id"]))
            if v and v.get("bd"):
                out.setdefault(int(player["playerId"]), {"bd": v["bd"], "h": v.get("h"), "w": v.get("w")})
    bios_path = DATA / "roster_bios.json"
    if bios_path.exists():
        for key, v in json.loads(bios_path.read_text(encoding="utf-8")).items():
            if v.get("bd"):
                out.setdefault(int(key), {"bd": v["bd"], "h": v.get("h"), "w": v.get("w")})
    return out


def chain_curve(group: str, deltas: dict, levels: dict) -> list[dict]:
    """Age curve from same-player year-over-year changes (the 'delta method').

    Comparing a player with himself a year later removes the survivor bias of a plain
    average by age, where only the best teenagers get to play. The yearly changes are chained
    from the youngest well-sampled age, then the whole curve is shifted so its games-weighted
    average matches the real league average for that position group.
    """
    ages = [a for a in range(AGE_MIN, AGE_MAX + 1) if deltas[(group, a)][2] >= MIN_AGE_SAMPLE]
    if not ages:
        return []
    # Light 1-2-1 smoothing of the yearly changes.
    change: dict[int, float] = {}
    for age in ages:
        total = weight = 0.0
        for offset, factor in ((-1, 1.0), (0, 2.0), (1, 1.0)):
            d = deltas.get((group, age + offset))
            if d and d[1] and d[2] >= MIN_AGE_SAMPLE:
                total += factor * d[0]
                weight += factor * d[1]
        change[age] = total / weight if weight else 0.0
    # Chain only across a gap-free run of ages that starts at the youngest sampled age.
    run = [ages[0]]
    for age in ages[1:]:
        if age == run[-1] + 1:
            run.append(age)
        else:
            break
    curve = {run[0]: 0.0}
    for age in run:
        curve[age + 1] = curve[age] + change[age]
    # Shift to the league level: weight each age by how many player-seasons we saw.
    num = den = 0.0
    for age, value in curve.items():
        level = levels.get((group, age))
        if level and level[1]:
            num += level[1] * (level[0] / level[1] - value)
            den += level[1]
    shift = num / den if den else 0.0
    return [
        {"age": age, "per82": round(value + shift, 1), "n": int(levels[(group, age)][2]) if (group, age) in levels else 0}
        for age, value in sorted(curve.items())
    ]


def build() -> None:
    conn = connect()
    _picks, seasons = load_inputs(conn)
    _toi, save_avg = league_context(seasons)
    last_complete, in_progress = season_calendar(date.today())
    progress = season_progress(seasons, in_progress)
    bios = birth_dates(conn)
    names = {row["player_id"]: row["name"] for row in conn.execute("SELECT player_id, name FROM players WHERE name IS NOT NULL")}
    roster_path = DATA / "roster_bios.json"
    roster = json.loads(roster_path.read_text(encoding="utf-8")) if roster_path.exists() else {}

    players: dict[str, dict] = {}
    # (group, age) -> [impact, games or seasons, sample]
    deltas: dict[tuple[str, int], list[float]] = defaultdict(lambda: [0.0, 0.0, 0])
    levels: dict[tuple[str, int], list[float]] = defaultdict(lambda: [0.0, 0.0, 0])

    for player_id, by_season in seasons.items():
        played = []
        for season in sorted(by_season):
            roles = by_season[season]
            role = "goalie" if "goalie" in roles and (not roles.get("skater") or roles["goalie"]["gp"] >= (roles["skater"]["gp"] if roles.get("skater") else 0)) else "skater"
            row = roles.get(role)
            if not row or not (row["gp"] or 0):
                continue
            group = "G" if role == "goalie" else ice_group(row["position"], "F")
            impact, gp = season_quality(row, role, "G" if role == "goalie" else group, season, {}, save_avg)
            played.append((season, role, group, row, impact, gp))
        if not played:
            continue

        info = bios.get(player_id) or {}
        birth = info.get("bd")
        if birth:
            # Same-player pairs of back-to-back seasons: (group, age) -> change in rate, weight.
            rates: dict[int, tuple[str, int, float, float]] = {}
            for season, role, group, row, impact, gp in played:
                if season > last_complete:
                    continue
                age = season_age(birth, season)
                if age is None or not AGE_MIN <= age <= AGE_MAX + 1:
                    continue
                if role == "goalie":
                    starts = row.get("starts") or 0
                    if starts < GOALIE_MIN_STARTS:
                        continue
                    rates[season] = ("G", age, impact, float(starts))
                else:
                    if gp < SKATER_MIN_GP:
                        continue
                    rates[season] = (group, age, impact / gp * 82, float(gp))
            for season, (group, age, rate, weight) in rates.items():
                nxt = rates.get(season + 1)
                if not nxt or nxt[0] != group:
                    continue
                pair_weight = min(weight, nxt[3])
                bucket = deltas[(group, age)]
                bucket[0] += (nxt[2] - rate) * pair_weight
                bucket[1] += pair_weight
                bucket[2] += 1
                level = levels[(group, age)]
                level[0] += rate * weight
                level[1] += weight
                level[2] += 1

        recent = played[-3:]
        _season, role, group, last_row, _impact, _gp = recent[-1]
        record: dict = {
            "g": group,
            "pos": (last_row.get("position") or "").upper() if role != "goalie" else "G",
            "ss": [[s, g, round(i, 1), (r.get("starts") or 0) if role == "goalie" else 0] for s, _role, _grp, r, i, g in recent],
            "cgp": sum(g for *_rest, g in played),
        }
        name = names.get(player_id) or (roster.get(str(player_id)) or {}).get("n")
        if name:
            record["n"] = name
        if birth:
            record["bd"] = birth
        if info.get("h"):
            record["h"] = info["h"]
        if info.get("w"):
            record["w"] = info["w"]
        if role != "goalie":
            box = defaultdict(float)
            for _s, _role, _grp, r, _i, g in recent:
                box["gp"] += g
                box["g"] += r.get("goals") or 0
                box["a"] += r.get("assists") or 0
                box["pts"] += r.get("points") or ((r.get("goals") or 0) + (r.get("assists") or 0))
                box["sog"] += r.get("shots") or 0
                box["blk"] += r.get("blocks") or 0
                box["pim"] += r.get("pim") or 0
                box["fw"] += r.get("fo_wins") or 0
                box["fl"] += r.get("fo_losses") or 0
                box["ev"] += r.get("ev_toi") or 0
                box["pp"] += r.get("pp_toi") or 0
                box["pk"] += r.get("sh_toi") or 0
                box["pm"] += r.get("plus_minus") or 0
                # Seasons without a split (older data): fall back to average ice time per game.
                if not (r.get("ev_toi") or r.get("pp_toi") or r.get("sh_toi")) and r.get("toi"):
                    box["ev"] += r["toi"] * g
            record["b"] = {key: int(round(value)) for key, value in box.items()}
        players[str(player_id)] = record

    age_curve = {}
    for group in ("F", "D", "G"):
        age_curve[group] = chain_curve(group, deltas, levels)

    payload = {
        "asOf": date.today().isoformat(),
        "season": in_progress or last_complete,
        "progress": round(progress, 3),
        "lastComplete": last_complete,
        "ageCurve": age_curve,
        "players": dict(sorted(players.items(), key=lambda item: int(item[0]))),
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    conn.close()
    print(f"nhlers: {len(players)} players, age curves {{{', '.join(f'{k}: {len(v)} ages' for k, v in age_curve.items())}}}", flush=True)


def main() -> None:
    build()


if __name__ == "__main__":
    main()
