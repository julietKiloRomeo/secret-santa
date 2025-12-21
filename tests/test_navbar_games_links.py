import os
import json
import datetime
from pathlib import Path
from werkzeug.security import generate_password_hash
import re


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
    data_dir = Path(f".data.test.navbarlinks.{year}")
    data_dir.mkdir(parents=True, exist_ok=True)
    env_path = data_dir / ".env"
    os.environ["DATA_DIR"] = str(data_dir)
    os.environ["ENV_FILE"] = str(env_path)
    os.environ.setdefault("SECRET_KEY", "test-secret-key")

    env_lines = [
        f"SECRET_KEY={os.environ['SECRET_KEY']}\n",
        f"LOGIN_jimmy={generate_password_hash('cozy-winter-lantern')}\n",
        f"LOGIN_emma={generate_password_hash('quiet-forest-breeze')}\n",
    ]
    env_path.write_text("".join(env_lines))

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


GAME_LINKS = [
    ("/forste-advent", "Første Advent"),
    ("/anden-advent", "Anden Advent"),
    ("/tredje-advent", "Tredje Advent"),
    ("/fjerde-advent", "Fjerde Advent"),
]


def _extract_mobile_menu(html: str) -> str:
    match = re.search(r'<div id="mobile-menu"[^>]*>(.*?)</div>', html, re.DOTALL)
    assert match, "Mobile menu container missing"
    return match.group(1)


def test_before_login_no_game_links():
    from app import app

    client = app.test_client()
    resp = client.get("/")
    html = resp.get_data(as_text=True)
    assert resp.status_code == 200
    for href, label in GAME_LINKS:
        assert f'href="{href}"' not in html
        assert label not in html


def test_after_login_non_admin_shows_game_links_no_admin():
    from app import app

    client = app.test_client()
    assert login_as(client, "emma", "quiet-forest-breeze").status_code == 200
    # Check consistency across pages
    pages = ["/"] + [href for href, _ in GAME_LINKS]
    for page in pages:
        r = client.get(page)
        html = r.get_data(as_text=True)
        assert r.status_code == 200
        for href, label in GAME_LINKS:
            assert f'href="{href}"' in html
            assert label in html
        assert "id=\"admin-link\"" not in html
        assert ">Admin<" not in html
        assert "Glædelig Jul" not in html
        assert "/glaedelig-jul" not in html


def test_after_login_admin_shows_game_links_and_admin():
    from app import app

    client = app.test_client()
    assert login_as(client, "jimmy", "cozy-winter-lantern").status_code == 200
    pages = ["/"] + [href for href, _ in GAME_LINKS]
    for page in pages:
        r = client.get(page)
        html = r.get_data(as_text=True)
        assert r.status_code == 200
        for href, label in GAME_LINKS:
            assert f'href="{href}"' in html
            assert label in html
        assert "id=\"admin-link\"" in html
        assert ">Admin<" in html
        assert "Glædelig Jul" not in html
        assert "/glaedelig-jul" not in html


def test_mobile_menu_omits_merry_christmas_link_everywhere():
    from app import app

    client = app.test_client()
    assert login_as(client, "emma", "quiet-forest-breeze").status_code == 200
    resp = client.get("/")
    html = resp.get_data(as_text=True)
    assert resp.status_code == 200
    mobile_menu = _extract_mobile_menu(html)
    assert "/glaedelig-jul" not in mobile_menu
    assert "Glædelig Jul" not in mobile_menu
    assert "/glaedelig-jul" not in html
    assert "Glædelig Jul" not in html
