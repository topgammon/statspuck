"""NHL EDGE skating data (puck and player tracking, 2021-22 on) for the Skills Skating axis.

Free public endpoint, one call per player-season:
  https://api-web.nhle.com/v1/edge/skater-detail/{playerId}/{season}/2
It returns top skating speed and bursts over 20 mph, each with a league percentile.

Writes data/draft-rater/edge.json:
  {"players": {playerId: {seasonStart: [topSpeedMph, speedPct, bursts20, burstsPct]}}}
Finished seasons are kept from the last saved file, so a nightly run only refreshes the
season in progress (about one call per active skater). If the API is down, saved data stays.
"""

from __future__ import annotations

import json
from pathlib import Path

from fetch_nhl import get_json, season_calendar

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
OUT = DATA / "edge.json"
NHLERS = DATA / "nhlers.json"
FIRST_EDGE_SEASON = 2021
SEASONS_BACK = 3  # matches the three-season Skills window


def _one(player_id: str, season: int) -> list | None:
    url = f"https://api-web.nhle.com/v1/edge/skater-detail/{player_id}/{season}{season + 1}/2"
    payload = get_json(url, refresh=True)
    speed = (payload.get("skatingSpeed") or {}).get("speedMax") or {}
    bursts = (payload.get("skatingSpeed") or {}).get("burstsOver20") or {}
    if speed.get("imperial") is None:
        return None
    return [
        round(float(speed["imperial"]), 2),
        round(float(speed.get("percentile") or 0), 4),
        int(bursts.get("value") or 0),
        round(float(bursts.get("percentile") or 0), 4),
    ]


def build() -> None:
    saved = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"players": {}}
    players: dict[str, dict[str, list]] = saved.get("players", {})
    last_complete, in_progress = season_calendar()
    newest = in_progress if in_progress is not None else last_complete
    seasons = [s for s in range(max(FIRST_EDGE_SEASON, newest - SEASONS_BACK + 1), newest + 1)]
    nhlers = json.loads(NHLERS.read_text(encoding="utf-8"))["players"]

    calls = 0
    failures = 0
    for pid, player in nhlers.items():
        if player.get("g") == "G":
            continue
        played = {row[0] for row in player.get("ss", []) if row[1] > 0}
        for season in seasons:
            if season not in played:
                continue
            have = players.get(pid, {}).get(str(season))
            # Finished seasons never change; only the live season is refreshed.
            if have is not None and season <= last_complete:
                continue
            try:
                row = _one(pid, season)
                calls += 1
            except Exception as error:  # noqa: BLE001 - keep going, keep saved data
                failures += 1
                if failures <= 5:
                    print(f"edge {pid} {season}: {error}", flush=True)
                continue
            if row:
                players.setdefault(pid, {})[str(season)] = row
            if calls and calls % 200 == 0:
                print(f"edge: {calls} calls", flush=True)
                OUT.write_text(json.dumps({"players": players}, separators=(",", ":")), encoding="utf-8")
    OUT.write_text(json.dumps({"players": players}, separators=(",", ":")), encoding="utf-8")
    print(f"edge: {len(players)} skaters, {calls} calls, {failures} failures -> {OUT.name}", flush=True)


if __name__ == "__main__":
    build()
