"""Permanent historical contract comparables archive (2005-2026).

Input:  pipelines/draft-rater/historical_contracts_seed.json   (hand-compiled public contract facts:
        player, position group, first season, term, AAV)
        data/nhl-cap-history.json                              (official cap ceiling by season)
        data/draft-rater/nhl.sqlite                            (our NHL season stats since 2005-06)
Output: data/historical-contracts.json

For each contract we attach, from our own database:
  ageAtSigning   - age on Oct 1 of the deal's first season (birth date from the NHL player feed)
  preImpact82    - Impact per 82 games over the two seasons before the deal (goalies: per season)
  preSkill       - era-adjusted skill: that pace as a z-score against the same seasons' regulars
                   at his position, on the site's 0-99 Overall scale (72 + 9z)
  signingCapPct  - AAV / cap ceiling in the deal's first season

Run once (and again only if the seed list changes). No paid or restricted sources involved.
"""

from __future__ import annotations

import json
import statistics
import unicodedata
from pathlib import Path

from fetch_nhl import connect, get_json
from grade_quality import league_context, load_inputs, position_group, season_quality

ROOT = Path(__file__).resolve().parents[2]
SEED = Path(__file__).resolve().parent / "historical_contracts_seed.json"
CAPS = ROOT / "data" / "nhl-cap-history.json"
NAMES = ROOT / "data" / "draft-rater" / "season_stats.json"
OUT = ROOT / "data" / "historical-contracts.json"


def norm(name: str) -> str:
    text = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode().lower()
    return "".join(ch for ch in text if ch.isalnum())


def main() -> None:
    seed = json.loads(SEED.read_text(encoding="utf-8"))["contracts"]
    caps = {int(k): v for k, v in json.loads(CAPS.read_text(encoding="utf-8"))["ceiling"].items()}
    names = json.loads(NAMES.read_text(encoding="utf-8"))["names"]
    by_name: dict[str, list[str]] = {}
    for pid, name in names.items():
        by_name.setdefault(norm(name), []).append(pid)

    conn = connect()
    _picks, seasons = load_inputs(conn)
    conn.close()
    _toi, save_avg = league_context(seasons)

    def impact(pid: int, season: int, group: str) -> tuple[float, int]:
        roles = seasons.get(pid, {}).get(season, {})
        role = "goalie" if group == "G" else "skater"
        row = roles.get(role)
        if not row:
            return 0.0, 0
        value, gp = season_quality(row, role, group, season, {}, save_avg)
        return value, gp

    def pace(pid: int, start: int, group: str) -> tuple[float | None, int]:
        total, games, played = 0.0, 0, 0
        for season in (start - 2, start - 1):
            value, gp = impact(pid, season, group)
            total += value
            games += gp
            played += 1 if gp else 0
        if games < (20 if group == "G" else 40):
            return None, games
        return (total / max(1, played)) if group == "G" else total / games * 82, games

    # Era pools: every player's two-season pace before each signing year, per position group.
    pools: dict[tuple[int, str], list[float]] = {}

    def pool(start: int, group: str) -> list[float]:
        key = (start, group)
        if key not in pools:
            values = []
            for pid, by_season in seasons.items():
                role = "goalie" if group == "G" else "skater"
                rows = [by_season.get(s, {}).get(role) for s in (start - 2, start - 1)]
                rows = [r for r in rows if r]
                if not rows:
                    continue
                if group != "G" and position_group(rows[-1].get("position")) != group:
                    continue
                gp = sum(r["gp"] for r in rows)
                if gp < (60 if group == "G" else 120):
                    continue
                p, _ = pace(pid, start, group)
                if p is not None:
                    values.append(p)
            pools[key] = values
        return pools[key]

    out, missing = [], []
    for name, group, start, term, aav_m in seed:
        ids = by_name.get(norm(name), [])
        if len(ids) > 1:
            # Same name, different players (e.g. two Elias Petterssons): take the one at this
            # position who played the most in the two seasons before the deal.
            def recent(pid_text: str) -> int:
                role = "goalie" if group == "G" else "skater"
                return sum((seasons.get(int(pid_text), {}).get(s, {}).get(role) or {}).get("gp", 0) for s in (start - 2, start - 1, start))
            ids = [max(ids, key=recent)]
        if len(ids) != 1:
            missing.append(f"{name} ({len(ids)} matches)")
            continue
        pid = int(ids[0])
        aav = int(round(aav_m * 1_000_000))
        cap = caps.get(start)
        if not cap:
            missing.append(f"{name}: no cap for {start}")
            continue
        birth = None
        try:
            birth = get_json(f"https://api-web.nhle.com/v1/player/{pid}/landing", refresh=False).get("birthDate")
        except Exception:  # noqa: BLE001
            pass
        age = None
        if birth:
            y, m, d = (int(x) for x in birth.split("-"))
            age = start - y - (1 if (m, d) > (10, 1) else 0)
        pre, games = pace(pid, start, group)
        skill = None
        if pre is not None:
            values = pool(start, group)
            if len(values) >= 20:
                mean = statistics.fmean(values)
                sd = statistics.pstdev(values) or 1
                skill = max(35, min(99, round(72 + 9 * (pre - mean) / sd)))
        out.append(
            {
                "playerId": pid,
                "playerName": names.get(str(pid), name),
                "position": group,
                "signingYear": start,
                "ageAtSigning": age,
                "aav": aav,
                "term": term,
                "capAtSigning": cap,
                "signingCapPct": round(aav / cap, 4),
                "preImpact82": None if pre is None else round(pre, 1),
                "preGames": games,
                "preSkill": skill,
            }
        )
    out.sort(key=lambda row: (row["signingYear"], row["playerName"]))
    OUT.write_text(
        json.dumps(
            {
                "note": "Hand-compiled public NHL contract facts (player, first season, term, AAV) with stats attached from StatsPuck's own database. See pipelines/draft-rater/historical_contracts_seed.json.",
                "contracts": out,
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"historical contracts: {len(out)} written, {len(missing)} skipped", flush=True)
    for line in missing:
        print("  skipped:", line, flush=True)


if __name__ == "__main__":
    main()
