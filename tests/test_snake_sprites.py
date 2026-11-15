"""Snake art: gift skins and the head exist, are square with transparent backgrounds; the view draws them."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "static" / "sprites" / "snake"
VIEW = ROOT / "static" / "forste_advent.js"
NAMES = ["gift-red", "gift-green", "gift-blue", "candy", "sock", "cookie", "head"]


def test_snake_sprites_exist_square_and_transparent():
    for name in NAMES:
        path = SPRITES / f"{name}.png"
        assert path.exists(), f"missing {name}"
        with Image.open(path) as im:
            assert im.size[0] == im.size[1] == 48, f"{name} is {im.size}, expected 48x48"
            assert im.mode == "RGBA", f"{name} has no alpha channel"
            assert im.getpixel((0, 0))[3] == 0, f"{name} background is not transparent"


def test_view_draws_snake_sprites_not_emoji():
    src = VIEW.read_text(encoding="utf-8")
    assert "snake/" in src, "view does not load snake sprites"
    assert "this.add.text(0, 0, '', { fontSize" not in src, "view still draws emoji text"
