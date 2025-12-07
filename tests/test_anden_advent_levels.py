from pathlib import Path


def test_level_thresholds_and_preview_constants_declared():
    text = Path('static/anden_advent.js').read_text()
    assert 'const LEVEL_TWO_SCORE = 25' in text, 'New level at score 25 must be documented'
    assert 'const LEVEL_THREE_SCORE = 50' in text, 'Second level-up threshold missing'
    assert 'const PREVIEW_LEAD_MS = 1000' in text, 'Gap preview lead-time should be 1s (1000ms)'


def test_gap_indicator_and_levelup_helpers_wired():
    text = Path('static/anden_advent.js').read_text()
    required_snippets = [
        'function updateLevelProgress(',
        'function drawGapIndicator(',
        'drawGapIndicator();',
        'Level up!',
    ]
    missing = [snip for snip in required_snippets if snip not in text]
    assert not missing, f"Missing level/indicator helpers in static/anden_advent.js: {missing}"
