import os
import json
import datetime
import importlib
from pathlib import Path
from werkzeug.security import generate_password_hash


def test_run_matches_blocked_and_button_disabled(tmp_path, monkeypatch):
    # Prepare a separate env file and ensure DRAW_LOCKED is set for this test
    year = datetime.datetime.now().year
    env_path = tmp_path / f".env.test.locked.{year}"
    env_lines = [
        f"SECRET_KEY=test-secret-key\n",
        f"LOGIN_jimmy={generate_password_hash('cozy-winter-lantern')}\n",
        f"LOGIN_ditte={generate_password_hash('horse-staple-orange')}\n",
    ]
    env_path.write_text("".join(env_lines))

    monkeypatch.setenv('ENV_FILE', str(env_path))
    monkeypatch.setenv('DRAW_LOCKED', '1')

    # Reload app so it picks up the env changes
    if 'app' in globals():
        importlib.reload(globals()['app'])
    import app
    importlib.reload(app)

    client = app.app.test_client()

    # Login as admin (jimmy)
    r = client.post('/api/login', data=json.dumps({'name': 'jimmy', 'code': 'cozy-winter-lantern'}), content_type='application/json')
    assert r.status_code == 200

    # Attempt to run matches — should be blocked (403)
    r = client.post('/api/admin/run_matches')
    assert r.status_code == 403
    data = r.get_json()
    assert data is not None and data.get('error')

    # Admin page should render a disabled run button
    r = client.get('/admin')
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert 'id="runMatchesBtn"' in html
    # ensure disabled attribute is present on the button tag
    idx = html.index('id="runMatchesBtn"')
    end = html.index('>', idx)
    snippet = html[idx:end]
    assert 'disabled' in snippet

