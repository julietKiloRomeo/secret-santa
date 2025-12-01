import os
import tempfile
import json


def setup_module(module):
    fd, path = tempfile.mkstemp(prefix='.scores.test.upsert.anden.', suffix='.sqlite3')
    os.close(fd)
    os.environ['SCORES_DB'] = path
    os.environ.setdefault('SECRET_KEY', 'test-secret-key')


def test_scores_allow_duplicates_for_anden_advent():
    from app import app, reset_scores_for_game

    client = app.test_client()
    reset_scores_for_game('anden-advent')

    scores = [4, 2, 11]
    for value in scores:
        r = client.post(
            '/api/scores/anden-advent',
            data=json.dumps({'name': 'santa-fan', 'score': value}),
            content_type='application/json'
        )
        assert r.status_code == 200
        assert r.get_json()['success'] is True

    # Leaderboard should list three entries sorted desc, even with same name repeated
    r = client.post(
        '/api/scores/anden-advent',
        data=json.dumps({'name': 'santa-fan', 'score': 6}),
        content_type='application/json'
    )
    assert r.status_code == 200
    assert r.get_json()['success'] is True

    r = client.get('/api/scores/anden-advent')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data['scores'], list)
    assert len(data['scores']) == 4
    assert [row['score'] for row in data['scores']] == [11, 6, 4, 2]
    assert all(row['name'] == 'santa-fan' for row in data['scores'])
