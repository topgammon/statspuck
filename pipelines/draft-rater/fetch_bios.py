"""Player vitals (height, weight, hand, birth date and place) and undrafted NHL graduates.

Source: the free NHL player feed.

    https://api-web.nhle.com/v1/player/{playerId}/landing

Who gets fetched:
  - every drafted player with an NHL player id, and
  - every NHL player since 2005-06 with 25+ regular-season games who is not in our
    draft table. The landing feed's draftDetails tells us whether he was ever drafted
    (older drafts count too). No draftDetails means undrafted.

Writes data/draft-rater/bios.json, which doubles as a cache:
{playerId: {"n": name, "pos": "C", "h": inches, "w": lbs, "sc": "L", "bd": "1997-01-13",
            "city": ..., "prov": ..., "ctry": "CAN", "dr": true, "act": true, "team": "EDM",
            "nhl": [[seasonStart, teamName, gp], ...] (undrafted only),
            "path": [[seasonStart, league, teamName, gp], ...] (undrafted only),
            "at": "2026-11-26"}}

Retired players are fetched once. Active players are refreshed after REFRESH_DAYS so
weight and team stay current. A failed call keeps the last saved record.
"""

from __future__ import annotations

import json
import sqlite3
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
DB_PATH = DATA / "nhl.sqlite"
OUT = DATA / "bios.json"
USER_AGENT = "StatsPuckBot/1.0 (hockey stats research)"
UNDRAFTED_MIN_GP = 25
REFRESH_DAYS = 30


def candidates() -> tuple[set[int], set[int]]:
    """(drafted player ids, possible undrafted player ids with 25+ NHL games since 2005-06)."""
    conn = sqlite3.connect(DB_PATH)
    drafted = {int(row[0]) for row in conn.execute("SELECT DISTINCT player_id FROM picks WHERE player_id IS NOT NULL")}
    heavy = {
        int(row[0])
        for row in conn.execute("SELECT player_id FROM player_seasons GROUP BY player_id HAVING SUM(gp) >= ?", (UNDRAFTED_MIN_GP,))
    }
    conn.close()
    return drafted, heavy - drafted


def fetch_one(player_id: int) -> dict | None:
    url = f"https://api-web.nhle.com/v1/player/{player_id}/landing"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    delay = 0.5
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return {}
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                return None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == 3:
                return None
        time.sleep(delay)
        delay *= 2
    return None


def _text(value) -> str | None:
    if isinstance(value, dict):
        value = value.get("default")
    text = (value or "").strip() if isinstance(value, str) else None
    return text or None


def summarize(payload: dict, undrafted_check: bool) -> dict:
    first = _text(payload.get("firstName")) or ""
    last = _text(payload.get("lastName")) or ""
    record = {
        "n": f"{first} {last}".strip() or None,
        "pos": payload.get("position"),
        "h": payload.get("heightInInches"),
        "w": payload.get("weightInPounds"),
        "sc": payload.get("shootsCatches"),
        "bd": payload.get("birthDate"),
        "city": _text(payload.get("birthCity")),
        "prov": _text(payload.get("birthStateProvince")),
        "ctry": payload.get("birthCountry"),
        "dr": bool(payload.get("draftDetails")),
        "act": payload.get("isActive"),
        "team": payload.get("currentTeamAbbrev"),
        "at": date.today().isoformat(),
    }
    if undrafted_check and not record["dr"]:
        regular = [row for row in payload.get("seasonTotals") or [] if row.get("gameTypeId") == 2]
        nhl: list[list] = []
        path: list[list] = []
        for row in regular:
            start = int(str(row.get("season"))[:4]) if row.get("season") else None
            if start is None:
                continue
            league = (row.get("leagueAbbrev") or "Other").strip()
            team = _text(row.get("teamName")) or ""
            gp = int(row.get("gamesPlayed") or 0)
            if league == "NHL":
                nhl.append([start, team, gp])
            path.append([start, league, team, gp])
        record["nhl"] = nhl
        record["path"] = path
    return record


def main() -> None:
    drafted, maybe_undrafted = candidates()
    known: dict[str, dict] = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    stale = (date.today() - timedelta(days=REFRESH_DAYS)).isoformat()

    def due(player_id: int) -> bool:
        record = known.get(str(player_id))
        if not record:
            return True
        return bool(record.get("act")) and (record.get("at") or "") < stale

    wanted = drafted | maybe_undrafted
    pending = sorted(player_id for player_id in wanted if due(player_id))
    print(f"bios: {len(drafted)} drafted, {len(maybe_undrafted)} undrafted candidates, {len(pending)} to fetch", flush=True)
    done = failed = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_one, player_id): player_id for player_id in pending}
        for future in as_completed(futures):
            player_id = futures[future]
            payload = future.result()
            done += 1
            if payload is None:
                failed += 1
                continue
            if not payload:
                continue
            known[str(player_id)] = summarize(payload, undrafted_check=player_id in maybe_undrafted)
            if done % 500 == 0:
                print(f"  {done}/{len(pending)}", flush=True)
    # Drop players who are no longer candidates (e.g. a pick removed from the draft table).
    kept = {key: value for key, value in known.items() if int(key) in wanted}
    OUT.write_text(
        json.dumps(dict(sorted(kept.items(), key=lambda item: int(item[0]))), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    undrafted = sum(1 for value in kept.values() if value.get("dr") is False)
    print(f"bios: saved {len(kept)} players, {undrafted} undrafted ({failed} failed, kept for next run)", flush=True)


if __name__ == "__main__":
    main()
