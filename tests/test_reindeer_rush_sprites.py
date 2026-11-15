"""Reindeer Rush art: the Rudolph frames are wired in and every drawn sprite exists at the expected size."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "static" / "sprites"
VIEW = ROOT / "static" / "reindeer_rush.js"

RUDOLPH_RUN = [f"rudolph/run-{i}.png" for i in range(1, 7)]
RUDOLPH_OTHER = ["rudolph/jump-1.png", "rudolph/slide.png"]


def test_rudolph_frames_exist_and_share_a_size():
    sizes = set()
    for name in RUDOLPH_RUN + RUDOLPH_OTHER:
        path = SPRITES / name
        assert path.exists(), f"missing {name}"
        with Image.open(path) as im:
            sizes.add(im.size)
    assert len(sizes) == 1, f"Rudolph frames differ in size: {sizes}"


def test_view_uses_rudolph_frames_for_run_jump_and_slide():
    src = VIEW.read_text(encoding="utf-8")
    assert "rudolph/run-" in src
    assert "rudolph/jump-1.png" in src
    assert "rudolph/slide.png" in src


def test_view_no_longer_uses_the_cartoon_reindeer():
    src = VIEW.read_text(encoding="utf-8")
    assert "'rr/run.png'" not in src
    assert "'rr/jump.png'" not in src
    assert "'rr/slide.png'" not in src


def test_snowman_art_matches_its_hitbox_aspect():
    # Design: the snowman is drawn at exactly its collision box, 40 x 40 design px (see reindeer_core.js).
    with Image.open(SPRITES / "rr" / "snowman.png") as im:
        w, h = im.size
    assert (
        abs((w / h) - 1.0) < 0.15
    ), f"snowman art is {w}x{h}, expected roughly square like its 40x40 hitbox"
