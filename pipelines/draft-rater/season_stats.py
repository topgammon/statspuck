"""Season-by-season NHL regular-season box scores for every player profile.

Reads the `player_seasons` table that fetch_nhl.py keeps up to date and writes a
compact data/draft-rater/season_stats.json for the Stats tab, the Skills ratings and
the IRON MAN stamp. No network calls.

Skater row: [season, gp, g, a, pts, plusMinus, pim, shots, blocks, foWins, foLosses, toiPerGameSec, ppToiSec, shToiSec]
Goalie row: [season, gp, starts, shotsAgainst, saves, goalsAgainst, toiSec]
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
DB_PATH = DATA / "nhl.sqlite"
OUT = DATA / "season_stats.json"


def _int(value) -> int:
    return int(round(value)) if value is not None else 0


def build() -> None:
    if not DB_PATH.exists():
        print("season_stats: no database, keeping the last file")
        return
    con = sqlite3.connect(DB_PATH)
    rows = con.execute(
        """
        SELECT player_id, season_start, role, gp, goals, assists, points, plus_minus, pim, shots, blocks,
               fo_wins, fo_losses, toi_per_game, pp_toi, sh_toi, games_started, shots_against, saves,
               goals_against, time_on_ice
        FROM player_seasons
        WHERE gp > 0
        ORDER BY player_id, season_start
        """
    ).fetchall()
    con.close()

    skaters: dict[str, list] = {}
    goalies: dict[str, list] = {}
    for (pid, season, role, gp, g, a, pts, pm, pim, sog, blk, fw, fl, toi_pg, pp, sh, gs, sa, sv, ga, toi) in rows:
        key = str(pid)
        if role == "goalie":
            goalies.setdefault(key, []).append([season, gp, _int(gs), _int(sa), _int(sv), _int(ga), _int(toi)])
        else:
            skaters.setdefault(key, []).append(
                [season, gp, _int(g), _int(a), _int(pts), _int(pm), _int(pim), _int(sog), _int(blk), _int(fw), _int(fl), _int(toi_pg), _int(pp), _int(sh)]
            )

    last = max((row[0] for rows_ in skaters.values() for row in rows_), default=0)
    out = {"lastSeason": last, "skaters": skaters, "goalies": goalies}
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"season_stats: {len(skaters)} skaters, {len(goalies)} goalies -> {OUT.name}")


if __name__ == "__main__":
    build()
