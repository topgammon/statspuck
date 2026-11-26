"""Find a public photo for every general manager in gm_eras.json.

Source: the Wikipedia REST summary API (images are from Wikimedia Commons).

https://en.wikipedia.org/api/rest_v1/page/summary/{title}

Writes data/draft-rater/gm_photos.json as
{person: {"photoUrl": str | null, "pageUrl": str | null, "checked": "YYYY-MM-DD"}}.
Names are tried as "Name (ice hockey)" first, then "Name", and a page only counts
if it is clearly about a hockey person. Anyone without a match keeps a null photo,
and the site shows the suit-and-tie silhouette. Found photos are kept; misses are
retried after 30 days.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / "data" / "draft-rater" / "gm_photos.json"
ERAS_PATH = ROOT / "gm_eras.json"
USER_AGENT = "DraftRaterBot/1.0 (hockey stats research)"
RETRY_DAYS = 30
HOCKEY_WORDS = ("hockey", "nhl", "general manager")

# Wikipedia titles for names the two-step lookup cannot find on its own.
TITLE_OVERRIDES: dict[str, str] = {}


PAUSE = 1.2  # seconds between requests, to stay well inside Wikimedia's limits


class Unavailable(Exception):
    """Wikipedia is rate limiting or down. Stop and try again on the next run."""


def summary(title: str) -> dict | None:
    """The page summary, None if there is no such page. Raises Unavailable on rate limits or outages."""
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_"), safe="()_")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(4):
        time.sleep(PAUSE)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if error.code not in {429, 500, 502, 503, 504}:
                return None
            wait = error.headers.get("Retry-After") if error.headers else None
            time.sleep(min(float(wait), 120) if wait and wait.isdigit() else 5 * 2**attempt)
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * 2**attempt)
    raise Unavailable(title)


def is_hockey_person(page: dict) -> bool:
    if page.get("type") != "standard":
        return False
    text = f"{page.get('description', '')} {page.get('extract', '')}".lower()
    return any(word in text for word in HOCKEY_WORDS)


def lookup(person: str) -> dict:
    titles = [TITLE_OVERRIDES[person]] if person in TITLE_OVERRIDES else [f"{person} (ice hockey)", person]
    for title in titles:
        page = summary(title)
        if page and is_hockey_person(page):
            image = (page.get("thumbnail") or {}).get("source")
            if image:
                image = image.split("?")[0]
            page_url = ((page.get("content_urls") or {}).get("desktop") or {}).get("page")
            return {"photoUrl": image, "pageUrl": page_url}
    return {"photoUrl": None, "pageUrl": None}


def main() -> None:
    eras = json.loads(ERAS_PATH.read_text(encoding="utf-8"))["eras"]
    people = sorted({era["person"] for era in eras})
    known: dict[str, dict] = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    today = date.today()
    stale = today - timedelta(days=RETRY_DAYS)
    pending = [
        person
        for person in people
        if person not in known
        or (not known[person].get("photoUrl") and date.fromisoformat(known[person].get("checked", "2000-01-01")) < stale)
    ]
    print(f"gm photos: {len(people)} GMs, {len(pending)} to look up", flush=True)
    for person in pending:
        try:
            found = lookup(person)
        except Unavailable:
            print(f"gm photos: Wikipedia is busy, stopping at {person}; the rest retry next run", flush=True)
            break
        known[person] = {**found, "checked": today.isoformat()}
    known = {person: known[person] for person in people if person in known}
    OUT.write_text(json.dumps(known, indent=1, ensure_ascii=False), encoding="utf-8")
    with_photo = sum(1 for value in known.values() if value.get("photoUrl"))
    print(f"gm photos: {with_photo} of {len(known)} have a photo", flush=True)


if __name__ == "__main__":
    main()
