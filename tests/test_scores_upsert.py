import os
import tempfile
import json

_ORIG_DATA_DIR = None
_ORIG_SCORES_DB = None


def setup_module(module):
    global _ORIG_DATA_DIR, _ORIG_SCORES_DB
    _ORIG_DATA_DIR = os.environ.pop('DATA_DIR', None)
    _ORIG_SCORES_DB = os.environ.get('SCORES_DB')
    fd, path = tempfile.mkstemp(prefix='.scores.test.upsert.', suffix='.sqlite3')
    os.close(fd)
    os.environ['SCORES_DB'] = path
    os.environ.setdefault('SECRET_KEY', 'test-secret-key')


def teardown_module(module):
    if _ORIG_SCORES_DB is None:
        os.environ.pop('SCORES_DB', None)
    else:
        os.environ['SCORES_DB'] = _ORIG_SCORES_DB
    if _ORIG_DATA_DIR is None:
        os.environ.pop('DATA_DIR', None)
    else:
        os.environ['DATA_DIR'] = _ORIG_DATA_DIR


def test_scores_allow_multiple_entries_and_sort_desc():
    from app import app

    client = app.test_client()
    from app import reset_scores_for_game
    reset_scores_for_game('forste-advent')

    # Submit three scores for the same name
    r = client.post(
        '/api/scores/forste-advent',
        data=json.dumps({'name': 'testuser', 'score': 5}),
        content_type='application/json'
    )
    assert r.status_code == 200
    assert r.get_json()['success'] is True

    r = client.post(
        '/api/scores/forste-advent',
        data=json.dumps({'name': 'testuser', 'score': 3}),
        content_type='application/json'
    )
    assert r.status_code == 200
    assert r.get_json()['success'] is True

    r = client.post(
        '/api/scores/forste-advent',
        data=json.dumps({'name': 'testuser', 'score': 9}),
        content_type='application/json'
    )
    assert r.status_code == 200
    assert r.get_json()['success'] is True

    # Leaderboard should contain all three entries sorted by score desc
    r = client.get('/api/scores/forste-advent')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data['scores'], list)
    assert [row['score'] for row in data['scores']] == [9, 5, 3]
    assert all(row['name'] == 'testuser' for row in data['scores'])


def test_low_scores_still_saved_even_when_leaderboard_full():
    from app import app, reset_scores_for_game

    client = app.test_client()
    reset_scores_for_game('forste-advent')

    # Seed 10 high scoring entries
    for i in range(10):
        payload = {'name': f'high{i}', 'score': 100 - i}
        r = client.post(
            '/api/scores/forste-advent',
            data=json.dumps(payload),
            content_type='application/json'
        )
        assert r.status_code == 200
        assert r.get_json()['success'] is True

    # Submit a very low score – should still be accepted even if not in top 10
    r = client.post(
        '/api/scores/forste-advent',
        data=json.dumps({'name': 'latecomer', 'score': 1}),
        content_type='application/json'
    )
    assert r.status_code == 200
    assert r.get_json()['success'] is True

    # Leaderboard remains the original top 10 high scores
    r = client.get('/api/scores/forste-advent')
    assert r.status_code == 200
    data = r.get_json()
    assert len(data['scores']) == 10
    assert data['scores'][0]['score'] == 100
    assert data['scores'][-1]['score'] == 91
