from pathlib import Path


def test_anden_advent_refactor_helpers_present():
    p = Path('static/anden_advent.js')
    assert p.exists(), 'static/anden_advent.js missing'
    s = p.read_text()
    # Ensure the new clearer game-loop helper functions exist
    helpers = [
        'function updatePhysics(',
        'function updateObstacles(',
        'function updateBackground(',
        'function checkCollisions(',
        'function render('
    ]
    missing = [h for h in helpers if h not in s]
    assert not missing, f"Expected refactor helpers in static/anden_advent.js, missing: {missing}"

