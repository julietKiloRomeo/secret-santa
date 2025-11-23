import os
import json
import datetime
import tempfile
from pathlib import Path
from werkzeug.security import generate_password_hash


def setup_module(module):
    # Use a temporary env file for tests
    year = datetime.datetime.now().year
    env_path = Path(f".env.test.admin_games.{year}")
    os.environ["ENV_FILE"] = str(env_path)
    os.environ["SECRET_KEY"] = "test-secret-key"

    # Admin user (jimmy) hashed passphrase
    env_lines = [
        f"SECRET_KEY={os.environ['SECRET_KEY']}\n",
        f"LOGIN_jimmy={generate_password_hash('cozy-winter-lantern')}\n",
        f"LOGIN_ditte={generate_password_hash('horse-staple-orange')}\n",
        f"LOGIN_emma={generate_password_hash('quiet-forest-breeze')}\n",
    ]
    env_path.write_text("".join(env_lines))

    # Ensure a current-year assignment file exists before importing app
    assignments_path = Path(f"secret-santa-{year}.json")
    if not assignments_path.exists():
        assignment = {"jimmy": "camilla"}
        assignments_path.write_text(json.dumps(assignment))
    # Use a temporary scores database
    fd, path = tempfile.mkstemp(prefix='.scores.test.admin_games.', suffix='.sqlite3')
    os.close(fd)
    os.environ['SCORES_DB'] = path


def login_as(client, name, code):
    return client.post(
        "/api/login",
        data=json.dumps({"name": name, "code": code}),
        content_type="application/json",
    )


def test_admin_toggle_and_visibility():
    from app import app

    client = app.test_client()

    # Unauthenticated users should not be able to reach the subpage
    r = client.get('/forste-advent')
    assert r.status_code in (401, 302)

    # Login as admin and disable the game
    resp = login_as(client, 'jimmy', 'cozy-winter-lantern')
    assert resp.status_code == 200
    r = client.post('/api/admin/set_game', data=json.dumps({'game': 'forste-advent', 'enabled': False}), content_type='application/json')
    assert r.status_code == 200

    # Non-admin (logged-in) should now see Under Construction
    client2 = app.test_client()
    assert login_as(client2, 'emma', 'quiet-forest-breeze').status_code == 200
    r = client2.get('/forste-advent')
    html = r.get_data(as_text=True)
    assert 'snake-canvas' not in html
    assert 'Under Construction' in html

    # Admin still sees the game
    r = client.get('/forste-advent')
    html = r.get_data(as_text=True)
    assert 'snake-canvas' in html

    # Re-enable the game
    r = client.post('/api/admin/set_game', data=json.dumps({'game': 'forste-advent', 'enabled': True}), content_type='application/json')
    assert r.status_code == 200
    r = client2.get('/forste-advent')
    html = r.get_data(as_text=True)
    assert 'snake-canvas' in html


def test_admin_reset_scores():
    from app import app

    client = app.test_client()

    # Submit a score
    r = client.post('/api/scores/anden-advent', data=json.dumps({'name': 'temp', 'score': 7}), content_type='application/json')
    assert r.status_code == 200

    r = client.get('/api/scores/anden-advent')
    data = r.get_json()
    assert len(data['scores']) == 1

    # Login as admin and reset
    resp = login_as(client, 'jimmy', 'cozy-winter-lantern')
    assert resp.status_code == 200
    r = client.post('/api/admin/reset_scores', data=json.dumps({'game': 'anden-advent'}), content_type='application/json')
    assert r.status_code == 200

    r = client.get('/api/scores/anden-advent')
    data = r.get_json()
    assert data['scores'] == []


def test_all_mini_games_disable_flag():
    from app import app

    client = app.test_client()
    assert login_as(client, 'jimmy', 'cozy-winter-lantern').status_code == 200
    mini_games = [
        ('forste-advent', '/forste-advent'),
        ('anden-advent', '/anden-advent'),
        ('tredje-advent', '/tredje-advent'),
        ('fjerde-advent', '/fjerde-advent'),
        ('glaedelig-jul', '/glaedelig-jul'),
    ]
    for game, path in mini_games:
        resp = client.post('/api/admin/set_game', data=json.dumps({'game': game, 'enabled': False}), content_type='application/json')
        assert resp.status_code == 200
        non_admin = app.test_client()
        assert login_as(non_admin, 'emma', 'quiet-forest-breeze').status_code == 200
        r = non_admin.get(path)
        html = r.get_data(as_text=True)
        assert 'Under Construction' in html
        resp = client.post('/api/admin/set_game', data=json.dumps({'game': game, 'enabled': True}), content_type='application/json')
        assert resp.status_code == 200
