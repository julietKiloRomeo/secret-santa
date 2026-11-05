import datetime
import importlib
import json

import pytest
from fastapi.testclient import TestClient
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
PASSWORDS = {
    "jimmy": "cozy-winter-lantern",
    "ditte": "horse-staple-orange",
    "emma": "quiet-forest-breeze",
}


@pytest.fixture
def appmod(tmp_path, monkeypatch):
    """Fresh app module whose data (env, db, draws) all live in tmp_path."""
    for key in ("SCORES_DB", "ENV_FILE", "DRAW_LOCKED", *(f"LOGIN_{n}" for n in NAMES)):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    env = "SECRET_KEY=test-secret-key\n" + "".join(
        f"LOGIN_{n}='{generate_password_hash(p)}'\n" for n, p in PASSWORDS.items()
    )
    (tmp_path / ".env").write_text(env)
    year = datetime.datetime.now().year
    rotation = {n: NAMES[(i + 1) % len(NAMES)] for i, n in enumerate(NAMES)}
    (tmp_path / f"secret-santa-{year}.json").write_text(json.dumps(rotation))
    import app

    yield importlib.reload(app)
    for n in PASSWORDS:  # load_dotenv(override=True) writes into os.environ
        monkeypatch.delenv(f"LOGIN_{n}", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)


@pytest.fixture
def client(appmod):
    return TestClient(appmod.app, follow_redirects=False)


def login(client, name, code=None):
    return client.post(
        "/api/login", json={"name": name, "code": code or PASSWORDS[name]}
    )
