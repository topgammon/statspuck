"""NHL playoff box scores and Playoff Impact for every player, 2005-06 on.

Same free stats endpoints as fetch_nhl.py, with gameTypeId=3 (playoffs) instead of 2.
Playoff Impact uses the exact regular-season Impact formulas in grade_quality.py,
so a playoff game is worth the same as a regular-season game on the Impact scale.

Writes data/draft-rater/playoff_stats.json. Finished playoff years are kept from the
last saved file, so a nightly run only re-downloads the most recent spring. If the
API is down, the last saved file stays in place.

Skater row: [season, gp, g, a, pts, plusMinus, pim, shots, blocks, foWins, foLosses, toiPerGameSec, impact]
Goalie row: [season, gp, starts, shotsAgainst, saves, goalsAgainst, toiSec, impact]
"""

from __future__ import annotations

import json
import urllib.parse
from pathlib import Path

from fetch_nhl import FIRST_DRAFT_YEAR, get_json, season_calendar
from grade_quality import goalie_impact, ice_group, skater_impact

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
OUT = DATA / "playoff_stats.json"
NO_PLAYOFFS = {2004}  # lockout


def _url(report: str, season_start: int, start: int) -> str:
    query = urllib.parse.urlencode(
        {
            "limit": "100",
            "start": str(start),
            "sort": "playerId",
            "cayenneExp": f"seasonId={season_start}{season_start + 1} and gameTypeId=3",
        }
    )
    return f"https://api.nhle.com/stats/rest/en/{report}?{query}"


def _report(report: str, season_start: int, refresh: bool) -> dict[int, dict]:
    found: dict[int, dict] = {}
    start = 0
    for _page in range(20):
        payload = get_json(_url(report, season_start, start), refresh=refresh)
        batch = payload.get("data", [])
        total = payload.get("total", 0)
        if not batch:
            break
        for row in batch:
            if row.get("playerId"):
                found[row["playerId"]] = row
        start += len(batch)
        if start >= total:
            break
    return found


def _season(season_start: int, refresh: bool) -> tuple[dict[str, list], dict[str, list]]:
    skaters: dict[str, list] = {}
    goalies: dict[str, list] = {}

    summary = _report("skater/summary", season_start, refresh)
    if summary:
        realtime = _report("skater/realtime", season_start, refresh)
        faceoffs = _report("skater/faceoffwins", season_start, refresh)
        toi = _report("skater/timeonice", season_start, refresh)
        for pid, row in summary.items():
            gp = int(row.get("gamesPlayed") or 0)
            if gp <= 0:
                continue
            ice = toi.get(pid, {})
            fo = faceoffs.get(pid, {})
            calc = {
                "gp": gp,
                "goals": row.get("goals"),
                "assists": row.get("assists"),
                "points": row.get("points"),
                "sh_points": row.get("shPoints"),
                "shots": row.get("shots"),
                "pim": row.get("penaltyMinutes"),
                "plus_minus": row.get("plusMinus"),
                "blocks": realtime.get(pid, {}).get("blockedShots"),
                "fo_wins": fo.get("totalFaceoffWins"),
                "fo_losses": fo.get("totalFaceoffLosses"),
                "ev_toi": ice.get("evTimeOnIce"),
                "pp_toi": ice.get("ppTimeOnIce"),
                "sh_toi": ice.get("shTimeOnIce"),
                "toi": row.get("timeOnIcePerGame"),
            }
            group = ice_group(row.get("positionCode"), "F")
            impact = skater_impact(calc, group)
            skaters[str(pid)] = [
                season_start,
                gp,
                int(row.get("goals") or 0),
                int(row.get("assists") or 0),
                int(row.get("points") or 0),
                int(row.get("plusMinus") or 0),
                int(row.get("penaltyMinutes") or 0),
                int(row.get("shots") or 0),
                int(calc["blocks"] or 0),
                int(calc["fo_wins"] or 0),
                int(calc["fo_losses"] or 0),
                int(round(row.get("timeOnIcePerGame") or 0)),
                round(impact, 1),
            ]

    goalie_rows = _report("goalie/summary", season_start, refresh)
    shots_all = sum(int(row.get("shotsAgainst") or 0) for row in goalie_rows.values())
    saves_all = sum(int(row.get("saves") or 0) for row in goalie_rows.values())
    league_save = saves_all / shots_all if shots_all else None
    for pid, row in goalie_rows.items():
        gp = int(row.get("gamesPlayed") or 0)
        if gp <= 0:
            continue
        calc = {"gp": gp, "starts": row.get("gamesStarted"), "shots": row.get("shotsAgainst"), "saves": row.get("saves"), "save_pct": row.get("savePct")}
        impact = goalie_impact(calc, league_save)
        goalies[str(pid)] = [
            season_start,
            gp,
            int(row.get("gamesStarted") or 0),
            int(row.get("shotsAgainst") or 0),
            int(row.get("saves") or 0),
            int(row.get("goalsAgainst") or 0),
            int(round(row.get("timeOnIce") or 0)),
            round(impact, 1),
        ]
    return skaters, goalies


def build() -> None:
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"seasons": [], "skaters": {}, "goalies": {}}
    last_complete, in_progress = season_calendar()
    # Playoffs for a season finish in June, so the newest season start with playoffs is
    # the in-progress one (empty until April) or the last complete one.
    newest = in_progress if in_progress is not None else last_complete
    done = set(previous.get("seasons", []))
    skaters: dict[str, list] = {}
    goalies: dict[str, list] = {}
    fetched: list[int] = []

    def keep(season: int) -> None:
        for pid, rows in previous.get("skaters", {}).items():
            for row in rows:
                if row[0] == season:
                    skaters.setdefault(pid, []).append(row)
        for pid, rows in previous.get("goalies", {}).items():
            for row in rows:
                if row[0] == season:
                    goalies.setdefault(pid, []).append(row)

    for season in range(FIRST_DRAFT_YEAR, newest + 1):
        if season in NO_PLAYOFFS:
            continue
        # Re-check the two newest springs every night; older playoffs never change.
        if season in done and season < last_complete:
            keep(season)
            fetched.append(season)
            continue
        try:
            s, g = _season(season, refresh=True)
        except Exception as error:  # keep last saved data if the API is down
            print(f"playoffs {season}: failed ({error}); keeping saved data", flush=True)
            if season in done:
                keep(season)
                fetched.append(season)
            continue
        if not s and not g:
            print(f"playoffs {season}: none yet", flush=True)
            continue
        for pid, row in s.items():
            skaters.setdefault(pid, []).append(row)
        for pid, row in g.items():
            goalies.setdefault(pid, []).append(row)
        fetched.append(season)
        print(f"playoffs {season}: {len(s)} skaters, {len(g)} goalies", flush=True)

    for rows in (*skaters.values(), *goalies.values()):
        rows.sort(key=lambda row: row[0])
    out = {"seasons": sorted(set(fetched)), "skaters": skaters, "goalies": goalies}
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"playoff_stats: {len(skaters)} skaters, {len(goalies)} goalies, {len(out['seasons'])} springs -> {OUT.name}", flush=True)


if __name__ == "__main__":
    build()
