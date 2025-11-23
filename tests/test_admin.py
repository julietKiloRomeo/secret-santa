import os
import sys
import json
import datetime
import shutil
from pathlib import Path
from werkzeug.security import generate_password_hash
import importlib

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

storage = importlib.import_module('storage')
get_data_dir = storage.get_data_dir
match_file_path = storage.match_file_path


_ORIG_DATA_DIR = None
_ORIG_ENV_FILE = None


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
    global _ORIG_DATA_DIR, _ORIG_ENV_FILE
    _ORIG_DATA_DIR = os.environ.get("DATA_DIR")
    _ORIG_ENV_FILE = os.environ.get("ENV_FILE")
    # Use a temporary env file for tests
    year = datetime.datetime.now().year
    data_dir = Path(f".data.test.{year}")
    data_dir.mkdir(exist_ok=True)
    os.environ["DATA_DIR"] = str(data_dir)
    env_path = data_dir / f".env.test.{year}"
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
    assignments_path = data_dir / f"secret-santa-{year}.json"
    if not assignments_path.exists():
        # Create a simple rotation mapping (not enforcing constraints for the test initial state)
        mapping = {name: NAMES[(i + 1) % len(NAMES)] for i, name in enumerate(NAMES)}
        assignments_path.write_text(json.dumps(mapping))


def teardown_module(module):
    if _ORIG_DATA_DIR is None:
        os.environ.pop("DATA_DIR", None)
    else:
        os.environ["DATA_DIR"] = _ORIG_DATA_DIR
    if _ORIG_ENV_FILE is None:
        os.environ.pop("ENV_FILE", None)
    else:
        os.environ["ENV_FILE"] = _ORIG_ENV_FILE


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

    # Trigger re-generation of matches as admin and ensure app uses the updated file
    # Re-login as admin (previous step logged in as emma)
    resp = login_as(client, "jimmy", "cozy-winter-lantern")
    assert resp.status_code == 200
    resp = client.post("/api/admin/run_matches")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert "year" in data
    year = data["year"]

    # The app should present current year's matches; verify file exists and app's state matches file contents
    saved = json.loads(Path(match_file_path(year)).read_text())
    assert isinstance(saved, dict) and len(saved) == len(NAMES)


def test_admin_set_password_rejects_unknown():
    from app import app

    client = app.test_client()

    # Login as admin (jimmy)
    resp = login_as(client, "jimmy", "cozy-winter-lantern")
    assert resp.status_code == 200

    # Try to set password for a non-existing user
    resp = client.post(
        "/api/admin/set_password",
        data=json.dumps({"name": "ghost", "passphrase": "nope"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["success"] is False


def test_admin_snapshots_create_and_restore():
    from app import SS, app

    client = app.test_client()

    # Login as admin (jimmy)
    resp = login_as(client, "jimmy", "cozy-winter-lantern")
    assert resp.status_code == 200

    resp = client.post("/api/admin/snapshots")
    assert resp.status_code == 200
    snapshot_data = resp.get_json()
    assert snapshot_data["success"] is True
    snapshot_name = snapshot_data["snapshot"]

    snapshots_dir = Path(get_data_dir()) / "snapshots"
    snapshot_path = snapshots_dir / snapshot_name
    assert snapshot_path.is_dir()

    assignment_path = Path(match_file_path(SS.year))
    original = assignment_path.read_text()
    assignment_path.write_text(json.dumps({"temporary": "state"}))
    assert assignment_path.read_text() != original

    resp = client.post(
        "/api/admin/snapshots/restore",
        data=json.dumps({"name": snapshot_name}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    restore_data = resp.get_json()
    assert restore_data["success"] is True
    assert assignment_path.read_text() == original

    shutil.rmtree(snapshot_path)
