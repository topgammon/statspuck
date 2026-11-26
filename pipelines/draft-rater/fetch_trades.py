"""Trade track record: every NHL trade since 2009-10, valued by what actually happened.

Source: the public trade log pages on capwages.com (one page per season, allowed by its robots.txt).
For each team in each trade we add up the Impact (the Draft Rater's own metric) of what it received
minus what it sent, over the five seasons that follow:

  - a player counts for the five seasons from the trade (a mid-season deal counts its first season
    at half). Seasons that have not been played yet are projected from his latest full season,
    fading 8% a year, and only if he is still active.
  - a draft pick counts for the first five seasons of the player taken with it. Seasons that have
    not happened yet use the Draft Rater's expected Impact for that slot. A pick not made yet uses
    the middle slot of its round.

Writes data/draft-rater/trades.json. If the site is down the last saved file is kept.
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

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
OUT = DATA / "trades.json"
NAMES = DATA / "player_names.json"
USER_AGENT = "StatsPuckBot/1.0 (hockey stats research; contact via statspuck.com)"
FIRST_SEASON = 2009
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


def season_pages(today: dt.date) -> list[tuple[str, list[dict]]]:
    start = today.year if today.month >= 7 else today.year - 1
    out = []
    for year in range(FIRST_SEASON, start + 1):
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
        pages = season_pages(today)
    except Exception as error:  # noqa: BLE001 - keep the saved file
        print(f"trades: fetch failed ({error}); keeping the saved file", flush=True)
        return

    conn = connect()
    _picks, seasons = load_inputs(conn)
    _toi, save_avg = league_context(seasons)
    last_complete, in_progress = season_calendar(today)
    progress = season_progress(seasons, in_progress)
    current = in_progress or last_complete
    names = fill_names(conn)
    active = {int(k): v for k, v in json.loads((DATA / "active.json").read_text(encoding="utf-8")).items()}

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

    def expected_increment(slot: int, h: int) -> float:
        index = min(max(slot, 1), curves["maxPick"])
        out = 0.0
        for family, weight in (("skater", 0.9), ("goalie", 0.1)):
            table = curves[family]
            now = table.get(str(h), [0] * (index + 1))[index]
            before = table.get(str(h - 1), [0] * (index + 1))[index] if h > 1 else 0.0
            out += weight * max(0.0, now - before)
        return out

    def player_value(name: str, season0: int, first_weight: float) -> float:
        candidates = by_name.get(norm(name), [])
        if not candidates:
            return 0.0
        if len(candidates) > 1:
            candidates = sorted(candidates, key=lambda pid: -sum(games[pid].get(s, 0) for s in range(season0 - 1, season0 + 3)))
        pid = candidates[0]
        own = impact.get(pid, {})
        # Full-season-equivalent Impact for each season, used to project seasons not played yet.
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
                # The season in progress counts as the full-season equivalent so a young season does not look like a bust.
                total += weight * (full(season) or (latest or 0.0))
            elif active.get(pid) and latest:
                total += weight * latest * (FADE ** (season - current))
        return total

    def pick_value(item: dict) -> float:
        year = int(item.get("year") or 0)
        rnd = int(item.get("round") or 1)
        overall = item.get("overall")
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
    unknown_slugs = set()
    for label, trades in pages:
        for trade in trades:
            # The trade id starts with its date, which is the one format that never varies.
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
            got: dict[str, list[tuple[str, float]]] = defaultdict(list)
            gave: dict[str, list[tuple[str, float]]] = defaultdict(list)
            for item in trade["items"]:
                kind = item.get("type")
                if kind == "player":
                    value = player_value(item["name"], season0, first_weight)
                    # Salary a team keeps paying is not value it gets.
                    label_text = re.sub(r"^(.*), (.*)$", r"\2 \1", item["name"])
                elif kind == "draft_pick":
                    value = pick_value(item)
                    label_text = f"{item.get('year')} R{item.get('round')}"
                else:
                    continue
                src = SLUG_TO_ABBR.get(item.get("from", ""))
                dst = SLUG_TO_ABBR.get(item.get("to", ""))
                if dst:
                    got[dst].append((label_text, value))
                if src:
                    gave[src].append((label_text, value))
            for abbr in {t for t in teams if t}:
                incoming = got.get(abbr, [])
                outgoing = gave.get(abbr, [])
                net = sum(v for _, v in incoming) - sum(v for _, v in outgoing)
                top = lambda rows: [[n, round(v)] for n, v in sorted(rows, key=lambda r: -r[1])[:4]]  # noqa: E731
                sides.append({"id": trade["id"], "d": date, "t": abbr, "net": round(net, 1), "in": top(incoming), "out": top(outgoing)})

    if unknown_slugs:
        print(f"trades: unmapped teams {sorted(unknown_slugs)}", flush=True)
    if len(sides) < 1500:
        print(f"trades: only {len(sides)} sides found; keeping the saved file", flush=True)
        return
    payload = {"asOf": today.isoformat(), "from": f"{FIRST_SEASON}-{str(FIRST_SEASON + 1)[2:]}", "horizon": HORIZON, "sides": sides}
    OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    conn.close()
    print(f"trades: {len(sides)} team sides from {len(pages)} seasons", flush=True)


def main() -> None:
    build()


if __name__ == "__main__":
    main()
