"""Trade track record and trade trees: every NHL trade since 2005-06, valued by what actually happened.

Sources: the public trade log on capwages.com for 2009-10 onward (one page per season, allowed by its
robots.txt) and Wikipedia's season transaction lists for 2005-06 through 2008-09 (wiki_trades.py).

For each team in each trade we add up the Impact (the Draft Rater's own metric) of what it received
minus what it sent, over the five seasons that follow:

  - a player counts for the five seasons from the trade (a mid-season deal counts its first season
    at half). Seasons that have not been played yet are projected from his latest full season,
    fading 8% a year, and only if he is still active.
  - a draft pick counts for the first five seasons of the player taken with it. Seasons that have
    not happened yet use the Draft Rater's expected Impact for that slot. A pick not made yet uses
    the middle slot of its round.

It also links trades into trees: when a team trades away something it earlier got in a trade (or the
player it drafted with a pick it got in a trade), that later trade grows the same tree.

Writes data/draft-rater/trades.json and data/draft-rater/trade_trees.json. If a source is down the
last saved files are kept.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fetch_nhl import connect, season_calendar
from grade_quality import ice_group, league_context, load_inputs, season_progress, season_quality
from teams import FRANCHISES
from wiki_trades import wiki_pages

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
OUT = DATA / "trades.json"
TREES = DATA / "trade_trees.json"
NAMES = DATA / "player_names.json"
USER_AGENT = "StatsPuckBot/1.0 (hockey stats research; contact via statspuck.com)"
FIRST_SEASON = 2005
CAPWAGES_FROM = 2009
HORIZON = 5
FADE = 0.92

SLUG_TO_ABBR = {re.sub(r"[^a-z0-9]+", "_", info["name"].lower().replace(".", "")).strip("_"): abbr for abbr, info in FRANCHISES.items()}
SLUG_TO_ABBR.update(
    {
        "arizona_coyotes": "UTA",
        "phoenix_coyotes": "UTA",
        "utah_hockey_club": "UTA",
        "atlanta_thrashers": "WPG",
        "mighty_ducks_of_anaheim": "ANA",
    }
)


def get(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    delay = 1.0
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(delay)
        delay *= 2
    raise RuntimeError("unreachable")


def norm(name: str) -> str:
    if "," in name:
        last, first = [part.strip() for part in name.split(",", 1)]
        name = f"{first} {last}"
    name = unicodedata.normalize("NFKD", name)
    name = "".join(ch for ch in name if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z ]", "", name.lower().replace("-", " "))).strip()


def capwages_pages(today: dt.date) -> list[tuple[str, list[dict]]]:
    start = today.year if today.month >= 7 else today.year - 1
    out = []
    for year in range(CAPWAGES_FROM, start + 1):
        label = f"{year}-{str(year + 1)[2:]}"
        html = get(f"https://capwages.com/trades/{label}")
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
        if not match:
            raise ValueError(f"no data on trades page {label}")
        out.append((label, json.loads(match.group(1))["props"]["pageProps"]["trades"]))
        time.sleep(1.0)
    return out


def fill_names(conn) -> dict[int, str]:
    """Names for every player in the database. Veterans our draft tables never saw come from the NHL feed once, then stay cached."""
    names = {row["player_id"]: row["name"] for row in conn.execute("SELECT player_id, name FROM players WHERE name IS NOT NULL")}
    cached = {int(k): v for k, v in json.loads(NAMES.read_text(encoding="utf-8")).items()} if NAMES.exists() else {}
    names.update(cached)
    missing = [row[0] for row in conn.execute("SELECT DISTINCT player_id FROM player_seasons") if row[0] not in names]
    if missing:
        def one(pid: int) -> tuple[int, str | None]:
            try:
                payload = json.loads(get(f"https://api-web.nhle.com/v1/player/{pid}/landing"))
                return pid, f"{payload['firstName']['default']} {payload['lastName']['default']}"
            except Exception:  # noqa: BLE001 - a missing name only means one player goes unmatched
                return pid, None

        with ThreadPoolExecutor(max_workers=6) as pool:
            for pid, name in pool.map(one, missing):
                if name:
                    cached[pid] = name
                    names[pid] = name
        NAMES.write_text(json.dumps({str(k): v for k, v in sorted(cached.items())}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return names


def build() -> None:
    today = dt.date.today()
    try:
        pages = wiki_pages() + capwages_pages(today)
    except Exception as error:  # noqa: BLE001 - keep the saved files
        print(f"trades: fetch failed ({error}); keeping the saved files", flush=True)
        return

    conn = connect()
    _picks, seasons = load_inputs(conn)
    _toi, save_avg = league_context(seasons)
    last_complete, in_progress = season_calendar(today)
    progress = season_progress(seasons, in_progress)
    current = in_progress or last_complete
    names = fill_names(conn)
    active = {int(k): v for k, v in json.loads((DATA / "active.json").read_text(encoding="utf-8")).items()}
    rosters = {int(k): v for k, v in json.loads((DATA / "rosters.json").read_text(encoding="utf-8")).items()}

    # player -> season -> Impact (skater + goalie rows together), and games per season
    impact: dict[int, dict[int, float]] = defaultdict(dict)
    games: dict[int, dict[int, int]] = defaultdict(dict)
    for pid, by_season in seasons.items():
        for season, roles in by_season.items():
            total = 0.0
            gp = 0
            for role, row in roles.items():
                value, played = season_quality(row, role, "G" if role == "goalie" else ice_group(row["position"], "F"), season, {}, save_avg)
                total += value
                gp += played
            impact[pid][season] = total
            games[pid][season] = gp

    by_name: dict[str, list[int]] = defaultdict(list)
    for pid, name in names.items():
        by_name[norm(name)].append(pid)

    curves = json.loads((DATA / "curves.json").read_text(encoding="utf-8"))
    pick_rows = json.loads((DATA / "picks.json").read_text(encoding="utf-8"))
    by_slot = {(row["year"], row["overall"]): row for row in pick_rows if not row.get("forfeited")}
    latest_draft = max(row["year"] for row in pick_rows)
    # Player id -> /players/[id] route id (a pick id for the drafted, the player id for the undrafted).
    route_by_pid: dict[int, int] = {row["playerId"]: row["id"] for row in pick_rows if row.get("playerId") and not row.get("forfeited")}
    for row in json.loads((DATA / "undrafted.json").read_text(encoding="utf-8")):
        route_by_pid.setdefault(int(row["playerId"]), int(row["id"]))

    def expected_increment(slot: int, h: int) -> float:
        index = min(max(slot, 1), curves["maxPick"])
        out = 0.0
        for family, weight in (("skater", 0.9), ("goalie", 0.1)):
            table = curves[family]
            now = table.get(str(h), [0] * (index + 1))[index]
            before = table.get(str(h - 1), [0] * (index + 1))[index] if h > 1 else 0.0
            out += weight * max(0.0, now - before)
        return out

    def resolve(name: str, season0: int) -> int | None:
        candidates = by_name.get(norm(name), [])
        if not candidates:
            return None
        if len(candidates) > 1:
            candidates = sorted(candidates, key=lambda pid: -sum(games[pid].get(s, 0) for s in range(season0 - 1, season0 + 3)))
        return candidates[0]

    def player_value(pid: int | None, season0: int, first_weight: float) -> float:
        if pid is None:
            return 0.0
        own = impact.get(pid, {})

        def full(season: int) -> float | None:
            if season not in own:
                return None
            if season == in_progress:
                return own[season] / max(progress, 0.15)
            return own[season]

        observed = [s for s in sorted(own) if s <= current]
        latest = full(observed[-1]) if observed else None
        total = 0.0
        for k in range(HORIZON):
            season = season0 + k
            weight = first_weight if k == 0 else 1.0
            if season <= last_complete:
                total += weight * own.get(season, 0.0)
            elif season == in_progress:
                total += weight * (full(season) or (latest or 0.0))
            elif active.get(pid) and latest:
                total += weight * latest * (FADE ** (season - current))
        return total

    def pick_value(year: int, rnd: int, overall: int | None) -> float:
        slot = int(overall) if overall else (rnd - 1) * 32 + 16
        row = by_slot.get((year, int(overall))) if overall else None
        realized = row["seasons"] if row else []
        total = 0.0
        for h in range(1, HORIZON + 1):
            if h <= len(realized) and row and year + h - 1 <= current:
                total += realized[h - 1]
            else:
                total += expected_increment(slot, h)
        return total

    sides = []
    steps: dict[str, dict] = {}
    unknown_slugs = set()
    for label, trades in pages:
        for trade in trades:
            date = str(trade["id"])[:10] if re.match(r"\d{4}-\d{2}-\d{2}", str(trade["id"])) else str(trade["date"])[:10]
            teams = [SLUG_TO_ABBR.get(slug) for slug in trade["teams"]]
            for slug, abbr in zip(trade["teams"], teams):
                if not abbr:
                    unknown_slugs.add(slug)
            when = dt.date.fromisoformat(date)
            if when.month >= 7:
                season0, first_weight = when.year, 1.0
            else:
                season0, first_weight = when.year - 1, 0.5
            # A piece: (label, value, kind, identity, pid, derived-player (name, pid) or None)
            got: dict[str, list[tuple]] = defaultdict(list)
            gave: dict[str, list[tuple]] = defaultdict(list)
            for item in trade["items"]:
                kind = item.get("type")
                src = SLUG_TO_ABBR.get(item.get("from", ""))
                dst = SLUG_TO_ABBR.get(item.get("to", ""))
                if kind == "player":
                    pid = resolve(item["name"], season0)
                    value = player_value(pid, season0, first_weight)
                    text = re.sub(r"^(.*), (.*)$", r"\2 \1", item["name"])
                    piece = (text, value, "p", f"p:{norm(item['name'])}", pid, None)
                elif kind == "draft_pick":
                    year, rnd = int(item.get("year") or 0), int(item.get("round") or 1)
                    overall = int(item["overall"]) if item.get("overall") else None
                    origin = SLUG_TO_ABBR.get(item.get("originTeam", "")) or src or "UNK"
                    value = pick_value(year, rnd, overall)
                    drafted = None
                    row = by_slot.get((year, overall)) if overall and year <= latest_draft else None
                    if row and row.get("playerId"):
                        drafted = (row["name"], int(row["playerId"]))
                    piece = (f"{year} R{rnd}", value, "k", f"k:{year}-{rnd}-{origin}", None, drafted)
                else:
                    continue
                if dst:
                    got[dst].append(piece)
                if src:
                    gave[src].append(piece)
            for abbr in {t for t in teams if t}:
                incoming = got.get(abbr, [])
                outgoing = gave.get(abbr, [])
                net = sum(p[1] for p in incoming) - sum(p[1] for p in outgoing)
                # Players first (biggest first), then picks (biggest first). Nothing is cut off.
                ordered = lambda rows: [[p[0], round(p[1]), p[2]] for p in sorted(rows, key=lambda r: (r[2] != "p", -r[1]))]  # noqa: E731
                sides.append({"id": trade["id"], "d": date, "t": abbr, "net": round(net, 1), "in": ordered(incoming), "out": ordered(outgoing)})
                others = [t for t in teams if t and t != abbr]
                steps[f"{trade['id']}:{abbr}"] = {"id": trade["id"], "d": date, "t": abbr, "o": others[0] if others else "", "gave": outgoing, "got": incoming}

    if unknown_slugs:
        print(f"trades: unmapped teams {sorted(unknown_slugs)}", flush=True)
    if len(sides) < 2500:
        print(f"trades: only {len(sides)} sides found; keeping the saved files", flush=True)
        return
    payload = {"asOf": today.isoformat(), "from": f"{FIRST_SEASON}-{str(FIRST_SEASON + 1)[2:]}", "horizon": HORIZON, "sides": sides}
    OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"trades: {len(sides)} team sides from {len(pages)} seasons", flush=True)

    write_trees(steps, today, latest_draft, active, rosters, route_by_pid)
    conn.close()


def write_trees(steps: dict[str, dict], today: dt.date, latest_draft: int, active: dict, rosters: dict, route_by_pid: dict) -> None:
    """Link each team's trades into trees and write trade_trees.json."""
    by_team: dict[str, list[str]] = defaultdict(list)
    for key, step in steps.items():
        by_team[step["t"]].append(key)
    for keys in by_team.values():
        keys.sort(key=lambda k: (steps[k]["d"], k))

    # When did a team receive each identity? Drafted players count as received on draft day.
    receipts: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    for key, step in steps.items():
        for piece in step["got"]:
            receipts[(step["t"], piece[3])].append((step["d"], key))
    drafted_at: dict[str, list[dict]] = defaultdict(list)  # step key -> drafted players
    for key, step in steps.items():
        for piece in step["got"]:
            if piece[2] != "k" or not piece[5]:
                continue
            year = int(piece[3].split(":")[1].split("-")[0])
            draft_day = f"{year}-06-30"
            if step["d"] > draft_day:
                continue
            # Only the team still holding the pick on draft day makes the selection.
            gave_later = any(s2["t"] == step["t"] and step["d"] <= s2["d"] <= draft_day and any(g[3] == piece[3] for g in s2["gave"]) and k2 != key for k2, s2 in steps.items())
            if gave_later:
                continue
            name, pid = piece[5]
            drafted_at[key].append({"name": name, "pid": pid, "pick": piece[0], "ident": f"p:{norm(name)}", "date": draft_day})
            receipts[(step["t"], f"p:{norm(name)}")].append((draft_day, key))

    parents: dict[str, str] = {}
    for key, step in steps.items():
        best = None
        for piece in step["gave"]:
            options = [r for r in receipts.get((step["t"], piece[3]), []) if r[0] <= step["d"] and r[1] != key]
            if options:
                candidate = max(options)
                if best is None or candidate[0] < best[0]:
                    best = candidate  # first parent in time keeps the child, so each trade sits under one parent
        if best:
            parents[key] = best[1]

    children: dict[str, list[str]] = defaultdict(list)
    for child, parent in parents.items():
        children[parent].append(child)
    for kids in children.values():
        kids.sort(key=lambda k: (steps[k]["d"], k))

    def status(step: dict, piece: tuple, kids: list[str]) -> str:
        """For a player piece nobody moved on: 'a' on this team now, 'x' with another team, 'r' retired or inactive."""
        if piece[2] != "p" or piece[4] is None:
            return ""
        used = any(any(g[3] == piece[3] for g in steps[k]["gave"]) for k in kids)
        if used:
            return ""
        pid = piece[4]
        if rosters.get(pid) == step["t"]:
            return "a"
        if rosters.get(pid):
            return "x"
        return "r" if active.get(pid) is False else ""

    out_steps: dict[str, dict] = {}
    trees = []
    all_roots = [k for k in steps if k not in parents and children.get(k)]
    for root in all_roots:
        seen: list[str] = []
        stack = [(root, 1)]
        depth = 1
        while stack:
            key, level = stack.pop()
            seen.append(key)
            depth = max(depth, level)
            for kid in children.get(key, []):
                stack.append((kid, level + 1))
        actives = 0
        for key in seen:
            step = steps[key]
            kids = children.get(key, [])
            got = []
            for piece in step["got"]:
                st = status(step, piece, kids)
                actives += st == "a"
                got.append([piece[0], round(piece[1]), piece[2], piece[4] or 0, route_by_pid.get(piece[4] or 0, 0), st])
            drafted = []
            for d in drafted_at.get(key, []):
                used = any(any(g[3] == d["ident"] for g in steps[k]["gave"]) for k in kids)
                st = ""
                if not used:
                    st = "a" if rosters.get(d["pid"]) == step["t"] else ("x" if rosters.get(d["pid"]) else ("r" if active.get(d["pid"]) is False else ""))
                actives += st == "a"
                drafted.append([d["name"], d["pick"], d["pid"], route_by_pid.get(d["pid"], 0), st])
            out_steps[key] = {
                "d": step["d"],
                "t": step["t"],
                "o": step["o"],
                "gave": [[p[0], round(p[1]), p[2], p[4] or 0, route_by_pid.get(p[4] or 0, 0)] for p in sorted(step["gave"], key=lambda r: (r[2] != "p", -r[1]))],
                "got": sorted(got, key=lambda r: (r[2] != "p", -r[1])),
                "draft": drafted,
                "kids": children.get(key, []),
            }
        first = min(steps[k]["d"] for k in seen)
        last = max(steps[k]["d"] for k in seen)
        trees.append({"root": root, "size": len(seen), "depth": depth, "from": first, "to": last, "active": actives, "team": steps[root]["t"]})
    trees.sort(key=lambda t: (-t["depth"], -t["size"], t["root"]))
    TREES.write_text(json.dumps({"asOf": today.isoformat(), "trees": trees, "steps": out_steps}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"trade trees: {len(trees)} trees, deepest {trees[0]['depth'] if trees else 0} trades, {len(out_steps)} steps", flush=True)


def main() -> None:
    build()


if __name__ == "__main__":
    main()
