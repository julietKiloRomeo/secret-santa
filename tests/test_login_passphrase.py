import os
import json
from werkzeug.security import generate_password_hash


def setup_module(module):
    # Configure env with passphrase-style login codes before importing the app
    os.environ.setdefault("SECRET_KEY", "test-secret-key")
    os.environ["LOGIN_ditte"] = generate_password_hash("horse-staple-orange")


def test_login_with_passphrase_succeeds():
    from app import app

    client = app.test_client()
    resp = client.post(
        "/api/login",
        data=json.dumps({"name": "ditte", "code": "horse-staple-orange"}),
        content_type="application/json",
    )

    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["name"] == "ditte"
    assert "recipient" in data


def test_login_with_wrong_passphrase_fails():
    from app import app

    client = app.test_client()
    resp = client.post(
        "/api/login",
        data=json.dumps({"name": "ditte", "code": "wrong-passphrase"}),
        content_type="application/json",
    )

    assert resp.status_code == 401
    data = resp.get_json()
    assert data["success"] is False
