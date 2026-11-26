"""Development Path data and Team / GM Development Grades (Pillar 2).

Inputs: graded picks from grade_quality.build(), the slot curves, and
data/draft-rater/league_seasons.json from fetch_paths.py.

For every pick we record the primary league in each season from D+0 (the draft
origin) to D+6, bucketed into NHL, AHL, CHL, NCAA, USHL, SHL, Liiga, KHL, Other.

Development Grade asks: once a team has a player, does he turn into an NHL player
more often, and grow faster, than history says that draft slot should?
  1. Graduation vs expected: reached 25 and 100 Impact by D+6, minus the share
     of picks at that exact slot who historically did.
  2. Growth surge: Impact gained from D+2 through D+6, minus what that slot
     usually gains over the same years.
Both parts are put on the same scale (standard deviations), averaged per pick,
then averaged per team and centered so 0.0 is the average NHL franchise.
Only picks whose D+6 season is complete count, so every pick is judged over the
same six years. Forfeited slots never count.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from model import gaussian_smooth, isotonic_decreasing, round1

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
SEASONS_PATH = DATA / "league_seasons.json"
OUT = DATA / "development.json"

HORIZON = 6
GM_SHRINK = 6
MIN_GRADED = 5
DEV_SCALE = 100.0

BUCKETS = ["NHL", "AHL", "CHL", "NCAA", "USHL", "SHL", "Liiga", "KHL", "Other", "None"]
# Higher level wins a tie on games played.
LEVEL = {"NHL": 9, "AHL": 8, "KHL": 7, "SHL": 6, "Liiga": 5, "Other": 4, "NCAA": 3, "CHL": 2, "USHL": 1, "None": 0}

_EXACT = {
    "NHL": "NHL",
    "AHL": "AHL",
    "WHL": "CHL", "OHL": "CHL", "QMJHL": "CHL", "LHJMQ": "CHL", "QJHL": "CHL", "CHL": "CHL",
    "NCAA": "NCAA",
    "USHL": "USHL", "USDP": "USHL", "USNTDP": "USHL", "NTDP": "USHL", "U.S. National U18": "USHL",
    "BCHL": "USHL", "AJHL": "USHL", "SJHL": "USHL", "MJHL": "USHL", "OJHL": "USHL", "CCHL": "USHL",
    "NAHL": "USHL", "QJAAAHL": "USHL", "MJAHL": "USHL", "OPJHL": "USHL", "CJHL": "USHL",
    "SHL": "SHL", "SweHL": "SHL", "SEL": "SHL", "Elitserien": "SHL", "Sweden": "SHL",
    "Liiga": "Liiga", "SM-liiga": "Liiga", "SM-l": "Liiga", "Finland": "Liiga",
    "KHL": "KHL", "RSL": "KHL", "Russia": "KHL", "Rus-KHL": "KHL",
}

# College conferences are listed alongside (or instead of) "NCAA".
_NCAA = {"WCHA", "H-East", "Hockey East", "CCHA", "ECAC", "NCHC", "Big Ten", "Big 10", "AHA", "Atlantic Hockey", "CHA", "NCAA-III"}

# Tournaments and national-team events are not a season's league.
_EVENT_WORDS = ("wjc", "wj18", "wjac", "cup", "champions hl", "hlinka", "olympic", "spengler", "euro hockey tour", "prospects challenge")
_EVENTS = {"WC", "WC-A", "WC-B", "EHT", "OG", "U-18", "U-17", "U18", "U17", "WHC-17", "USA-S17", "M-Cup", "4 Nations", "WCH"}


def is_event(league: str) -> bool:
    name = (league or "").strip()
    lower = name.lower()
    return name in _EVENTS or any(word in lower for word in _EVENT_WORDS)


def bucket_for(league: str) -> str:
    name = (league or "").strip()
    if name in _EXACT:
        return _EXACT[name]
    lower = name.lower()
    if lower.startswith("ncaa") or name in _NCAA:
        return "NCAA"
    if "jr. a" in lower or "jr a" in lower or lower.endswith("jhl"):
        return "USHL"
    return "Other"


def primary(rows: list[list]) -> tuple[str, int, int]:
    """(bucket, games in that bucket, NHL games) for one season's [[league, gp], ...]."""
    games: dict[str, int] = {}
    for league, gp in rows:
        if gp <= 0 or is_event(league):
            continue
        bucket = bucket_for(league)
        games[bucket] = games.get(bucket, 0) + gp
    if not games:
        return "None", 0, 0
    best = max(games.items(), key=lambda item: (item[1], LEVEL[item[0]]))
    return best[0], best[1], games.get("NHL", 0)


def slot_rates(pool: list[dict], key: str, max_pick: int, sigma: float) -> list[float]:
    """Smoothed share of picks at each slot that hit `key`, never rising for later picks."""
    hits = [0.0] * (max_pick + 1)
    counts = [0.0] * (max_pick + 1)
    for row in pool:
        hits[row["overall"]] += 1.0 if row[key] else 0.0
        counts[row["overall"]] += 1.0
    raw = [hits[i] / counts[i] if counts[i] else 0.0 for i in range(1, max_pick + 1)]
    weights = [counts[i] for i in range(1, max_pick + 1)]
    smoothed_num = gaussian_smooth([raw[i] * weights[i] for i in range(len(raw))], sigma)
    smoothed_den = gaussian_smooth(weights, sigma)
    smoothed = [num / den if den else 0.0 for num, den in zip(smoothed_num, smoothed_den)]
    fitted = isotonic_decreasing(smoothed, [max(w, 0.5) for w in weights])
    return [0.0] + [min(1.0, max(0.0, value)) for value in fitted]


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 1.0
    mean = sum(values) / len(values)
    var = sum((value - mean) ** 2 for value in values) / (len(values) - 1)
    return math.sqrt(var) or 1.0


def _percentile(value: float, pool: list[float]) -> float:
    ordered = sorted(pool)
    count = len(ordered)
    if not count:
        return 50.0
    below = sum(1 for item in ordered if item < value)
    equal = sum(1 for item in ordered if item == value)
    return 100.0 * (below + equal / 2) / count if equal else 100.0 * below / count


ROUND_BUCKETS = [("Round 1", (1,)), ("Rounds 2–3", (2, 3)), ("Rounds 4–7", (4, 5, 6, 7))]


def _round_rates(rows: list[dict], league_rows: list[dict]) -> list[dict]:
    out = []
    for label, rounds in ROUND_BUCKETS:
        mine = [row for row in rows if row["round"] in rounds]
        league = [row for row in league_rows if row["round"] in rounds]
        out.append(
            {
                "label": label,
                "n": len(mine),
                "rate25": round(sum(row["hit25"] for row in mine) / len(mine), 4) if mine else None,
                "rate100": round(sum(row["hit100"] for row in mine) / len(mine), 4) if mine else None,
                "expected25": round(sum(row["p25"] for row in mine) / len(mine), 4) if mine else None,
                "expected100": round(sum(row["p100"] for row in mine) / len(mine), 4) if mine else None,
                "league25": round(sum(row["hit25"] for row in league) / len(league), 4) if league else None,
                "league100": round(sum(row["hit100"] for row in league) / len(league), 4) if league else None,
            }
        )
    return out


def build_development(
    scored: list[dict],
    curves: dict[str, dict[int, list[float]]],
    expected_at,
    last_complete: int,
    leaderboard: list[dict],
    eras: list[dict],
    rating_and_letter,
) -> dict:
    seasons = json.loads(SEASONS_PATH.read_text(encoding="utf-8")) if SEASONS_PATH.exists() else {}
    max_pick = max(pick["overall"] for pick in scored)

    # 1. Paths for every real pick.
    paths: dict[str, dict] = {}
    for pick in scored:
        if pick.get("forfeited") or not pick.get("playerId"):
            continue
        record = seasons.get(str(pick["playerId"]))
        if not record:
            continue
        rows = record["s"]
        # A player drafted twice keeps the seasons around this pick's draft year.
        shift = pick["year"] - record["y"]
        if shift:
            rows = rows[shift:] + [[] for _ in range(shift)]
        steps = [primary(season) for season in rows[: HORIZON + 1]]
        paths[str(pick["id"])] = {
            "b": [step[0] for step in steps],
            "gp": [step[1] for step in steps],
            "nhl": [step[2] for step in steps],
            "lg": [next((league for league, gp in season if gp > 0 and not is_event(league)), None) for season in rows[: HORIZON + 1]],
        }

    # 2. Development value for picks with a complete D+1..D+6 window.
    mature: list[dict] = []
    for pick in scored:
        if pick.get("forfeited") or pick["year"] + HORIZON - 1 > last_complete:
            continue
        per_year = pick.get("seasons") or []
        q1 = per_year[0] if per_year else 0.0
        q6 = sum(per_year[:HORIZON])
        key = "G" if pick["group"] == "G" else "S"
        e1 = expected_at(curves[key], pick["overall"], 1, 1.0)
        e6 = expected_at(curves[key], pick["overall"], HORIZON, 1.0)
        mature.append(
            {
                "id": pick["id"],
                "year": pick["year"],
                "round": pick["round"],
                "overall": pick["overall"],
                "group": pick["group"],
                "franchise": pick["franchise"],
                "q6": q6,
                "hit25": q6 >= 25,
                "hit100": q6 >= 100,
                "growth": (q6 - q1) - (e6 - e1),
            }
        )

    rates: dict[str, dict[str, list[float]]] = {}
    for key, sigma in (("S", 10.0), ("G", 24.0)):
        pool = [row for row in mature if (row["group"] == "G") == (key == "G")]
        rates[key] = {
            "p25": slot_rates(pool, "hit25", max_pick, sigma),
            "p100": slot_rates(pool, "hit100", max_pick, sigma),
        }
    for row in mature:
        table = rates["G" if row["group"] == "G" else "S"]
        row["p25"] = table["p25"][row["overall"]]
        row["p100"] = table["p100"][row["overall"]]
        row["grad"] = (row["hit25"] - row["p25"]) + (row["hit100"] - row["p100"])
    grad_sd = _std([row["grad"] for row in mature])
    growth_sd = _std([row["growth"] for row in mature])
    for row in mature:
        row["dev"] = DEV_SCALE * ((row["grad"] / grad_sd) + (row["growth"] / growth_sd)) / 2

    by_id = {row["id"]: row for row in mature}
    for path in paths.values():
        path["dev"] = None
    for row in mature:
        if str(row["id"]) in paths:
            paths[str(row["id"])]["dev"] = round1(row["dev"])

    def gems(rows: list[dict]) -> list[dict]:
        best = sorted(rows, key=lambda row: -row["dev"])[:5]
        return [{"id": row["id"], "dev": round1(row["dev"]), "q6": round1(row["q6"])} for row in best]

    # 3. Teams, centered on the league.
    team_raw: dict[str, float] = {}
    team_rows: dict[str, list[dict]] = {}
    for team in leaderboard:
        rows = [row for row in mature if row["franchise"] == team["abbr"]]
        team_rows[team["abbr"]] = rows
        if rows:
            team_raw[team["abbr"]] = sum(row["dev"] for row in rows) / len(rows)
    league = sum(team_raw.values()) / len(team_raw) if team_raw else 0.0
    team_scores = {abbr: round1(raw - league) for abbr, raw in team_raw.items()}
    pool = list(team_scores.values())
    ranked = sorted(team_scores.items(), key=lambda item: -item[1])
    rank_of = {abbr: index + 1 for index, (abbr, _score) in enumerate(ranked)}
    for team in leaderboard:
        rows = team_rows.get(team["abbr"], [])
        if team["abbr"] not in team_scores:
            team["dev"] = None
            continue
        rating, letter = rating_and_letter(team_scores[team["abbr"]], pool)
        team["dev"] = {
            "avg": team_scores[team["abbr"]],
            "rating": rating,
            "letter": letter,
            "rank": rank_of[team["abbr"]],
            "n": len(rows),
            "rounds": _round_rates(rows, mature),
            "gems": gems(rows),
        }

    # 4. GMs, shrunk toward the league average like the Draft grade.
    gm_scores: list[float] = []
    for era in eras:
        end = era["endYear"] if era["endYear"] is not None else 9999
        rows = [row for row in mature if row["franchise"] == era["team"] and era["startYear"] <= row["year"] <= end]
        era["dev"] = None
        if not rows:
            continue
        raw = sum(row["dev"] for row in rows) / len(rows) - league
        score = round1(raw * (len(rows) / (len(rows) + GM_SHRINK)))
        era["dev"] = {"avg": score, "rating": None, "letter": None, "n": len(rows), "rounds": _round_rates(rows, mature), "gems": gems(rows)}
        if len(rows) >= MIN_GRADED:
            gm_scores.append(score)
    for era in eras:
        if era["dev"] and era["dev"]["n"] >= MIN_GRADED:
            rating, letter = rating_and_letter(era["dev"]["avg"], gm_scores)
            era["dev"]["rating"] = rating
            era["dev"]["letter"] = letter

    # 5. Cohort rows for the /development page: mature picks with a known path.
    cohort = []
    for pick in scored:
        path = paths.get(str(pick["id"]))
        if not path or pick["id"] not in by_id:
            continue
        cohort.append(
            [
                pick["id"],
                pick["name"],
                pick["overall"],
                pick["round"],
                pick["group"],
                pick["franchise"],
                pick["year"],
                round1(pick["qg"]),
                [BUCKETS.index(bucket) for bucket in path["b"]],
            ]
        )

    payload = {
        "buckets": BUCKETS,
        "horizon": HORIZON,
        "league": round(league, 4),
        "matureThrough": last_complete - HORIZON + 1,
        "slot": {key: {name: [round(value, 4) for value in values] for name, values in table.items()} for key, table in rates.items()},
        "cohort": cohort,
        "paths": paths,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"development: {len(paths)} paths, {len(mature)} mature picks, {len(cohort)} in cohort", flush=True)
    return payload
