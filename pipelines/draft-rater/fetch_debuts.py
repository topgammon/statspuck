"""NHL Debuts: first-game box scores for every player whose first NHL season is the current one.

Reads data/draft-rater/season_stats.json to find this season's newcomers, then one free game-log
call each:  https://api-web.nhle.com/v1/player/{id}/game-log/{season}/2

Writes data/draft-rater/debuts.json:
  {"season": 2026, "players": [{"playerId", "date", "team", "opponent", "home", "goals", "assists",
                                "points", "toi", "shots", "gp", "goalie": {...} | null}]}
Players already saved keep their debut line; only new names are fetched (plus GP refresh from stats).
"""

from __future__ import annotations

import json
from pathlib import Path

from fetch_nhl import get_json, season_calendar

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
OUT = DATA / "debuts.json"
STATS = DATA / "season_stats.json"


def build() -> None:
    last_complete, in_progress = season_calendar()
    season = in_progress if in_progress is not None else last_complete
    stats = json.loads(STATS.read_text(encoding="utf-8"))
    saved = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"season": season, "players": []}
    known = {p["playerId"]: p for p in saved.get("players", [])} if saved.get("season") == season else {}

    newcomers: dict[int, int] = {}
    for group in ("skaters", "goalies"):
        for pid, rows in stats[group].items():
            seasons = {row[0] for row in rows}
            if min(seasons) == season:
                newcomers[int(pid)] = sum(row[1] for row in rows if row[0] == season)

    out = []
    for pid, gp in newcomers.items():
        entry = known.get(pid)
        if entry is None:
            try:
                log = get_json(f"https://api-web.nhle.com/v1/player/{pid}/game-log/{season}{season + 1}/2", refresh=True).get("gameLog", [])
            except Exception as error:  # noqa: BLE001 - skip this player tonight
                print(f"debuts {pid}: {error}", flush=True)
                continue
            if not log:
                continue
            first = min(log, key=lambda g: (g.get("gameDate", ""), g.get("gameId", 0)))
            goalie = None
            if "savePctg" in first or "shotsAgainst" in first:
                goalie = {
                    "decision": first.get("decision"),
                    "shotsAgainst": first.get("shotsAgainst"),
                    "goalsAgainst": first.get("goalsAgainst"),
                    "savePct": first.get("savePctg"),
                }
            entry = {
                "playerId": pid,
                "date": first.get("gameDate"),
                "team": first.get("teamAbbrev"),
                "opponent": first.get("opponentAbbrev"),
                "home": first.get("homeRoadFlag") == "H",
                "goals": first.get("goals", 0),
                "assists": first.get("assists", 0),
                "points": first.get("points", 0),
                "shots": first.get("shots"),
                "toi": first.get("toi"),
                "goalie": goalie,
            }
        entry["gp"] = gp
        out.append(entry)
    out.sort(key=lambda p: p.get("date") or "", reverse=True)
    OUT.write_text(json.dumps({"season": season, "players": out}, separators=(",", ":")), encoding="utf-8")
    print(f"debuts: {len(out)} NHL debuts in {season}-{str(season + 1)[2:]} -> {OUT.name}", flush=True)


if __name__ == "__main__":
    build()
