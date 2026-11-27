"""IRON MAN: true consecutive-games streaks (340+ games in a row without missing one).

Season totals cannot tell a missed game in October from one in March, so for players who
might have a long streak we compare every game they played with their team's schedule:

  player game log:  https://api-web.nhle.com/v1/player/{id}/game-log/{season}/2
  team schedule:    https://api-web.nhle.com/v1/club-schedule-season/{team}/{season}

A streak breaks when his team plays a regular-season game he does not. After a trade the
games between his last game for the old team and his first for the new one never count as
missed (the trade date is not in the feed). The season in progress counts.

Candidates come from season totals: a run of back-to-back seasons where every middle season
was (nearly) complete and the run adds up to 340+ games. Nobody else can reach 340 in a row.

Writes data/draft-rater/ironman.json:
  {"seasons": {pid: {season: [head, tail, longest, full, gp]}},
   "players": {pid: {"best": n, "from": "YYYY-MM-DD", "to": "...", "current": n}}}
Finished seasons are kept from the saved file; only the season in progress is re-read nightly.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

from fetch_nhl import get_json, season_calendar

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
OUT = DATA / "ironman.json"
STATS = DATA / "season_stats.json"
CANDIDATE_GAMES = 340


def season_length(season: int) -> int:
    return {2012: 48, 2019: 68, 2020: 56}.get(season, 82)


def candidates(stats: dict, in_progress: int | None) -> dict[str, list[int]]:
    """Player id -> seasons worth reading game logs for."""
    out: dict[str, list[int]] = {}
    for group in ("skaters", "goalies"):
        for pid, rows in stats[group].items():
            gp: dict[int, int] = {}
            for row in rows:
                gp[row[0]] = gp.get(row[0], 0) + row[1]
            years = sorted(gp)
            best: list[int] = []
            run: list[int] = []
            for year in years:
                if run and year != run[-1] + 1:
                    run = []
                run.append(year)
                # A middle season must be (nearly) complete or the run is broken there.
                while len(run) > 2 and any(gp[y] < season_length(y) - 3 for y in run[1:-1]):
                    run = run[1:]
                if sum(gp[y] for y in run) >= CANDIDATE_GAMES and len(run) >= len(best):
                    best = list(run)
            if best:
                seasons = set(best)
                if in_progress is not None and in_progress in gp and best[-1] >= in_progress - 1:
                    seasons.add(in_progress)
                out[pid] = sorted(seasons)
    return out


_schedules: dict[tuple[str, int], list[tuple[int, str]]] = {}


def team_games(team: str, season: int, live: bool) -> list[tuple[int, str]]:
    """Completed regular-season games for a team: (gameId, date), in order."""
    key = (team, season)
    if key not in _schedules:
        payload = get_json(f"https://api-web.nhle.com/v1/club-schedule-season/{team}/{season}{season + 1}", refresh=live)
        today = date.today().isoformat()
        games = [
            (g["id"], g["gameDate"])
            for g in payload.get("games", [])
            if g.get("gameType") == 2 and (g.get("gameState") in {"OFF", "FINAL"} or g.get("gameDate", "9") < today)
        ]
        _schedules[key] = sorted(games, key=lambda item: (item[1], item[0]))
    return _schedules[key]


def season_summary(pid: str, season: int, live: bool) -> list[int] | None:
    """[head, tail, longest, full, gp] for one player-season, or None if he did not play."""
    log = get_json(f"https://api-web.nhle.com/v1/player/{pid}/game-log/{season}{season + 1}/2", refresh=live).get("gameLog", [])
    if not log:
        return None
    played = sorted(((g["gameDate"], g["gameId"], g["teamAbbrev"]) for g in log))
    mine = {g[1] for g in played}
    # Stints in order: each team he played for this season, first to last game.
    stints: list[tuple[str, str, str]] = []
    for day, _gid, team in played:
        if stints and stints[-1][0] == team:
            stints[-1] = (team, stints[-1][1], day)
        else:
            stints.append((team, day, day))
    sequence: list[bool] = []
    for index, (team, first, last) in enumerate(stints):
        games = team_games(team, season, live)
        lo = "0000" if index == 0 else first
        hi = "9999" if index == len(stints) - 1 else last
        sequence.extend(gid in mine for gid, day in games if lo <= day <= hi)
    if not sequence:
        return None
    head = 0
    while head < len(sequence) and sequence[head]:
        head += 1
    tail = 0
    while tail < len(sequence) and sequence[-1 - tail]:
        tail += 1
    longest = run = 0
    for hit in sequence:
        run = run + 1 if hit else 0
        longest = max(longest, run)
    full = int(all(sequence))
    return [head, tail, longest, full, len(mine)]


def streaks(by_season: dict[str, list[int]]) -> dict:
    """Best streak ever and the streak still running, across seasons."""
    best = current = 0
    best_span = ("", "")
    start = ""
    prev = None
    for key in sorted(by_season, key=int):
        season = int(key)
        head, tail, longest, full, _gp = by_season[key]
        if prev is not None and season != prev + 1:
            current = 0
        if full:
            if current == 0:
                start = str(season)
            current += head
        else:
            current += head
            if current > best:
                best, best_span = current, (start or str(season), str(season))
            if longest > best:
                best, best_span = longest, (str(season), str(season))
            current = tail
            start = str(season) if tail else ""
        if current > best:
            best, best_span = current, (start or str(season), str(season))
        prev = season
    return {"best": best, "from": best_span[0], "to": best_span[1], "current": current, "last": prev}


def build() -> None:
    saved = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"seasons": {}, "players": {}}
    seasons: dict[str, dict[str, list[int]]] = saved.get("seasons", {})
    stats = json.loads(STATS.read_text(encoding="utf-8"))
    last_complete, in_progress = season_calendar()
    wanted = candidates(stats, in_progress)
    jobs: list[tuple[str, int, bool]] = []
    for pid, years in wanted.items():
        mine = seasons.setdefault(pid, {})
        for season in years:
            live = in_progress is not None and season == in_progress
            if str(season) in mine and not live:
                continue
            jobs.append((pid, season, live))

    def run(job: tuple[str, int, bool]):
        pid, season, live = job
        try:
            return job, season_summary(pid, season, live), None
        except Exception as error:  # noqa: BLE001 - keep saved data
            return job, None, error

    calls = failures = 0
    # A few requests at a time: each call is mostly waiting on the network.
    with ThreadPoolExecutor(max_workers=6) as pool:
        for (pid, season, _live), summary, error in pool.map(run, jobs):
            calls += 1
            if error is not None:
                failures += 1
                if failures <= 5:
                    print(f"ironman {pid} {season}: {error}", flush=True)
                continue
            if summary:
                seasons[pid][str(season)] = summary
            if calls % 250 == 0:
                print(f"ironman: {calls}/{len(jobs)} seasons read", flush=True)
    players = {}
    for pid, by_season in seasons.items():
        if not by_season:
            continue
        result = streaks(by_season)
        # A streak is only "current" if his last season on file is the newest one.
        newest = in_progress if in_progress is not None else last_complete
        if result["last"] != newest:
            result["current"] = 0
        del result["last"]
        players[pid] = result
    OUT.write_text(json.dumps({"seasons": seasons, "players": players}, separators=(",", ":")), encoding="utf-8")
    print(f"ironman: {len(wanted)} candidates, {calls} seasons read, {failures} failures -> {OUT.name}", flush=True)


if __name__ == "__main__":
    build()
