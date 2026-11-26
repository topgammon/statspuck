"""Impact above the slot, by years since the draft.

Impact (formerly quality games) puts skaters and goalies on one scale where
1.0 is about one average NHL regular-season game. Skaters earn a 0.50 base
per game plus two-way box-score events and a minutes-trust adjustment that
counts penalty-kill time 1.35x. Goalies earn 1.35 per start plus 0.65 per goal
saved above the league-average save percentage.

Anyone still inside the development window with less than 25 Impact stays
Developing, even if they are ahead of the slot. Reaching 25 graduates them
immediately, even if the score is still negative.
"""

from __future__ import annotations

import bisect
import json
import math
import re
import sqlite3
import unicodedata
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

from fetch_nhl import backfill_season_details, connect, season_calendar
from model import fit_family, isotonic_increasing, refit, round0, round1
from teams import FRANCHISES

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
HEADSHOTS = DATA / "headshots.json"
ACTIVE = DATA / "active.json"
ROSTERS = DATA / "rosters.json"
GM_PHOTOS = DATA / "gm_photos.json"
CHART = ROOT.parents[1] / "public" / "draft-rater" / "charts" / "expected-gp.svg"
ERAS_PATH = ROOT / "gm_eras.json"

SKATER_CAP = 8
GOALIE_CAP = 10
SKATER_WINDOW = 3
GOALIE_WINDOW = 5
GRADUATE_QG = 25.0
MIN_GRADED = 5
# Skater Impact: minutes trust.
PK_TRUST = 1.35
FORWARD_ATOI = 15.5
DEFENSE_ATOI = 19.5
MINUTES_SCALE = 0.35
MINUTES_FLOOR = -0.25
MINUTES_CEILING = 0.35
# Goalie Impact: 75 games / 55 starts, plus credit per goal saved above average.
GOALIE_START_VALUE = 1.35
GOALIE_GSAA_VALUE = 0.65
# Team and GM grades: a #1 overall hit is capped here. A #1 bust counts in full.
FIRST_OVERALL_CAP = 250.0
GM_SHRINK = 6
BUST_LETTERS = {"D+", "D", "D-"}
BEHIND_LETTERS = {"C", "C-", "D+", "D", "D-"}
STEAL_LETTERS = {"A", "A+"}
BLOOM_LETTERS = {"B-", "B", "B+", "A-", "A", "A+"}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def position_group(position: str | None) -> str:
    token = (position or "").upper()
    if token == "G":
        return "G"
    if token == "D":
        return "D"
    return "F"


def ice_group(code: str | None, draft_group: str) -> str:
    token = (code or "").upper()
    if token == "D":
        return "D"
    if token in {"C", "L", "R", "F", "W"}:
        return "F"
    return "D" if draft_group == "D" else "F"


def _num(value) -> float:
    return float(value) if value is not None else 0.0


def skater_impact(row: dict, group: str) -> float:
    """Season Impact for a skater. An average NHL regular earns about 1.0 per game.

    Box value: 0.50 per game played plus weighted two-way events.
    Minutes trust: penalty-kill minutes count 1.35x, compared with the
    positional average (15.5 minutes forwards, 19.5 defense).
    """
    gp = row.get("gp") or 0
    if gp <= 0:
        return 0.0
    goals = _num(row.get("goals"))
    assists = _num(row.get("assists"))
    if row.get("goals") is None and row.get("assists") is None and row.get("points") is not None:
        assists = _num(row.get("points"))
    box = (
        0.50 * gp
        + 0.75 * goals
        + 0.62 * assists
        + 0.20 * _num(row.get("sh_points"))
        + 0.075 * _num(row.get("shots"))
        + 0.05 * _num(row.get("blocks"))
        + 0.01 * _num(row.get("fo_wins"))
        - 0.01 * _num(row.get("fo_losses"))
        - 0.075 * _num(row.get("pim"))
        + 0.15 * _num(row.get("plus_minus"))
    )
    ev, pp, pk = row.get("ev_toi"), row.get("pp_toi"), row.get("sh_toi")
    if ev is not None and pp is not None and pk is not None and (ev + pp + pk) > 0:
        weighted_minutes = (ev + pp + PK_TRUST * pk) / 60.0
    elif row.get("toi"):
        weighted_minutes = row["toi"] * gp / 60.0
    else:
        weighted_minutes = None
    minutes_adj = 0.0
    if weighted_minutes is not None:
        average = DEFENSE_ATOI if group == "D" else FORWARD_ATOI
        per_game = ((weighted_minutes / gp) - average) / average * MINUTES_SCALE
        minutes_adj = gp * clamp(per_game, MINUTES_FLOOR, MINUTES_CEILING)
    return max(0.0, box + minutes_adj)


def goalie_impact(row: dict, league_save: float | None) -> float:
    """Season Impact for a goalie, on the same scale as skaters.

    1.35 per start (about 55 starts is a full 75-game workload) plus 0.65 per
    goal saved above the league-average save percentage.
    """
    gp = row.get("gp") or 0
    starts = row.get("starts")
    if gp <= 0 and not starts:
        return 0.0
    games = float(starts) if starts is not None else gp * 0.85
    shots = row.get("shots")
    saves = row.get("saves")
    if shots and saves is not None and league_save is not None:
        gsaa = saves - shots * league_save
        return max(0.0, GOALIE_START_VALUE * games + GOALIE_GSAA_VALUE * gsaa)
    save_pct = row.get("save_pct")
    if save_pct is None or league_save is None:
        multiplier = 1.0
    else:
        multiplier = clamp(1 + (save_pct - league_save) * 15, 0.6, 1.4)
    return max(0.0, GOALIE_START_VALUE * games * multiplier)


def letter_for(rating: int) -> str:
    for threshold, letter in (
        (97, "A+"),
        (90, "A"),
        (82, "A-"),
        (72, "B+"),
        (60, "B"),
        (48, "B-"),
        (38, "C+"),
        (28, "C"),
        (18, "C-"),
        (10, "D+"),
        (4, "D"),
    ):
        if rating >= threshold:
            return letter
    return "D-"


def percentile_of(value: float, pool: list[float]) -> float:
    """Mid-rank percentile. Values outside the pool use the share strictly below."""
    ordered = sorted(pool)
    count = len(ordered)
    if count == 0:
        return 50.0
    below = bisect.bisect_left(ordered, value)
    end = bisect.bisect_right(ordered, value)
    if below == end:
        return 100 * below / count
    return 100 * ((below + end) / 2) / count


def rating_and_letter(value: float, pool: list[float]) -> tuple[int, str]:
    rating = round0(percentile_of(value, pool))
    return rating, letter_for(rating)


def slugify(*parts: str) -> str:
    text = "-".join(parts).lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def cap_for(group: str) -> int:
    return GOALIE_CAP if group == "G" else SKATER_CAP


def window_for(group: str) -> int:
    return GOALIE_WINDOW if group == "G" else SKATER_WINDOW


def pick_weight(overall: int) -> float:
    return 1.0 / math.sqrt(overall)


def weighted_mean(rows: list[dict]) -> float:
    total = 0.0
    weight_sum = 0.0
    for row in rows:
        weight = pick_weight(row["overall"])
        total += row["score"] * weight
        weight_sum += weight
    return total / weight_sum


def effective_score(score: float, overall: int) -> float:
    """The one lottery-luck rule, used only when averaging a team or a GM.

    A #1 overall hit counts at most +250. A #1 overall bust counts in full.
    Every other pick counts exactly as scored.
    """
    if overall == 1 and score > 0:
        return min(score, FIRST_OVERALL_CAP)
    return score


def _tenths(rows: list[dict]) -> int:
    """Sum of effective scores in whole tenths, so the site's math matches exactly."""
    return sum(int(round(effective_score(row["score"], row["overall"]) * 10)) for row in rows)


def scouting_average(rows: list[dict]) -> float:
    """Plain average of effective scores across graduated picks."""
    if not rows:
        return 0.0
    return _tenths(rows) / (10 * len(rows))


def scouting_total(rows: list[dict]) -> float:
    return _tenths(rows) / 10


def shrink_gm(avg: float, graded: int) -> float:
    """Pull a short GM sample toward the league average (0.0 once centered). Six picks keep half, sixty keep about 91 percent."""
    if graded <= 0:
        return 0.0
    return avg * (graded / (graded + GM_SHRINK))


def current_milestone(
    draft_year: int, last_complete: int, in_progress: int | None, group: str
) -> tuple[int, bool]:
    """Years since the draft, with no career cutoff. The group is unused now that both positions run for life."""
    del group
    if in_progress is not None:
        reached = in_progress - draft_year + 1
        partial = True
    else:
        reached = last_complete - draft_year + 1
        partial = False
    if reached < 1:
        return 0, False
    return reached, partial


def draft_plus(draft_year: int, last_complete: int, in_progress: int | None) -> int:
    """Uncapped seasons since the draft. Year 1 is the draft season itself."""
    season = in_progress if in_progress is not None else last_complete
    return max(0, season - draft_year + 1)


def inside_window(group: str, milestone: int) -> bool:
    if milestone <= 0:
        return True
    return milestone <= window_for(group)


def is_developing(group: str, milestone: int, quality: float) -> bool:
    """Inside the window, 25 quality games graduates a prospect even if the score is negative."""
    if milestone <= 0:
        return True
    if not inside_window(group, milestone):
        return False
    return quality < GRADUATE_QG


def stalled_year(group: str, milestone: int) -> bool:
    """Make-or-break years. First-round misses are Stalled here, not yet Busts."""
    if group == "G":
        return milestone in (6, 7)
    return milestone in (4, 5)


def bust_year(group: str, milestone: int) -> bool:
    if group == "G":
        return milestone >= 8
    return milestone >= 6


def stamps_for(pick: dict) -> list[str]:
    if pick["developing"]:
        return ["DEVELOPING"]
    marks: list[str] = []
    letter = pick["letter"]
    score = pick["score"]
    group = pick["group"]
    milestone = pick["milestone"]
    if pick["overall"] >= 20 and (letter in STEAL_LETTERS or (score is not None and score >= 200)):
        marks.append("STEAL")
    if late_bloomer(pick):
        marks.append("LATE BLOOMER")
    elif pick["overall"] <= 32 and letter in BUST_LETTERS:
        if stalled_year(group, milestone):
            marks.append("STALLED")
        elif bust_year(group, milestone):
            marks.append("BUST")
    if is_elite(pick):
        marks.append("ELITE")
    if is_retired(pick):
        marks.append("RETIRED")
    return marks


def late_bloomer(pick: dict) -> bool:
    """Behind through year 4, then ahead for the first time in year 5 or later, and still ahead."""
    score = pick.get("score")
    if pick.get("developing") or score is None or score <= 0:
        return False
    seasons = pick.get("seasons") or []
    expected = pick.get("expectedPath") or []
    if len(seasons) < 5 or len(expected) < 4:
        return False
    actual = 0.0
    first_positive = None
    for index in range(min(len(seasons), len(expected))):
        year = index + 1
        actual += seasons[index]
        if index == len(seasons) - 1 and pick.get("qg") is not None and pick.get("expected") is not None:
            year_score = pick["qg"] - pick["expected"]
        else:
            year_score = actual - expected[index]
        if year <= 4 and year_score >= 0:
            return False
        if year_score > 0 and first_positive is None:
            first_positive = year
    return first_positive is not None and first_positive >= 5


def is_elite(pick: dict) -> bool:
    """Franchise peaks. Forwards also need a real scoring rate. Goalies use a lower season bar."""
    if pick.get("developing"):
        return False
    group = pick.get("group")
    seasons = pick.get("seasons") or []
    quality = pick.get("qg") or 0
    if group == "G":
        if sum(1 for value in seasons if value >= 90) < 3:
            return False
        if quality >= 650:
            return True
        starts = pick.get("starts") or 0
        return starts >= 200 and quality / starts >= 1.45
    if sum(1 for value in seasons if value >= 105) < 3:
        return False
    if group == "F":
        ppg = pick.get("ppg")
        if ppg is None or ppg < 0.80:
            return False
    if quality >= 850:
        return True
    games = pick.get("gpCareer") or 0
    return games >= 300 and quality / games >= 1.15


def is_retired(pick: dict) -> bool:
    """Inactive, a real NHL career, and drafted at least seven years ago.

    draftPlus counts the draft season as year 1, so during 2026–27 a 2019 pick is
    year 8. Year 8 is the 2019 draft and earlier.
    """
    if pick.get("developing") or pick.get("active") is not False:
        return False
    if (pick.get("gpCareer") or 0) < 25:
        return False
    return (pick.get("draftPlus") or 0) >= 8


def expected_at(curves: dict[int, list[float]], pick: int, milestone: int, progress: float) -> float:
    if milestone <= 0:
        return 0.0
    index = min(max(pick, 1), len(curves[milestone]) - 1)
    high = curves[milestone][index]
    low = 0.0 if milestone == 1 else curves[milestone - 1][index]
    if progress >= 0.999:
        return high
    return low + progress * (high - low)


EXPECTED_CAP = 21


def expected_series_for(
    curves: dict[int, list[float]], overall: int, milestone: int, partial: bool, progress: float
) -> list[float]:
    """Cumulative Expected for each year since the draft.

    Elapsed years stop at 21. After that the line stays flat. When the current
    season is still inside the cap, it is prorated by how far the season has gone.
    """
    points: list[float] = []
    for year in range(1, max(milestone, 0) + 1):
        elapsed = min(year, EXPECTED_CAP)
        prorate = partial and year == milestone and year <= EXPECTED_CAP
        points.append(round1(expected_at(curves, overall, elapsed, progress if prorate else 1.0)))
    return points


def enforce_growth(curves: dict[int, list[float]], max_pick: int, cap: int) -> None:
    for pick in range(1, max_pick + 1):
        series = [curves[milestone][pick] for milestone in range(1, cap + 1)]
        fixed = isotonic_increasing(series)
        for milestone, value in enumerate(fixed, start=1):
            curves[milestone][pick] = max(0.0, value)


def _self_check() -> None:
    # A quiet forward at exactly the average weighted minutes: only the 0.50 base.
    assert abs(skater_impact({"gp": 10, "ev_toi": 9300, "pp_toi": 0, "sh_toi": 0}, "F") - 5.0) < 1e-9
    # Box events: 0.5*10 + 0.75*2 + 0.62*3 + 0.075*20 - 0.075*4 + 0.15*2.
    box = {"gp": 10, "goals": 2, "assists": 3, "shots": 20, "pim": 4, "plus_minus": 2, "toi": 930}
    assert abs(skater_impact(box, "F") - (5 + 1.5 + 1.86 + 1.5 - 0.3 + 0.3)) < 1e-9
    # Penalty-kill minutes count 1.35x: 15.5 min = 10 EV + 4 PK (+1.5 bonus).
    pk = {"gp": 10, "ev_toi": 10 * 600 + 10 * 30, "pp_toi": 0, "sh_toi": 10 * 4 * 60}
    weighted = (10 * 630 + 1.35 * 2400) / 60 / 10
    assert abs(skater_impact(pk, "F") - (5 + 10 * (weighted - 15.5) / 15.5 * 0.35)) < 1e-9
    # Minutes trust is clamped per game: +0.35 ceiling, -0.25 floor.
    assert abs(skater_impact({"gp": 10, "toi": 40 * 60}, "D") - 10 * (0.5 + 0.35)) < 1e-9
    assert abs(skater_impact({"gp": 10, "toi": 3 * 60}, "F") - 10 * (0.5 - 0.25)) < 1e-9
    assert skater_impact({"gp": 1, "pim": 40, "toi": 600}, "F") == 0.0
    # Goalies: 1.35 per start plus 0.65 per goal saved above average.
    goalie = {"gp": 10, "starts": 10, "shots": 300, "saves": 276, "save_pct": 0.92}
    assert abs(goalie_impact(goalie, 0.90) - (13.5 + 0.65 * 6)) < 1e-9
    assert abs(goalie_impact({"gp": 10, "starts": None, "save_pct": None, "shots": None, "saves": None}, None) - 1.35 * 8.5) < 1e-9
    fallback = {"gp": 10, "starts": 10, "save_pct": 0.92, "shots": None, "saves": None}
    assert abs(goalie_impact(fallback, 0.905) - 13.5 * 1.225) < 1e-9
    assert current_milestone(2025, 2025, 2026, "F") == (2, True)
    assert current_milestone(2010, 2025, 2026, "F") == (17, True)
    assert current_milestone(2010, 2025, 2026, "G") == (17, True)
    assert current_milestone(2017, 2025, 2026, "G") == (10, True)
    assert is_elite({"developing": False, "group": "F", "qg": 900, "gpCareer": 800, "ppg": 0.9, "seasons": [110, 108, 106, 40]})
    assert not is_elite({"developing": False, "group": "F", "qg": 900, "gpCareer": 800, "ppg": 0.7, "seasons": [110, 108, 106, 40]})
    assert not is_elite({"developing": False, "group": "F", "qg": 900, "gpCareer": 800, "ppg": 1.0, "seasons": [100, 100, 100, 40]})
    assert is_elite({"developing": False, "group": "D", "qg": 900, "gpCareer": 800, "ppg": 0.4, "seasons": [110, 108, 106, 40]})
    assert is_elite({"developing": False, "group": "G", "qg": 660, "gpCareer": 500, "starts": 400, "seasons": [95, 92, 90]})
    assert is_elite({"developing": False, "group": "G", "qg": 400, "gpCareer": 260, "starts": 250, "seasons": [95, 92, 90]})
    assert not is_elite({"developing": False, "group": "G", "qg": 400, "gpCareer": 500, "starts": 180, "seasons": [95, 92, 90]})
    assert not is_elite({"developing": False, "group": "G", "qg": 700, "gpCareer": 500, "starts": 400, "seasons": [95, 92, 89]})
    assert effective_score(1583.4, 1) == 250.0
    assert effective_score(-300.0, 1) == -300.0
    assert effective_score(1583.4, 2) == 1583.4
    assert abs(scouting_average([{"overall": 1, "score": 900}, {"overall": 40, "score": -50}]) - 100.0) < 1e-9
    assert abs(shrink_gm(10, 6) - 5.0) < 1e-9
    assert current_milestone(2026, 2025, 2026, "D") == (1, True)
    assert draft_plus(2010, 2025, 2026) == 17
    assert draft_plus(2024, 2025, 2026) == 3
    assert draft_plus(2026, 2025, None) == 0
    assert inside_window("F", 3) and not inside_window("F", 4)
    assert inside_window("G", 5) and not inside_window("G", 6)
    assert is_developing("F", 2, 24.9) and not is_developing("F", 2, 25.0)
    assert not is_developing("F", 4, 0)
    assert is_developing("G", 5, 10) and not is_developing("G", 6, 0)
    assert round1(weighted_mean([{"overall": 1, "score": 10}, {"overall": 4, "score": 0}])) == 6.7
    assert letter_for(97) == "A+" and letter_for(3) == "D-" and letter_for(48) == "B-"
    pool = [float(value) for value in range(10)]
    assert rating_and_letter(9, pool) == (95, "A")
    assert rating_and_letter(100, pool) == (100, "A+")
    assert rating_and_letter(-1, pool) == (0, "D-")
    assert abs(expected_at({1: [0, 10], 2: [0, 30]}, 1, 2, 0.5) - 20) < 1e-9
    assert slugify("BUF", "Jarmo Kekäläinen", "2026") == "buf-jarmo-kekalainen-2026"
    stalled = {
        "developing": False,
        "letter": "D+",
        "score": -40,
        "overall": 8,
        "group": "F",
        "milestone": 4,
        "_windowScore": None,
    }
    assert stamps_for(stalled) == ["STALLED"]
    assert stamps_for({**stalled, "milestone": 6}) == ["BUST"]
    assert stamps_for({**stalled, "overall": 40, "milestone": 8}) == []
    assert stamps_for({**stalled, "group": "G", "milestone": 6}) == ["STALLED"]
    assert stamps_for({**stalled, "group": "G", "milestone": 7}) == ["STALLED"]
    assert stamps_for({**stalled, "group": "G", "milestone": 8}) == ["BUST"]
    assert stamps_for({"developing": True, "letter": None, "score": -4, "overall": 3, "group": "F", "milestone": 2}) == [
        "DEVELOPING"
    ]
    bloom = {
        "developing": False,
        "letter": "B",
        "score": 12.0,
        "qg": 12.0,
        "expected": 0.0,
        "overall": 25,
        "group": "F",
        "milestone": 7,
        "seasons": [1, 1, 1, 1, 2, 3, 3],
        "expectedPath": [2, 4, 6, 8, 9, 10, 11],
    }
    assert stamps_for(bloom) == ["LATE BLOOMER"]
    assert stamps_for({**bloom, "letter": "A+", "score": 220.0, "qg": 220.0}) == ["STEAL", "LATE BLOOMER"]
    ahead = {**bloom, "seasons": [5, 1, 1, 1, 2, 3, 3]}
    assert "LATE BLOOMER" not in stamps_for(ahead)
    assert stamps_for({**bloom, "milestone": 4, "letter": "D", "score": -3}) == ["STALLED"]
    assert stamps_for({**bloom, "active": False, "gpCareer": 400, "draftPlus": 10}) == ["LATE BLOOMER", "RETIRED"]
    assert stamps_for({**bloom, "active": False, "gpCareer": 10, "draftPlus": 10}) == ["LATE BLOOMER"]
    assert stamps_for({**stalled, "active": False, "gpCareer": 80, "draftPlus": 5}) == ["STALLED"]
    assert stamps_for({**stalled, "active": False, "gpCareer": 80, "draftPlus": 10}) == ["STALLED", "RETIRED"]
    assert stamps_for({"developing": True, "letter": None, "score": -4, "overall": 3, "group": "F", "milestone": 2, "active": False}) == [
        "DEVELOPING"
    ]
    boxed = career_box(
        {
            2005: {
                "skater": {
                    "gp": 10,
                    "goals": 4,
                    "assists": 6,
                    "points": 10,
                    "goals_against": None,
                    "time_on_ice": None,
                    "save_pct": None,
                    "shots": None,
                }
            }
        },
        "F",
    )
    assert boxed["goals"] == 4 and boxed["points"] == 10 and boxed["ppg"] == 1.0
    goalie = career_box(
        {
            2005: {
                "goalie": {
                    "gp": 2,
                    "goals": 0,
                    "assists": 0,
                    "points": 0,
                    "goals_against": 4,
                    "time_on_ice": 7200,
                    "save_pct": 0.9,
                    "shots": 40,
                }
            }
        },
        "G",
    )
    assert goalie["savePct"] == 0.9 and goalie["gaa"] == 2.0


def load_inputs(conn: sqlite3.Connection) -> tuple[list[dict], dict[int, dict[int, dict[str, dict]]]]:
    picks = [dict(row) for row in conn.execute("SELECT * FROM picks ORDER BY draft_year, overall")]
    seasons: dict[int, dict[int, dict[str, dict]]] = {}
    query = """
      SELECT player_id, season_start, role, gp, toi_per_game, points, plus_minus,
             games_started, save_pct, shots_against, position_code,
             goals, assists, goals_against, time_on_ice,
             shots, pim, sh_points, blocks, fo_wins, fo_losses,
             ev_toi, pp_toi, sh_toi, saves
      FROM player_seasons
    """
    for row in conn.execute(query):
        goalie = row["role"] == "goalie"
        seasons.setdefault(row["player_id"], {}).setdefault(row["season_start"], {})[row["role"]] = {
            "gp": row["gp"] or 0,
            "toi": row["toi_per_game"],
            "points": row["points"],
            "plus_minus": row["plus_minus"],
            "starts": row["games_started"],
            "save_pct": row["save_pct"],
            # For goalies "shots" is shots against. For skaters it is shots on goal.
            "shots": row["shots_against"] if goalie else row["shots"],
            "saves": row["saves"],
            "position": row["position_code"],
            "goals": row["goals"],
            "assists": row["assists"],
            "goals_against": row["goals_against"],
            "time_on_ice": row["time_on_ice"],
            "pim": row["pim"],
            "sh_points": row["sh_points"],
            "blocks": row["blocks"],
            "fo_wins": row["fo_wins"],
            "fo_losses": row["fo_losses"],
            "ev_toi": row["ev_toi"],
            "pp_toi": row["pp_toi"],
            "sh_toi": row["sh_toi"],
        }
    return picks, seasons


def season_progress(seasons: dict[int, dict[int, dict[str, dict]]], in_progress: int | None) -> float:
    """Share of the 82-game season the league has played.

    Each game has one starting goalie, so the sum of starts divided by 32 teams
    is the average team games played. That fraction is the season progress.
    """
    if in_progress is None:
        return 1.0
    starts = 0
    for by_season in seasons.values():
        goalie = (by_season.get(in_progress) or {}).get("goalie")
        if goalie and goalie["starts"]:
            starts += goalie["starts"]
    if starts <= 0:
        return 0.05
    average_team_gp = starts / 32
    return max(0.05, min(1.0, average_team_gp / 82))


def league_context(seasons: dict[int, dict[int, dict[str, dict]]]) -> tuple[dict, dict[int, float]]:
    """League-average save percentage each season: all saves over all shots against."""
    save_weight: dict[int, list[float]] = {}
    for by_season in seasons.values():
        for season, roles in by_season.items():
            goalie = roles.get("goalie")
            if not goalie or not goalie["shots"]:
                continue
            if goalie["saves"] is not None:
                saved = float(goalie["saves"])
            elif goalie["save_pct"] is not None:
                saved = goalie["save_pct"] * goalie["shots"]
            else:
                continue
            bucket = save_weight.setdefault(season, [0.0, 0.0])
            bucket[0] += saved
            bucket[1] += goalie["shots"]
    saves = {season: total / shots for season, (total, shots) in save_weight.items() if shots}
    return {}, saves


def season_quality(
    row: dict,
    role: str,
    draft_group: str,
    season: int,
    toi_avg: dict,
    save_avg: dict[int, float],
) -> tuple[float, int]:
    """Season Impact and games played. toi_avg is unused: minutes are compared with fixed positional averages."""
    del toi_avg
    if role == "goalie":
        return goalie_impact(row, save_avg.get(season)), row["gp"]
    group = ice_group(row["position"], draft_group)
    return skater_impact(row, group), row["gp"]


def cumulative(
    player_seasons: dict[int, dict[str, dict]],
    draft_year: int,
    milestone: int,
    draft_group: str,
    toi_avg: dict[tuple[int, str], float],
    save_avg: dict[int, float],
) -> tuple[float, int, int]:
    quality = 0.0
    games = 0
    career = 0
    role = "goalie" if draft_group == "G" else "skater"
    for season, roles in player_seasons.items():
        for row in roles.values():
            career += row["gp"]
        offset = season - draft_year + 1
        if offset < 1 or offset > milestone:
            continue
        row = roles.get(role)
        if not row:
            continue
        added, played = season_quality(row, role, draft_group, season, toi_avg, save_avg)
        quality += added
        games += played
    return quality, games, career


def expected_series(
    curves: dict[int, list[float]],
    overall: int,
    milestone: int,
    progress: float,
    partial: bool,
) -> list[float]:
    """Cumulative expected quality at each post-draft year, matching the grade."""
    if milestone <= 0:
        return []
    points = []
    for year in range(1, milestone + 1):
        year_progress = progress if partial and year == milestone else 1.0
        points.append(round1(expected_at(curves, overall, year, year_progress)))
    return points


def season_series(
    player_seasons: dict[int, dict[str, dict]],
    draft_year: int,
    milestone: int,
    draft_group: str,
    toi_avg: dict[tuple[int, str], float],
    save_avg: dict[int, float],
) -> list[float]:
    """Quality games added in each post-draft year, including zeros for missed seasons."""
    if milestone <= 0:
        return []
    buckets = [0.0] * milestone
    role = "goalie" if draft_group == "G" else "skater"
    for season, roles in player_seasons.items():
        offset = season - draft_year + 1
        if offset < 1 or offset > milestone:
            continue
        row = roles.get(role)
        if not row:
            continue
        added, _played = season_quality(row, role, draft_group, season, toi_avg, save_avg)
        buckets[offset - 1] += added
    return [round1(value) for value in buckets]


def headshot_map() -> dict[int, bool]:
    if not HEADSHOTS.exists():
        return {}
    raw = json.loads(HEADSHOTS.read_text(encoding="utf-8"))
    return {int(key): bool(value) for key, value in raw.items()}


def optional_json(path: Path) -> dict:
    """A side data file that may not exist yet. Missing means empty."""
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def active_map() -> dict[int, bool | None]:
    if not ACTIVE.exists():
        return {}
    raw = json.loads(ACTIVE.read_text(encoding="utf-8"))
    return {int(key): None if value is None else bool(value) for key, value in raw.items()}


def career_box(player_seasons: dict[int, dict[str, dict]], draft_group: str) -> dict:
    """Career counting stats for the player page. Scoring is skater seasons. Goaltending is goalie seasons."""
    goals = assists = points = skater_gp = starts = 0
    shots = saves = goals_against = ice = 0.0
    saw_skater = saw_goalie = False
    for roles in player_seasons.values():
        skater = roles.get("skater")
        if skater and skater["gp"]:
            saw_skater = True
            skater_gp += skater["gp"]
            goals += skater["goals"] or 0
            assists += skater["assists"] or 0
            points += skater["points"] or 0
        goalie = roles.get("goalie")
        if goalie:
            starts += goalie.get("starts") or 0
            if goalie["gp"]:
                saw_goalie = True
                if goalie["shots"]:
                    shots += goalie["shots"]
                    if goalie["save_pct"] is not None:
                        saves += goalie["save_pct"] * goalie["shots"]
                goals_against += goalie["goals_against"] or 0
                ice += goalie["time_on_ice"] or 0
    if draft_group == "G":
        save_pct = round(saves / shots, 3) if shots and saw_goalie else None
        gaa = round(goals_against * 3600 / ice, 2) if ice and saw_goalie else None
        return {"goals": None, "assists": None, "points": None, "ppg": None, "savePct": save_pct, "gaa": gaa, "starts": starts}
    if not saw_skater:
        return {"goals": None, "assists": None, "points": None, "ppg": None, "savePct": None, "gaa": None, "starts": 0}
    ppg = round(points / skater_gp, 2) if skater_gp else None
    return {
        "goals": goals,
        "assists": assists,
        "points": points,
        "ppg": ppg,
        "savePct": None,
        "gaa": None,
        "starts": 0,
    }


def write_chart(
    path: Path,
    skater_dots: list[tuple[int, float]],
    goalie_dots: list[tuple[int, float]],
    skater_curves: dict[int, list[float]],
    goalie_curves: dict[int, list[float]],
    skater_mae: float,
    goalie_mae: float,
    max_pick: int,
) -> None:
    width = 1100
    panel_h = 520
    height = 88 + panel_h * 2 + 36
    margin_l, margin_r, margin_t = 78, 28, 52

    def panel(
        title: str,
        dots: list[tuple[int, float]],
        curves: dict[int, list[float]],
        mae: float,
        top: int,
        cap: int,
    ) -> list[str]:
        y_max = max(40.0, max((curves[cap][pick] for pick in range(1, max_pick + 1)), default=40))
        y_max = max(y_max, max((value for _pick, value in dots), default=0))
        y_max = math.ceil(y_max / 50) * 50
        plot_w = width - margin_l - margin_r
        plot_h = panel_h - margin_t - 64
        x0 = margin_l
        y0 = top + margin_t
        parts = [
            f'<text x="{margin_l}" y="{top + 28}" fill="#f4f4f5" font-family="Oswald, Impact, sans-serif" font-size="28">{title}</text>',
            f'<text x="{width - margin_r}" y="{top + 26}" text-anchor="end" fill="#d4d4d8" font-family="Barlow, sans-serif" font-size="16">year {cap}, average miss {mae:.1f}</text>',
            f'<rect x="{x0}" y="{y0}" width="{plot_w}" height="{plot_h}" fill="#0c0d12" stroke="#27272a"/>',
        ]
        step = 50 if y_max <= 250 else 100
        for tick in range(0, int(y_max) + 1, step):
            y = y0 + plot_h - (tick / y_max) * plot_h
            parts.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x0 + plot_w}" y2="{y:.1f}" stroke="#27272a"/>')
            parts.append(
                f'<text x="{x0 - 10}" y="{y + 5:.1f}" text-anchor="end" fill="#d4d4d8" font-size="16" font-family="Barlow, sans-serif">{tick}</text>'
            )
        for pick, value in dots:
            x = x0 + (min(pick, max_pick) / max_pick) * plot_w
            y = y0 + plot_h - (min(value, y_max) / y_max) * plot_h
            parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.2" fill="#ffffff" opacity="0.16"/>')

        def line(milestone: int, color: str, dash: str) -> str:
            points = []
            for pick in range(1, max_pick + 1):
                x = x0 + (pick / max_pick) * plot_w
                y = y0 + plot_h - (min(curves[milestone][pick], y_max) / y_max) * plot_h
                points.append(f"{x:.1f},{y:.1f}")
            return (
                f'<polyline fill="none" stroke="{color}" stroke-width="2.5" '
                f'stroke-dasharray="{dash}" points="{" ".join(points)}"/>'
            )

        parts.append(line(1, "#38bdf8", "2 6"))
        parts.append(line(4, "#f87171", "5 5"))
        parts.append(line(min(8, cap), "#f4f4f5", "0"))
        parts.append(
            f'<text x="{x0}" y="{y0 + plot_h + 28}" fill="#d4d4d8" font-size="16" font-family="Barlow, sans-serif">White is year 8. Red dashes are year 4. Blue dots are year 1. The grade keeps counting after year {cap}.</text>'
        )
        return parts

    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#0B0D10"/>',
        '<text x="78" y="40" fill="#ffffff" font-family="Oswald, Impact, sans-serif" font-size="32">Expected Impact by draft slot</text>',
        '<text x="78" y="66" fill="#d4d4d8" font-family="Barlow, sans-serif" font-size="16">Cumulative through that year after the draft. The curve cannot rise as the pick gets later.</text>',
    ]
    body.extend(panel("Skaters", skater_dots, skater_curves, skater_mae, 80, SKATER_CAP))
    body.extend(panel("Goalies", goalie_dots, goalie_curves, goalie_mae, 80 + panel_h, GOALIE_CAP))
    body.append("</svg>")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(body), encoding="utf-8")


def build() -> None:
    _self_check()
    backfill_season_details(refresh_live=True)
    today = date.today()
    last_complete, in_progress = season_calendar(today)
    conn = connect()
    picks, seasons = load_inputs(conn)
    if len(picks) < 4000:
        raise RuntimeError(f"Only {len(picks)} picks in the database. Fetch first.")
    detail = conn.execute(
        "SELECT COUNT(*) AS n FROM player_seasons WHERE role = 'skater' AND toi_per_game IS NOT NULL"
    ).fetchone()["n"]
    if detail < 1000:
        raise RuntimeError("Season rows are missing ice time. The stats cache did not reload.")
    impact_detail = conn.execute(
        "SELECT COUNT(*) AS n FROM player_seasons WHERE role = 'skater' AND ev_toi IS NOT NULL AND shots IS NOT NULL"
    ).fetchone()["n"]
    if impact_detail < 1000:
        raise RuntimeError("Season rows are missing Impact inputs (shots, blocks, ice-time splits). Refetch the seasons.")
    progress = season_progress(seasons, in_progress)
    max_pick = max(pick["overall"] for pick in picks)
    toi_avg, save_avg = league_context(seasons)

    def through(pick: dict, milestone: int) -> float:
        if not pick["player_id"] or milestone <= 0:
            return 0.0
        quality, _games, _career = cumulative(
            seasons.get(pick["player_id"], {}),
            pick["draft_year"],
            milestone,
            position_group(pick["position"]),
            toi_avg,
            save_avg,
        )
        return quality

    slot_curves: dict[str, dict[int, list[float]]] = {"S": {}, "G": {}}
    fits: dict[str, dict] = {}
    dots: dict[str, list[tuple[int, float]]] = {"S": [], "G": []}
    horizon = 1
    for pick in picks:
        horizon = max(horizon, draft_plus(pick["draft_year"], last_complete, in_progress))
    horizon = min(horizon, EXPECTED_CAP)

    def extend_curve(family: dict[str, dict[int, list[float]]], group: str, milestone: int) -> None:
        previous = family[group][milestone - 1]
        prior = family[group].get(milestone - 2)
        extended = []
        for index, value in enumerate(previous):
            step = 0.0 if prior is None else max(0.0, value - prior[index])
            extended.append(value + step * 0.72)
        family[group][milestone] = extended

    for group in ("S", "G"):
        anchor = []
        for pick in picks:
            pick_group = "G" if position_group(pick["position"]) == "G" else "S"
            if pick_group != group:
                continue
            if pick["draft_year"] + SKATER_CAP - 1 <= last_complete:
                anchor.append((pick["overall"], through(pick, SKATER_CAP)))
        dots[group] = anchor
        sigmas = [8, 12, 18] if group == "S" else [12, 18, 28]
        fits[group] = fit_family(anchor, max_pick, sigmas)
        for milestone in range(1, horizon + 1):
            slot_records = []
            for pick in picks:
                pick_group = "G" if position_group(pick["position"]) == "G" else "S"
                if pick_group != group:
                    continue
                if pick["draft_year"] + milestone - 1 > last_complete:
                    continue
                slot_records.append((pick["overall"], through(pick, milestone)))
            if len(slot_records) >= 40:
                slot_curves[group][milestone] = refit(slot_records, fits[group]["chosen"], max_pick)
            elif milestone > 1 and slot_curves[group].get(milestone - 1):
                extend_curve(slot_curves, group, milestone)
            else:
                slot_curves[group][milestone] = refit(slot_records, fits[group]["chosen"], max_pick)
        enforce_growth(slot_curves[group], max_pick, horizon)
    curves = slot_curves

    write_chart(
        CHART,
        dots["S"],
        dots["G"],
        curves["S"],
        curves["G"],
        fits["S"]["chosen"]["mae"],
        fits["G"]["chosen"]["mae"],
        max_pick,
    )

    photos = headshot_map()
    actives = active_map()
    rosters = optional_json(ROSTERS)
    gm_photos = optional_json(GM_PHOTOS)
    duplicates: dict[int, list[int]] = {}
    for pick in picks:
        if pick["player_id"]:
            duplicates.setdefault(pick["player_id"], []).append(pick["pick_uid"])

    scored = []
    for pick in picks:
        group = position_group(pick["position"])
        curve_key = "G" if group == "G" else "S"
        milestone, partial = current_milestone(pick["draft_year"], last_complete, in_progress, group)
        plus = draft_plus(pick["draft_year"], last_complete, in_progress)
        player_seasons = seasons.get(pick["player_id"] or -1, {})
        box = career_box(player_seasons, group)
        quality, games, career = cumulative(
            player_seasons, pick["draft_year"], max(milestone, 0), group, toi_avg, save_avg
        )
        seasons_played = season_series(
            player_seasons, pick["draft_year"], max(milestone, 0), group, toi_avg, save_avg
        )
        table = slot_curves[curve_key]
        # One rule for every pick, whatever his games played or active status:
        # Expected is the slot curve at the years elapsed since the draft,
        # capped at year 21, with the season in progress prorated.
        expected_path = expected_series_for(table, pick["overall"], milestone, partial, progress)
        developing = is_developing(group, milestone, quality)
        window = window_for(group)
        window_score = None
        if milestone > window:
            window_quality = through(pick, window)
            window_expected = expected_at(table, pick["overall"], window, 1.0)
            window_score = round1(window_quality - window_expected)
        if milestone <= 0:
            expected = None
            score = None
        else:
            expected = expected_path[-1]
            score = round1(quality - expected)
        bloom_end = 10 if group == "G" else 8
        bloom_start = 8 if group == "G" else 6
        bloom_score = None
        if milestone >= bloom_start and score is not None:
            judge = min(milestone, bloom_end)
            if judge == milestone:
                bloom_score = score
            else:
                judged_quality, _judged_games, _judged_career = cumulative(
                    player_seasons, pick["draft_year"], judge, group, toi_avg, save_avg
                )
                judged_expected = expected_at(table, pick["overall"], judge, 1.0)
                bloom_score = round1(judged_quality - judged_expected)
        included = not developing and score is not None
        also = [other for other in duplicates.get(pick["player_id"], []) if other != pick["pick_uid"]]
        scored.append(
            {
                "id": pick["pick_uid"],
                "year": pick["draft_year"],
                "round": pick["round"],
                "overall": pick["overall"],
                "team": pick["team_abbr"],
                "franchise": pick["franchise_abbr"],
                "teamName": pick["historic_name"],
                "franchiseName": FRANCHISES[pick["franchise_abbr"]]["name"],
                "pos": pick["position"] or "—",
                "group": group,
                "playerId": pick["player_id"],
                "hasHeadshot": bool(pick["player_id"]) and photos.get(pick["player_id"], False),
                "active": actives.get(pick["player_id"]) if pick["player_id"] else None,
                "name": pick["player_name"],
                "country": pick["country"],
                "amateur": pick["amateur_club"],
                "gpCareer": career,
                "gp": games,
                "goals": box["goals"],
                "assists": box["assists"],
                "points": box["points"],
                "ppg": box["ppg"],
                "savePct": box["savePct"],
                "gaa": box["gaa"],
                "starts": box["starts"],
                "draftPlus": plus,
                "qg": round1(quality),
                "seasons": seasons_played,
                "expectedPath": expected_path,
                "expected": expected,
                "score": score,
                "milestone": milestone,
                "developing": developing,
                "included": included,
                "letter": None,
                "rating": None,
                "redraft": None,
                "stamps": [],
                "alsoDrafted": also,
                "currentTeam": rosters.get(str(pick["player_id"])) if pick["player_id"] else None,
                "_windowScore": window_score,
                "_bloomScore": bloom_score,
            }
        )

    pool = [pick["score"] for pick in scored if pick["included"] and pick["score"] is not None]
    for pick in scored:
        if pick["included"] and pick["score"] is not None:
            rating, letter = rating_and_letter(pick["score"], pool)
            pick["rating"] = rating
            pick["letter"] = letter
        window_score = pick.get("_windowScore")
        if window_score is not None and pool:
            pick["_windowLetter"] = rating_and_letter(window_score, pool)[1]
    bloom_pool = [pick["_bloomScore"] for pick in scored if pick.get("_bloomScore") is not None]
    for pick in scored:
        bloom_score = pick.get("_bloomScore")
        if bloom_score is not None and bloom_pool:
            pick["_bloomLetter"] = rating_and_letter(bloom_score, bloom_pool)[1]
        pick["stamps"] = stamps_for(pick)
        del pick["_windowScore"]
        pick.pop("_windowLetter", None)
        pick.pop("_bloomScore", None)
        pick.pop("_bloomLetter", None)

    by_year: dict[int, list[dict]] = {}
    for pick in scored:
        by_year.setdefault(pick["year"], []).append(pick)
    for group in by_year.values():
        ordered = sorted(group, key=lambda item: (-item["qg"], item["overall"], item["id"]))
        for rank, item in enumerate(ordered, start=1):
            item["redraft"] = rank

    by_franchise: dict[str, list[dict]] = {}
    for pick in scored:
        by_franchise.setdefault(pick["franchise"], []).append(pick)

    leaderboard = []
    for abbr, info in FRANCHISES.items():
        rows = by_franchise.get(abbr, [])
        official = [pick for pick in rows if pick["included"] and pick["score"] is not None]
        if not official:
            continue
        developing = sum(1 for pick in rows if pick["developing"])
        best = max(official, key=lambda pick: (pick["score"], -pick["overall"]))
        worst = min(official, key=lambda pick: (pick["score"], pick["overall"]))
        by_year_rows = []
        for year in sorted({pick["year"] for pick in rows}):
            class_rows = [pick for pick in rows if pick["year"] == year]
            graded_rows = [pick for pick in class_rows if pick["included"] and pick["score"] is not None]
            if not graded_rows:
                continue
            by_year_rows.append(
                {
                    "year": year,
                    "avg": round1(scouting_average(graded_rows)),
                    "n": len(graded_rows),
                    "developing": sum(1 for pick in class_rows if pick["developing"]),
                    "rating": None,
                    "letter": None,
                }
            )
        leaderboard.append(
            {
                "abbr": abbr,
                "name": info["name"],
                "short": info["short"],
                "color": info["color"],
                "_raw": scouting_average(official),
                "total": round1(scouting_total(official)),
                "n": len(official),
                "developing": developing,
                "best": brief(best),
                "worst": brief(worst),
                "byYear": by_year_rows,
            }
        )

    class_pool = [
        point
        for row in leaderboard
        for point in row["byYear"]
        if point["n"] >= MIN_GRADED
    ]
    class_values = [point["avg"] for point in class_pool]
    for point in class_pool:
        rating, letter = rating_and_letter(point["avg"], class_values)
        point["rating"] = rating
        point["letter"] = letter

    # Draft Score: 0.0 is the average NHL franchise. The #1 overall cap pulls
    # the raw league average below zero, so every team and GM is measured
    # against that average instead. Order and letters do not change.
    league_avg = sum(row["_raw"] for row in leaderboard) / len(leaderboard)
    for row in leaderboard:
        row["avg"] = round1(row.pop("_raw") - league_avg)
    team_pool = [row["avg"] for row in leaderboard]
    for row in leaderboard:
        rating, letter = rating_and_letter(row["avg"], team_pool)
        row["rating"] = rating
        row["letter"] = letter
    leaderboard.sort(key=lambda row: (-row["rating"], -row["avg"], row["name"]))
    for rank, row in enumerate(leaderboard, start=1):
        row["rank"] = rank

    included = [pick for pick in scored if pick["included"] and pick["score"] is not None]
    best_class = None
    for row in leaderboard:
        for point in row["byYear"]:
            if point["n"] < MIN_GRADED:
                continue
            candidate = (point["avg"], point["n"])
            if best_class is None or candidate > (best_class["avg"], best_class["n"]):
                best_class = {
                    "franchise": row["abbr"],
                    "franchiseName": row["name"],
                    "color": row["color"],
                    "year": point["year"],
                    "avg": point["avg"],
                    "n": point["n"],
                    "letter": point["letter"],
                    "rating": point["rating"],
                }
    if best_class is None:
        raise RuntimeError("No draft class had enough graded picks.")
    steal = max(included, key=lambda pick: (pick["score"], -pick["overall"]))
    bust = min(included, key=lambda pick: (pick["score"], pick["overall"]))

    era_file = json.loads(ERAS_PATH.read_text(encoding="utf-8"))
    latest_draft = max(pick["year"] for pick in scored)
    eras = []
    seen_slugs: set[str] = set()
    for index, era in enumerate(era_file["eras"], start=1):
        end = era["endYear"] if era["endYear"] is not None else latest_draft
        owned = [
            pick
            for pick in scored
            if pick["franchise"] == era["team"] and era["startYear"] <= pick["year"] <= end
        ]
        official = [pick for pick in owned if pick["included"] and pick["score"] is not None]
        slug = slugify(era["team"], era["person"], str(era["startYear"]))
        if slug in seen_slugs:
            raise RuntimeError(f"Duplicate era slug {slug}")
        seen_slugs.add(slug)
        entry = {
            "id": index,
            "slug": slug,
            "team": era["team"],
            "teamName": FRANCHISES[era["team"]]["name"],
            "color": FRANCHISES[era["team"]]["color"],
            "person": era["person"],
            "role": era["role"],
            "startYear": era["startYear"],
            "endYear": era["endYear"],
            "note": era.get("note") or "",
            "n": len(official),
            "developing": sum(1 for pick in owned if pick["developing"]),
            "avg": None,
            "total": None,
            "rating": None,
            "letter": None,
            "photoUrl": (gm_photos.get(era["person"]) or {}).get("photoUrl"),
            "photoPage": (gm_photos.get(era["person"]) or {}).get("pageUrl"),
        }
        if official:
            avg = round1(shrink_gm(scouting_average(official) - league_avg, len(official)))
            entry["avg"] = avg
            entry["total"] = round1(scouting_total(official))
        eras.append(entry)

    gm_pool = [era["avg"] for era in eras if era["avg"] is not None and era["n"] >= MIN_GRADED]
    for era in eras:
        if era["avg"] is not None and era["n"] >= MIN_GRADED:
            rating, letter = rating_and_letter(era["avg"], gm_pool)
            era["rating"] = rating
            era["letter"] = letter

    conn.execute("DELETE FROM gm_eras")
    for era in eras:
        conn.execute(
            """
            INSERT INTO gm_eras (id, team, person, role, start_year, end_year, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (era["id"], era["team"], era["person"], era["role"], era["startYear"], era["endYear"], era["note"]),
        )
    conn.commit()
    conn.close()

    examples = []
    for name in (
        "Sidney Crosby",
        "Connor McDavid",
        "Nail Yakupov",
        "Auston Matthews",
        "David Pastrnak",
        "Brayden Point",
        "Mark Stone",
        "Connor Bedard",
    ):
        match = next((pick for pick in scored if pick["name"] == name), None)
        if match:
            examples.append(brief(match))

    def describe(fit: dict) -> dict:
        chosen = fit["chosen"]
        alternate = fit["alternate"]
        return {
            "model": chosen["model"],
            "sigma": chosen["sigma"],
            "mae": round1(chosen["mae"]),
            "alternate": alternate["model"],
            "alternateSigma": alternate["sigma"],
            "alternateMae": round1(alternate["mae"]),
            "options": [
                {"model": item["model"], "sigma": item["sigma"], "mae": round1(item["mae"])}
                for item in fit["options"]
            ],
        }

    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "asOf": today.isoformat(),
        "lastCompleteSeason": last_complete,
        "seasonInProgress": in_progress,
        "seasonProgress": round1(progress),
        "curveFirstYear": 2005,
        "curveLastYear": last_complete,
        "goalieCurveLastYear": last_complete,
        "latestDraftYear": latest_draft,
        "window": SKATER_WINDOW,
        "skaterCap": horizon,
        "goalieCap": horizon,
        "skaterWindow": SKATER_WINDOW,
        "goalieWindow": GOALIE_WINDOW,
        "graduateQg": GRADUATE_QG,
        "leagueAvg": round(league_avg, 4),
        "skater": describe(fits["S"]),
        "goalie": describe(fits["G"]),
        "examples": examples,
        "pickCount": len(scored),
        "gradedPickCount": len(included),
        "developingCount": sum(1 for pick in scored if pick["developing"]),
        "eraNote": era_file["note"],
    }
    headlines = {"bestClass": best_class, "steal": brief(steal), "bust": brief(bust)}
    teams = [
        {"abbr": abbr, "name": info["name"], "short": info["short"], "color": info["color"]}
        for abbr, info in sorted(FRANCHISES.items(), key=lambda item: item[1]["name"])
    ]

    draft_classes = []
    for year in sorted(by_year):
        group = by_year[year]
        graded = [pick for pick in group if pick["included"] and pick["score"] is not None]
        if not graded:
            continue
        draft_classes.append(
            {
                "year": year,
                "avg": round1(weighted_mean(graded)),
                "n": len(graded),
                "developing": sum(1 for pick in group if pick["developing"]),
                "rating": None,
                "letter": None,
                "teams": [],
            }
        )
    year_values = [row["avg"] for row in draft_classes]
    for row in draft_classes:
        rating, letter = rating_and_letter(row["avg"], year_values)
        row["rating"] = rating
        row["letter"] = letter
    class_by_year = {row["year"]: row for row in draft_classes}
    for team in leaderboard:
        for point in team["byYear"]:
            class_by_year[point["year"]]["teams"].append(
                {
                    "franchise": team["abbr"],
                    "franchiseName": team["name"],
                    "color": team["color"],
                    "avg": point["avg"],
                    "n": point["n"],
                    "developing": point["developing"],
                    "rating": point["rating"],
                    "letter": point["letter"],
                }
            )
    for row in draft_classes:
        row["teams"].sort(key=lambda item: (-(item["rating"] if item["rating"] is not None else -1), -item["avg"], item["franchiseName"]))

    def series(group_curves: dict[int, list[float]], cap: int) -> dict[str, list[float]]:
        return {
            str(milestone): [round1(group_curves[milestone][pick]) for pick in range(1, max_pick + 1)]
            for milestone in range(1, cap + 1)
        }

    curve_export = {
        "maxPick": max_pick,
        "skater": series(curves["S"], horizon),
        "goalie": series(curves["G"], horizon),
    }

    DATA.mkdir(parents=True, exist_ok=True)
    dump(DATA / "picks.json", scored)
    dump(DATA / "classes.json", draft_classes)
    dump(DATA / "curves.json", curve_export)
    dump(DATA / "leaderboard.json", leaderboard)
    dump(DATA / "eras.json", eras)
    dump(DATA / "headlines.json", headlines)
    dump(DATA / "meta.json", meta)
    dump(DATA / "teams.json", teams)

    print(f"curves through {meta['curveLastYear']}, {meta['gradedPickCount']} graded, {meta['developingCount']} developing")
    print(f"skaters {meta['skater']['model']} mae {meta['skater']['mae']}")
    print(f"goalies {meta['goalie']['model']} mae {meta['goalie']['mae']}")
    print("season progress", meta["seasonProgress"])
    print("best class", best_class["franchiseName"], best_class["year"], best_class["avg"])
    print("steal", steal["name"], steal["year"], steal["score"], steal["letter"])
    print("bust", bust["name"], bust["year"], bust["score"], bust["letter"])
    print("leader", leaderboard[0]["name"], leaderboard[0]["letter"], leaderboard[0]["avg"], "developing", leaderboard[0]["developing"])
    print("last", leaderboard[-1]["name"], leaderboard[-1]["letter"], leaderboard[-1]["avg"])
    counts = Counter(stamp for pick in scored for stamp in pick["stamps"])
    print("stamps", dict(counts))
    for name in ("Carter Yakemchuk", "Mark Stone", "Nail Yakupov"):
        match = next((pick for pick in scored if pick["name"] == name), None)
        if match:
            print(
                f"  check {match['name']} #{match['overall']} yr {match['milestone']} qg {match['qg']} "
                f"score {match['score']} {match['letter']} {match['stamps']} redraft {match['redraft']}"
            )
    for example in examples:
        state = "developing" if example["developing"] else example["letter"]
        print(
            f"  {example['name']} {example['year']} #{example['overall']} yr {example['milestone']} "
            f"qg {example['qg']} exp {example['expected']} {example['score']} {state}"
        )


def brief(pick: dict) -> dict:
    return {
        "id": pick["id"],
        "name": pick["name"],
        "year": pick["year"],
        "round": pick["round"],
        "overall": pick["overall"],
        "franchise": pick["franchise"],
        "franchiseName": pick["franchiseName"],
        "teamName": pick["teamName"],
        "color": FRANCHISES[pick["franchise"]]["color"],
        "pos": pick["pos"],
        "group": pick["group"],
        "gp": pick["gp"],
        "gpCareer": pick["gpCareer"],
        "playerId": pick["playerId"],
        "hasHeadshot": pick["hasHeadshot"],
        "draftPlus": pick["draftPlus"],
        "qg": pick["qg"],
        "expected": pick["expected"],
        "score": pick["score"],
        "milestone": pick["milestone"],
        "developing": pick["developing"],
        "included": pick["included"],
        "letter": pick["letter"],
        "rating": pick["rating"],
        "redraft": pick["redraft"],
        "stamps": pick["stamps"],
    }


def dump(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {path.name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
