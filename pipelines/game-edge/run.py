"""Nightly Game Edge + Ref Watch data refresh.

    python pipelines/game-edge/run.py              # fetch new games, rebuild all outputs
    python pipelines/game-edge/run.py --skip-fetch # rebuild outputs from the stored games
    python pipelines/game-edge/run.py --fetch-only # just grow the game store

Seasons: the three most recent (the historical seed) including the one in progress.
"""

from __future__ import annotations

import argparse
import datetime as dt

from store import sync

FIRST_SEASON = 2024  # 2024-25, 2025-26 and 2026-27


def current_season(today: dt.date | None = None) -> int:
    today = today or dt.date.today()
    return today.year if today.month >= 9 else today.year - 1


def seasons() -> list[int]:
    now = current_season()
    return list(range(max(FIRST_SEASON, now - 2), now + 1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-fetch", action="store_true")
    parser.add_argument("--fetch-only", action="store_true")
    args = parser.parse_args()
    window = seasons()
    if not args.skip_fetch:
        sync(window)
    if args.fetch_only:
        return
    from build import build_all  # noqa: PLC0415 - heavy imports only when building

    build_all(window, current_season())


if __name__ == "__main__":
    main()
