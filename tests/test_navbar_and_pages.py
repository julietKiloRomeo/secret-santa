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
    year = datetime.datetime.now().year
    data_dir = Path(f".data.test.navbar.{year}")
    data_dir.mkdir(parents=True, exist_ok=True)
    env_path = data_dir / ".env"
    os.environ["DATA_DIR"] = str(data_dir)
    os.environ["ENV_FILE"] = str(env_path)
    os.environ.setdefault("SECRET_KEY", "test-secret-key")

    # Admin and non-admin users
    env_lines = [
        f"SECRET_KEY={os.environ['SECRET_KEY']}\n",
        f"LOGIN_jimmy={generate_password_hash('cozy-winter-lantern')}\n",
        f"LOGIN_emma={generate_password_hash('quiet-forest-breeze')}\n",
    ]
    env_path.write_text("".join(env_lines))

    # Ensure a current-year assignment file exists before importing app
    assignments_path = Path(f"secret-santa-{year}.json")
    if not assignments_path.exists():
        mapping = {name: NAMES[(i + 1) % len(NAMES)] for i, name in enumerate(NAMES)}
        assignments_path.write_text(json.dumps(mapping))


def login_as(client, name, code):
    return client.post(
        "/api/login",
        data=json.dumps({"name": name, "code": code}),
        content_type="application/json",
    )


def test_navbar_has_no_admin_link_before_login():
    from app import app

    client = app.test_client()
    resp = client.get("/")
    html = resp.get_data(as_text=True)
    assert resp.status_code == 200
    assert "id=\"admin-link\"" not in html
    assert ">Admin<" not in html


def test_navbar_shows_admin_link_after_admin_login_on_all_pages():
    from app import app

    client = app.test_client()
    # Login as admin
    resp = login_as(client, "jimmy", "cozy-winter-lantern")
    assert resp.status_code == 200

    # Pages to check for consistent navbar
    routes = [
        "/",
        "/forste-advent",
        "/anden-advent",
        "/tredje-advent",
        "/fjerde-advent",
    ]
    for route in routes:
        r = client.get(route)
        html = r.get_data(as_text=True)
        assert r.status_code == 200
        assert "id=\"admin-link\"" in html
        assert ">Admin<" in html


def test_navbar_hides_admin_link_for_non_admin_after_login():
    from app import app

    client = app.test_client()
    # Login as non-admin
    resp = login_as(client, "emma", "quiet-forest-breeze")
    assert resp.status_code == 200

    r = client.get("/")
    html = r.get_data(as_text=True)
    assert r.status_code == 200
    assert "id=\"admin-link\"" not in html
    assert ">Admin<" not in html


def test_advent_pages_exist_and_are_under_construction():
    from app import app

    client = app.test_client()
    pages = {
        "/forste-advent": "Første Advent",
        "/anden-advent": "Anden Advent",
        "/tredje-advent": "Tredje Advent",
        "/fjerde-advent": "Fjerde Advent",
    }
    # Pages require login; unauthenticated access should be refused
    for route, title in pages.items():
        r = client.get(route)
        assert r.status_code in (401, 302)

    # After logging in as a normal user, the pages should be accessible
    assert login_as(client, "emma", "quiet-forest-breeze").status_code == 200
    for route, title in pages.items():
        r = client.get(route)
        html = r.get_data(as_text=True)
        assert r.status_code == 200
        assert title in html
        if route == "/forste-advent":
            # First minigame is implemented; should have a canvas
            assert "snake-canvas" in html
        elif route == "/anden-advent":
            # Second minigame (Flappy Santa) should have a canvas
            assert "santa-canvas" in html
        elif route == "/tredje-advent":
            # Third minigame: Jingle Bell Hero React shell should be mounted
            assert "jingle-bell-hero-root" in html
        elif route == "/fjerde-advent":
            # Fourth minigame now houses Reindeer Rush
            assert "reindeer-canvas" in html
        else:
            assert "Under Construction" in html or "Under construction" in html


def test_glaedelig_jul_route_removed():
    from app import app

    client = app.test_client()
    assert login_as(client, "emma", "quiet-forest-breeze").status_code == 200
    r = client.get("/glaedelig-jul")
    html = r.get_data(as_text=True)
    assert r.status_code == 404
    assert "Glædelig Jul" not in html
