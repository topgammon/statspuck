"""Turn the stored games into the JSON files the site reads.

Outputs (all in data/game-edge/):
  refs.json        Ref Watch: every referee's isolated whistle rate, grade, biases and splits
  teams.json       Game Edge team profiles: goal types for/against, PP/PK, goalies, lines, ref splits
  goalies.json     Goalie tendencies by chance type, shot type and ice zone
  players.json     Player shot maps, shot types, best linemates, ref splits, chemistry lift
  chemistry.json   League-wide top 5v5 lines and D-pairs, plus the Perfect Roster chemistry bonus
  today.json       Today's NHL games (and referees when the NHL has posted them)
and data/draft-rater/availability.json (games played vs team games, per season).

Recency weights for team / goalie / player profiles: this season 1.0, last season 0.5,
two seasons ago 0.25. Ref Watch uses every game unweighted, because referees need sample.
"""

from __future__ import annotations

import bisect
import json
import math
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

from store import get_json, load_games

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "game-edge"
DRAFT = ROOT / "data" / "draft-rater"

GOAL_X = 89

# ---------------------------------------------------------------- helpers


def letter_for(rating: float) -> str:
    """Same thresholds as src/lib/grade.ts letterFor."""
    for cut, letter in ((97, "A+"), (90, "A"), (82, "A-"), (72, "B+"), (60, "B"), (48, "B-"), (38, "C+"), (28, "C"), (18, "C-"), (10, "D+"), (4, "D")):
        if rating >= cut:
            return letter
    return "D-"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def r1(v: float) -> float:
    return round(v, 1)


def r2(v: float) -> float:
    return round(v, 2)


def r3(v: float) -> float:
    return round(v, 3)


def pct_rank(values: list[float], v: float) -> float:
    if not values:
        return 50.0
    below = sum(1 for x in values if x < v)
    equal = sum(1 for x in values if x == v)
    return 100.0 * (below + 0.5 * equal) / len(values)


def mean(xs) -> float:
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0


def sd(xs) -> float:
    xs = list(xs)
    if len(xs) < 2:
        return 1.0
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1)) or 1.0


INFRACTIONS = [
    ("tripping", "Tripping"),
    ("hooking", "Hooking"),
    ("slashing", "Slashing"),
    ("interference", "Interference"),
    ("holding", "Holding"),
    ("roughing", "Roughing"),
    ("cross-checking", "Cross-Checking"),
    ("high-sticking", "High-Sticking"),
    ("goalie-interference", "Goalie Interference"),
    ("unsportsmanlike", "Unsportsmanlike"),
    ("delay-of-game", "Delay of Game"),
    ("too-many-men", "Too Many Men"),
    ("boarding-charging", "Boarding & Charging"),
    ("other", "Other"),
]


def infraction(desc: str) -> str:
    d = desc.lower()
    if d.startswith("ps-"):
        d = d[3:]
    if "goalkeeper" in d or "goalie" in d:
        return "goalie-interference"
    for key in ("tripping", "hooking", "slashing", "roughing", "cross-checking", "high-sticking", "unsportsmanlike"):
        if d.startswith(key) or key in d:
            return key
    if d.startswith("interference"):
        return "interference"
    if d.startswith("holding"):
        return "holding"
    if "delay" in d or "puck-over-glass" in d or "closing-hand" in d:
        return "delay-of-game"
    if "too-many-men" in d:
        return "too-many-men"
    if any(k in d for k in ("boarding", "charging", "elbowing", "kneeing", "clipping", "checking-from-behind", "head")):
        return "boarding-charging"
    return "other"


def is_call(extra: str) -> bool:
    """Referee decisions that count as 'calls': minors, bench minors, majors (not fights), penalty shots."""
    desc, code, _ = (extra.split("|") + ["", "", ""])[:3]
    if code not in {"MIN", "BEN", "MAJ", "MATCH", "PS"}:
        return False
    return "fighting" not in desc


def chance_type(ev: list, prior: list[list]) -> str:
    """Primary tactical chance type for a shot. prior = earlier events in the same period, newest last."""
    t, _, side, _, x, y, _, _, shot_type = ev[:9]
    if x is None or y is None:
        return "other"
    if x < 25:
        return "point"  # long-range shot from outside the offensive zone
    for p in reversed(prior):
        if t - p[0] > 5:
            break
        dt_ = t - p[0]
        same = p[2] == side
        px, py = p[4], p[5]
        if px is None:
            continue
        if not same:
            px, py = -px, -py
        if dt_ <= 2 and same and p[1] == "S":
            return "rebound"
    for p in reversed(prior):
        if t - p[0] > 5:
            break
        same = p[2] == side
        px, py = p[4], p[5]
        if px is None:
            continue
        if not same:
            px, py = -px, -py
        # Rush: the puck was in the neutral or defensive zone (takeaway, faceoff, giveaway,
        # opponent shot or block) within 5 seconds of the shot.
        if px < 25 and (p[1] in ("T", "F", "V") or not same):
            return "rush"
    for p in reversed(prior):
        if t - p[0] > 2:
            break
        px, py = p[4], p[5]
        if px is None:
            continue
        if p[2] != side:
            px, py = -px, -py
        if px >= 25 and abs(py) >= 4 and abs(y) >= 4 and (py > 0) != (y > 0):
            return "royal"
    if shot_type in ("tip-in", "deflected"):
        return "tip"
    if x > GOAL_X - 10 and abs(y) <= 9:
        return "netfront"
    if x <= 45 or abs(y) > 22:
        return "point"
    return "slot"


CHANCES = ["rebound", "rush", "royal", "tip", "netfront", "slot", "point", "other"]
SHOT_TYPES = ["wrist", "snap", "slap", "backhand", "tip-in", "deflected", "wrap-around", "other"]
ZONES = ["netfront", "highslot", "leftcircle", "rightcircle", "point"]


def ice_zone(x, y) -> str | None:
    if x is None or y is None:
        return None
    if x < 54:
        return "point"
    if abs(y) <= 10:
        return "netfront" if x >= 69 else "highslot"
    return "leftcircle" if y > 0 else "rightcircle"


def pp_origin(x, y, shot_type: str) -> str | None:
    zone = ice_zone(x, y)
    if zone is None:
        return None
    if shot_type in ("tip-in", "deflected") or zone == "point":
        return "point"
    if zone in ("leftcircle", "rightcircle"):
        return "flank"
    return "netfront"


def call_zone(x, y) -> str:
    """Where a penalty was called, from the offending team's point of view (they attack +x)."""
    if x is None or y is None:
        return "nz"
    if abs(x) >= 60 and abs(y) <= 12:
        return "slot"
    if abs(y) >= 30 or abs(x) >= GOAL_X:
        return "boards"
    if x > 25:
        return "oz"
    if x < -25:
        return "dz"
    return "nz"


def grid_cell(x, y, x_bins=20, y_bins=9) -> int | None:
    if x is None or y is None:
        return None
    gx = min(x_bins - 1, max(0, int((x + 100) / (200 / x_bins))))
    gy = min(y_bins - 1, max(0, int((y + 42.5) / (85 / y_bins))))
    return gy * x_bins + gx


def shot_cell(x, y) -> int | None:
    """Offensive-half shot grid: 15 columns (x 25..100, 5 ft) x 17 rows (y, 5 ft)."""
    if x is None or y is None or x < 25:
        return None
    gx = min(14, int((x - 25) / 5))
    gy = min(16, max(0, int((y + 42.5) / 5)))
    return gy * 15 + gx


# ---------------------------------------------------------------- per-game pass


def score_timeline(game: dict) -> list[tuple[int, int]]:
    """[(t, home - away)] after each goal, starting at (0, 0)."""
    out = [(0, 0)]
    diff = 0
    for ev in game["ev"]:
        if ev[1] == "G":
            diff += 1 if ev[2] == 1 else -1
            out.append((ev[0], diff))
    return out


def diff_at(timeline: list[tuple[int, int]], t: int) -> int:
    """Score diff (home - away) just before time t."""
    diff = 0
    for when, d in timeline:
        if when < t:
            diff = d
        else:
            break
    return diff


def crunch_exposure(timeline: list[tuple[int, int]]) -> int:
    """Seconds in the final 5 minutes of regulation with a one-goal (or tied) game."""
    seconds = 0
    for t in range(3300, 3600):
        if abs(diff_at(timeline, t + 1)) <= 1:
            seconds += 1
    return seconds


def on_ice_segments(game: dict):
    """Yield (start, end, {side: [skaters]}, both_goalies_in) segments from shift charts."""
    roster = game["roster"]
    changes: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for pid, start, end in game["sh"]:
        changes[start].append((pid, 1))
        changes[end].append((pid, -1))
    if not changes:
        return []
    times = sorted(changes)
    on: dict[int, int] = defaultdict(int)
    segments = []
    for i, t in enumerate(times):
        for pid, delta in changes[t]:
            on[pid] += delta
        if i + 1 >= len(times):
            break
        nxt = times[i + 1]
        sides: dict[int, list[int]] = {0: [], 1: []}
        goalies = {0: False, 1: False}
        for pid, count in on.items():
            if count <= 0:
                continue
            info = roster.get(str(pid))
            if not info:
                continue
            if info[1] == "G":
                goalies[info[0]] = True
            else:
                sides[info[0]].append(pid)
        segments.append((t, nxt, sides, goalies[0] and goalies[1]))
    return segments


def build_all(seasons: list[int], current: int) -> None:
    """Two Game Edge views: this season only (default, no suffix) and this + last season ("-2yr").
    Ref Watch always uses every stored game (referees need the sample)."""
    OUT.mkdir(parents=True, exist_ok=True)
    games = load_games(seasons)
    print(f"game-edge build: {len(games)} stored games", flush=True)
    if not games:
        return
    _build(games, current, {current: 1.0}, "", main=True)
    _build(games, current, {current: 1.0, current - 1: 1.0}, "-2yr", main=False)


def _build(games: list[dict], current: int, weight: dict[int, float], suffix: str, main: bool) -> None:
    names: dict[int, str] = {}
    pos_of: dict[int, str] = {}
    latest_team: dict[int, tuple[str, str]] = {}

    # ---- accumulators
    ref_games: dict[str, list[dict]] = defaultdict(list)
    team_games_count: dict[str, float] = defaultdict(float)
    team_games_current: dict[str, int] = defaultdict(int)
    team_minutes: dict[str, float] = defaultdict(float)
    tf = lambda: defaultdict(lambda: [0.0, 0.0])  # noqa: E731 - [shots, goals]
    team_for = defaultdict(tf)
    team_against = defaultdict(tf)
    team_shot_for = defaultdict(tf)
    team_shot_against = defaultdict(tf)
    team_pp = defaultdict(lambda: defaultdict(float))
    team_pk = defaultdict(lambda: defaultdict(float))
    team_disc = defaultdict(lambda: [0.0, 0.0])  # taken, drawn (weighted)
    team_pp_opp = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])  # pp opps, pp goals, times shorthanded, pp goals against
    league_for = tf()
    league_shot = tf()
    league_weight_games = 0.0
    goalie = defaultdict(lambda: {"gp": 0.0, "teams": {}, "chance": tf(), "zone": tf(), "type": tf()})
    league_goalie = {"chance": tf(), "zone": tf(), "type": tf()}
    player_shots = defaultdict(lambda: {"cells": defaultdict(lambda: [0.0, 0.0]), "type": tf(), "chance": tf(), "gp": 0.0})
    player_ref = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))  # pid -> ref -> [games, taken, drawn]
    player_tot = defaultdict(lambda: [0, 0, 0])
    team_ref = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))  # team -> ref -> [games, net]
    team_tot = defaultdict(lambda: [0, 0.0])
    # chemistry
    p_toi = defaultdict(float)
    p_cf = defaultdict(float)
    p_ca = defaultdict(float)
    p_gf = defaultdict(float)
    p_ga = defaultdict(float)
    pair = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])  # toi, cf, ca, gf, ga
    line = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])
    dpair = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])

    for game in sorted(games, key=lambda g: g["id"]):
        season = int(str(game["id"])[:4])
        w = weight.get(season, 0.0)
        side_abbr = [game["away"], game["home"]]
        minutes = game["len"] / 60
        for pid, info in game["roster"].items():
            pid_i = int(pid)
            if len(info) > 2 and info[2]:
                names[pid_i] = info[2]
            pos_of[pid_i] = info[1]
            latest_team[pid_i] = (side_abbr[info[0]], game["date"])
        for s in (0, 1):
            team_games_count[side_abbr[s]] += w
            team_minutes[side_abbr[s]] += w * minutes
            if season == current:
                team_games_current[side_abbr[s]] += 1
        league_weight_games += w
        timeline = score_timeline(game)
        refs = game.get("refs") or []

        # -- events
        calls = []
        by_period: dict[int, list[list]] = defaultdict(list)
        counts = [0, 0]  # calls so far by side
        pens_at: dict[int, list[list]] = defaultdict(list)
        for ev in game["ev"]:
            t, kind, side, sit, x, y, p1, p2, extra = ev
            period = min(4, t // 1200 + 1) if t < 3600 else 4
            prior = by_period[period]
            if kind == "P":
                if is_call(extra):
                    diff = diff_at(timeline, t + 1)
                    lead_side = 1 if diff > 0 else 0 if diff < 0 else None
                    calls.append(
                        {
                            "t": t,
                            "side": side,
                            "inf": infraction(extra.split("|")[0]),
                            "zone": call_zone(x, y),
                            "cell": grid_cell(x, y),
                            "p1": p1,
                            "p2": p2,
                            "evenup": None if counts[0] == counts[1] else (1 if counts[side] < counts[1 - side] else 0),
                            "leader": None if lead_side is None else (1 if side == lead_side else 0),
                            "crunch": 3300 <= t < 3600 and abs(diff) <= 1,
                        }
                    )
                    counts[side] += 1
                    team_disc[side_abbr[side]][0] += w
                    team_disc[side_abbr[1 - side]][1] += w
                    code = extra.split("|")[1] if "|" in extra else ""
                    if code in ("MIN", "BEN", "MAJ", "MATCH"):
                        pens_at[t].append([side, code])
            elif kind in ("S", "G", "M"):
                if not sit.endswith("e"):
                    ctype = chance_type(ev, prior)
                    shooter_team, def_team = side_abbr[side], side_abbr[1 - side]
                    stype = extra if extra in SHOT_TYPES else "other"
                    on_goal = kind in ("S", "G")
                    goal = 1.0 if kind == "G" else 0.0
                    if on_goal:
                        for bucket, key in ((team_for[shooter_team], ctype), (team_shot_for[shooter_team], stype)):
                            bucket[key][0] += w
                            bucket[key][1] += w * goal
                        for bucket, key in ((team_against[def_team], ctype), (team_shot_against[def_team], stype)):
                            bucket[key][0] += w
                            bucket[key][1] += w * goal
                        league_for[ctype][0] += w
                        league_for[ctype][1] += w * goal
                        league_shot[stype][0] += w
                        league_shot[stype][1] += w * goal
                        zone = ice_zone(x, y)
                        if p2:
                            g = goalie[p2]
                            for bucket, key in ((g["chance"], ctype), (g["type"], stype), (g["zone"], zone), (league_goalie["chance"], ctype), (league_goalie["type"], stype), (league_goalie["zone"], zone)):
                                if key is None:
                                    continue
                                bucket[key][0] += w
                                bucket[key][1] += w * goal
                    if p1:
                        ps = player_shots[p1]
                        cell = shot_cell(x, y)
                        if cell is not None:
                            ps["cells"][cell][0] += w
                            ps["cells"][cell][1] += w * goal
                        ps["type"][stype][0] += w
                        ps["type"][stype][1] += w * goal
                        ps["chance"][ctype][0] += w
                        ps["chance"][ctype][1] += w * goal
                    mine, theirs = int(sit[0]), int(sit[1]) if len(sit) > 1 and sit[1].isdigit() else 5
                    if mine > theirs and on_goal:
                        origin = pp_origin(x, y, extra)
                        if origin:
                            team_pp[shooter_team][origin] += w
                            team_pk[def_team][origin] += w
                            team_pp[shooter_team]["total"] += w
                            team_pk[def_team]["total"] += w
                    if kind == "G" and mine > theirs:
                        team_pp_opp[shooter_team][1] += w
                        team_pp_opp[def_team][3] += w
            prior.append(ev)

        # power-play opportunities (offsetting minors at the same moment cancel)
        for t, pens in pens_at.items():
            per_side = [sum(1 for p in pens if p[0] == s) for s in (0, 1)]
            net = per_side[0] - per_side[1]
            if net > 0:
                team_pp_opp[side_abbr[1]][0] += w
                team_pp_opp[side_abbr[0]][2] += w
            elif net < 0:
                team_pp_opp[side_abbr[0]][0] += w
                team_pp_opp[side_abbr[1]][2] += w

        # goalie games
        for pid, info in game["roster"].items():
            if info[1] == "G":
                if any(e[7] == int(pid) for e in game["ev"] if e[1] in ("S", "G")):
                    goalie[int(pid)]["gp"] += w
                    if season == current:
                        goalie[int(pid)]["now"] = goalie[int(pid)].get("now", 0) + 1
                    goalie[int(pid)]["teams"][side_abbr[info[0]]] = game["date"]

        # -- ref records (unweighted)
        exposure = crunch_exposure(timeline)
        record = {
            "id": game["id"],
            "season": season,
            "home": game["home"],
            "away": game["away"],
            "len": game["len"],
            "calls": calls,
            "p12": sum(1 for c in calls if c["t"] < 2400),
            "p3": sum(1 for c in calls if 2400 <= c["t"] < 3600),
            "crunchExp": exposure,
            "partner": None,
        }
        for i, ref in enumerate(refs[:2]):
            rec = dict(record)
            rec["partner"] = refs[1 - i] if len(refs) == 2 else None
            ref_games[ref].append(rec)

        # team / player ref splits
        net_home = sum(1 for c in calls if c["side"] == 0) - sum(1 for c in calls if c["side"] == 1)
        for s, abbr in enumerate(side_abbr):
            net = net_home if s == 1 else -net_home
            team_tot[abbr][0] += 1
            team_tot[abbr][1] += net
            for ref in refs[:2]:
                team_ref[abbr][ref][0] += 1
                team_ref[abbr][ref][1] += net
        taken = defaultdict(int)
        drawn = defaultdict(int)
        for c in calls:
            if c["p1"]:
                taken[c["p1"]] += 1
            if c["p2"]:
                drawn[c["p2"]] += 1
        dressed = {int(pid) for pid, info in game["roster"].items() if info[1] != "G"}
        for pid in dressed:
            player_tot[pid][0] += 1
            player_tot[pid][1] += taken.get(pid, 0)
            player_tot[pid][2] += drawn.get(pid, 0)
            for ref in refs[:2]:
                rec = player_ref[pid][ref]
                rec[0] += 1
                rec[1] += taken.get(pid, 0)
                rec[2] += drawn.get(pid, 0)
        for pid in dressed:
            player_shots[pid]["gp"] += w

        # -- 5v5 chemistry from shift charts
        segments = on_ice_segments(game)
        if segments:
            starts = [s[0] for s in segments]
            for ev in game["ev"]:
                if ev[1] not in ("S", "G", "M", "B"):
                    continue
                k = bisect.bisect_left(starts, ev[0]) - 1
                if k < 0 or k >= len(segments):
                    continue
                a, b, sides, goalies_in = segments[k]
                if not (a < ev[0] <= b) or not goalies_in or len(sides[0]) != 5 or len(sides[1]) != 5:
                    continue
                s = ev[2]
                goal = ev[1] == "G"
                for pid in sides[s]:
                    p_cf[pid] += w
                    if goal:
                        p_gf[pid] += w
                for pid in sides[1 - s]:
                    p_ca[pid] += w
                    if goal:
                        p_ga[pid] += w
                for team_side, idx_f, idx_a in ((s, 1, 2), (1 - s, 2, 1)):
                    skaters = sorted(sides[team_side])
                    for i in range(len(skaters)):
                        for j in range(i + 1, len(skaters)):
                            rec = pair[(skaters[i], skaters[j])]
                            rec[idx_f] += w
                            if goal:
                                rec[idx_f + 2] += w
                    abbr = side_abbr[team_side]
                    fwd = tuple(sorted(p for p in skaters if game["roster"].get(str(p), [0, "C"])[1] in ("C", "L", "R")))
                    dmen = tuple(sorted(p for p in skaters if game["roster"].get(str(p), [0, "C"])[1] == "D"))
                    if len(fwd) == 3:
                        line[(abbr, fwd)][idx_f] += w
                        if goal:
                            line[(abbr, fwd)][idx_f + 2] += w
                    if len(dmen) == 2:
                        dpair[(abbr, dmen)][idx_f] += w
                        if goal:
                            dpair[(abbr, dmen)][idx_f + 2] += w
            for a, b, sides, goalies_in in segments:
                if not goalies_in or len(sides[0]) != 5 or len(sides[1]) != 5:
                    continue
                d = (b - a) / 60 * w
                for s in (0, 1):
                    skaters = sorted(sides[s])
                    for pid in skaters:
                        p_toi[pid] += d
                    for i in range(len(skaters)):
                        for j in range(i + 1, len(skaters)):
                            pair[(skaters[i], skaters[j])][0] += d
                    abbr = side_abbr[s]
                    fwd = tuple(sorted(p for p in skaters if game["roster"].get(str(p), [0, "C"])[1] in ("C", "L", "R")))
                    dmen = tuple(sorted(p for p in skaters if game["roster"].get(str(p), [0, "C"])[1] == "D"))
                    if len(fwd) == 3:
                        line[(abbr, fwd)][0] += d
                    if len(dmen) == 2:
                        dpair[(abbr, dmen)][0] += d

    # ================================================================ Ref Watch
    refs_out = build_refs(ref_games, current, names)
    active_refs = {r["name"]: r for r in refs_out["refs"] if r["active"]}

    # ================================================================ chemistry
    def cf_pct(cf, ca):
        return 100 * cf / (cf + ca) if cf + ca > 0 else 50.0

    def wowy(a: int, b: int, rec: list) -> float:
        toi, cf, ca = rec[0], rec[1], rec[2]
        if cf + ca < 10:
            return 0.0
        together = cf_pct(cf, ca)
        a_cf, a_ca = p_cf[a] - cf, p_ca[a] - ca
        b_cf, b_ca = p_cf[b] - cf, p_ca[b] - ca
        apart = []
        for xcf, xca, pid in ((a_cf, a_ca, a), (b_cf, b_ca, b)):
            apart.append(cf_pct(xcf, xca) if xcf + xca >= 40 else cf_pct(p_cf[pid], p_ca[pid]))
        delta = together - mean(apart)
        n = cf + ca
        return delta * n / (n + 150)

    mates: dict[int, list] = defaultdict(list)
    lift_sum: dict[int, float] = defaultdict(float)
    lift_w: dict[int, float] = defaultdict(float)
    for (a, b), rec in pair.items():
        if rec[0] < 10:
            continue
        delta = wowy(a, b, rec)
        together = cf_pct(rec[1], rec[2])
        mates[a].append([b, rec[0], together, delta])
        mates[b].append([a, rec[0], together, delta])
        # Chemistry lift: how much better a teammate's shot share is with this player.
        for me, other in ((a, b), (b, a)):
            o_cf, o_ca = p_cf[other] - rec[1], p_ca[other] - rec[2]
            if o_cf + o_ca < 40:
                continue
            lift_sum[me] += rec[0] * (together - cf_pct(o_cf, o_ca))
            lift_w[me] += rec[0]
    lift = {pid: (lift_sum[pid] / lift_w[pid]) * lift_w[pid] / (lift_w[pid] + 300) for pid in lift_w}

    def unit_rows(table: dict, size: int, min_toi: float) -> list[dict]:
        rows = []
        for (abbr, ids), rec in table.items():
            toi, cf, ca, gf, ga = rec
            if toi < min_toi:
                continue
            members = []
            for pid in ids:
                m_cf, m_ca = p_cf[pid] - cf, p_ca[pid] - ca
                members.append(cf_pct(m_cf, m_ca) if m_cf + m_ca >= 40 else cf_pct(p_cf[pid], p_ca[pid]))
            n = cf + ca
            delta = (cf_pct(cf, ca) - mean(members)) * n / (n + 150)
            rows.append(
                {
                    "team": abbr,
                    "ids": list(ids),
                    "names": [names.get(p, str(p)) for p in ids],
                    "toi": r1(toi),
                    "cf": r1(cf_pct(cf, ca)),
                    "gf": r1(100 * gf / (gf + ga)) if gf + ga > 0 else None,
                    "goals": [r1(gf), r1(ga)],
                    "delta": r1(delta),
                }
            )
        return rows

    lines_all = unit_rows(line, 3, 25)
    pairs_all = unit_rows(dpair, 2, 30)
    current_team = {pid: t for pid, (t, _) in latest_team.items()}

    def still_together(row: dict) -> bool:
        return all(current_team.get(p) == row["team"] for p in row["ids"])

    chemistry_out = {
        "asOf": date.today().isoformat(),
        "lines": sorted([r for r in lines_all if r["toi"] >= 60 and still_together(r)], key=lambda r: -r["delta"])[:25],
        "pairs": sorted([r for r in pairs_all if r["toi"] >= 80 and still_together(r)], key=lambda r: -r["delta"])[:25],
        "bonus": {str(pid): r2(max(-3.0, min(3.0, 0.5 * v))) for pid, v in lift.items() if abs(v) >= 0.05},
    }

    # ================================================================ goalies
    def sv_table(table: dict, keys: list[str]) -> dict:
        out = {}
        for key in keys:
            sa, ga = table.get(key, [0.0, 0.0])
            if sa > 0:
                out[key] = [r1(sa), r1(ga)]
        return out

    league_g = {k: sv_table(league_goalie[k], keys) for k, keys in (("chance", CHANCES), ("zone", ZONES), ("type", SHOT_TYPES))}
    goalies_out = []
    for pid, g in goalie.items():
        sa = sum(v[0] for v in g["zone"].values())
        ga = sum(v[1] for v in g["zone"].values())
        if sa < 150:
            continue
        team = max(g["teams"].items(), key=lambda kv: kv[1])[0] if g["teams"] else None
        goalies_out.append(
            {
                "id": pid,
                "name": names.get(pid, str(pid)),
                "team": team,
                "gp": r1(g["gp"]),
                "gpNow": g.get("now", 0),
                "sa": r1(sa),
                "ga": r1(ga),
                "sv": r3(1 - ga / sa) if sa else None,
                "chance": sv_table(g["chance"], CHANCES),
                "zone": sv_table(g["zone"], ZONES),
                "type": sv_table(g["type"], SHOT_TYPES),
            }
        )
    goalies_out.sort(key=lambda g: -g["sa"])
    lsa = sum(v[0] for v in league_goalie["zone"].values())
    lga = sum(v[1] for v in league_goalie["zone"].values())

    # ================================================================ teams
    def ref_splits(entries: dict, base: tuple[int, float], min_games: int, active: dict, shrink: float) -> dict:
        games_all, net_all = base
        avg = net_all / games_all if games_all else 0.0
        rows = []
        for ref, (n, net) in entries.items():
            if ref not in active or n < min_games:
                continue
            delta = (net / n - avg) * n / (n + shrink)
            rows.append({"slug": active[ref]["slug"], "name": ref, "games": n, "delta": r2(delta)})
        rows.sort(key=lambda r: -r["delta"])
        return {"best": rows[:3], "worst": list(reversed(rows[-3:])) if len(rows) > 3 else [], "all": {r["slug"]: [r["games"], r["delta"]] for r in rows}}

    def share_table(table: dict, keys: list[str]) -> dict:
        return {k: [r1(table[k][0]), r1(table[k][1])] for k in keys if k in table}

    teams_out = {}
    for abbr in sorted(team_games_count):
        gw = team_games_count[abbr]
        opp = team_pp_opp[abbr]
        tg = [g for g in goalies_out if g["team"] == abbr]
        tg.sort(key=lambda g: (-g["gpNow"], -g["gp"]))
        splits = ref_splits(team_ref[abbr], tuple(team_tot[abbr]), 4, active_refs, 5)
        team_lines = sorted([r for r in lines_all if r["team"] == abbr and still_together(r)], key=lambda r: -r["toi"])[:4]
        team_pairs = sorted([r for r in pairs_all if r["team"] == abbr and still_together(r)], key=lambda r: -r["toi"])[:3]
        teams_out[abbr] = {
            "games": team_games_current.get(abbr, 0),
            "weightGames": r1(gw),
            "minutes": r1(team_minutes[abbr]),
            "for": share_table(team_for[abbr], CHANCES),
            "against": share_table(team_against[abbr], CHANCES),
            "shotFor": share_table(team_shot_for[abbr], SHOT_TYPES),
            "shotAgainst": share_table(team_shot_against[abbr], SHOT_TYPES),
            "pp": {k: r1(v) for k, v in team_pp[abbr].items()},
            "pk": {k: r1(v) for k, v in team_pk[abbr].items()},
            "taken": r2(team_disc[abbr][0] / gw) if gw else 0,
            "drawn": r2(team_disc[abbr][1] / gw) if gw else 0,
            "ppPct": r3(opp[1] / opp[0]) if opp[0] else None,
            "pkPct": r3(1 - opp[3] / opp[2]) if opp[2] else None,
            "ppOpp": r2(opp[0] / gw) if gw else 0,
            "goalies": [g["id"] for g in tg[:3]],
            "lines": team_lines,
            "pairs": team_pairs,
            "refs": splits,
        }
    league_games = sum(team_games_count.values())
    league_team = {
        "for": share_table(league_for, CHANCES),
        "shot": share_table(league_shot, SHOT_TYPES),
        "teamGames": r1(league_games),
        "taken": r2(sum(v[0] for v in team_disc.values()) / league_games) if league_games else 0,
        "ppPct": r3(sum(v[1] for v in team_pp_opp.values()) / max(1, sum(v[0] for v in team_pp_opp.values()))),
        "sv": r3(1 - lga / lsa) if lsa else None,
        "goalie": league_g,
    }

    # ================================================================ players
    players_out = {}
    for pid, ps in player_shots.items():
        total_shots = sum(v[0] for v in ps["type"].values())
        mate_rows = sorted((m for m in mates.get(pid, []) if m[1] >= 40), key=lambda m: -m[3])[:5]
        prs = ref_splits_player(player_ref.get(pid, {}), player_tot.get(pid), active_refs)
        if total_shots < 5 and not mate_rows and not prs["best"]:
            continue
        players_out[str(pid)] = {
            "shots": r1(total_shots),
            "goals": r1(sum(v[1] for v in ps["type"].values())),
            "cells": [[c, r1(v[0]), r1(v[1])] for c, v in sorted(ps["cells"].items()) if v[0] >= 0.5],
            "type": share_table(ps["type"], SHOT_TYPES),
            "chance": share_table(ps["chance"], CHANCES),
            "toi5": r1(p_toi.get(pid, 0)),
            "cf5": r1(cf_pct(p_cf[pid], p_ca[pid])) if p_cf[pid] + p_ca[pid] > 0 else None,
            "mates": [{"id": m[0], "name": names.get(m[0], str(m[0])), "toi": r1(m[1]), "cf": r1(m[2]), "delta": r1(m[3])} for m in mate_rows],
            "lift": r2(lift.get(pid, 0.0)),
            "refs": prs,
        }

    goalie_out = {
        "asOf": date.today().isoformat(),
        "league": {"sv": league_team["sv"], **league_g},
        "goalies": goalies_out,
    }
    seasons_used = sorted(s for s, v in weight.items() if v > 0)
    write(f"teams{suffix}.json", {"asOf": date.today().isoformat(), "current": current, "seasons": seasons_used, "league": league_team, "teams": teams_out})
    write(f"goalies{suffix}.json", goalie_out)
    write(f"players{suffix}.json", {"asOf": date.today().isoformat(), "players": players_out})
    write(f"chemistry{suffix}.json", chemistry_out)
    if main:
        write("refs.json", refs_out)
        build_today(active_refs)
        build_availability(current, team_games_current)


def ref_splits_player(entries: dict, total, active: dict) -> dict:
    if not total or not total[0]:
        return {"best": [], "worst": []}
    games, taken, drawn = total
    base = (drawn - taken) / games
    rows = []
    for ref, (n, t, d) in entries.items():
        if ref not in active or n < 5:
            continue
        delta = ((d - t) / n - base) * n / (n + 8)
        rows.append({"slug": active[ref]["slug"], "name": ref, "games": n, "taken": t, "drawn": d, "delta": r2(delta)})
    rows.sort(key=lambda r: -r["delta"])
    return {"best": rows[:3], "worst": list(reversed(rows[-3:])) if len(rows) > 3 else []}


# ---------------------------------------------------------------- Ref Watch


def build_refs(ref_games: dict[str, list[dict]], current: int, names: dict[int, str]) -> dict:
    # Unique games (each game appears under both refs).
    unique: dict[int, dict] = {}
    for recs in ref_games.values():
        for rec in recs:
            unique[rec["id"]] = rec
    games = list(unique.values())
    total_len = sum(g["len"] for g in games)
    total_calls = sum(len(g["calls"]) for g in games)
    league_rate = 3600 * total_calls / total_len if total_len else 0  # calls per 60
    league_home = mean((sum(1 for c in g["calls"] if c["side"] == 0) - sum(1 for c in g["calls"] if c["side"] == 1)) * 3600 / g["len"] for g in games)
    inf_league = defaultdict(int)
    for g in games:
        for c in g["calls"]:
            inf_league[c["inf"]] += 1
    league_p12 = sum(g["p12"] for g in games) / (2400 * len(games)) * 3600
    league_p3 = sum(g["p3"] for g in games) / (1200 * len(games)) * 3600
    crunch_calls = sum(sum(1 for c in g["calls"] if c["crunch"]) for g in games)
    crunch_exp = sum(g["crunchExp"] for g in games)
    league_crunch = 3600 * crunch_calls / crunch_exp if crunch_exp else league_rate
    ev_n = sum(sum(1 for c in g["calls"] if c["evenup"] is not None) + sum(1 for c in g["calls"] if c["leader"] is not None) for g in games)
    ev_hits = sum(sum(c["evenup"] or 0 for c in g["calls"]) + sum(c["leader"] or 0 for c in g["calls"]) for g in games)
    league_mgmt = 100 * ev_hits / ev_n if ev_n else 50

    # ---- ridge model: per-game calls/60 = mu + ref_a + ref_b + team_home + team_away
    mu = league_rate
    ref_eff: dict[str, float] = defaultdict(float)
    team_eff: dict[str, float] = defaultdict(float)
    game_refs: dict[int, list[str]] = defaultdict(list)
    for ref, recs in ref_games.items():
        for rec in recs:
            game_refs[rec["id"]].append(ref)
    LAMBDA_REF, LAMBDA_TEAM = 15.0, 25.0
    for _ in range(40):
        for ref, recs in ref_games.items():
            resid = 0.0
            for rec in recs:
                y = 3600 * len(rec["calls"]) / rec["len"]
                others = sum(ref_eff[o] for o in game_refs[rec["id"]] if o != ref)
                resid += y - mu - others - team_eff[rec["home"]] - team_eff[rec["away"]]
            ref_eff[ref] = resid / (len(recs) + LAMBDA_REF)
        team_resid: dict[str, list[float]] = defaultdict(lambda: [0.0, 0])
        for g in games:
            y = 3600 * len(g["calls"]) / g["len"]
            base = y - mu - sum(ref_eff[r] for r in game_refs[g["id"]])
            for team, other in ((g["home"], g["away"]), (g["away"], g["home"])):
                team_resid[team][0] += base - team_eff[other]
                team_resid[team][1] += 1
        for team, (s, n) in team_resid.items():
            team_eff[team] = s / (n + LAMBDA_TEAM)
    # Raw per-ref numbers
    rows = []
    for ref, recs in ref_games.items():
        n = len(recs)
        length = sum(r["len"] for r in recs)
        calls = [c for r in recs for c in r["calls"]]
        raw = 3600 * len(calls) / length if length else 0
        home_net = [(sum(1 for c in r["calls"] if c["side"] == 0) - sum(1 for c in r["calls"] if c["side"] == 1)) * 3600 / r["len"] for r in recs]
        home = (sum(home_net) + 20 * league_home) / (n + 20) - league_home
        mg_n = sum(1 for c in calls if c["evenup"] is not None) + sum(1 for c in calls if c["leader"] is not None)
        mg_h = sum(c["evenup"] or 0 for c in calls) + sum(c["leader"] or 0 for c in calls)
        mgmt = 100 * (mg_h + 60 * league_mgmt / 100) / (mg_n + 60)
        cr_calls = sum(1 for c in calls if c["crunch"])
        cr_exp = sum(r["crunchExp"] for r in recs)
        k = 7200  # two hours of crunch time as prior
        crunch_rate = 3600 * (cr_calls + k * league_crunch / 3600) / (cr_exp + k)
        crunch_ratio = crunch_rate / raw if raw else 1
        p12 = sum(r["p12"] for r in recs)
        p3 = sum(r["p3"] for r in recs)
        p12_rate = 3600 * (p12 + 10 * league_p12 * 2400 / 3600) / (2400 * (n + 10))
        p3_rate = 3600 * (p3 + 10 * league_p3 * 1200 / 3600) / (1200 * (n + 10))
        inf = defaultdict(int)
        for c in calls:
            inf[c["inf"]] += 1
        infractions = []
        for key, label in INFRACTIONS:
            league_per_game = inf_league[key] / len(games) if games else 0
            if league_per_game <= 0:
                continue
            prior = 25  # games of league-average prior
            ratio = (inf[key] + prior * league_per_game) / ((n + prior) * league_per_game)
            infractions.append({"key": key, "label": label, "perGame": r2(inf[key] / n if n else 0), "league": r2(league_per_game), "pct": round(100 * (ratio - 1))})
        signature = sorted([i for i in infractions if i["key"] != "other" and i["league"] >= 0.12], key=lambda i: -abs(i["pct"]))[:2]
        zones = defaultdict(int)
        grid = defaultdict(int)
        for c in calls:
            zones[c["zone"]] += 1
            if c["cell"] is not None:
                grid[c["cell"]] += 1
        friction_taken = defaultdict(int)
        friction_drawn = defaultdict(int)
        for c in calls:
            if c["p1"]:
                friction_taken[c["p1"]] += 1
            if c["p2"]:
                friction_drawn[c["p2"]] += 1
        team_net = defaultdict(lambda: [0, 0.0])
        for r in recs:
            net_home = sum(1 for c in r["calls"] if c["side"] == 0) - sum(1 for c in r["calls"] if c["side"] == 1)
            team_net[r["home"]][0] += 1
            team_net[r["home"]][1] += net_home
            team_net[r["away"]][0] += 1
            team_net[r["away"]][1] -= net_home
        seasons = sorted({r["season"] for r in recs})
        rows.append(
            {
                "name": ref,
                "slug": slugify(ref),
                "games": n,
                "seasons": seasons,
                "currentGames": sum(1 for r in recs if r["season"] == current),
                "active": any(r["season"] == current for r in recs),
                "low": n < 15,
                "raw": r2(raw),
                "rate": r2(mu + ref_eff[ref]),
                "delta": r2(ref_eff[ref]),
                "home": r2(home),
                "mgmt": r1(mgmt),
                "crunch": r2(crunch_ratio),
                "crunchRate": r2(crunch_rate),
                "p12": r2(p12_rate),
                "p3": r2(p3_rate),
                "infractions": infractions,
                "signature": [{"label": s["label"], "pct": s["pct"]} for s in signature],
                "zones": {z: zones.get(z, 0) for z in ("oz", "nz", "dz", "slot", "boards")},
                "grid": [[c, v] for c, v in sorted(grid.items())],
                "calls": len(calls),
                "_teams": team_net,
                "taken": [{"id": p, "name": names.get(p, str(p)), "n": v} for p, v in sorted(friction_taken.items(), key=lambda kv: -kv[1])[:5] if v >= 2],
                "drawn": [{"id": p, "name": names.get(p, str(p)), "n": v} for p, v in sorted(friction_drawn.items(), key=lambda kv: -kv[1])[:5] if v >= 2],
                "partners": sorted({r["partner"] for r in recs if r["partner"]}),
            }
        )

    # team baselines (net PP per game across all games)
    base_team = defaultdict(lambda: [0, 0.0])
    for g in games:
        net_home = sum(1 for c in g["calls"] if c["side"] == 0) - sum(1 for c in g["calls"] if c["side"] == 1)
        base_team[g["home"]][0] += 1
        base_team[g["home"]][1] += net_home
        base_team[g["away"]][0] += 1
        base_team[g["away"]][1] -= net_home
    for row in rows:
        splits = []
        for team, (n, net) in row.pop("_teams").items():
            if n < 4:
                continue
            bn, bnet = base_team[team]
            delta = (net / n - bnet / bn) * n / (n + 5)
            splits.append({"team": team, "games": n, "net": r2(net / n), "delta": r2(delta)})
        splits.sort(key=lambda s: -s["delta"])
        row["teamsBest"] = splits[:5]
        row["teamsWorst"] = list(reversed(splits[-5:])) if len(splits) > 5 else []

    # ---- consistency grade + style (graded against refs with 15+ games)
    graded = [r for r in rows if not r["low"]]
    league_crunch_ratio = mean(r["crunch"] for r in graded) if graded else 1
    league_p3_ratio = mean(r["p3"] / r["p12"] for r in graded if r["p12"]) if graded else 1
    comps = {
        "home": [abs(r["home"]) for r in graded],
        "mgmt": [abs(r["mgmt"] - league_mgmt) for r in graded],
        "crunch": [abs(r["crunch"] - league_crunch_ratio) for r in graded],
        "p3": [abs((r["p3"] / r["p12"] if r["p12"] else 1) - league_p3_ratio) for r in graded],
    }
    sds = {k: sd(v) for k, v in comps.items()}

    def composite(r: dict) -> float:
        return (
            1.2 * abs(r["home"]) / sds["home"]
            + 1.0 * abs(r["mgmt"] - league_mgmt) / sds["mgmt"]
            + 0.9 * abs(r["crunch"] - league_crunch_ratio) / sds["crunch"]
            + 0.9 * abs((r["p3"] / r["p12"] if r["p12"] else 1) - league_p3_ratio) / sds["p3"]
        )

    pool = [composite(r) for r in graded]
    rate_sd = sd(r["delta"] for r in graded)
    mgmt_sd = sd(r["mgmt"] for r in graded)
    for r in rows:
        c = composite(r)
        score = round(100 - pct_rank(pool, c))
        r["score"] = max(0, min(100, score))
        r["grade"] = letter_for(r["score"])
        z = r["delta"] / rate_sd
        if z >= 0.8:
            style = "Strict Whistle"
        elif z <= -0.8:
            style = "Let Them Play"
        elif (r["mgmt"] - league_mgmt) / mgmt_sd >= 1.0:
            style = "Game Manager"
        else:
            style = "Balanced"
        r["style"] = style
    attach_official_bios(rows)
    rows.sort(key=lambda r: (-r["active"], -r["games"]))
    return {
        "asOf": date.today().isoformat(),
        "seasons": sorted({g["season"] for g in games}),
        "games": len(games),
        "league": {
            "rate": r2(league_rate),
            "home": r2(league_home),
            "mgmt": r1(league_mgmt),
            "crunch": r2(league_crunch_ratio),
            "crunchRate": r2(league_crunch),
            "p12": r2(league_p12),
            "p3": r2(league_p3),
            "perTeamGame": r2(total_calls / (2 * len(games))) if games else 0,
        },
        "refs": rows,
    }


def _key(name: str) -> str:
    return re.sub(r"[^a-z]", "", name.lower())


def attach_official_bios(rows: list[dict]) -> None:
    """Official NHL headshot, sweater number and hometown from records.nhl.com (free, public)."""
    try:
        data = get_json("https://records.nhl.com/site/api/officials?cayenneExp=officialType=%22Referee%22").get("data", [])
    except Exception as error:  # noqa: BLE001 - photos are optional
        print(f"officials: lookup failed ({error})", flush=True)
        return
    by_name = {}
    for o in data:
        by_name.setdefault(_key(f"{o.get('firstName', '')}{o.get('lastName', '')}"), o)
    matched = 0
    for r in rows:
        o = by_name.get(_key(r["name"]))
        if not o:
            continue
        matched += 1
        r["photo"] = o.get("headshot_url") or o.get("thumb_url")
        r["number"] = o.get("sweaterNumber")
        city = ", ".join(x for x in (o.get("birthCity"), o.get("stateProvinceCode") or o.get("countryCode")) if x)
        r["hometown"] = city or None
        first = o.get("firstRegularGameId")
        r["since"] = int(str(first)[:4]) if first else None
    print(f"officials: matched {matched}/{len(rows)} referees to NHL bios", flush=True)


# ---------------------------------------------------------------- today + availability


def build_today(active_refs: dict) -> None:
    out = {"date": date.today().isoformat(), "games": []}
    try:
        sched = get_json("https://api-web.nhle.com/v1/schedule/now")
        days = sched.get("gameWeek") or []
        today = next((d for d in days if d.get("games")), None)
        if today:
            out["date"] = today.get("date") or out["date"]
            for g in today["games"]:
                if g.get("gameType") != 2:
                    continue
                refs: list[str] = []
                try:
                    rail = get_json(f"https://api-web.nhle.com/v1/gamecenter/{g['id']}/right-rail")
                    refs = [((r.get("fullName") or {}).get("default") or "") for r in ((rail.get("gameInfo") or {}).get("referees") or [])]
                except Exception:  # noqa: BLE001 - refs are usually posted close to puck drop
                    refs = []
                out["games"].append(
                    {
                        "id": g["id"],
                        "start": g.get("startTimeUTC"),
                        "away": g["awayTeam"]["abbrev"],
                        "home": g["homeTeam"]["abbrev"],
                        "refs": [active_refs[r]["slug"] for r in refs if r in active_refs],
                    }
                )
    except Exception as error:  # noqa: BLE001 - keep yesterday's file if the API is down
        print(f"today: schedule failed ({error})", flush=True)
        if (OUT / "today.json").exists():
            return
    write("today.json", out)


def build_availability(current: int, team_games_current: dict[str, int]) -> None:
    """Season-by-season games played vs team games, from the first 40+ GP NHL season on."""
    stats_path = DRAFT / "season_stats.json"
    if not stats_path.exists():
        return
    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    current_games = sorted(team_games_current.values())
    live_games = current_games[len(current_games) // 2] if current_games else 0

    def season_length(season: int) -> int:
        if season == current:
            return live_games
        return {2012: 48, 2019: 70, 2020: 56}.get(season, 82)

    players = {}
    for group in ("skaters", "goalies"):
        for pid, rows in stats.get(group, {}).items():
            gp: dict[int, int] = defaultdict(int)
            for row in rows:
                gp[row[0]] += row[1]
            if not gp or max(gp) < current - 2:
                continue  # only players active in the last three seasons
            first = next((s for s in sorted(gp) if gp[s] >= 40), None)
            if first is None:
                continue
            series = []
            for season in range(first, max(gp) + 1):
                games = season_length(season)
                if games <= 0:
                    continue
                played = min(gp.get(season, 0), games)
                series.append([season, played, games])
            if series:
                players[pid] = series
    path = DRAFT / "availability.json"
    path.write_text(json.dumps({"asOf": date.today().isoformat(), "current": current, "players": players}, separators=(",", ":")), encoding="utf-8")
    print(f"availability: {len(players)} players -> {path.name}", flush=True)


def write(name: str, payload: dict) -> None:
    path = OUT / name
    path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)", flush=True)
