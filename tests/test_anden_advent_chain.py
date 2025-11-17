from pathlib import Path


def test_anden_advent_chain_markers():
    p = Path('static/anden_advent.js')
    assert p.exists(), 'static/anden_advent.js missing'
    s = p.read_text()
    # These are simple smoke checks to ensure the chain behavior is implemented
    assert 'const TRAIL_LENGTH' in s, 'Expected TRAIL_LENGTH constant'
    assert ('const trail' in s) or ('let trail' in s), 'Expected trail buffer variable'
    assert 'trail.unshift' in s, 'Expected trail to be updated each frame'
    assert ('drawReindeerAt(' in s) or ('drawReindeerAt ' in s), 'Expected helper to draw reindeer at trail positions'

