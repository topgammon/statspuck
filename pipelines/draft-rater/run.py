"""Refresh the database, refit the curves, and redraw the share cards.

    python pipeline/run.py --sample     # one draft and one stats page
    python pipeline/run.py              # incremental update
    python pipeline/run.py --rebuild    # refetch every season from the network
    python pipeline/run.py --skip-fetch # refit and redraw from the database
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from asset_data import build as build_asset_data
from cards import render
from fetch_awards import build as fetch_awards, due as awards_due
from fetch_bios import main as fetch_bios
from fetch_contracts import main as fetch_contracts
from fetch_trades import build as build_trades
from fetch_gm_photos import main as fetch_gm_photos
from fetch_nhl import fetch_all, sample
from fetch_debuts import build as fetch_debuts
from fetch_edge import build as fetch_edge
from fetch_ironman import build as fetch_ironman
from fetch_lottery import build as fetch_lottery
from fetch_paths import main as fetch_paths
from fetch_playoffs import build as fetch_playoffs
from fetch_rosters import main as fetch_rosters
from model import build
from season_stats import build as build_season_stats


CONTRACTS_FILE = Path(__file__).resolve().parents[2] / "data" / "contracts.json"
CONTRACT_REFRESH_DAYS = 30


def contracts_due() -> bool:
    """Contracts change rarely, so they are re-synced about once a month, not nightly."""
    try:
        as_of = json.loads(CONTRACTS_FILE.read_text(encoding="utf-8")).get("asOf")
        return (dt.date.today() - dt.date.fromisoformat(as_of)).days >= CONTRACT_REFRESH_DAYS
    except (OSError, ValueError, TypeError):
        return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Update Draft Rater data.")
    parser.add_argument("--sample", action="store_true", help="Print a small API sample and stop.")
    parser.add_argument("--rebuild", action="store_true", help="Refetch completed seasons too.")
    parser.add_argument("--skip-fetch", action="store_true", help="Use the database as it stands.")
    parser.add_argument("--skip-cards", action="store_true", help="Skip share-card images.")
    parser.add_argument("--contracts", action="store_true", help="Re-sync contracts now, even if the monthly refresh is not due.")
    args = parser.parse_args()
    if args.sample:
        sample()
        return
    if not args.skip_fetch:
        fetch_all(rebuild=args.rebuild)
        # Side data. Each step keeps its last saved file if the source is down.
        fetch_rosters()
        fetch_gm_photos()
        fetch_paths()
        fetch_bios()
        if args.contracts or contracts_due():
            fetch_contracts()
        else:
            print(f"contracts: last synced under {CONTRACT_REFRESH_DAYS} days ago; skipping (monthly)", flush=True)
        fetch_playoffs()
        fetch_lottery()
    build()
    build_trades()
    build_asset_data()
    build_season_stats()
    if not args.skip_fetch:
        fetch_edge()  # needs nhlers.json from build_asset_data
        fetch_ironman()  # needs season_stats.json
        fetch_debuts()  # needs season_stats.json
        if awards_due():
            fetch_awards()  # monthly: trophies change once a year
    if not args.skip_cards:
        render()


if __name__ == "__main__":
    main()
