import os
import tempfile
import json


def setup_module(module):
    # Use a temporary database for scores
    fd, path = tempfile.mkstemp(prefix='.scores.test.forste_advent.', suffix='.sqlite3')
    os.close(fd)
    os.environ['SCORES_DB'] = path
    os.environ.setdefault('SECRET_KEY', 'test-secret-key')


def test_scores_api_top10_behavior():
    from app import app

    client = app.test_client()

    # Initially empty
    r = client.get('/api/scores/forste-advent')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data, dict)
    assert data['game'] == 'forste-advent'
    assert data['scores'] == []

    # Insert 12 scores
    entries = [
        ('jimmy', 12), ('emma', 9), ('klaus', 30), ('sara', 15),
        ('ditte', 7), ('mathias', 20), ('andreas', 5), ('tommy', 18),
        ('camilla', 22), ('jonna', 16), ('guest', 11), ('n1', 13)
    ]

    for name, score in entries:
        r = client.post(
            '/api/scores/forste-advent',
            data=json.dumps({'name': name, 'score': score}),
            content_type='application/json'
        )
        assert r.status_code == 200
        resp = r.get_json()
        assert resp['success'] is True

    # Fetch top 10
    r = client.get('/api/scores/forste-advent')
    assert r.status_code == 200
    data = r.get_json()
    scores = data['scores']
    assert len(scores) == 10
    # Sorted descending by score
    sorted_scores = sorted(entries, key=lambda t: t[1], reverse=True)[:10]
    for (exp_name, exp_score), item in zip(sorted_scores, scores):
        assert item['name'] == exp_name
        assert item['score'] == exp_score

