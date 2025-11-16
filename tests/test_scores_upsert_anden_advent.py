import os
import tempfile
import json


def setup_module(module):
    fd, path = tempfile.mkstemp(prefix='.scores.test.upsert.anden.', suffix='.sqlite3')
    os.close(fd)
    os.environ['SCORES_DB'] = path
    os.environ.setdefault('SECRET_KEY', 'test-secret-key')


def test_score_upsert_anden_advent():
    from app import app

    client = app.test_client()

    # Submit an initial score
    r = client.post(
        '/api/scores/anden-advent',
        data=json.dumps({'name': 'santa-fan', 'score': 4}),
        content_type='application/json'
    )
    assert r.status_code == 200
    assert r.get_json()['success'] is True

    # Submit a lower score for same name -> should NOT downgrade
    r = client.post(
        '/api/scores/anden-advent',
        data=json.dumps({'name': 'santa-fan', 'score': 2}),
        content_type='application/json'
    )
    assert r.status_code == 200

    # Submit a higher score for same name -> should upgrade
    r = client.post(
        '/api/scores/anden-advent',
        data=json.dumps({'name': 'santa-fan', 'score': 11}),
        content_type='application/json'
    )
    assert r.status_code == 200

    # There should only be one entry and the score should be the highest (11)
    r = client.get('/api/scores/anden-advent')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data['scores'], list)
    assert len(data['scores']) == 1
    assert data['scores'][0]['name'] == 'santa-fan'
    assert data['scores'][0]['score'] == 11

