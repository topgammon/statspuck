"""NHL draft lottery history (2006 on) and today's projected lottery order.

For each draft, the lottery teams are the original owners of the first N picks (N = number of
non-playoff clubs, plus an expansion club), read from each pick's `teamPickHistory` (e.g.
"MTL-TOR" means Montreal's pick, traded to Toronto). Their pre-lottery seed is their order in the
final regular-season standings (worst first, NHL league ranking). Their actual slot is where that
pick landed. Seed minus slot is what the ping-pong balls gave or took.

Sources (free NHL APIs):
  https://records.nhl.com/site/api/draft          (via fetch_nhl.draft_url)
  https://api-web.nhle.com/v1/standings-season    (season end dates)
  https://api-web.nhle.com/v1/standings/{date}    (final standings)
  https://api-web.nhle.com/v1/standings/now       (live order for the simulator)

2005 is left out: the post-lockout lottery weighted all 30 teams.

Writes data/draft-rater/lottery.json.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from fetch_nhl import draft_url, get_json
from teams import FRANCHISES, lookup_team

DATA = Path(__file__).resolve().parents[2] / "data" / "draft-rater"
OUT = DATA / "lottery.json"
EXPANSION = {2017: "VGK", 2021: "SEA"}  # expansion club drafts with the 3rd-best odds


def lottery_size(year: int) -> int:
    if year <= 2017:
        return 14 + (1 if year == 2017 else 0)
    if year <= 2020:
        return 15
    return 16


def franchise(abbr: str, year: int) -> str | None:
    try:
        return lookup_team(abbr, year)[0]
    except Exception:  # noqa: BLE001 - unknown code
        return abbr if abbr in FRANCHISES else None


def season_end(seasons: list[dict], year: int) -> str | None:
    """Last regular-season standings date for the season that ends in this draft year."""
    sid = (year - 1) * 10000 + year
    row = next((s for s in seasons if s.get("id") == sid), None)
    return row.get("standingsEnd") if row else None


def build_year(year: int, seasons: list[dict], live: bool) -> list[dict] | None:
    rows = sorted((r for r in get_json(draft_url(year), refresh=live).get("data", []) if r.get("roundNumber") == 1 and r.get("overallPickNumber")), key=lambda r: r["overallPickNumber"])
    size = lottery_size(year)
    picks = []
    for r in rows[:size]:
        history = str(r.get("teamPickHistory") or r.get("triCode") or "").split("-")
        owner = franchise(history[0].strip(), year)
        if owner:
            picks.append({"team": owner, "overall": r["overallPickNumber"], "playerId": r.get("playerId"), "name": r.get("playerName")})
    end = season_end(seasons, year)
    if not end:
        return None
    standings = get_json(f"https://api-web.nhle.com/v1/standings/{end}", refresh=False).get("standings", [])
    rank = {}
    for t in standings:
        code = franchise((t.get("teamAbbrev") or {}).get("default", ""), year)
        if code:
            rank[code] = t.get("leagueSequence", 99)
    lottery = [p for p in picks if p["team"] in rank or EXPANSION.get(year) == p["team"]]
    # Worst record first. The expansion club takes the 3rd seed by rule.
    ordered = sorted((p for p in lottery if p["team"] != EXPANSION.get(year)), key=lambda p: -rank[p["team"]])
    expansion = next((p for p in lottery if p["team"] == EXPANSION.get(year)), None)
    if expansion:
        ordered.insert(2, expansion)
    for seed, pick in enumerate(ordered, start=1):
        pick["seed"] = seed
        pick["moved"] = seed - pick["overall"]
    return ordered


def live_order(history: dict[str, list[dict]]) -> list[dict]:
    """Projected lottery order if the season ended today: non-playoff clubs, worst point % first."""
    standings = get_json("https://api-web.nhle.com/v1/standings/now", refresh=True).get("standings", [])
    out = [t for t in standings if (t.get("wildcardSequence") or 0) > 2]
    out.sort(key=lambda t: (t.get("pointPctg") or 0, t.get("points") or 0, t.get("regulationWins") or 0))
    year = date.today().year + (1 if date.today().month >= 7 else 0)
    recent = [str(y) for y in range(year - 5, year)]
    rows = []
    for seed, t in enumerate(out[:16], start=1):
        code = franchise((t.get("teamAbbrev") or {}).get("default", ""), year) or "?"
        wins = sum(1 for y in recent for p in history.get(y, []) if p["team"] == code and p["moved"] > 0 and p["overall"] <= 2)
        rows.append({"seed": seed, "team": code, "points": t.get("points"), "gp": t.get("gamesPlayed"), "pct": round(t.get("pointPctg") or 0, 3), "recentWins": wins})
    return rows


def build() -> None:
    saved = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"years": {}}
    seasons = get_json("https://api-web.nhle.com/v1/standings-season", refresh=True).get("seasons", [])
    years: dict[str, list[dict]] = saved.get("years", {})
    latest = date.today().year if date.today().month >= 7 else date.today().year - 1
    for year in range(2006, latest + 1):
        if str(year) in years and year < latest:
            continue
        try:
            result = build_year(year, seasons, live=year == latest)
        except Exception as error:  # noqa: BLE001 - keep saved data
            print(f"lottery {year}: {error}", flush=True)
            continue
        if result:
            years[str(year)] = result
    try:
        order = live_order(years)
    except Exception as error:  # noqa: BLE001
        print(f"lottery live order: {error}", flush=True)
        order = saved.get("live", [])
    OUT.write_text(json.dumps({"asOf": date.today().isoformat(), "years": years, "live": order}, separators=(",", ":")), encoding="utf-8")
    jumps = sum(1 for rows in years.values() for p in rows if p["moved"] > 0)
    print(f"lottery: {len(years)} drafts, {jumps} teams moved up, live order {len(order)} teams -> {OUT.name}", flush=True)


if __name__ == "__main__":
    build()
