from pathlib import Path


def test_reindeer_rush_posts_scores_to_fjerde():
    content = Path("static/reindeer_rush.js").read_text()
    assert "gameId: 'advent-4'" in content
    assert "advent-3" not in content
