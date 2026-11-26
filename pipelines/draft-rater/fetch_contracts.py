"""Sync public NHL contract facts into data/contracts.json.

Source: the public team roster tables on capwages.com (allowed by its robots.txt).
No paid API. For every NHL team we record:
  - each rostered player's AAV, the year his deal ends, and whether it is an ELC
  - the team's Used Cap, Cap Space, LTIR and the league Floor (lower limit) / Ceiling (upper limit)
  - the 2027-2029 draft picks the team currently owns

Players are matched to NHL player ids by name + birth date (with a name-only fallback
inside the same team). If the site throttles us or changes shape, the last saved
data/contracts.json is kept, so the app never breaks.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

from teams import FRANCHISES

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data"
OUT = DATA / "contracts.json"
DB = DATA / "draft-rater" / "nhl.sqlite"
VITALS = DATA / "draft-rater" / "vitals.json"
BIOS = DATA / "draft-rater" / "roster_bios.json"
USER_AGENT = "StatsPuckBot/1.0 (hockey stats research; contact via statspuck.com)"
BASE = "https://capwages.com/teams/"
PICK_YEARS = {"2027", "2028", "2029"}
MIN_TEAMS = 28

MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}

# Team name on the source -> our abbreviation. Built from the franchise table plus a few spellings.
NAME_TO_ABBR = {info["name"].lower(): abbr for abbr, info in FRANCHISES.items()}
NAME_TO_ABBR.update({"montreal canadiens": "MTL", "montréal canadiens": "MTL", "utah hockey club": "UTA"})


def season_label(today: dt.date | None = None) -> str:
    today = today or dt.date.today()
    start = today.year if today.month >= 7 else today.year - 1
    return f"{start}-{str(start + 1)[2:]}"


def slug_for(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower().replace(".", "")).strip("_")


def norm(name: str) -> str:
    """'Carlsson, Leo' or 'Leo Carlsson' -> 'leo carlsson' without accents or punctuation."""
    if "," in name:
        last, first = [part.strip() for part in name.split(",", 1)]
        name = f"{first} {last}"
    name = unicodedata.normalize("NFKD", name)
    name = "".join(ch for ch in name if not unicodedata.combining(ch))
    name = re.sub(r"[^a-z ]", "", name.lower().replace("-", " "))
    return re.sub(r"\s+", " ", name).strip()


def parse_born(text: str | None) -> str | None:
    """'Dec. 26, 2004' -> '2004-12-26'."""
    match = re.match(r"([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})", text or "")
    if not match or match.group(1).lower() not in MONTHS:
        return None
    return f"{match.group(3)}-{MONTHS[match.group(1).lower()]:02d}-{int(match.group(2)):02d}"


def money(text: str | None) -> int | None:
    digits = re.sub(r"[^0-9]", "", (text or "").split(".")[0])
    return int(digits) if digits else None


def http_get(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    delay = 1.0
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(delay)
        delay *= 2
    raise RuntimeError("unreachable")


def page_props(html: str) -> dict:
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise ValueError("page data not found")
    return json.loads(match.group(1))["props"]["pageProps"]


def build_index() -> tuple[dict[tuple[str, str], int], dict[str, list[int]]]:
    """(normalised name, birth date) -> id, plus name -> ids, from our own player tables."""
    by_born: dict[tuple[str, str], int] = {}
    by_name: dict[str, list[int]] = {}
    vitals = json.loads(VITALS.read_text(encoding="utf-8")) if VITALS.exists() else {}
    if not DB.exists():
        return by_born, by_name
    with sqlite3.connect(DB) as db:
        for player_id, name in db.execute("SELECT player_id, name FROM players WHERE name IS NOT NULL"):
            key = norm(name)
            by_name.setdefault(key, []).append(player_id)
            born = (vitals.get(str(player_id)) or {}).get("bd")
            if born:
                by_born[(key, born)] = player_id
    return by_born, by_name


def match_player(row: dict, by_born: dict, by_name: dict, roster_ids: set[int]) -> int | None:
    key = norm(row.get("name", ""))
    born = parse_born(row.get("born"))
    if born and (key, born) in by_born:
        return by_born[(key, born)]
    candidates = by_name.get(key, [])
    on_roster = [pid for pid in candidates if pid in roster_ids]
    if len(on_roster) == 1:
        return on_roster[0]
    if len(candidates) == 1 and not born:
        return candidates[0]
    return None


def current_contract(row: dict, season: str) -> dict | None:
    """The contract that covers this season: AAV, end year, ELC flag."""
    for contract in row.get("contracts") or []:
        details = contract.get("details") or []
        seasons = [d.get("season", "") for d in details]
        if season not in seasons:
            continue
        now = details[seasons.index(season)]
        last = max(int(s[:4]) for s in seasons if s[:4].isdigit()) + 1
        elc = "entry" in (contract.get("type") or "").lower()
        # An ELC's listed AAV includes bonuses; the cap hit is what counts.
        aav = money(now.get("capHit")) if elc else (money(now.get("aav")) or money(now.get("capHit")))
        if not aav:
            return None
        out = {"aav": aav, "expires": last}
        if elc:
            out["elc"] = True
        return out
    return None


def roster_rows(props: dict) -> list[dict]:
    rows: list[dict] = []
    for section in ("roster", "non-roster"):
        for group in (props.get("data", {}).get(section) or {}).values():
            if isinstance(group, list):
                rows.extend(group)
    return rows


def fetch_nhl_ids(by_born: dict, by_name: dict, bios: dict) -> dict[str, set[int]]:
    """Official roster feed ids per team. Also adds veterans our draft tables never saw to the name index,
    and records name, birth date, height, weight and position for every rostered player in `bios`."""
    out: dict[str, set[int]] = {}
    for abbr in FRANCHISES:
        out[abbr] = set()
        try:
            payload = json.loads(http_get(f"https://api-web.nhle.com/v1/roster/{abbr}/current"))
        except Exception:  # noqa: BLE001 - the index still works from our own tables
            continue
        for key in ("forwards", "defensemen", "goalies"):
            for row in payload.get(key) or []:
                if not row.get("id"):
                    continue
                pid = int(row["id"])
                out[abbr].add(pid)
                full = f"{(row.get('firstName') or {}).get('default', '')} {(row.get('lastName') or {}).get('default', '')}".strip()
                bios[str(pid)] = {
                    "n": full,
                    "pos": row.get("positionCode"),
                    "bd": row.get("birthDate"),
                    "h": row.get("heightInInches"),
                    "w": row.get("weightInPounds"),
                    "sc": row.get("shootsCatches"),
                }
                name = norm(full)
                if pid not in by_name.setdefault(name, []):
                    by_name[name].append(pid)
                if row.get("birthDate"):
                    by_born[(name, row["birthDate"])] = pid
        time.sleep(0.2)
    return out


def write_draft_capital(owned_rows: list[dict], away: list[dict]) -> None:
    """data/draft_capital.json: who owns every 2027-2029 pick, Rounds 1-7, for all 32 franchises.

    Each slot is (year, round, original team). If a slot has no owner in the data it stays with the
    original team, so the inventory is always complete.
    """
    owner: dict[tuple, dict] = {}
    for row in owned_rows:
        owner.setdefault((row["y"], row["r"], row["orig"]), row)
    notes = {(row["y"], row["r"], row["orig"]): row["note"] for row in away}
    picks = []
    for year in sorted(int(y) for y in PICK_YEARS):
        for rnd in range(1, 8):
            for orig in sorted(FRANCHISES):
                row = owner.get((year, rnd, orig))
                entry = {"y": year, "r": rnd, "orig": orig, "owner": row["owner"] if row else orig}
                if row and row.get("cond"):
                    entry["cond"] = True
                if entry["owner"] != orig and notes.get((year, rnd, orig)):
                    entry["note"] = notes[(year, rnd, orig)]
                picks.append(entry)
    traded = sum(1 for p in picks if p["owner"] != p["orig"])
    (DATA / "draft_capital.json").write_text(
        json.dumps({"asOf": dt.date.today().isoformat(), "years": sorted(int(y) for y in PICK_YEARS), "picks": picks}, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"draft capital: {len(picks)} slots, {traded} held by another team", flush=True)


def main() -> None:
    season = season_label()
    by_born, by_name = build_index()
    bios: dict[str, dict] = {}
    nhl_ids = fetch_nhl_ids(by_born, by_name, bios)
    players: dict[str, dict] = {}
    teams: dict[str, dict] = {}
    owned_rows: list[dict] = []
    away: list[dict] = []
    floor = ceiling = None
    unmatched = 0
    try:
        for abbr, info in sorted(FRANCHISES.items()):
            props = page_props(http_get(BASE + slug_for(info["name"])))
            summary = props.get("teamSummary") or {}
            cap_hit = (summary.get("capHit") or {}).get("total")
            if cap_hit is None:
                raise ValueError(f"{abbr}: no cap total")
            ceiling = summary.get("upperLimit") or ceiling
            floor = summary.get("lowerLimit") or floor
            teams[abbr] = {
                "capHit": int(cap_hit),
                "capSpace": int(summary.get("capSpace") or 0),
                "ltir": int(summary.get("ltir") or 0),
                "deadCap": int((summary.get("capHit") or {}).get("deadCap") or 0),
            }
            roster_ids = nhl_ids.get(abbr, set())
            for row in roster_rows(props):
                contract = current_contract(row, season)
                if not contract:
                    continue
                player_id = match_player(row, by_born, by_name, roster_ids)
                if player_id is None:
                    unmatched += 1
                    continue
                players[str(player_id)] = {**contract, "team": abbr}
            for pick in props.get("draftPicks") or []:
                if str(pick.get("year")) not in PICK_YEARS:
                    continue
                origin = NAME_TO_ABBR.get(str(pick.get("team", "")).lower())
                if not origin:
                    continue
                row = {"y": int(pick["year"]), "r": int(pick["round"]), "orig": origin}
                if pick.get("isTradedAway"):
                    # This team's own slot, now held by someone else. Keep the trade note for the traded-away list.
                    away.append({**row, "note": str(pick.get("tradeDetails") or "")[:160]})
                else:
                    if pick.get("conditions"):
                        row["cond"] = True
                    owned_rows.append({**row, "owner": abbr})
            time.sleep(1.0)
    except Exception as error:  # noqa: BLE001 - keep the last saved file on any failure
        print(f"contracts: sync failed ({error}); keeping the saved file", flush=True)
        return
    if len(teams) < MIN_TEAMS or len(players) < 500 or not ceiling or not floor:
        print(f"contracts: only {len(teams)} teams / {len(players)} players; keeping the saved file", flush=True)
        return
    payload = {
        "season": season,
        "capCeiling": int(ceiling),
        "capFloor": int(floor),
        "source": "CapWages public roster tables (capwages.com)",
        "asOf": dt.date.today().isoformat(),
        "players": dict(sorted(players.items(), key=lambda item: int(item[0]))),
        "teams": teams,
    }
    write_draft_capital(owned_rows, away)
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    if len(bios) >= 500:
        BIOS.write_text(json.dumps(dict(sorted(bios.items(), key=lambda item: int(item[0]))), separators=(",", ":")), encoding="utf-8")
    print(f"contracts: {len(players)} players on {len(teams)} teams ({unmatched} unmatched), cap {floor:,}-{ceiling:,}", flush=True)


if __name__ == "__main__":
    main()
