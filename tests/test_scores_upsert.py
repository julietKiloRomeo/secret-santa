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


def test_score_upsert_keeps_single_entry_and_upgrades():
    from app import app

    client = app.test_client()

    # Submit an initial score
    r = client.post(
        '/api/scores/forste-advent',
        data=json.dumps({'name': 'testuser', 'score': 5}),
        content_type='application/json'
    )
    assert r.status_code == 200
    assert r.get_json()['success'] is True

    # Submit a lower score for same name -> should NOT downgrade
    r = client.post(
        '/api/scores/forste-advent',
        data=json.dumps({'name': 'testuser', 'score': 3}),
        content_type='application/json'
    )
    assert r.status_code == 200

    # Submit a higher score for same name -> should upgrade
    r = client.post(
        '/api/scores/forste-advent',
        data=json.dumps({'name': 'testuser', 'score': 9}),
        content_type='application/json'
    )
    assert r.status_code == 200

    # There should only be one entry and the score should be the highest (9)
    r = client.get('/api/scores/forste-advent')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data['scores'], list)
    # single entry
    assert len(data['scores']) == 1
    assert data['scores'][0]['name'] == 'testuser'
    assert data['scores'][0]['score'] == 9
