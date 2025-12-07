from pathlib import Path


def test_duplicate_score_pill_removed_client_side():
    """Ensure the JS removes the redundant HUD score pill so only the canvas remains."""
    js = Path('static/anden_advent.js').read_text()
    assert 'function removeDuplicateScorePill' in js, (
        'Expected helper that cleans up the legacy #santa-score pill.'
    )
    assert 'removeDuplicateScorePill();' in js, (
        'Call the helper early in static/anden_advent.js so duplicate score text disappears.'
    )
