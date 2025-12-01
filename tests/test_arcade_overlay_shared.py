from pathlib import Path


def test_arcade_overlay_exports_shared_helpers():
    path = Path('static/arcade_overlay.js')
    assert path.exists(), 'Expected shared arcade overlay module at static/arcade_overlay.js'
    text = path.read_text()
    # Ensure we expose a global helper and the key functions for the mini games
    required_snippets = [
        'window.arcadeOverlay',
        'function showHighScores',
        'function showScoresCarousel',
        'function promptHighScoreEntry',
        'function hideOverlay',
    ]
    missing = [snippet for snippet in required_snippets if snippet not in text]
    assert not missing, f"Missing expected helper exports in arcade overlay: {missing}"
