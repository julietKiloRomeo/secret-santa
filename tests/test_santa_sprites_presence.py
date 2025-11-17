from pathlib import Path


def test_sprite_files_exist():
    base = Path('static/sprites')
    files = [
        'reindeer1.png',
        'reindeer2.png',
        'reindeer3.png',
        'santa_sleigh.png',
    ]
    missing = [str(base / f) for f in files if not (base / f).exists()]
    assert not missing, f"Missing sprite files: {missing}"

