"""Record whether each drafted player is still active.

The NHL player landing feed is the source:

https://api-web.nhle.com/v1/player/{playerId}/landing

`isActive` is true for a player still on an NHL roster path, and false once
that career is over. Results are stored in data/active.json. A missing file
or a null value means unknown, which is not treated as retired.
"""

from __future__ import annotations

import json
import sqlite3
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
DB_PATH = DATA / "nhl.sqlite"
OUT = DATA / "active.json"
USER_AGENT = "DraftRating/0.1 (personal research; player active status)"


def player_ids() -> list[int]:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT DISTINCT player_id FROM picks WHERE player_id IS NOT NULL").fetchall()
    return [row[0] for row in rows]


def load_existing() -> dict[str, bool | None]:
    if not OUT.exists():
        return {}
    raw = json.loads(OUT.read_text(encoding="utf-8"))
    return {str(key): value for key, value in raw.items()}


def fetch_one(player_id: int) -> bool | None:
    url = f"https://api-web.nhle.com/v1/player/{player_id}/landing"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    delay = 0.4
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                payload = json.load(response)
            value = payload.get("isActive")
            return None if value is None else bool(value)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(delay)
        delay *= 2
    return None


def main() -> None:
    known = load_existing()
    pending = [player_id for player_id in player_ids() if str(player_id) not in known]
    print(f"active status: {len(known)} cached, {len(pending)} to fetch", flush=True)
    if not pending:
        return
    done = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(fetch_one, player_id): player_id for player_id in pending}
        for future in as_completed(futures):
            player_id = futures[future]
            known[str(player_id)] = future.result()
            done += 1
            if done % 250 == 0 or done == len(pending):
                OUT.write_text(json.dumps(dict(sorted(known.items(), key=lambda item: int(item[0])))), encoding="utf-8")
                yes = sum(1 for value in known.values() if value is True)
                no = sum(1 for value in known.values() if value is False)
                print(f"saved {len(known)} active {yes} retired {no}", flush=True)
    print(f"wrote {OUT.name}", flush=True)


if __name__ == "__main__":
    main()
