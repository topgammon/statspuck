"""Share cards for team grades, featured picks, and GM eras.

Wide images are the Open Graph size (1200x630). Square images are for
feeds that crop to a tile. Both are written under public/og.
"""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data" / "draft-rater"
PUBLIC = ROOT.parents[1] / "public" / "draft-rater"
OG = PUBLIC / "og"
LOGO = ROOT.parents[1] / "public" / "statspuck-logo-480.png"
FONTS = ROOT / "fonts"

MUGS = ROOT / "cache" / "mugs"
WIDE = (1200, 630)
SQUARE = (1080, 1080)
BG = (7, 8, 12)
INK = (244, 244, 245)
MUTED = (161, 161, 170)
DIM = (113, 113, 122)
GREEN = (61, 220, 151)
RED = (255, 77, 77)


def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def _fit(draw: ImageDraw.ImageDraw, text: str, font_name: str, size: int, max_width: int, floor: int = 28) -> ImageFont.FreeTypeFont:
    while size > floor:
        font = _font(font_name, size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 2
    return _font(font_name, floor)


def _hex(value: str) -> tuple[int, int, int]:
    value = value.removeprefix("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def _signed(value: float | None) -> str:
    if value is None:
        return "—"
    text = f"{value:.1f}"
    return f"+{text}" if value > 0 else text


def _canvas(size: tuple[int, int], color: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", size, BG)
    draw = ImageDraw.Draw(image)
    accent = _hex(color)
    draw.rectangle((0, 0, 16, size[1]), fill=accent)
    draw.rectangle((0, 0, size[0], 8), fill=accent)
    return image, draw


def _logo(image: Image.Image, box: int, xy: tuple[int, int]) -> None:
    if not LOGO.exists():
        return
    logo = Image.open(LOGO).convert("RGBA")
    logo.thumbnail((box, box), Image.Resampling.LANCZOS)
    image.paste(logo, xy, logo)


def _paint(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font: ImageFont.FreeTypeFont, fill, gap: int = 14) -> int:
    """Draw text and return the next y, using the real glyph box so lines do not collide."""
    draw.text((x, y), text, font=font, fill=fill)
    _left, _top, _right, bottom = draw.textbbox((x, y), text, font=font)
    return bottom + gap


def _footer(draw: ImageDraw.ImageDraw, width: int, height: int) -> None:
    font = _font("Barlow-Medium.ttf", 22)
    draw.text((48, height - 52), "STATSPUCK · DRAFT RATER", font=font, fill=INK)
    label = "statspuck.com/draft-rater"
    draw.text((width - 48 - draw.textlength(label, font=font), height - 52), label, font=font, fill=DIM)


def _save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def _team_card(team: dict, size: tuple[int, int]) -> Image.Image:
    image, draw = _canvas(size, team["color"])
    square = size[0] == size[1]
    _logo(image, 210 if square else 150, (size[0] - (250 if square else 186), 36 if square else 28))
    y = _paint(draw, 48, 36 if not square else 52, "TEAM GRADE", _font("Barlow-SemiBold.ttf", 22), MUTED, 10)
    name_font = _fit(draw, team["name"].upper(), "Oswald-Bold.ttf", 58 if not square else 68, size[0] - 280)
    y = _paint(draw, 48, y, team["name"].upper(), name_font, INK, 8)
    letter_size = 170 if not square else 230
    y = _paint(draw, 48, y + (8 if not square else 24), team["letter"], _font("Oswald-Bold.ttf", letter_size), INK, 16)
    y = _paint(draw, 48, y, f"{team['rating']} / 100", _font("Oswald-Medium.ttf", 34), _hex(team["color"]), 8)
    score = _signed(team["avg"])
    score_color = GREEN if team["avg"] > 0 else RED if team["avg"] < 0 else INK
    y = _paint(draw, 48, y, f"{score} vs the slot", _font("Barlow-Bold.ttf", 28), score_color, 8)
    developing = f"  ·  {team['developing']} prospects" if team.get("developing") else ""
    _paint(
        draw,
        48,
        y,
        f"{team['n']} graded picks{developing}",
        _font("Barlow-Regular.ttf", 22),
        MUTED,
        0,
    )
    _footer(draw, size[0], size[1])
    return image


def _cover_top(image: Image.Image, width: int, height: int) -> Image.Image:
    image = image.convert("RGBA")
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    left = max(0, (resized.width - width) // 2)
    return resized.crop((left, 0, left + width, height))


def _silhouette(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (20, 22, 28, 255))
    draw = ImageDraw.Draw(image)
    ink = (58, 61, 70, 255)
    draw.ellipse((size * 0.33, size * 0.16, size * 0.67, size * 0.50), fill=ink)
    draw.pieslice((size * 0.16, size * 0.58, size * 0.84, size * 1.35), 180, 360, fill=ink)
    return image


def _mug(player_id: int | None) -> Image.Image | None:
    if not player_id:
        return None
    MUGS.mkdir(parents=True, exist_ok=True)
    path = MUGS / f"{player_id}.png"
    if not path.exists():
        request = urllib.request.Request(
            f"https://assets.nhle.com/mugs/nhl/latest/{player_id}.png",
            headers={"User-Agent": "DraftRating/0.1 (share cards; caches headshots)"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                if "default-" in response.geturl():
                    return None
                data = response.read()
            if len(data) == 11875:
                return None
            with Image.open(io.BytesIO(data)) as probe:
                probe.verify()
            path.write_bytes(data)
        except (urllib.error.URLError, TimeoutError, OSError, Image.UnidentifiedImageError):
            return None
    if path.stat().st_size == 11875:
        return None
    try:
        with Image.open(path) as photo:
            return photo.convert("RGBA")
    except (OSError, Image.UnidentifiedImageError):
        path.unlink(missing_ok=True)
        return None


def _portrait(player_id: int | None, size: int, color: str, has_headshot: bool = False) -> Image.Image:
    plate = Image.new("RGBA", (size, size), (20, 22, 28, 255))
    photo = _mug(player_id) if has_headshot else None
    photo = _silhouette(size) if photo is None else _cover_top(photo, size, size)
    plate.paste(photo, (0, 0), photo)
    mask = Image.new("L", (size, size), 0)
    radius = max(16, size // 8)
    ImageDraw.Draw(mask).rounded_rectangle((1, 1, size - 2, size - 2), radius=radius, fill=255)
    plate.putalpha(mask)
    edge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        (2, 2, size - 3, size - 3),
        radius=radius,
        outline=(*_hex(color), 255),
        width=max(4, size // 36),
    )
    plate.alpha_composite(edge)
    return plate


def _stage(pick: dict) -> str:
    plus = pick.get("draftPlus")
    if plus is None:
        return f"Year {pick.get('milestone', '')}"
    if plus <= 0:
        return "Not started"
    if plus > 8:
        return "Retired" if "RETIRED" in (pick.get("stamps") or []) else "Veteran"
    return f"Draft +{plus}"


def _pick_card(pick: dict, kicker: str, size: tuple[int, int]) -> Image.Image:
    image, draw = _canvas(size, pick["color"])
    square = size[0] == size[1]
    photo = 250 if square else 210
    portrait = _portrait(pick.get("playerId"), photo, pick["color"], bool(pick.get("hasHeadshot")))
    image.paste(portrait, (size[0] - photo - 40, 48 if not square else 64), portrait)
    text_width = size[0] - photo - 140
    y = _paint(draw, 48, 36 if not square else 56, kicker, _font("Barlow-SemiBold.ttf", 22), _hex(pick["color"]), 12)
    name_font = _fit(draw, pick["name"], "DejaVuSans-Bold.ttf", 72 if not square else 80, text_width, floor=32)
    y = _paint(draw, 48, y, pick["name"], name_font, INK, 12)
    where = f"{pick['year']}  ·  Round {pick['round']}  ·  Pick {pick['overall']}"
    y = _paint(draw, 48, y, where, _font("Barlow-Medium.ttf", 26), MUTED, 6)
    team_font = _fit(draw, pick["teamName"], "Barlow-Regular.ttf", 26, text_width, floor=18)
    y = _paint(draw, 48, y, pick["teamName"], team_font, MUTED, 18)
    score = _signed(pick["score"])
    score_color = GREEN if (pick["score"] or 0) > 0 else RED if (pick["score"] or 0) < 0 else INK
    y = _paint(draw, 48, y, score, _font("Oswald-Bold.ttf", 104 if not square else 132), score_color, 10)
    caption = "Prospect" if pick.get("developing") else f"{pick.get('letter') or ''}  ·  quality games vs the slot"
    y = _paint(draw, 48, y, caption, _font("Barlow-Medium.ttf", 24), MUTED, 8)
    line = f"{_stage(pick)}   ·   {pick.get('qg', pick['gp'])} quality   ·   {pick['expected']} expected"
    _paint(draw, 48, y, line, _font("Barlow-Regular.ttf", 22), INK, 0)
    _footer(draw, size[0], size[1])
    return image


def _era_card(era: dict, size: tuple[int, int]) -> Image.Image:
    image, draw = _canvas(size, era["color"])
    square = size[0] == size[1]
    y = _paint(draw, 48, 36 if not square else 56, f"{era['role'].upper()} ERA", _font("Barlow-SemiBold.ttf", 22), _hex(era["color"]), 12)
    person = _fit(draw, era["person"], "DejaVuSans-Bold.ttf", 64 if not square else 72, size[0] - 96, floor=32)
    y = _paint(draw, 48, y, era["person"], person, INK, 10)
    end = str(era["endYear"]) if era["endYear"] else "present"
    span = f"{era['teamName']}  ·  {era['startYear']}–{end}"
    span_font = _fit(draw, span, "Barlow-Regular.ttf", 26, size[0] - 96, floor=18)
    y = _paint(draw, 48, y, span, span_font, MUTED, 16)
    if era["letter"]:
        mark = era["letter"]
        mark_size = 180 if not square else 240
        detail = f"{_signed(era['avg'])} vs the slot   ·   {era['n']} graded   ·   {era.get('developing', 0)} prospects"
    elif era["n"] == 0:
        mark = "NOT YET"
        mark_size = 100
        detail = "No graded picks in this era yet."
    else:
        mark = "EARLY"
        mark_size = 100
        detail = f"{_signed(era['avg'])} vs the slot across {era['n']} graded picks. Sample is too small for a letter."
    y = _paint(draw, 48, y, mark, _font("Oswald-Bold.ttf", mark_size), INK, 16)
    detail_font = _fit(draw, detail, "Barlow-Regular.ttf", 22, size[0] - 96, floor=16)
    _paint(draw, 48, y, detail, detail_font, MUTED, 0)
    _footer(draw, size[0], size[1])
    return image


def _home_card(leader: dict, headlines: dict, size: tuple[int, int]) -> Image.Image:
    image, draw = _canvas(size, "#E11D48")
    square = size[0] == size[1]
    _logo(image, 280 if square else 200, ((size[0] - (280 if square else 200)) // 2, 36 if not square else 70))
    title = "DRAFT RATER"
    font = _font("Oswald-Bold.ttf", 92 if not square else 96)
    draw.text(((size[0] - draw.textlength(title, font=font)) / 2, 250 if not square else 380), title, font=font, fill=INK)
    sub = "Who actually wins the NHL draft"
    sub_font = _font("Barlow-Regular.ttf", 28)
    draw.text(((size[0] - draw.textlength(sub, font=sub_font)) / 2, 360 if not square else 500), sub, font=sub_font, fill=MUTED)
    line = f"Leader  {leader['name']}  {leader['letter']}"
    line_font = _font("Barlow-SemiBold.ttf", 26)
    draw.text(((size[0] - draw.textlength(line, font=line_font)) / 2, 430 if not square else 580), line, font=line_font, fill=_hex(leader["color"]))
    steal = headlines["steal"]
    steal_line = f"Steal of the draft  {steal['name']}  {_signed(steal['score'])}"
    steal_font = _fit(draw, steal_line, "Barlow-Regular.ttf", 22, size[0] - 120, floor=16)
    draw.text(((size[0] - draw.textlength(steal_line, font=steal_font)) / 2, 480 if not square else 640), steal_line, font=steal_font, fill=DIM)
    _footer(draw, size[0], size[1])
    return image


def _method_card(size: tuple[int, int]) -> Image.Image:
    image, draw = _canvas(size, "#E11D48")
    draw.text((48, 70), "HOW IT WORKS", font=_font("Barlow-SemiBold.ttf", 22), fill=MUTED)
    draw.text((48, 120), "QUALITY VS\nTHE SLOT", font=_font("Oswald-Bold.ttf", 92), fill=INK)
    copy = "Each pick is scored on NHL play since the draft,\nminus what that slot has usually produced by the same year."
    draw.text((48, 360), copy, font=_font("Barlow-Regular.ttf", 28), fill=MUTED)
    _footer(draw, size[0], size[1])
    return image


def _class_card(row: dict, size: tuple[int, int]) -> Image.Image:
    image, draw = _canvas(size, "#E11D48")
    square = size[0] == size[1]
    y = _paint(draw, 48, 48 if not square else 80, "DRAFT CLASS", _font("Barlow-SemiBold.ttf", 22), MUTED, 8)
    y = _paint(draw, 48, y, f"{row['year']} DRAFT", _font("Oswald-Bold.ttf", 78 if not square else 92), INK, 8)
    y = _paint(draw, 48, y, row.get("letter") or "—", _font("Oswald-Bold.ttf", 150 if not square else 200), INK, 8)
    score = _signed(row.get("avg"))
    color = GREEN if (row.get("avg") or 0) > 0 else RED if (row.get("avg") or 0) < 0 else INK
    _paint(draw, 48, y, f"{score} vs the slot", _font("Barlow-Bold.ttf", 32), color, 0)
    _footer(draw, size[0], size[1])
    return image


def render() -> None:
    leaderboard = json.loads((DATA / "leaderboard.json").read_text(encoding="utf-8"))
    headlines = json.loads((DATA / "headlines.json").read_text(encoding="utf-8"))
    eras = json.loads((DATA / "eras.json").read_text(encoding="utf-8"))
    index: dict = {"teams": {}, "picks": {}, "eras": {}, "classes": {}, "home": "/draft-rater/og/home.png", "method": "/draft-rater/og/method.png"}

    for size, suffix in ((WIDE, ""), (SQUARE, "-sq")):
        _save(_home_card(leaderboard[0], headlines, size), OG / f"home{suffix}.png")
        _save(_method_card(size), OG / f"method{suffix}.png")

    for team in leaderboard:
        for size, suffix in ((WIDE, ""), (SQUARE, "-sq")):
            _save(_team_card(team, size), OG / "teams" / f"{team['abbr']}{suffix}.png")
        index["teams"][team["abbr"]] = f"/draft-rater/og/teams/{team['abbr']}.png"

    featured = [
        (headlines["steal"], "steal", "STEAL OF THE DRAFT"),
        (headlines["bust"], "bust", "BIGGEST BUST"),
    ]
    for team in leaderboard:
        featured.append((team["best"], "best", "BEST PICK"))
        featured.append((team["worst"], "worst", "WORST PICK"))
    seen: set[tuple[int, str]] = set()
    for pick, kind, kicker in featured:
        key = (pick["id"], kind)
        if key in seen:
            continue
        seen.add(key)
        for size, suffix in ((WIDE, ""), (SQUARE, "-sq")):
            _save(_pick_card(pick, kicker, size), OG / "picks" / f"{pick['id']}-{kind}{suffix}.png")
        index["picks"].setdefault(str(pick["id"]), {})[kind] = f"/draft-rater/og/picks/{pick['id']}-{kind}.png"

    classes = json.loads((DATA / "classes.json").read_text(encoding="utf-8"))
    for row in classes:
        for size, suffix in ((WIDE, ""), (SQUARE, "-sq")):
            _save(_class_card(row, size), OG / "classes" / f"{row['year']}{suffix}.png")
        index["classes"][str(row["year"])] = f"/draft-rater/og/classes/{row['year']}.png"

    for era in eras:
        for size, suffix in ((WIDE, ""), (SQUARE, "-sq")):
            _save(_era_card(era, size), OG / "eras" / f"{era['slug']}{suffix}.png")
        index["eras"][era["slug"]] = f"/draft-rater/og/eras/{era['slug']}.png"

    (DATA / "og.json").write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    print(f"cards: {len(list(OG.rglob('*.png')))} pngs")


if __name__ == "__main__":
    render()
