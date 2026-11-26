"""Record where every drafted player played in each season around his draft.

Source: the free NHL player feed, `seasonTotals` regular-season rows.

https://api-web.nhle.com/v1/player/{playerId}/landing

Writes data/draft-rater/league_seasons.json:
{playerId: {"y": draftYear, "s": [[[league, gp], ...] for D+0 .. D+6]}}

D+0 is the season before the draft (the draft origin). D+1 is the season that
starts after the draft. Leagues are stored raw; grade_quality.py turns them into
buckets (NHL, AHL, CHL, NCAA, ...). The file doubles as a cache: a player is only
refetched while his D+6 season is not complete yet.
"""

from __future__ import annotations

import json
import sqlite3
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

from fetch_nhl import season_calendar

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
DB_PATH = DATA / "nhl.sqlite"
OUT = DATA / "league_seasons.json"
USER_AGENT = "DraftRaterBot/1.0 (hockey stats research)"
SPAN = 6  # D+0 through D+6


def drafted() -> dict[int, int]:
    """playerId -> earliest draft year."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT player_id, MIN(draft_year) FROM picks WHERE player_id IS NOT NULL GROUP BY player_id"
    ).fetchall()
    conn.close()
    return {int(player_id): int(year) for player_id, year in rows}


def fetch_one(player_id: int) -> list[dict] | None:
    url = f"https://api-web.nhle.com/v1/player/{player_id}/landing"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    delay = 0.5
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.load(response).get("seasonTotals") or []
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return []
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                return None
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                return None
        time.sleep(delay)
        delay *= 2
    return None


def by_season(totals: list[dict], draft_year: int) -> list[list[list]]:
    """[[league, gp], ...] per season from D+0 to D+6, regular season only."""
    out: list[list[list]] = []
    for offset in range(SPAN + 1):
        start = draft_year - 1 + offset
        code = start * 10000 + start + 1
        leagues: dict[str, int] = {}
        for row in totals:
            if row.get("season") != code or row.get("gameTypeId") != 2:
                continue
            league = (row.get("leagueAbbrev") or "Other").strip()
            leagues[league] = leagues.get(league, 0) + int(row.get("gamesPlayed") or 0)
        out.append(sorted(([league, gp] for league, gp in leagues.items()), key=lambda item: -item[1]))
    return out


def main() -> None:
    last_complete, _in_progress = season_calendar(date.today())
    players = drafted()
    known: dict[str, dict] = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    # A player's window is final once his D+6 season (starting draft_year + 5) is complete.
    pending = [
        player_id
        for player_id, year in players.items()
        if str(player_id) not in known or year + 5 > last_complete
    ]
    print(f"league paths: {len(players)} players, {len(pending)} to fetch", flush=True)
    done = failed = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_one, player_id): player_id for player_id in pending}
        for future in as_completed(futures):
            player_id = futures[future]
            totals = future.result()
            done += 1
            if totals is None:
                failed += 1
                continue
            known[str(player_id)] = {"y": players[player_id], "s": by_season(totals, players[player_id])}
            if done % 500 == 0:
                print(f"  {done}/{len(pending)}", flush=True)
    OUT.write_text(json.dumps(dict(sorted(known.items(), key=lambda item: int(item[0]))), separators=(",", ":")), encoding="utf-8")
    print(f"league paths: saved {len(known)} players ({failed} failed, kept for next run)", flush=True)


if __name__ == "__main__":
    main()
