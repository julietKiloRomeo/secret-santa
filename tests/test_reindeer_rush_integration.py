import json
import os
import tempfile


TEST_DB_KEY = 'SCORES_DB'


def setup_module(module):
    fd, path = tempfile.mkstemp(prefix='.scores.test.reindeer_rush.integration.', suffix='.sqlite3')
    os.close(fd)
    os.environ[TEST_DB_KEY] = path
    os.environ.setdefault('SECRET_KEY', 'test-secret-key')


def teardown_module(module):
    path = os.environ.pop(TEST_DB_KEY, None)
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


def test_reindeer_rush_score_submission_flow():
    from app import app

    client = app.test_client()

    payload = {'name': 'elf-test', 'score': 128}
    response = client.post(
        '/api/scores/reindeer-rush',
        data=json.dumps(payload),
        content_type='application/json'
    )
    assert response.status_code == 200
    resp_json = response.get_json()
    assert resp_json['success'] is True

    leaderboard_resp = client.get('/api/scores/reindeer-rush')
    assert leaderboard_resp.status_code == 200
    data = leaderboard_resp.get_json()
    assert data['game'] == 'reindeer-rush'
    assert data['scores'], 'Expected at least one leaderboard entry'
    top_score = data['scores'][0]
    assert top_score['name'] == 'elf-test'
    assert top_score['score'] == 128
    assert 'created_at' in top_score
