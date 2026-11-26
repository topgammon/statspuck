"""Franchise names, colours, and the drafting-team alias map.

Atlanta's picks belong to Winnipeg. Phoenix and Arizona belong to Utah.
The abbr on a pick is whoever actually made the selection that year.
"""

from __future__ import annotations

FRANCHISES: dict[str, dict[str, str]] = {
    "ANA": {"name": "Anaheim Ducks", "short": "Ducks", "color": "#FC4C02"},
    "BOS": {"name": "Boston Bruins", "short": "Bruins", "color": "#FFB81C"},
    "BUF": {"name": "Buffalo Sabres", "short": "Sabres", "color": "#5B8DEF"},
    "CGY": {"name": "Calgary Flames", "short": "Flames", "color": "#E03A3E"},
    "CAR": {"name": "Carolina Hurricanes", "short": "Hurricanes", "color": "#E03A3E"},
    "CHI": {"name": "Chicago Blackhawks", "short": "Blackhawks", "color": "#E31937"},
    "COL": {"name": "Colorado Avalanche", "short": "Avalanche", "color": "#C04A6B"},
    "CBJ": {"name": "Columbus Blue Jackets", "short": "Blue Jackets", "color": "#6B8CFF"},
    "DAL": {"name": "Dallas Stars", "short": "Stars", "color": "#2E9D57"},
    "DET": {"name": "Detroit Red Wings", "short": "Red Wings", "color": "#E31837"},
    "EDM": {"name": "Edmonton Oilers", "short": "Oilers", "color": "#FF4C00"},
    "FLA": {"name": "Florida Panthers", "short": "Panthers", "color": "#C8102E"},
    "LAK": {"name": "Los Angeles Kings", "short": "Kings", "color": "#C5CCD1"},
    "MIN": {"name": "Minnesota Wild", "short": "Wild", "color": "#2F9E6B"},
    "MTL": {"name": "Montreal Canadiens", "short": "Canadiens", "color": "#D11F32"},
    "NSH": {"name": "Nashville Predators", "short": "Predators", "color": "#FFB81C"},
    "NJD": {"name": "New Jersey Devils", "short": "Devils", "color": "#E31837"},
    "NYI": {"name": "New York Islanders", "short": "Islanders", "color": "#4C8DFF"},
    "NYR": {"name": "New York Rangers", "short": "Rangers", "color": "#4C7DFF"},
    "OTT": {"name": "Ottawa Senators", "short": "Senators", "color": "#E31837"},
    "PHI": {"name": "Philadelphia Flyers", "short": "Flyers", "color": "#F74902"},
    "PIT": {"name": "Pittsburgh Penguins", "short": "Penguins", "color": "#FFC72C"},
    "SJS": {"name": "San Jose Sharks", "short": "Sharks", "color": "#00B5BD"},
    "SEA": {"name": "Seattle Kraken", "short": "Kraken", "color": "#99D9D9"},
    "STL": {"name": "St. Louis Blues", "short": "Blues", "color": "#5B7CFF"},
    "TBL": {"name": "Tampa Bay Lightning", "short": "Lightning", "color": "#4C7DFF"},
    "TOR": {"name": "Toronto Maple Leafs", "short": "Maple Leafs", "color": "#6CA0E8"},
    "UTA": {"name": "Utah Mammoth", "short": "Mammoth", "color": "#8EC6F5"},
    "VAN": {"name": "Vancouver Canucks", "short": "Canucks", "color": "#6CA0E8"},
    "VGK": {"name": "Vegas Golden Knights", "short": "Golden Knights", "color": "#C4A35A"},
    "WSH": {"name": "Washington Capitals", "short": "Capitals", "color": "#E31837"},
    "WPG": {"name": "Winnipeg Jets", "short": "Jets", "color": "#8FB4E0"},
}

# abbr, franchise, name used while that abbr was drafting, first draft year, last draft year.
# last year None means the name is still current.
_SPECIAL = [
    ("ANA", "ANA", "Mighty Ducks of Anaheim", 2005, 2005),
    ("ANA", "ANA", "Anaheim Ducks", 2006, None),
    ("ATL", "WPG", "Atlanta Thrashers", 1999, 2011),
    ("PHX", "UTA", "Phoenix Coyotes", 1996, 2013),
    ("ARI", "UTA", "Arizona Coyotes", 2014, 2023),
    ("UTA", "UTA", "Utah Hockey Club", 2024, 2024),
    ("UTA", "UTA", "Utah Mammoth", 2025, None),
    ("WPG", "WPG", "Winnipeg Jets", 2011, None),
]


def alias_rows() -> list[tuple[str, str, str, int, int | None]]:
    special_abbrs = {row[0] for row in _SPECIAL}
    rows = list(_SPECIAL)
    for abbr, info in FRANCHISES.items():
        if abbr in special_abbrs:
            continue
        rows.append((abbr, abbr, info["name"], 2005, None))
    return rows


def lookup_team(abbr: str, year: int) -> tuple[str, str, str]:
    """Return franchise abbr, historic team name, current franchise name."""
    matches = [
        row
        for row in alias_rows()
        if row[0] == abbr and row[3] <= year and (row[4] is None or year <= row[4])
    ]
    if not matches:
        raise KeyError(f"No team alias for {abbr} in {year}. Add it to pipeline/teams.py.")
    matches.sort(key=lambda row: row[3], reverse=True)
    _abbr, franchise, historic, _start, _end = matches[0]
    return franchise, historic, FRANCHISES[franchise]["name"]
