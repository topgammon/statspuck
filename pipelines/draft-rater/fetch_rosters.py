"""Record each player's current NHL team from the official roster feed.

https://api-web.nhle.com/v1/roster/{TEAM}/current

Writes data/draft-rater/rosters.json as {playerId: teamAbbr}. A player who is
not on any current NHL roster is simply absent. If the feed fails, the last
saved file is kept so a bad night never blanks the site.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from teams import FRANCHISES

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / "data" / "draft-rater" / "rosters.json"
USER_AGENT = "DraftRaterBot/1.0 (hockey stats research)"


def fetch_team(abbr: str) -> list[int]:
    url = f"https://api-web.nhle.com/v1/roster/{abbr}/current"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    delay = 0.5
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                payload = json.load(response)
            ids = []
            for key in ("forwards", "defensemen", "goalies"):
                ids.extend(int(row["id"]) for row in payload.get(key) or [] if row.get("id"))
            return ids
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return []
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(delay)
        delay *= 2
    return []


def main() -> None:
    rosters: dict[str, str] = {}
    try:
        for abbr in sorted(FRANCHISES):
            for player_id in fetch_team(abbr):
                rosters[str(player_id)] = abbr
            time.sleep(0.2)
    except Exception as error:  # noqa: BLE001 - keep yesterday's file on any network failure
        print(f"rosters: fetch failed ({error}); keeping the saved file", flush=True)
        return
    if len(rosters) < 500:
        print(f"rosters: only {len(rosters)} players found; keeping the saved file", flush=True)
        return
    OUT.write_text(json.dumps(dict(sorted(rosters.items(), key=lambda item: int(item[0])))), encoding="utf-8")
    print(f"rosters: {len(rosters)} players on {len(set(rosters.values()))} teams", flush=True)


if __name__ == "__main__":
    main()
