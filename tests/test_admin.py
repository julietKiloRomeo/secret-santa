import os
import json
import datetime
from pathlib import Path
from werkzeug.security import generate_password_hash


NAMES = [
    "jimmy",
    "camilla",
    "klaus",
    "jonna",
    "ditte",
    "mathias",
    "tommy",
    "sara",
    "emma",
    "andreas",
]


def setup_module(module):
    # Use a temporary env file for tests
    year = datetime.datetime.now().year
    env_path = Path(f".env.test.{year}")
    os.environ["ENV_FILE"] = str(env_path)
    os.environ["SECRET_KEY"] = "test-secret-key"

    # Admin user (jimmy) hashed passphrase
    env_lines = [
        f"SECRET_KEY={os.environ['SECRET_KEY']}\n",
        f"LOGIN_jimmy={generate_password_hash('cozy-winter-lantern')}\n",
        f"LOGIN_ditte={generate_password_hash('horse-staple-orange')}\n",
    ]
    env_path.write_text("".join(env_lines))

    # Ensure a current-year assignment file exists before importing app
    assignments_path = Path(f"secret-santa-{year}.json")
    if not assignments_path.exists():
        # Create a simple rotation mapping (not enforcing constraints for the test initial state)
        mapping = {name: NAMES[(i + 1) % len(NAMES)] for i, name in enumerate(NAMES)}
        assignments_path.write_text(json.dumps(mapping))


def login_as(client, name, code):
    return client.post(
        "/api/login",
        data=json.dumps({"name": name, "code": code}),
        content_type="application/json",
    )


def test_admin_requires_login():
    from app import app

    client = app.test_client()
    resp = client.get("/admin")
    assert resp.status_code in (401, 302)  # unauthorized or redirect to login page


def test_admin_access_and_set_password_and_run_matches():
    from app import app

    client = app.test_client()

    # Login as admin (jimmy)
    resp = login_as(client, "jimmy", "cozy-winter-lantern")
    assert resp.status_code == 200

    # Access admin page
    resp = client.get("/admin")
    assert resp.status_code == 200

    # Set a password for emma
    new_phrase = "quiet-forest-breeze"
    resp = client.post(
        "/api/admin/set_password",
        data=json.dumps({"name": "emma", "passphrase": new_phrase}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True

    # Verify emma can log in with the new passphrase
    resp = login_as(client, "emma", new_phrase)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["name"] == "emma"
    assert "recipient" in data

    # Trigger re-generation of matches and ensure app uses the updated file
    resp = client.post("/api/admin/run_matches")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert "year" in data
    year = data["year"]

    # The app should present current year's matches; verify file exists and app's state matches file contents
    saved = json.loads(Path(f"secret-santa-{year}.json").read_text())
    assert isinstance(saved, dict) and len(saved) == len(NAMES)
