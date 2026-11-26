"""Curve helpers and the published grade build.

Grades are quality games above the slot at the player's current draft year,
capped at eight seasons. See grade_quality.py for the metric.
"""

from __future__ import annotations

import json
import math
import random
import re
import sqlite3
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path

from fetch_nhl import DB_PATH, connect, season_calendar
from teams import FRANCHISES

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
CHART = ROOT.parents[1] / "public" / "draft-rater" / "charts" / "expected-gp.svg"
ERAS_PATH = ROOT / "gm_eras.json"
WINDOW = 7
BOOTSTRAP_REPS = 2000
MIN_CLASS_PICKS = 5


def round1(value: float) -> float:
    """Half away from zero, one decimal. The site uses the same rule."""
    scaled = value * 10
    if value >= 0:
        return math.floor(scaled + 0.5) / 10
    return math.ceil(scaled - 0.5) / 10


def round0(value: float) -> int:
    if value >= 0:
        return int(math.floor(value + 0.5))
    return int(math.ceil(value - 0.5))


def draft_age(draft_year: int, today: date) -> int:
    age = today.year - draft_year
    if (today.month, today.day) < (6, 30):
        age -= 1
    return age


def position_group(position: str | None) -> str:
    token = (position or "").upper()
    if token == "G":
        return "G"
    if token == "D":
        return "D"
    return "F"


def isotonic_increasing(values: list[float], weights: list[float] | None = None) -> list[float]:
    """Pool-adjacent-violators, non-decreasing."""
    weights = weights or [1.0] * len(values)
    blocks: list[list[float]] = []
    for index, (value, weight) in enumerate(zip(values, weights)):
        blocks.append([float(index), float(index), weight * value, weight])
        while len(blocks) >= 2:
            left, right = blocks[-2], blocks[-1]
            if left[2] / left[3] <= right[2] / right[3] + 1e-12:
                break
            blocks[-2] = [
                left[0],
                right[1],
                left[2] + right[2],
                left[3] + right[3],
            ]
            blocks.pop()
    out = [0.0] * len(values)
    for start, end, sum_wy, sum_w in blocks:
        level = sum_wy / sum_w
        for index in range(int(start), int(end) + 1):
            out[index] = level
    return out


def isotonic_decreasing(values: list[float], weights: list[float] | None = None) -> list[float]:
    flipped = isotonic_increasing([-value for value in values], weights)
    return [-value for value in flipped]


def gaussian_smooth(values: list[float], sigma: float) -> list[float]:
    radius = max(1, int(round(sigma * 3)))
    out: list[float] = []
    count = len(values)
    for index in range(count):
        numerator = 0.0
        denominator = 0.0
        for other in range(max(0, index - radius), min(count, index + radius + 1)):
            weight = math.exp(-0.5 * ((index - other) / sigma) ** 2)
            numerator += weight * values[other]
            denominator += weight
        out.append(numerator / denominator)
    return out


def _interp(pick: int, picks: list[int], values: list[float]) -> float:
    if pick <= picks[0]:
        return values[0]
    if pick >= picks[-1]:
        return values[-1]
    low = 0
    high = len(picks) - 1
    while high - low > 1:
        mid = (low + high) // 2
        if picks[mid] <= pick:
            low = mid
        else:
            high = mid
    span = picks[high] - picks[low]
    if span == 0:
        return values[low]
    mix = (pick - picks[low]) / span
    return values[low] + mix * (values[high] - values[low])


def isotonic_curve(
    means: list[tuple[int, float, int]],
    sigma: float,
    max_pick: int,
) -> list[float]:
    picks = [row[0] for row in means]
    values = [row[1] for row in means]
    weights = [float(row[2]) for row in means]
    fitted = isotonic_decreasing(values, weights)
    dense = [0.0] + [_interp(pick, picks, fitted) for pick in range(1, max_pick + 1)]
    if sigma > 0:
        smoothed = gaussian_smooth(dense[1:], sigma)
        smoothed = isotonic_decreasing(smoothed)
        dense = [0.0] + [max(0.0, value) for value in smoothed]
    else:
        dense = [0.0] + [max(0.0, value) for value in dense[1:]]
    return dense


def exponential_curve(means: list[tuple[int, float, int]], max_pick: int) -> list[float]:
    """y = a * exp(-b * pick) + c, with b chosen on a grid and a, c by least squares."""
    xs = [row[0] for row in means]
    ys = [row[1] for row in means]
    ws = [float(row[2]) for row in means]
    best: tuple[float, float, float, float] | None = None

    def solve(b: float, force_floor: bool = False) -> tuple[float, float, float] | None:
        exponent = [math.exp(-b * x) for x in xs]
        see = swe = sw = sye = sy = 0.0
        for base, y, weight in zip(exponent, ys, ws):
            see += weight * base * base
            swe += weight * base
            sw += weight
            sye += weight * base * y
            sy += weight * y
        if force_floor:
            if see <= 1e-12:
                return None
            a = sye / see
            c = 0.0
        else:
            det = see * sw - swe * swe
            if abs(det) < 1e-12:
                return None
            a = (sye * sw - sy * swe) / det
            c = (see * sy - swe * sye) / det
            if c < 0:
                return solve(b, force_floor=True)
        if a < 0:
            return None
        sse = 0.0
        for x, y, weight in zip(xs, ys, ws):
            pred = a * math.exp(-b * x) + c
            sse += weight * (y - pred) ** 2
        return a, c, sse

    for step in range(2, 220):
        b = step / 1000
        solved = solve(b)
        if solved is None:
            continue
        a, c, sse = solved
        if best is None or sse < best[0]:
            best = (sse, b, a, c)
    if best is None:
        raise RuntimeError("Exponential fit failed.")
    _sse, b, a, c = best
    # Local polish around the winning decay rate.
    for step in range(-20, 21):
        trial = b + step / 5000
        if trial <= 0:
            continue
        solved = solve(trial)
        if solved is None:
            continue
        a2, c2, sse = solved
        if sse < best[0]:
            best = (sse, trial, a2, c2)
    _sse, b, a, c = best
    return [0.0] + [max(0.0, a * math.exp(-b * pick) + c) for pick in range(1, max_pick + 1)]


def player_mae(records: list[tuple[int, float]], curve: list[float]) -> float:
    error = 0.0
    for pick, gp in records:
        index = min(max(pick, 1), len(curve) - 1)
        error += abs(gp - curve[index])
    return error / len(records)


def _means(records: list[tuple[int, float]]) -> list[tuple[int, float, int]]:
    buckets: dict[int, list[float]] = {}
    for pick, gp in records:
        buckets.setdefault(pick, []).append(gp)
    return [
        (pick, sum(values) / len(values), len(values))
        for pick, values in sorted(buckets.items())
    ]


def fit_family(
    records: list[tuple[int, float]],
    max_pick: int,
    sigmas: list[float],
) -> dict:
    means = _means(records)
    options = []
    for sigma in sigmas:
        curve = isotonic_curve(means, sigma, max_pick)
        options.append(
            {
                "model": "isotonic",
                "sigma": sigma,
                "curve": curve,
                "mae": player_mae(records, curve),
            }
        )
    exp_curve = exponential_curve(means, max_pick)
    options.append(
        {
            "model": "exponential",
            "sigma": None,
            "curve": exp_curve,
            "mae": player_mae(records, exp_curve),
        }
    )
    options.sort(key=lambda item: item["mae"])
    best = options[0]
    best_iso = min((item for item in options if item["model"] == "isotonic"), key=lambda item: item["mae"])
    # A single exponential cannot bend at the ends of rounds. Keep the
    # isotonic fit when it is within 5% on average error.
    if best["model"] == "exponential" and best_iso["mae"] <= best["mae"] * 1.05:
        chosen = best_iso
    else:
        chosen = best
    other_family = [item for item in options if item["model"] != chosen["model"]]
    alternate = min(other_family, key=lambda item: item["mae"])
    return {"chosen": chosen, "alternate": alternate, "options": options}


def refit(records: list[tuple[int, float]], chosen: dict, max_pick: int) -> list[float]:
    means = _means(records)
    if chosen["model"] == "isotonic":
        return isotonic_curve(means, chosen["sigma"], max_pick)
    return exponential_curve(means, max_pick)


def expected_gp(curves: dict[int, list[float]], pick: int, horizon: int, progress: float) -> float:
    if horizon <= 0:
        return 0.0
    index = min(max(pick, 1), len(curves[horizon]) - 1)
    high = curves[horizon][index]
    low = 0.0 if horizon == 1 else curves[horizon - 1][index]
    if progress >= 0.999:
        return high
    return low + progress * (high - low)


def letter_for(rating: int) -> str:
    for threshold, letter in (
        (97, "A+"),
        (90, "A"),
        (80, "A-"),
        (70, "B+"),
        (60, "B"),
        (50, "B-"),
        (40, "C+"),
        (30, "C"),
        (20, "C-"),
        (10, "D"),
    ):
        if rating >= threshold:
            return letter
    return "F"


def assign_ratings(rows: list[dict]) -> None:
    count = len(rows)
    if count == 0:
        return
    if count == 1:
        rows[0]["rating"] = 100
        rows[0]["letter"] = "A+"
        return
    ordered = sorted(rows, key=lambda row: row["avg"])
    index = 0
    while index < count:
        end = index
        while end + 1 < count and ordered[end + 1]["avg"] == ordered[index]["avg"]:
            end += 1
        average_index = (index + end) / 2
        rating = round0(100 * average_index / (count - 1))
        for cursor in range(index, end + 1):
            ordered[cursor]["rating"] = rating
            ordered[cursor]["letter"] = letter_for(rating)
        index = end + 1


def rating_against(value: float, reference: list[float]) -> int:
    if not reference:
        return 50
    if all(value > item for item in reference):
        return 100
    if all(value < item for item in reference):
        return 0
    below = sum(1 for item in reference if item < value)
    return round0(100 * below / (len(reference) - 1))


def confidence(count: int, low: float | None, high: float | None) -> str:
    if count < 5 or low is None or high is None:
        return "low"
    half = (high - low) / 2
    if count >= 70 and half <= 30:
        return "high"
    if count >= 30 and half <= 45:
        return "medium"
    return "low"


def bootstrap(scores: list[float], rng: random.Random) -> tuple[float, float]:
    count = len(scores)
    means = []
    for _ in range(BOOTSTRAP_REPS):
        total = 0.0
        for _pick in range(count):
            total += scores[rng.randrange(count)]
        means.append(total / count)
    means.sort()
    low_index = int(0.025 * (BOOTSTRAP_REPS - 1))
    high_index = int(0.975 * (BOOTSTRAP_REPS - 1))
    return round1(means[low_index]), round1(means[high_index])


def percentile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * p
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return ordered[int(position)]
    mix = position - low
    return ordered[low] * (1 - mix) + ordered[high] * mix


def window_state(draft_year: int, last_complete: int, in_progress: int | None, progress: float) -> tuple[int, float]:
    complete = 0
    for offset in range(WINDOW):
        if draft_year + offset <= last_complete:
            complete += 1
        else:
            break
    if complete >= WINDOW:
        return WINDOW, 1.0
    if in_progress is not None and in_progress == draft_year + complete:
        return complete + 1, progress
    if complete == 0:
        return 0, 0.0
    return complete, 1.0


def sum_gp(seasons: dict[int, int], start: int, end: int) -> int:
    return sum(gp for season, gp in seasons.items() if start <= season <= end)


def slugify(*parts: str) -> str:
    text = "-".join(parts).lower()
    # Drop accents so Kekäläinen becomes kekalainen, not kek-l-inen.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def _self_check() -> None:
    assert isotonic_decreasing([3, 2, 1]) == [3, 2, 1]
    smoothed = isotonic_decreasing([1, 3, 2])
    assert smoothed[0] >= smoothed[1] >= smoothed[2]
    assert abs(expected_gp({1: [0, 10, 10], 2: [0, 30, 30]}, 1, 2, 0.5) - 20) < 1e-9
    assert window_state(2019, 2025, 2026, 0.3) == (7, 1.0)
    assert window_state(2021, 2025, 2026, 0.3) == (6, 0.3)
    assert slugify("BUF", "Jarmo Kekäläinen", "2026") == "buf-jarmo-kekalainen-2026"
    assert letter_for(100) == "A+"
    assert letter_for(0) == "F"
    assert round1(1.25) == 1.3 or round1(1.25) == 1.2
    assert round1(-1.25) == -1.3 or round1(-1.25) == -1.2
    assert draft_age(2021, date(2026, 11, 24)) == 5
    assert draft_age(2022, date(2026, 11, 24)) == 4


def load_inputs(conn: sqlite3.Connection) -> tuple[list[dict], dict[int, dict[int, int]]]:
    picks = []
    for row in conn.execute("SELECT * FROM picks ORDER BY draft_year, overall"):
        picks.append(dict(row))
    seasons: dict[int, dict[int, int]] = {}
    for row in conn.execute("SELECT player_id, season_start, gp FROM player_seasons"):
        seasons.setdefault(row["player_id"], {}).setdefault(row["season_start"], 0)
        seasons[row["player_id"]][row["season_start"]] += row["gp"]
    return picks, seasons


def season_progress(seasons: dict[int, dict[int, int]], in_progress: int | None) -> float:
    if in_progress is None:
        return 1.0
    played = [
        gp
        for by_season in seasons.values()
        for season, gp in by_season.items()
        if season == in_progress and gp > 0
    ]
    if not played:
        return 0.05
    elapsed = min(82.0, percentile(played, 0.98))
    return max(0.02, min(0.98, elapsed / 82))


def write_chart(
    path: Path,
    skater_dots: list[tuple[int, float]],
    goalie_dots: list[tuple[int, float]],
    skater: dict,
    goalie: dict,
    max_pick: int,
) -> None:
    width = 1100
    panel_h = 560
    height = 88 + panel_h * 2 + 48
    margin_l, margin_r, margin_t = 78, 28, 56

    def panel(title: str, dots: list[tuple[int, float]], fit: dict, top: int) -> list[str]:
        chosen = fit["chosen"]
        alternate = fit["alternate"]
        plot_w = width - margin_l - margin_r
        plot_h = panel_h - margin_t - 70
        y_max = 620
        if chosen["model"] == "isotonic":
            label = f'chosen smooth, bandwidth {chosen["sigma"]:g} · miss {chosen["mae"]:.1f} GP · other fit {alternate["mae"]:.1f}'
        else:
            label = f'chosen exponential · miss {chosen["mae"]:.1f} GP · other fit {alternate["mae"]:.1f}'
        parts = [
            f'<text x="{margin_l}" y="{top + 28}" fill="#f4f4f5" font-family="Oswald, Impact, sans-serif" font-size="28">{title}</text>',
            f'<text x="{width - margin_r}" y="{top + 26}" text-anchor="end" fill="#d4d4d8" font-family="Barlow, sans-serif" font-size="16">{label}</text>',
        ]
        x0 = margin_l
        y0 = top + margin_t
        parts.append(
            f'<rect x="{x0}" y="{y0}" width="{plot_w}" height="{plot_h}" fill="#0c0d12" stroke="#27272a"/>'
        )
        for gp in range(0, y_max + 1, 100):
            y = y0 + plot_h - (gp / y_max) * plot_h
            parts.append(
                f'<line x1="{x0}" y1="{y:.1f}" x2="{x0 + plot_w}" y2="{y:.1f}" stroke="#27272a"/>'
            )
            parts.append(
                f'<text x="{x0 - 10}" y="{y + 5:.1f}" text-anchor="end" fill="#d4d4d8" font-size="16" font-family="Barlow, sans-serif">{gp}</text>'
            )
        for pick in range(32, max_pick, 32):
            x = x0 + (pick / max_pick) * plot_w
            parts.append(
                f'<line x1="{x:.1f}" y1="{y0}" x2="{x:.1f}" y2="{y0 + plot_h}" stroke="#1c1c22"/>'
            )
        for pick, gp in dots:
            x = x0 + (min(pick, max_pick) / max_pick) * plot_w
            y = y0 + plot_h - (min(gp, y_max) / y_max) * plot_h
            parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.2" fill="#ffffff" opacity="0.16"/>')

        def polyline(curve: list[float], color: str, dash: str) -> str:
            points = []
            for pick in range(1, max_pick + 1):
                x = x0 + (pick / max_pick) * plot_w
                y = y0 + plot_h - (min(curve[pick], y_max) / y_max) * plot_h
                points.append(f"{x:.1f},{y:.1f}")
            return (
                f'<polyline fill="none" stroke="{color}" stroke-width="2.5" '
                f'stroke-dasharray="{dash}" points="{" ".join(points)}"/>'
            )

        parts.append(polyline(alternate["curve"], "#f87171", "5 5"))
        parts.append(polyline(chosen["curve"], "#f4f4f5", "0"))
        parts.append(
            f'<text x="{x0}" y="{y0 + plot_h + 32}" fill="#d4d4d8" font-size="16" font-family="Barlow, sans-serif">Overall pick. Faint lines every 32 picks are a typical round. Dots are the players in the 7-year fit.</text>'
        )
        return parts

    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#0B0D10"/>',
        '<text x="78" y="40" fill="#ffffff" font-family="Oswald, Impact, sans-serif" font-size="32">Expected NHL games by draft slot</text>',
        '<text x="78" y="66" fill="#d4d4d8" font-family="Barlow, sans-serif" font-size="16">Games inside the first 7 seasons. White line is the fit used for grades. Red dashes are the runner-up.</text>',
    ]
    body.extend(panel("Skaters", skater_dots, skater, 80))
    body.extend(panel("Goalies", goalie_dots, goalie, 80 + panel_h))
    body.append("</svg>")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(body), encoding="utf-8")


def build() -> None:
    from grade_quality import build as build_quality

    build_quality()


if __name__ == "__main__":
    build()
