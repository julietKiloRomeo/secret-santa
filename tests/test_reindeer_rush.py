import os
import tempfile
import json


def setup_module(module):
    # Use a temporary database for scores
    fd, path = tempfile.mkstemp(prefix='.scores.test.reindeer_rush.', suffix='.sqlite3')
    os.close(fd)
    os.environ['SCORES_DB'] = path
    os.environ.setdefault('SECRET_KEY', 'test-secret-key')


def test_reindeer_rush_scores_top10_and_upsert():
    from app import app

    client = app.test_client()

    # Initially empty
    r = client.get('/api/scores/reindeer-rush')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data, dict)
    assert data['game'] == 'reindeer-rush'
    assert data['scores'] == []

    # Insert multiple scores
    entries = [
        ('alice', 40), ('bob', 9), ('carol', 30), ('dan', 15),
        ('eve', 7), ('frank', 20), ('gary', 5), ('heidi', 18),
        ('ivan', 22), ('judy', 16), ('guest', 11), ('k1', 13)
    ]

    for name, score in entries:
        r = client.post(
            '/api/scores/reindeer-rush',
            data=json.dumps({'name': name, 'score': score}),
            content_type='application/json'
        )
        assert r.status_code == 200
        resp = r.get_json()
        assert resp['success'] is True

    # Fetch top 10
    r = client.get('/api/scores/reindeer-rush')
    assert r.status_code == 200
    data = r.get_json()
    scores = data['scores']
    assert len(scores) == 10
    # Sorted descending by score
    sorted_scores = sorted(entries, key=lambda t: t[1], reverse=True)[:10]
    for (exp_name, exp_score), item in zip(sorted_scores, scores):
        assert item['name'] == exp_name
        assert item['score'] == exp_score

