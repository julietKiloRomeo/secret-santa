from pathlib import Path


def test_anden_config_file_exists_and_keys():
    p = Path('static/anden_config.js')
    assert p.exists(), 'static/anden_config.js missing; add a friendly JS config with defaults'
    s = p.read_text()
    # Expect a global assignment so the browser can pick it up easily
    assert 'window.__ANDEN_CONFIG__' in s, 'Expected a global `window.__ANDEN_CONFIG__` assignment in static/anden_config.js'

    # Basic keys we expect the config to expose for tuning gameplay
    keys = [
        'gravityPerSecond',
        'flapVY',
        'baseSpeedPxPerS',
        'speedPerScorePxPerS',
        'playerXRatio',
        'leadOffsetXRatio',
        'secondOffsetXRatio',
        'thirdOffsetXRatioAdjust',
        'reindeerSpriteScale',
        'santaSpriteScale',
        'reindeerHitBoxScale',
        'gapRatio',
        'gapMin',
        'trailLengthMin',
        'spawnIntervalMsBase',
    ]
    missing = [k for k in keys if k not in s]
    assert not missing, f"Missing config keys in static/anden_config.js: {missing}"
