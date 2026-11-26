"""Draft origin labels: clean league names, feeder groups, and club names.

The records draft feed stores leagues like "SWEDEN-JR.", "H-EAST", "HIGH-MN" or
"USDP". The site shows a clean league ("Sweden Jr.", "NCAA", "US High School",
"USNTDP") and groups each pick into one feeder bucket for the draft class filters:
OHL, WHL, QMJHL, USHL/NCAA, Sweden, Finland, Russia, Other.
"""

from __future__ import annotations

FEEDERS = ["OHL", "WHL", "QMJHL", "USHL/NCAA", "Sweden", "Finland", "Russia", "Other"]

_NCAA = {"H-EAST", "HOCKEY EAST", "CCHA", "WCHA", "ECAC", "BIG10", "BIG 10", "BIG TEN", "NCHC", "AHA", "ATLANTIC HOCKEY", "CHA", "NCAA", "NCAA-III"}
_NTDP = {"USDP", "NTDP", "NTDP - USHL", "USNTDP", "U.S. NATIONAL U18", "USA U-18", "USA U-17"}
_CAN_JR_A = {"BCHL", "AJHL", "SJHL", "MJHL", "OJHL", "OPJHL", "OPJRA", "CCHL", "CJHL", "GOJHL", "KIJHL", "MJAHL", "QJAAAHL", "SMITH FALLS"}
_US_JR = {"NAHL", "EJHL", "USPHL PRE.", "USPHL - NCDC", "USPHL", "NCDC", "MWEHL", "USMAAAE", "USMAAA", "USMHL", "US EAST", "US WEST"}

# Exact raw value -> clean league label.
_LABELS = {
    "OHL": "OHL",
    "WHL": "WHL",
    "QMJHL": "QMJHL",
    "LHJMQ": "QMJHL",
    "CHL": "CHL",
    "USHL": "USHL",
    "SWEDEN": "SHL",
    "SHL": "SHL",
    "SWEDEN-2": "Allsvenskan",
    "SWE-2": "Allsvenskan",
    "HOCKEYALLSVENSKAN": "Allsvenskan",
    "SWEDEN-3": "Sweden-3",
    "SWE-3": "Sweden-3",
    "SWEDEN-JR.": "Sweden Jr.",
    "SWEDEN-JR. U18": "Sweden U18",
    "SWE-JR. U18": "Sweden U18",
    "SWEDEN-JR. 2": "Sweden Jr.",
    "J20 ELIT": "Sweden Jr.",
    "J20 NATIONELL": "Sweden Jr.",
    "J18 ALLSVENSKAN": "Sweden U18",
    "J18 ELIT": "Sweden U18",
    "FINLAND": "Liiga",
    "LIIGA": "Liiga",
    "SM-LIIGA": "Liiga",
    "FINLAND-2": "Mestis",
    "MESTIS": "Mestis",
    "FINLAND-JR.": "Finland Jr.",
    "FINLAND JR.": "Finland Jr.",
    "FINLAND JR-2": "Finland Jr.",
    "U20 SM-SARJA": "Finland Jr.",
    "FINLAND-JR. U18": "Finland U18",
    "FIN-JR. U18": "Finland U18",
    "U18 SM-SARJA": "Finland U18",
    "RUSSIA": "KHL",
    "KHL": "KHL",
    "RUS": "KHL",
    "RUS-KHL": "KHL",
    "RSL": "KHL",
    "RUSSIA-2": "VHL",
    "VHL": "VHL",
    "RUSSIA-3": "Russia-3",
    "RUSSIA-JR.": "MHL",
    "RUSSIA JR. 2": "MHL",
    "MHL": "MHL",
    "AHL": "AHL",
}

_COUNTRY_LEAGUES = {
    "CZREP": "Czechia", "CZECHIA": "Czechia", "CZE": "Czechia", "CZECH": "Czechia", "CZECH REPUBLIC": "Czechia", "EXTRALIGA": "Czechia",
    "CZREP-2": "Czechia-2", "CZREP-JR.": "Czechia Jr.", "CZE JR.": "Czechia Jr.", "CZECHIA-JR.": "Czechia Jr.", "CZREP-JR. U18": "Czechia Jr.",
    "SLOVAKIA": "Slovakia", "SVK": "Slovakia", "SLOVAKIA-2": "Slovakia-2", "SVK-2": "Slovakia-2", "SLOVAKIA-JR.": "Slovakia Jr.", "SVK JR.": "Slovakia Jr.",
    "SWISS": "Switzerland", "SUI": "Switzerland", "NL": "Switzerland", "SWISS-2": "Switzerland-2", "SWISS-3": "Switzerland-3", "SWISS-JR.": "Switzerland Jr.",
    "GERMANY": "Germany", "DEL": "Germany", "GERMAN-2": "Germany-2", "GERMAN-3": "Germany-3", "GERMANY-JR.": "Germany Jr.", "GERMAN-JR.": "Germany Jr.",
    "BELARUS": "Belarus", "BLR": "Belarus", "BELARUS-2": "Belarus-2", "BLR JR.": "Belarus Jr.",
    "LATVIA": "Latvia", "LAT": "Latvia", "NORWAY": "Norway", "DENMARK": "Denmark", "DENMARK-2": "Denmark-2",
    "AUSTRIA-2": "Austria-2", "FRANCE": "France", "ENGLAND": "England", "UKRAINE": "Ukraine", "KAZAKHSTAN U20": "Kazakhstan Jr.",
}


def clean_league(raw: str | None) -> str | None:
    """Human league label for a raw league string, or None."""
    if not raw:
        return None
    name = " ".join(raw.split())
    upper = name.upper()
    if upper in _LABELS:
        return _LABELS[upper]
    if upper in _NTDP:
        return "USNTDP"
    if upper in _NCAA or upper.startswith("NCAA"):
        return "NCAA"
    if upper.startswith("HIGH-") or upper.startswith("USHS") or upper in {"HS-MN", "HIGH SCHOOL"}:
        return "US High School"
    if upper in _CAN_JR_A:
        return upper if upper not in {"SMITH FALLS", "OPJRA"} else "CCHL" if upper == "SMITH FALLS" else "OPJHL"
    if upper in _US_JR:
        return "NAHL" if upper == "NAHL" else "EJHL" if upper == "EJHL" else "USPHL" if upper.startswith("USPHL") or upper == "NCDC" else "US Jr."
    if upper in _COUNTRY_LEAGUES:
        return _COUNTRY_LEAGUES[upper]
    return name


def feeder_for(league: str | None, country: str | None = None) -> str:
    """One of FEEDERS for a clean league label."""
    if league in {"OHL", "WHL", "QMJHL"}:
        return league
    if league in {"USHL", "USNTDP", "NCAA", "US High School", "NAHL", "EJHL", "USPHL", "US Jr."}:
        return "USHL/NCAA"
    if league in {"SHL", "Allsvenskan", "Sweden-3", "Sweden Jr.", "Sweden U18"}:
        return "Sweden"
    if league in {"Liiga", "Mestis", "Finland Jr.", "Finland U18"}:
        return "Finland"
    if league in {"KHL", "VHL", "Russia-3", "MHL"}:
        return "Russia"
    if league is None:
        # No league on file at all: fall back on the obvious country buckets.
        if country == "SWE":
            return "Sweden"
        if country == "FIN":
            return "Finland"
        if country == "RUS":
            return "Russia"
    return "Other"


def clean_club(club: str | None, league: str | None) -> str | None:
    """Club name as fans know it. The national development team is listed as 'USA U-18'."""
    if not club:
        return None
    name = " ".join(club.split())
    if league == "USNTDP" or name.upper() in _NTDP:
        return "USNTDP"
    return name


def _self_check() -> None:
    assert clean_league("SWEDEN-JR.") == "Sweden Jr."
    assert clean_league("H-EAST") == "NCAA"
    assert clean_league("HIGH-MN") == "US High School"
    assert clean_league("USDP") == "USNTDP"
    assert clean_league("RUSSIA-JR.") == "MHL"
    assert feeder_for("NCAA") == "USHL/NCAA"
    assert feeder_for("MHL") == "Russia"
    assert feeder_for("BCHL") == "Other"
    assert clean_club("USA U-18", "USNTDP") == "USNTDP"


_self_check()
