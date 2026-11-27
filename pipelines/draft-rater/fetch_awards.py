"""NHL awards and trophies for every player who has played since 2005-06 (Trophy Case).

Free official endpoint, one call per player:
  https://api-web.nhle.com/v1/player/{id}/landing   ->  "awards": [{trophy, seasons:[{seasonId, ...}]}]

Writes data/draft-rater/awards.json:
  {"asOf": "...", "players": {playerId: [[trophyName, [seasonStartYear, ...]], ...]}}
Only players with at least one award are stored. Trophies are handed out once a year, so
run.py refreshes this about once a month.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

from fetch_nhl import get_json

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
OUT = DATA / "awards.json"
STATS = DATA / "season_stats.json"


def awards_for(pid: str) -> tuple[str, list | None]:
    try:
        payload = get_json(f"https://api-web.nhle.com/v1/player/{pid}/landing", refresh=True)
    except Exception:  # noqa: BLE001 - skip; keep saved data for this player
        return pid, None
    out = []
    for award in payload.get("awards") or []:
        name = ((award.get("trophy") or {}).get("default") or "").strip()
        seasons = sorted({int(str(s.get("seasonId"))[:4]) for s in award.get("seasons") or [] if s.get("seasonId")})
        if name and seasons:
            out.append([name, seasons])
    return pid, out


def due(days: int = 30) -> bool:
    try:
        as_of = json.loads(OUT.read_text(encoding="utf-8")).get("asOf")
        return (date.today() - date.fromisoformat(as_of)).days >= days
    except (OSError, ValueError, TypeError):
        return True


def build() -> None:
    saved = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"players": {}}
    players: dict[str, list] = saved.get("players", {})
    stats = json.loads(STATS.read_text(encoding="utf-8"))
    ids = sorted(set(stats["skaters"]) | set(stats["goalies"]), key=int)
    done = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        for pid, result in pool.map(awards_for, ids):
            done += 1
            if result is None:
                continue
            if result:
                players[pid] = result
            else:
                players.pop(pid, None)
            if done % 500 == 0:
                print(f"awards: {done}/{len(ids)} players", flush=True)
    OUT.write_text(json.dumps({"asOf": date.today().isoformat(), "players": players}, separators=(",", ":")), encoding="utf-8")
    print(f"awards: {len(players)} players with awards -> {OUT.name}", flush=True)


if __name__ == "__main__":
    build()
