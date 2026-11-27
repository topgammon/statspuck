"""Pull NHL draft picks and regular-season games played into SQLite.

Endpoints that actually work (probed November 2026):

- Draft picks, including player id:
  https://records.nhl.com/site/api/draft?cayenneExp=draftYear=2005
  The web feed https://api-web.nhle.com/v1/draft/picks/{year}/all has the
  same picks but no player id, so it cannot be joined to stats.

- Season games played, skaters and goalies, 100 rows per page:
  https://api.nhle.com/stats/rest/en/skater/summary
  https://api.nhle.com/stats/rest/en/goalie/summary
  cayenneExp: seasonId=20242025 and gameTypeId=2
  Asking for limit=1000 still returns 100. This is the season log.
  Per-player game logs are one row per game and would be tens of thousands
  of calls for the same games-played totals, so they are not used.

Completed seasons are fetched once and then read from disk. The in-progress
season is refreshed on every run, because grades are supposed to move as
games accumulate. Young players who have never appeared simply stay at 0 GP.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from teams import alias_rows

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
CACHE = ROOT / "cache"
DB_PATH = DATA / "nhl.sqlite"

FIRST_DRAFT_YEAR = 2005
DELAY_SECONDS = 0.4
USER_AGENT = "DraftRating/0.1 (personal research; caches responses)"

SCHEMA = """
CREATE TABLE IF NOT EXISTS team_aliases (
  abbr TEXT NOT NULL,
  franchise_abbr TEXT NOT NULL,
  name TEXT NOT NULL,
  franchise_name TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER,
  PRIMARY KEY (abbr, start_year)
);

CREATE TABLE IF NOT EXISTS picks (
  pick_uid INTEGER PRIMARY KEY,
  draft_year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  pick_in_round INTEGER NOT NULL,
  overall INTEGER NOT NULL,
  team_abbr TEXT NOT NULL,
  franchise_abbr TEXT NOT NULL,
  historic_name TEXT NOT NULL,
  team_id INTEGER,
  player_id INTEGER,
  player_name TEXT NOT NULL,
  position TEXT,
  country TEXT,
  amateur_club TEXT
);

CREATE TABLE IF NOT EXISTS players (
  player_id INTEGER PRIMARY KEY,
  name TEXT,
  position TEXT,
  career_gp INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS player_seasons (
  player_id INTEGER NOT NULL,
  season_start INTEGER NOT NULL,
  gp INTEGER NOT NULL,
  role TEXT NOT NULL,
  toi_per_game REAL,
  points INTEGER,
  plus_minus INTEGER,
  games_started INTEGER,
  save_pct REAL,
  shots_against INTEGER,
  position_code TEXT,
  PRIMARY KEY (player_id, season_start, role)
);

CREATE TABLE IF NOT EXISTS season_fetches (
  season_start INTEGER NOT NULL,
  role TEXT NOT NULL,
  pages INTEGER NOT NULL,
  rows INTEGER NOT NULL,
  complete INTEGER NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (season_start, role)
);

CREATE TABLE IF NOT EXISTS gm_eras (
  id INTEGER PRIMARY KEY,
  team TEXT NOT NULL,
  person TEXT NOT NULL,
  role TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_picks_year ON picks(draft_year);
CREATE INDEX IF NOT EXISTS idx_picks_player ON picks(player_id);
CREATE INDEX IF NOT EXISTS idx_picks_franchise ON picks(franchise_abbr, draft_year);
CREATE INDEX IF NOT EXISTS idx_seasons_player ON player_seasons(player_id);
"""


def season_calendar(today: date | None = None) -> tuple[int, int | None]:
    """Return (last completed season start, in-progress season start or None).

    Regular season is treated as October through April. May through September
    is the offseason, so every stored season is complete and nothing is
    refreshed until October.
    """
    today = today or date.today()
    if today.month >= 10:
        return today.year - 1, today.year
    if today.month <= 4:
        return today.year - 2, today.year - 1
    return today.year - 1, None


SEASON_DETAIL_COLUMNS = (
    ("toi_per_game", "REAL"),
    ("points", "INTEGER"),
    ("plus_minus", "INTEGER"),
    ("games_started", "INTEGER"),
    ("save_pct", "REAL"),
    ("shots_against", "INTEGER"),
    ("position_code", "TEXT"),
    ("goals", "INTEGER"),
    ("assists", "INTEGER"),
    ("goals_against", "INTEGER"),
    ("time_on_ice", "INTEGER"),
    # Impact inputs (skaters): box-score events and situational ice time in seconds.
    ("shots", "INTEGER"),
    ("pim", "INTEGER"),
    ("sh_points", "INTEGER"),
    ("blocks", "INTEGER"),
    ("fo_wins", "INTEGER"),
    ("fo_losses", "INTEGER"),
    ("ev_toi", "INTEGER"),
    ("pp_toi", "INTEGER"),
    ("sh_toi", "INTEGER"),
    # Impact inputs (goalies).
    ("saves", "INTEGER"),
    # Display name, so season leaderboards can show players from before the 2005 draft book.
    ("player_name", "TEXT"),
)

# Extra skater reports merged into each season row, keyed by playerId.
# Each maps a stored column to the API field that fills it.
SKATER_EXTRA_REPORTS = (
    ("skater/realtime", {"blocks": "blockedShots"}),
    ("skater/faceoffwins", {"fo_wins": "totalFaceoffWins", "fo_losses": "totalFaceoffLosses"}),
    ("skater/timeonice", {"ev_toi": "evTimeOnIce", "pp_toi": "ppTimeOnIce", "sh_toi": "shTimeOnIce"}),
)

SEASON_COLUMNS = (
    "gp",
    "toi_per_game",
    "points",
    "plus_minus",
    "games_started",
    "save_pct",
    "shots_against",
    "position_code",
    "goals",
    "assists",
    "goals_against",
    "time_on_ice",
    "shots",
    "pim",
    "sh_points",
    "blocks",
    "fo_wins",
    "fo_losses",
    "ev_toi",
    "pp_toi",
    "sh_toi",
    "saves",
    "player_name",
)


# Draft-day origin and vitals from the records draft feed, stored on each pick.
PICK_DETAIL_COLUMNS = (
    ("amateur_league", "TEXT"),
    ("birth_date", "TEXT"),
    ("birth_place", "TEXT"),
    ("height", "INTEGER"),
    ("weight", "INTEGER"),
    ("shoots_catches", "TEXT"),
)


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    existing = {row[1] for row in conn.execute("PRAGMA table_info(player_seasons)")}
    for name, kind in SEASON_DETAIL_COLUMNS:
        if name not in existing:
            conn.execute(f"ALTER TABLE player_seasons ADD COLUMN {name} {kind}")
    existing = {row[1] for row in conn.execute("PRAGMA table_info(picks)")}
    for name, kind in PICK_DETAIL_COLUMNS:
        if name not in existing:
            conn.execute(f"ALTER TABLE picks ADD COLUMN {name} {kind}")
    return conn


def _cache_path(url: str) -> Path:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()
    return CACHE / f"{digest}.json"


def get_json(url: str, refresh: bool = False) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = _cache_path(url)
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))

    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    delay_next = DELAY_SECONDS
    last_error: Exception | None = None
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read()
            path.write_bytes(raw)
            time.sleep(delay_next)
            try:
                return json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError:
                path.unlink(missing_ok=True)
                raise
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504}:
                detail = error.read().decode("utf-8", errors="replace")[:300]
                raise RuntimeError(f"{error.code} for {url}: {detail}") from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
        wait = 2**attempt
        print(f"  retry {attempt + 1} in {wait}s ({last_error})", flush=True)
        time.sleep(wait)
    raise RuntimeError(f"Gave up on {url}: {last_error}")


def draft_url(year: int) -> str:
    query = urllib.parse.urlencode(
        {
            "limit": "500",
            "sort": "overallPickNumber",
            "cayenneExp": f"draftYear={year}",
        }
    )
    return f"https://records.nhl.com/site/api/draft?{query}"


def stats_url(report: str, season_start: int, start: int) -> str:
    season_id = f"{season_start}{season_start + 1}"
    query = urllib.parse.urlencode(
        {
            "limit": "100",
            "start": str(start),
            "sort": "playerId",
            "cayenneExp": f"seasonId={season_id} and gameTypeId=2",
        }
    )
    return f"https://api.nhle.com/stats/rest/en/{report}?{query}"


def seed_aliases(conn: sqlite3.Connection) -> None:
    from teams import FRANCHISES

    conn.execute("DELETE FROM team_aliases")
    for abbr, franchise, historic, start, end in alias_rows():
        conn.execute(
            """
            INSERT INTO team_aliases
              (abbr, franchise_abbr, name, franchise_name, start_year, end_year)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (abbr, franchise, historic, FRANCHISES[franchise]["name"], start, end),
        )


def latest_draft_year() -> int:
    payload = get_json("https://api.nhle.com/stats/rest/en/draft?limit=100")
    years = [row["draftYear"] for row in payload.get("data", [])]
    if not years:
        raise RuntimeError("Draft year list was empty.")
    return max(year for year in years if year <= date.today().year)


def _position(value: str | None) -> str | None:
    if not value:
        return None
    return str(value).strip() or None


def load_draft_year(conn: sqlite3.Connection, year: int, refresh: bool) -> int:
    from teams import lookup_team

    payload = get_json(draft_url(year), refresh=refresh)
    rows = payload.get("data", [])
    if len(rows) < 200:
        raise RuntimeError(f"{year} draft returned {len(rows)} picks; expected about 210+.")

    conn.execute("DELETE FROM picks WHERE draft_year = ?", (year,))
    inserted = 0
    for row in rows:
        if row.get("supplementalDraft") == "Y":
            continue
        overall = row.get("overallPickNumber")
        if not overall:
            continue
        abbr = (row.get("triCode") or "").upper()
        franchise, historic, _current = lookup_team(abbr, year)
        first = (row.get("firstName") or "").strip()
        last = (row.get("lastName") or "").strip()
        name = (row.get("playerName") or f"{first} {last}").strip() or "Unknown"
        player_id = row.get("playerId") or None
        conn.execute(
            """
            INSERT INTO picks (
              pick_uid, draft_year, round, pick_in_round, overall, team_abbr,
              franchise_abbr, historic_name, team_id, player_id, player_name,
              position, country, amateur_club, amateur_league, birth_date,
              birth_place, height, weight, shoots_catches
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                year,
                row.get("roundNumber"),
                row.get("pickInRound"),
                overall,
                abbr,
                franchise,
                historic,
                row.get("draftedByTeamId"),
                player_id,
                name,
                _position(row.get("position")),
                row.get("countryCode"),
                row.get("amateurClubName"),
                (row.get("amateurLeague") or "").strip() or None,
                row.get("birthDate"),
                " ".join((row.get("birthPlace") or "").split()) or None,
                row.get("height") or None,
                row.get("weight") or None,
                row.get("shootsCatches") or None,
            ),
        )
        inserted += 1
    conn.commit()
    print(f"draft {year}: {inserted} picks", flush=True)
    return inserted


def _should_fetch_season(
    conn: sqlite3.Connection,
    season_start: int,
    role: str,
    last_complete: int,
    rebuild: bool,
) -> bool:
    if rebuild:
        return True
    row = conn.execute(
        "SELECT complete FROM season_fetches WHERE season_start = ? AND role = ?",
        (season_start, role),
    ).fetchone()
    if row is None:
        return True
    if season_start > last_complete:
        return True
    # Was still in progress last run, and the season has since ended.
    return row["complete"] == 0


def fetch_report(report: str, season_start: int, refresh: bool, label: str) -> dict[int, dict]:
    """Every row of one stats report for one season, keyed by playerId."""
    start = 0
    pages = 0
    found: dict[int, dict] = {}
    total = None
    while pages < 40:
        payload = get_json(stats_url(report, season_start, start), refresh=refresh)
        batch = payload.get("data", [])
        total = payload.get("total", 0)
        pages += 1
        if not batch:
            break
        new = 0
        for row in batch:
            player_id = row.get("playerId")
            if not player_id or player_id in found:
                continue
            found[player_id] = row
            new += 1
        print(
            f"  {label} {season_start}-{str(season_start + 1)[-2:]} "
            f"page {pages} ({len(found)}/{total})",
            flush=True,
        )
        if new == 0:
            raise RuntimeError(f"Pagination stuck for {report} {season_start} at start={start}.")
        start += len(batch)
        if start >= total:
            break
    if total is not None and len(found) != total:
        print(f"  warning: {report} {season_start} stored {len(found)} of {total}", flush=True)
    return found


def load_season(
    conn: sqlite3.Connection,
    season_start: int,
    role: str,
    refresh: bool,
) -> int:
    found: dict[int, dict] = {}
    if role == "skater":
        for player_id, row in fetch_report("skater/summary", season_start, refresh, "skater").items():
            found[player_id] = {
                "gp": int(row.get("gamesPlayed") or 0),
                "toi_per_game": row.get("timeOnIcePerGame"),
                "points": row.get("points"),
                "plus_minus": row.get("plusMinus"),
                "position_code": row.get("positionCode"),
                "goals": row.get("goals"),
                "assists": row.get("assists"),
                "shots": row.get("shots"),
                "pim": row.get("penaltyMinutes"),
                "sh_points": row.get("shPoints"),
                "player_name": row.get("skaterFullName"),
            }
        for report, fields in SKATER_EXTRA_REPORTS:
            extra = fetch_report(report, season_start, refresh, report.split("/")[1])
            for player_id, row in extra.items():
                target = found.get(player_id)
                if target is None:
                    continue
                for column, field in fields.items():
                    target[column] = row.get(field)
    else:
        for player_id, row in fetch_report("goalie/summary", season_start, refresh, "goalie").items():
            found[player_id] = {
                "gp": int(row.get("gamesPlayed") or 0),
                "points": row.get("points"),
                "games_started": row.get("gamesStarted"),
                "save_pct": row.get("savePct"),
                "shots_against": row.get("shotsAgainst"),
                "goals": row.get("goals"),
                "assists": row.get("assists"),
                "goals_against": row.get("goalsAgainst"),
                "time_on_ice": row.get("timeOnIce"),
                "saves": row.get("saves"),
                "pim": row.get("penaltyMinutes"),
                "player_name": row.get("goalieFullName"),
            }
    if not found:
        raise RuntimeError(f"No {role} rows for {season_start}. The stats endpoint may have changed.")

    conn.execute(
        "DELETE FROM player_seasons WHERE season_start = ? AND role = ?",
        (season_start, role),
    )
    columns = ", ".join(SEASON_COLUMNS)
    marks = ", ".join("?" for _ in SEASON_COLUMNS)
    conn.executemany(
        f"INSERT INTO player_seasons (player_id, season_start, role, {columns}) VALUES (?, ?, ?, {marks})",
        [
            (player_id, season_start, role, *(values.get(column) for column in SEASON_COLUMNS))
            for player_id, values in found.items()
        ],
    )
    return len(found)


def backfill_season_details(refresh_live: bool = True) -> None:
    """Re-read cached season pages so quality-game inputs are stored.

    Completed seasons stay on disk. The in-progress season is refreshed from
    the network when asked, and falls back to the cache if that call fails.
    """
    conn = connect()
    last_complete, in_progress = season_calendar()
    end_season = in_progress if in_progress else last_complete
    for season_start in range(FIRST_DRAFT_YEAR, end_season + 1):
        for role in ("skater", "goalie"):
            live = refresh_live and in_progress is not None and season_start == in_progress
            try:
                count = load_season(conn, season_start, role, refresh=live)
            except Exception as error:
                if not live:
                    raise
                print(f"  live {role} {season_start} failed ({error}); using cache", flush=True)
                count = load_season(conn, season_start, role, refresh=False)
            conn.execute(
                """
                INSERT INTO season_fetches (season_start, role, pages, rows, complete, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(season_start, role) DO UPDATE SET
                  rows = excluded.rows,
                  complete = excluded.complete,
                  fetched_at = excluded.fetched_at
                """,
                (
                    season_start,
                    role,
                    0,
                    count,
                    1 if season_start <= last_complete else 0,
                    date.today().isoformat(),
                ),
            )
            conn.commit()
            print(f"{role} {season_start}: {count} players with season detail", flush=True)
    conn.close()


def refresh_players(conn: sqlite3.Connection) -> None:
    today = date.today().isoformat()
    conn.execute("DELETE FROM players")
    conn.execute(
        """
        INSERT INTO players (player_id, name, position, career_gp, updated_at)
        SELECT
          p.player_id,
          MAX(p.player_name),
          MAX(p.position),
          COALESCE((
            SELECT SUM(s.gp) FROM player_seasons s WHERE s.player_id = p.player_id
          ), 0),
          ?
        FROM picks p
        WHERE p.player_id IS NOT NULL
        GROUP BY p.player_id
        """,
        (today,),
    )
    conn.commit()


def fetch_all(rebuild: bool = False) -> None:
    conn = connect()
    seed_aliases(conn)
    conn.commit()
    last_complete, in_progress = season_calendar()
    latest = latest_draft_year()
    print(
        f"last complete season {last_complete}-{last_complete + 1}, "
        f"in progress {in_progress}, latest draft {latest}",
        flush=True,
    )

    for year in range(FIRST_DRAFT_YEAR, latest + 1):
        existing = conn.execute(
            "SELECT COUNT(*) AS n FROM picks WHERE draft_year = ?",
            (year,),
        ).fetchone()["n"]
        # Years stored before origin details (league, birth date) were kept get
        # reloaded once. The raw draft response on disk already has them.
        detailed = conn.execute(
            "SELECT COUNT(*) AS n FROM picks WHERE draft_year = ? AND (amateur_league IS NOT NULL OR birth_date IS NOT NULL)",
            (year,),
        ).fetchone()["n"]
        needed = rebuild or existing == 0 or year >= latest - 1 or detailed == 0
        if not needed:
            print(f"draft {year}: cached ({existing})", flush=True)
            continue
        # Historical years may reuse a raw response already on disk.
        # The two newest classes are always refreshed; picks get corrected.
        load_draft_year(conn, year, refresh=rebuild or year >= latest - 1)

    end_season = in_progress if in_progress else last_complete
    for season_start in range(FIRST_DRAFT_YEAR, end_season + 1):
        for role in ("skater", "goalie"):
            if not _should_fetch_season(conn, season_start, role, last_complete, rebuild):
                print(f"{role} {season_start}: cached", flush=True)
                continue
            stored = conn.execute(
                "SELECT complete FROM season_fetches WHERE season_start = ? AND role = ?",
                (season_start, role),
            ).fetchone()
            # Live season, a rebuild, or a season that ended since the last run
            # must hit the network. A first-time historical load reuses the raw
            # cache when it exists so a crashed run does not download twice.
            just_ended = (
                stored is not None
                and stored["complete"] == 0
                and season_start <= last_complete
            )
            refresh_network = rebuild or season_start > last_complete or just_ended
            count = load_season(conn, season_start, role, refresh=refresh_network)
            conn.execute(
                """
                INSERT INTO season_fetches (season_start, role, pages, rows, complete, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(season_start, role) DO UPDATE SET
                  pages = excluded.pages,
                  rows = excluded.rows,
                  complete = excluded.complete,
                  fetched_at = excluded.fetched_at
                """,
                (
                    season_start,
                    role,
                    0,
                    count,
                    1 if season_start <= last_complete else 0,
                    date.today().isoformat(),
                ),
            )
            conn.commit()
            print(f"{role} {season_start}: {count} players", flush=True)

    refresh_players(conn)
    picks = conn.execute("SELECT COUNT(*) AS n FROM picks").fetchone()["n"]
    players = conn.execute("SELECT COUNT(*) AS n FROM players").fetchone()["n"]
    zeros = conn.execute(
        "SELECT COUNT(*) AS n FROM players WHERE career_gp = 0"
    ).fetchone()["n"]
    print(f"done: {picks} picks, {players} players, {zeros} with 0 career GP", flush=True)
    conn.close()


def sample() -> None:
    """Print one draft class and one stats page. Does not write the database."""
    print("SAMPLE draft 2005", flush=True)
    draft = get_json(draft_url(2005))
    print("total", draft.get("total"), "rows", len(draft.get("data", [])))
    first = draft["data"][0]
    print(
        json.dumps(
            {
                "year": first.get("draftYear"),
                "overall": first.get("overallPickNumber"),
                "team": first.get("triCode"),
                "playerId": first.get("playerId"),
                "name": first.get("playerName"),
                "position": first.get("position"),
            },
            indent=2,
        )
    )
    print("SAMPLE skater 2024-25 page 1", flush=True)
    skaters = get_json(stats_url("skater/summary", 2024, 0))
    print("total", skaters.get("total"), "page", len(skaters.get("data", [])))
    print("keys", sorted(skaters["data"][0].keys()))
    print("SAMPLE goalie 2024-25 page 1", flush=True)
    goalies = get_json(stats_url("goalie/summary", 2024, 0))
    row = goalies["data"][0]
    print(
        json.dumps(
            {
                "total": goalies.get("total"),
                "playerId": row.get("playerId"),
                "name": row.get("goalieFullName"),
                "gamesPlayed": row.get("gamesPlayed"),
                "seasonId": row.get("seasonId"),
            },
            indent=2,
        )
    )
    print("sample ok", flush=True)


if __name__ == "__main__":
    if "--sample" in sys.argv:
        sample()
    else:
        fetch_all(rebuild="--rebuild" in sys.argv)
