"""Pac-Santa art: every drawn sprite exists, is square, and has a transparent background; the view uses them."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "static" / "sprites" / "pac"
VIEW = ROOT / "static" / "pac_santa.js"
NAMES = ["santa", "ghost-red", "ghost-pink", "ghost-cyan", "ghost-frightened", "candy-cane", "cookie"]


def test_pac_sprites_exist_square_and_transparent():
    for name in NAMES:
        path = SPRITES / f"{name}.png"
        assert path.exists(), f"missing {name}"
        with Image.open(path) as im:
            assert im.size[0] == im.size[1] == 48, f"{name} is {im.size}, expected 48x48"
            assert im.mode == "RGBA", f"{name} has no alpha channel"
            assert im.getpixel((0, 0))[3] == 0, f"{name} background is not transparent"


def test_view_draws_pac_sprites():
    src = VIEW.read_text(encoding="utf-8")
    for key in ["santa", "ghost-red", "ghost-frightened", "candy-cane", "cookie"]:
        assert f"pac/{key}.png" in src, f"view does not load pac/{key}.png"
