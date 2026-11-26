"""NHL trades for 2005-06 through 2008-09, from Wikipedia's season transaction lists.

The trade log we use for 2009-10 onward (capwages.com) does not go back further. Wikipedia keeps a
free table of every trade for those seasons: a date, then what each team received. This module turns
those tables into the same shape as the other trade pages so the rest of the pipeline treats them alike.

Only two-team trades are read (the tables list what each side received, so who sent what is clear).
Anything it cannot read cleanly is skipped and counted, never guessed.
"""

from __future__ import annotations

import datetime as dt
import re
import time
import urllib.parse
import urllib.request

from teams import FRANCHISES

USER_AGENT = "StatsPuckBot/1.0 (hockey stats research; contact via statspuck.com)"
FIRST_WIKI_SEASON = 2005
LAST_WIKI_SEASON = 2008  # 2008-09 is the last season before the capwages log begins

MONTHS = {m: i + 1 for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"])}
ORDINAL = r"(\d)(?:st|nd|rd|th)"

NAME_ALIASES = {
    "mighty ducks of anaheim": "ANA",
    "phoenix coyotes": "UTA",
    "arizona coyotes": "UTA",
    "atlanta thrashers": "WPG",
    "utah hockey club": "UTA",
    "montreal canadiens": "MTL",
}
TEAM_BY_NAME = {info["name"].lower(): abbr for abbr, info in FRANCHISES.items()}
TEAM_BY_NAME.update(NAME_ALIASES)
ABBR_ALIASES = {"PHX": "UTA", "ARI": "UTA", "ATL": "WPG", "TB": "TBL", "NJ": "NJD", "LA": "LAK", "SJ": "SJS", "T.B": "TBL", "N.J": "NJD", "L.A": "LAK", "S.J": "SJS"}


def slug_for(abbr: str) -> str:
    """Team slug in the same style the capwages pages use (e.g. 'new_york_rangers')."""
    name = FRANCHISES[abbr]["name"].lower().replace(".", "")
    return re.sub(r"[^a-z0-9]+", "_", name).strip("_")


def fetch_wikitext(season: int) -> str:
    title = f"{season}–{str(season + 1)[2:]} NHL transactions"
    url = f"https://en.wikipedia.org/w/index.php?title={urllib.parse.quote(title.replace(' ', '_'))}&action=raw"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def strip_markup(text: str) -> str:
    text = re.sub(r"<sup[^>]*>.*?</sup>", "", text, flags=re.S)
    text = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", "", text, flags=re.S)
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"'''?|<[^>]+>|\{\{[^}]*\}\}", "", text)
    return re.sub(r"\s+", " ", text).strip()


def team_abbr(raw: str) -> str | None:
    return TEAM_BY_NAME.get(raw.strip().lower())


def parse_pieces(body: str, giver: str, trade_year: int) -> list[dict]:
    """Pieces a team received. `giver` is the other team's abbr (the original owner of an unmarked pick)."""
    tokens = [t for t in re.split(r"<br\s*/?>", body) if strip_markup(t)]
    pieces: list[dict] = []
    index = 0
    while index < len(tokens):
        raw = tokens[index]
        plain = strip_markup(raw)
        index += 1
        pick = re.search(rf"{ORDINAL}-round pick in \[\[(\d{{4}})", raw)
        if pick:
            # The next line or two are details: "(PHX - #59 - Name)", possibly wrapped over several lines.
            detail = ""
            while index < len(tokens):
                nxt = strip_markup(tokens[index])
                is_detail = (nxt.startswith("(") and not re.search(r"round pick", nxt)) or re.search(r"#\d+", nxt) or (detail and detail.count("(") > detail.count(")"))
                if not is_detail or re.search(r"round pick", nxt):
                    break
                detail += " " + nxt
                index += 1
                if detail.count("(") <= detail.count(")"):
                    break
            text = raw + " " + detail
            origin = giver
            tag = re.search(r"\|([A-Z]{2,3})\]\]", text) or re.search(r"\(([A-Z]{2,3}) -", strip_markup(text))
            if tag:
                code = ABBR_ALIASES.get(tag.group(1), tag.group(1))
                if code in FRANCHISES:
                    origin = code
            slot = re.search(r"#(\d+)", strip_markup(text))
            pieces.append({"kind": "pick", "round": int(pick.group(1)), "year": int(pick.group(2)), "overall": int(slot.group(1)) if slot else None, "origin": origin})
            continue
        low = plain.lower()
        if not plain or plain.startswith("(") or low.startswith("or ") or re.search(r"consideration|cash|undisclosed|^to be|negotiating rights|^\d+(st|nd|rd|th)", low):
            continue
        name = re.sub(r"^rights to\s+", "", plain, flags=re.I)
        name = re.sub(r"\s*\(.*?\)\s*$", "", name).strip()
        if len(name.split()) >= 2 and len(name) < 40 and not re.search(r"\d", name):
            pieces.append({"kind": "player", "name": name})
    return pieces


def parse_date(text: str) -> dt.date | None:
    match = re.search(r"([A-Za-z]+)\d*\s+(\d{1,2}),\s*(\d{4})", strip_markup(text))
    if not match or match.group(1).lower() not in MONTHS:
        return None
    try:
        return dt.date(int(match.group(3)), MONTHS[match.group(1).lower()], int(match.group(2)))
    except ValueError:
        return None


def parse_season(text: str) -> tuple[list[dict], int]:
    """Trades in one season's wikitext, in the capwages page shape, plus how many rows were skipped."""
    start = re.search(r"==\s*Trades\s*==", text)
    if not start:
        return [], 0
    end = re.search(r"==\s*(Waivers|See also|Free agents|Signings)", text[start.end() :])
    section = text[start.end() : start.end() + end.start()] if end else text[start.end() :]
    trades: list[dict] = []
    skipped = 0
    used_ids: dict[str, int] = {}
    for chunk in re.split(r"\n\|-[^\n]*\n", section):
        cells = []
        for line in chunk.split("\n"):
            if line.startswith("|}") or line.startswith("{|"):
                continue
            if line.startswith("|"):
                cells.append(re.sub(r"^\|\s*(?:valign=\"?top\"?\s*\|)?\s*", "", line))
            elif cells:
                cells[-1] += "\n" + line
        if len(cells) < 3:
            continue
        when = parse_date(cells[0])
        teams = []
        for cell in cells[1:]:
            match = re.match(r"\s*To\s+\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*(?:<hr\s*/?>)?(.*)", cell, flags=re.S)
            if not match or not team_abbr(match.group(1)):
                teams = []
                break
            teams.append((team_abbr(match.group(1)) or "", match.group(2)))
        if when is None or len(teams) != 2 or teams[0][0] == teams[1][0]:
            skipped += 1
            continue
        (abbr_a, body_a), (abbr_b, body_b) = teams
        items = []
        for receiver, body, giver in ((abbr_a, body_a, abbr_b), (abbr_b, body_b, abbr_a)):
            for piece in parse_pieces(body, giver, when.year):
                base = {"from": slug_for(giver), "to": slug_for(receiver)}
                if piece["kind"] == "player":
                    items.append({**base, "type": "player", "name": piece["name"]})
                else:
                    items.append(
                        {
                            **base,
                            "type": "draft_pick",
                            "year": str(piece["year"]),
                            "round": piece["round"],
                            "overall": piece["overall"],
                            "originTeam": slug_for(piece["origin"]),
                        }
                    )
        if not items:
            skipped += 1
            continue
        base_id = f"{when.isoformat()}-{abbr_a}-{abbr_b}"
        used_ids[base_id] = used_ids.get(base_id, 0) + 1
        trade_id = base_id if used_ids[base_id] == 1 else f"{base_id}-{used_ids[base_id]}"
        trades.append({"id": trade_id, "date": when.isoformat(), "teams": [slug_for(abbr_a), slug_for(abbr_b)], "items": items})
    return trades, skipped


def wiki_pages() -> list[tuple[str, list[dict]]]:
    """[(season label, trades)] for 2005-06 through 2008-09."""
    pages = []
    for season in range(FIRST_WIKI_SEASON, LAST_WIKI_SEASON + 1):
        trades, skipped = parse_season(fetch_wikitext(season))
        label = f"{season}-{str(season + 1)[2:]}"
        print(f"wiki trades {label}: {len(trades)} trades read, {skipped} rows skipped", flush=True)
        pages.append((label, trades))
        time.sleep(1.0)
    return pages


if __name__ == "__main__":
    wiki_pages()
