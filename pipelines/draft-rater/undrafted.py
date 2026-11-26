"""Undrafted NHL graduates and player vitals for the profile pages.

Undrafted players (no NHL Entry Draft selection at any age, 25+ NHL regular-season
games since 2005-06) get their own profile. They never enter Draft Rater slot
averages. When one reaches 100+ career Impact, the franchise that gave him his
NHL debut (and the GM running it that season) gets Development Grade credit; see
development.py.

Inputs: data/draft-rater/bios.json from fetch_bios.py, the season rows already
loaded by grade_quality.build(), and the graded GM eras.
"""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path

from origins import clean_league
from teams import FRANCHISES, alias_rows

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
BIOS = DATA / "bios.json"
UNDRAFTED_MIN_GP = 25
GEM_IMPACT = 100.0
FIRST_CREDIT_SEASON = 2005


def load_bios() -> dict[str, dict]:
    if not BIOS.exists():
        return {}
    return json.loads(BIOS.read_text(encoding="utf-8"))


def _key(name: str) -> str:
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.lower().replace(".", "").split())


def _team_names() -> dict[str, tuple[str, str, int, int | None]]:
    """Normalized team name -> (abbr, franchise, first year, last year)."""
    names: dict[str, tuple[str, str, int, int | None]] = {}
    for abbr, franchise, historic, start, end in alias_rows():
        names[_key(historic)] = (abbr, franchise, start, end)
    for abbr, info in FRANCHISES.items():
        names.setdefault(_key(info["name"]), (abbr, abbr, 2005, None))
    return names


TEAM_NAMES = _team_names()


def team_for(name: str) -> tuple[str, str] | None:
    """(team abbr at the time, franchise abbr today) for an NHL team name, or None."""
    found = TEAM_NAMES.get(_key(name))
    if not found:
        return None
    return found[0], found[1]


def vitals_from_bio(bio: dict | None) -> dict:
    if not bio:
        return {}
    return {
        "h": bio.get("h"),
        "w": bio.get("w"),
        "sc": bio.get("sc"),
        "bd": bio.get("bd"),
        "city": bio.get("city"),
        "prov": bio.get("prov"),
        "ctry": bio.get("ctry"),
    }


def vitals_from_pick(pick: dict) -> dict:
    """Draft-day vitals from the records feed, for players the NHL feed has no page for."""
    place = pick.get("birth_place") or ""
    parts = [part.strip() for part in place.replace("  ", " ").split(",")]
    city = parts[0] if parts and parts[0] else None
    return {
        "h": pick.get("height"),
        "w": pick.get("weight"),
        "sc": pick.get("shoots_catches"),
        "bd": pick.get("birth_date"),
        "city": city,
        "prov": None,
        "ctry": pick.get("country"),
    }


def merge_vitals(primary: dict, backup: dict) -> dict:
    out = {key: primary.get(key) if primary.get(key) not in (None, "") else backup.get(key) for key in set(primary) | set(backup)}
    return {key: value for key, value in out.items() if value not in (None, "")}


def credit_era(eras: list[dict], franchise: str, season: int) -> dict | None:
    """The GM era running this franchise in the season the player debuted."""
    matches = [
        era
        for era in eras
        if era["team"] == franchise and era["startYear"] <= season <= (era["endYear"] if era["endYear"] is not None else 9999)
    ]
    if not matches:
        return None
    return max(matches, key=lambda era: era["startYear"])


def build_undrafted(
    bios: dict[str, dict],
    seasons: dict[int, dict[int, dict[str, dict]]],
    eras: list[dict],
    rosters: dict,
    toi_avg: dict,
    save_avg: dict[int, float],
    last_season: int,
) -> list[dict]:
    from grade_quality import career_box, is_elite, position_group, season_quality
    from model import round1

    out: list[dict] = []
    for key, bio in bios.items():
        if bio.get("dr") is not False:
            continue
        player_id = int(key)
        player_seasons = seasons.get(player_id, {})
        career = sum(row["gp"] for roles in player_seasons.values() for row in roles.values())
        if career < UNDRAFTED_MIN_GP:
            continue
        group = position_group(bio.get("pos"))
        role = "goalie" if group == "G" else "skater"
        nhl_rows = sorted((row for row in bio.get("nhl") or [] if row[2] > 0), key=lambda row: row[0])
        played = sorted(season for season, roles in player_seasons.items() if (roles.get(role) or {}).get("gp"))
        if not played:
            continue
        debut = nhl_rows[0][0] if nhl_rows else played[0]
        first_name = nhl_rows[0][1] if nhl_rows else None
        team = team_for(first_name) if first_name else None
        first_season = max(debut, FIRST_CREDIT_SEASON)
        series: list[float] = []
        quality = 0.0
        for season in range(first_season, last_season + 1):
            row = (player_seasons.get(season) or {}).get(role)
            added = season_quality(row, role, group, season, toi_avg, save_avg)[0] if row else 0.0
            series.append(round1(added))
            quality += added
        box = career_box(player_seasons, group)
        franchise = team[1] if team else None
        era = credit_era(eras, franchise, debut) if franchise and debut >= FIRST_CREDIT_SEASON else None
        # Where he played the season before his NHL debut: his "drafted from" equivalent.
        before = [row for row in bio.get("path") or [] if row[0] < debut and row[1] != "NHL" and row[3] > 0]
        last_year = max((row[0] for row in before), default=None)
        origin_rows = sorted((row for row in before if row[0] == last_year), key=lambda row: -row[3])
        origin = origin_rows[0] if origin_rows else None
        record = {
            "id": player_id,
            "playerId": player_id,
            "name": bio.get("n") or f"Player {player_id}",
            "pos": bio.get("pos") or "—",
            "group": group,
            "active": bio.get("act"),
            "currentTeam": rosters.get(str(player_id)) or (bio.get("team") if bio.get("act") else None),
            "debut": debut,
            "firstTeam": team[0] if team else None,
            "firstTeamName": first_name,
            "franchise": franchise,
            "franchiseName": FRANCHISES[franchise]["name"] if franchise else None,
            "creditEra": era["slug"] if era else None,
            "creditGm": era["person"] if era else None,
            "gpCareer": career,
            "qg": round1(quality),
            "seasons": series,
            "firstSeason": first_season,
            "goals": box["goals"],
            "assists": box["assists"],
            "points": box["points"],
            "ppg": box["ppg"],
            "savePct": box["savePct"],
            "gaa": box["gaa"],
            "starts": box["starts"],
            "origin": {"league": clean_league(origin[1]), "club": origin[2] or None, "season": origin[0]} if origin else None,
            "path": [row for row in bio.get("path") or [] if debut - 4 <= row[0] <= debut + 3],
            "devCredit": None,
            "stamps": ["UNDRAFTED"],
        }
        elite_view = {**record, "developing": False}
        if is_elite(elite_view):
            record["stamps"].append("ELITE")
        if record["active"] is False:
            record["stamps"].append("RETIRED")
        out.append(record)
    out.sort(key=lambda row: (-row["qg"], row["name"]))
    return out
