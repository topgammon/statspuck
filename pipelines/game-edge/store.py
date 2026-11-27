"""Game store: one small JSON file per finished NHL regular-season game.

For every game we read three free NHL endpoints once and keep only what Ref Watch and
Game Edge need:

  https://api-web.nhle.com/v1/gamecenter/{id}/play-by-play   shots, goals, penalties, faceoffs
  https://api-web.nhle.com/v1/gamecenter/{id}/right-rail      the two referees
  https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={id}   who was on the ice

Finished games never change, so a stored game is never fetched again. The store lives in
pipelines/game-edge/store/ (gitignored); GitHub Actions keeps it between nightly runs with
actions/cache. If the cache is ever lost the next run simply refetches.

Compact game file:
  {"id", "season", "date", "home", "away", "len" (game seconds), "refs": [name, name],
   "roster": {pid: [side, pos, name]},     side 0 = away, 1 = home; pos C/L/R/D/G
   "ev": [[t, kind, side, sit, x, y, p1, p2, extra], ...],
   "sh": [[pid, start, end], ...]}           5-on-5 matching uses these
Event kinds: S shot on goal, G goal, M missed, B blocked, P penalty, F faceoff win,
T takeaway, V giveaway. x/y are flipped so the acting team always attacks toward +x
(their goal line is at x = +89). sit = "skaters for-against" from the acting side, with
"e" appended when the opposing net is empty. p1 = shooter / offender / winner,
p2 = goalie / drawn-by. extra = shot type, or "descKey|typeCode|duration" for penalties.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STORE = ROOT / "store"
USER_AGENT = "StatsPuck-data/1.0 (hockey analytics; caches responses)"
FINAL_STATES = {"OFF", "FINAL"}


def get_json(url: str, tries: int = 4) -> dict:
    delay = 1.0
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as resp:
                return json.load(resp)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt == tries - 1:
                raise
            if isinstance(error, urllib.error.HTTPError) and error.code == 404:
                raise
            time.sleep(delay)
            delay *= 2
    return {}


def _clock(value: str | None) -> int:
    if not value:
        return 0
    mm, ss = value.split(":")
    return int(mm) * 60 + int(ss)


def _game_time(period: int, clock: str | None) -> int:
    return (period - 1) * 1200 + _clock(clock)


def _name(value) -> str:
    if isinstance(value, dict):
        return value.get("default") or ""
    return value or ""


def extract(game_id: int) -> dict | None:
    pbp = get_json(f"https://api-web.nhle.com/v1/gamecenter/{game_id}/play-by-play")
    if pbp.get("gameState") not in FINAL_STATES or pbp.get("gameType") != 2:
        return None
    home_id = pbp["homeTeam"]["id"]
    roster: dict[str, list] = {}
    team_of: dict[int, int] = {}
    for spot in pbp.get("rosterSpots", []):
        side = 1 if spot["teamId"] == home_id else 0
        name = f"{_name(spot.get('firstName'))} {_name(spot.get('lastName'))}".strip()
        roster[str(spot["playerId"])] = [side, spot.get("positionCode") or "F", name]
        team_of[spot["playerId"]] = side

    events: list[list] = []
    last_t = 0
    for play in pbp.get("plays", []):
        kind = play.get("typeDescKey")
        period = (play.get("periodDescriptor") or {}).get("number") or 1
        if period > 4:  # shootout
            continue
        t = _game_time(period, play.get("timeInPeriod"))
        last_t = max(last_t, t)
        d = play.get("details") or {}
        code = {
            "shot-on-goal": "S",
            "goal": "G",
            "missed-shot": "M",
            "blocked-shot": "B",
            "penalty": "P",
            "faceoff": "F",
            "takeaway": "T",
            "giveaway": "V",
        }.get(kind)
        if not code:
            continue
        if code in "SGMB":
            p1 = d.get("scoringPlayerId") if code == "G" else d.get("shootingPlayerId")
            side = team_of.get(p1)
            if side is None:
                side = 1 if d.get("eventOwnerTeamId") == home_id else 0
            p2 = d.get("goalieInNetId")
            extra = d.get("shotType") or ""
        elif code == "P":
            p1 = d.get("committedByPlayerId") or d.get("servedByPlayerId")
            side = 1 if d.get("eventOwnerTeamId") == home_id else 0
            p2 = d.get("drawnByPlayerId")
            extra = f"{d.get('descKey') or ''}|{d.get('typeCode') or ''}|{d.get('duration') or 0}"
        elif code == "F":
            p1 = d.get("winningPlayerId")
            side = 1 if d.get("eventOwnerTeamId") == home_id else 0
            p2 = d.get("losingPlayerId")
            extra = ""
        else:
            p1 = d.get("playerId")
            side = 1 if d.get("eventOwnerTeamId") == home_id else 0
            p2 = None
            extra = ""
        x, y = d.get("xCoord"), d.get("yCoord")
        if x is not None and y is not None:
            # Make the acting team attack toward +x.
            home_defends_right = play.get("homeTeamDefendingSide") == "right"
            attacks_left = home_defends_right if side == 1 else not home_defends_right
            if attacks_left:
                x, y = -x, -y
        sit = play.get("situationCode") or "1551"
        try:
            away_g, away_s, home_s, home_g = (int(c) for c in sit)
        except ValueError:
            away_g, away_s, home_s, home_g = 1, 5, 5, 1
        mine, theirs = (home_s, away_s) if side == 1 else (away_s, home_s)
        their_goalie = away_g if side == 1 else home_g
        strength = f"{mine}{theirs}" + ("" if their_goalie else "e")
        events.append([t, code, side, strength, x, y, p1, p2, extra])

    rail = get_json(f"https://api-web.nhle.com/v1/gamecenter/{game_id}/right-rail")
    refs = [_name(r.get("fullName")) for r in ((rail.get("gameInfo") or {}).get("referees") or [])]

    shifts: list[list] = []
    try:
        sc = get_json(f"https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={game_id}")
        for row in sc.get("data", []):
            if row.get("typeCode") != 517 or not row.get("startTime") or not row.get("endTime"):
                continue
            period = row.get("period") or 1
            if period > 4:
                continue
            start = _game_time(period, row["startTime"])
            end = _game_time(period, row["endTime"])
            if end > start:
                shifts.append([row["playerId"], start, end])
    except Exception:  # noqa: BLE001 - shifts are optional
        shifts = []

    return {
        "id": game_id,
        "season": pbp.get("season"),
        "date": pbp.get("gameDate"),
        "home": pbp["homeTeam"]["abbrev"],
        "away": pbp["awayTeam"]["abbrev"],
        "len": max(3600, last_t),
        "score": [pbp["awayTeam"].get("score", 0), pbp["homeTeam"].get("score", 0)],
        "refs": [r for r in refs if r],
        "roster": roster,
        "ev": events,
        "sh": shifts,
    }


def season_game_ids(season: int) -> list[int]:
    """Finished regular-season game ids for a season (season = start year)."""
    standings = get_json("https://api-web.nhle.com/v1/standings/now")
    abbrevs = sorted({row["teamAbbrev"]["default"] for row in standings.get("standings", [])})
    ids: set[int] = set()
    for abbr in abbrevs:
        try:
            data = get_json(f"https://api-web.nhle.com/v1/club-schedule-season/{abbr}/{season}{season + 1}")
        except Exception:  # noqa: BLE001 - a team missing that season
            continue
        for game in data.get("games", []):
            if game.get("gameType") == 2 and game.get("gameState") in FINAL_STATES:
                ids.add(int(game["id"]))
    return sorted(ids)


def path_for(game_id: int) -> Path:
    return STORE / str(game_id)[:4] / f"{game_id}.json"


def sync(seasons: list[int], threads: int = 6) -> int:
    todo: list[int] = []
    for season in seasons:
        ids = season_game_ids(season)
        missing = [g for g in ids if not path_for(g).exists()]
        print(f"game-edge store: {season}-{str(season + 1)[2:]} {len(ids)} finished games, {len(missing)} to fetch", flush=True)
        todo.extend(missing)

    done = 0
    failures = 0

    def one(game_id: int) -> bool:
        record = extract(game_id)
        if record is None:
            return False
        path = path_for(game_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record, separators=(",", ":")), encoding="utf-8")
        return True

    with ThreadPoolExecutor(max_workers=threads) as pool:
        for game_id, result in zip(todo, pool.map(lambda g: _safe(one, g), todo)):
            if result is True:
                done += 1
            elif result is not False:
                failures += 1
                if failures <= 5:
                    print(f"  game {game_id}: {result}", flush=True)
            if done and done % 250 == 0:
                print(f"  stored {done} games", flush=True)
    print(f"game-edge store: {done} new games, {failures} failures", flush=True)
    return done


def _safe(fn, arg):
    try:
        return fn(arg)
    except Exception as error:  # noqa: BLE001
        return str(error)


def load_games(seasons: list[int]) -> list[dict]:
    games: list[dict] = []
    for season in seasons:
        folder = STORE / str(season)
        if not folder.exists():
            continue
        for path in sorted(folder.glob("*.json")):
            games.append(json.loads(path.read_text(encoding="utf-8")))
    return games
