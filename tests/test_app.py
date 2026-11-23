import importlib
import json
from pathlib import Path

import pytest
from conftest import NAMES, PASSWORDS, login
from fastapi.testclient import TestClient

DUMMY_RECIPIENT = "Buddy the Elf"

GAMES = [f"advent-{n}" for n in range(1, 11)]
# Candidates with no game built yet render a placeholder for everyone, admins included.
BUILT = ["advent-1", "advent-2", "advent-3", "advent-4", "advent-5", "advent-6"]
PUBLISHED = ["advent-1", "advent-2", "advent-3", "advent-4"]


def test_healthz(client):
    assert client.get("/healthz").json() == {"status": "ok"}


def test_secret_key_required(appmod, monkeypatch, tmp_path):
    import importlib

    (tmp_path / ".env").write_text("")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(KeyError):
        importlib.reload(appmod)


def test_no_cors_headers(client):
    r = client.get("/healthz", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers


# --- login -------------------------------------------------------------------


def test_login_ok_and_wrong(client, appmod, monkeypatch):
    monkeypatch.setenv("DRAW_LIVE", "1")
    r = login(client, "ditte")
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True and data["name"] == "ditte"
    assert data["recipient"] == appmod.SS.config["ditte"].capitalize()
    r = login(client, "ditte", "wrong")
    assert r.status_code == 401 and r.json()["success"] is False


@pytest.mark.parametrize(
    "body", [{}, {"name": None}, "not json", {"name": "ghost", "code": "x"}]
)
def test_login_bad_input_is_not_500(client, body):
    r = client.post(
        "/api/login",
        content=json.dumps(body),
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code in (401, 422)


# --- pages -------------------------------------------------------------------


def test_pages_redirect_when_logged_out(client):
    for route in ["/lodtraekning", "/high-scores", *[f"/{g}" for g in GAMES]]:
        assert client.get(route).status_code == 302, route
    assert client.get("/admin").status_code == 401


def test_lodtraekning_shows_recipient(client, appmod, monkeypatch):
    monkeypatch.setenv("DRAW_LIVE", "1")
    login(client, "jimmy")
    assert appmod.SS.config["jimmy"].capitalize() in client.get("/lodtraekning").text


@pytest.mark.parametrize("flag", [None, "", "0", "false", "no"])
def test_draw_hidden_until_live(client, appmod, monkeypatch, flag):
    if flag is not None:
        monkeypatch.setenv("DRAW_LIVE", flag)
    real = appmod.SS.config["jimmy"].capitalize()
    r = login(client, "jimmy")
    assert r.json()["recipient"] == DUMMY_RECIPIENT
    page = client.get("/lodtraekning").text
    assert DUMMY_RECIPIENT in page
    assert real not in page


def test_admin_also_sees_dummy_until_live(client, appmod):
    login(client, "jimmy")
    assert DUMMY_RECIPIENT in client.get("/lodtraekning").text
    assert appmod.SS.config["jimmy"].capitalize() not in client.get("/lodtraekning").text


def test_navbar(client):
    assert 'href="/advent-1"' not in client.get("/").text
    login(client, "emma")
    html = client.get("/").text
    assert 'href="/spil"' in html
    assert 'id="admin-link"' not in html
    login(client, "jimmy")
    for page in ["/", "/lodtraekning", "/high-scores", "/admin", "/advent-1"]:
        assert 'id="admin-link"' in client.get(page).text, page


def test_high_scores_page_lists_games_in_order(client):
    login(client, "emma")
    html = client.get("/high-scores").text
    assert "hs-prev" in html and "hs-next" in html
    positions = [html.index(f'"{g}"') for g in PUBLISHED]
    assert positions == sorted(positions)


def test_unknown_game_404(client):
    login(client, "emma")
    assert client.get("/glaedelig-jul").status_code == 404
    assert client.get("/api/scores/glaedelig-jul").status_code == 404


# --- admin -------------------------------------------------------------------


def test_admin_forbidden_for_non_admin(client):
    login(client, "emma")
    assert client.get("/admin").status_code == 403
    assert client.post("/api/admin/run_matches").status_code == 404


def test_admin_set_password(client, appmod):
    login(client, "jimmy")
    assert client.get("/admin").status_code == 200
    r = client.post(
        "/api/admin/set_password",
        json={"name": "sara", "passphrase": "happy-snow-ember"},
    )
    assert r.json()["success"] is True
    assert login(client, "sara", "happy-snow-ember").status_code == 200



def test_admin_set_password_rejects_unknown(client):
    login(client, "jimmy")
    r = client.post(
        "/api/admin/set_password", json={"name": "ghost", "passphrase": "nope"}
    )
    assert r.status_code == 400 and r.json()["success"] is False


def test_admin_page_has_no_redraw_button(client):
    login(client, "jimmy")
    html = client.get("/admin").text
    assert "runMatches" not in html and "run_matches" not in html


def test_admin_game_toggle(client):
    login(client, "jimmy")
    for game in BUILT:
        assert (
            client.post(
                "/api/admin/set_game", json={"game": game, "enabled": False}
            ).status_code
            == 200
        )
        login(client, "emma")
        assert "Under Construction" in client.get(f"/{game}").text
        login(client, "jimmy")
        assert (
            "Under Construction" not in client.get(f"/{game}").text
        )  # admins always see games
        client.post("/api/admin/set_game", json={"game": game, "enabled": True})
    assert client.get("/api/admin/games").json()["games"] == [
        {"game": g, "enabled": True} for g in GAMES
    ]
    assert (
        client.post(
            "/api/admin/set_game", json={"game": "nope", "enabled": True}
        ).status_code
        == 404
    )


def test_admin_snapshots(client, appmod, tmp_path):
    login(client, "jimmy")
    name = client.post("/api/admin/snapshots").json()["snapshot"]
    assert (tmp_path / "snapshots" / name).is_dir()
    # The server reads the encoded draw; the snapshot must carry it back.
    path = Path(appmod.SS.encoded_path)
    original = path.read_text()
    expected = dict(appmod.SS.config)
    path.write_text("")
    assert (
        client.post("/api/admin/snapshots/restore", json={"name": name}).json()[
            "success"
        ]
        is True
    )
    assert path.read_text() == original
    assert appmod.SS.config == expected
    for bad in ["..", "../..", f"../snapshots/{name}"]:
        assert (
            client.post("/api/admin/snapshots/restore", json={"name": bad}).status_code
            == 404
        )


# --- scores ------------------------------------------------------------------


def test_scores_top10_sorted_and_reset(client):
    login(client, "emma")
    for i, score in enumerate([5, 3, 9, 1, 12, 7, 8, 2, 4, 6, 11, 10]):
        assert client.post(
            "/api/scores/advent-2", json={"name": f"p{i}", "score": score}
        ).json()["success"]
    scores = client.get("/api/scores/advent-2").json()["scores"]
    assert [s["score"] for s in scores] == [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]
    assert client.get("/api/scores/advent-1").json()["scores"] == []

    login(client, "jimmy")
    assert client.post("/api/admin/reset_scores", json={"game": "advent-2"}).json()[
        "success"
    ]
    assert client.get("/api/scores/advent-2").json()["scores"] == []


def test_score_post_requires_login(client):
    assert (
        client.post("/api/scores/advent-1", json={"name": "x", "score": 1}).status_code
        == 401
    )


def test_score_name_defaults_and_is_capped(client):
    login(client, "emma")
    client.post("/api/scores/advent-1", json={"name": "  ", "score": 2})
    client.post("/api/scores/advent-1", json={"name": "x" * 500, "score": 1})
    names = [s["name"] for s in client.get("/api/scores/advent-1").json()["scores"]]
    assert names == ["emma", "x" * 18]


@pytest.mark.parametrize("score", [-1, "abc", None, 10**12])
def test_score_rejects_bad_values(client, score):
    login(client, "emma")
    assert (
        client.post(
            "/api/scores/advent-1", json={"name": "a", "score": score}
        ).status_code
        == 422
    )


def test_advent_routes_are_numbered(client):
    login(client, "jimmy")
    for n in range(1, 6):
        assert client.get(f"/advent-{n}").status_code == 200, n
    assert client.get("/forste-advent").status_code == 404


def test_legacy_score_rows_move_to_advent_ids_once(appmod, client):
    import sqlite3

    # Re-create the pre-rename state, then run the boot migration.
    with sqlite3.connect(appmod.DB_PATH) as con:
        con.execute("DELETE FROM scores")
        con.execute("DELETE FROM games")
        con.execute("INSERT INTO games (game, enabled) VALUES ('anden-advent', 0)")
        con.execute(
            "INSERT INTO scores (game, name, score, created_at) VALUES ('forste-advent', 'emma', 40, 'x')"
        )
        con.execute(
            "INSERT INTO scores (game, name, score, created_at) VALUES ('fjerde-advent', 'emma', 90, 'x')"
        )
    appmod.init_db()
    login(client, "emma")
    assert client.get("/api/scores/advent-1").json()["scores"][0]["score"] == 40
    assert client.get("/api/scores/advent-4").json()["scores"][0]["score"] == 90
    with sqlite3.connect(appmod.DB_PATH) as con:
        assert (
            con.execute(
                "SELECT COUNT(*) FROM scores WHERE game LIKE 'advent-%'"
            ).fetchone()[0]
            == 2
        )
        assert (
            con.execute("SELECT enabled FROM games WHERE game = 'advent-2'").fetchone()[
                0
            ]
            == 0
        )
        assert (
            con.execute(
                "SELECT COUNT(*) FROM games WHERE game LIKE 'anden%' OR game LIKE 'forste%'"
            ).fetchone()[0]
            == 0
        )
    # A second boot must not re-copy: reset advent-1, boot again, it stays empty.
    login(client, "jimmy")
    client.post("/api/admin/reset_scores", json={"game": "advent-1"})
    appmod.init_db()
    assert client.get("/api/scores/advent-1").json()["scores"] == []


def test_spil_hub_lists_published_games_with_danish_titles(client):
    login(client, "emma")
    resp = client.get("/spil")
    assert resp.status_code == 200
    html = resp.text
    for g in PUBLISHED:
        assert f'href="/{g}"' in html, g
    assert "Første Advent" in html and "Snake" in html


def test_spil_hub_requires_login(client):
    resp = client.get("/spil", follow_redirects=False)
    assert resp.status_code == 302


def test_spil_hub_shows_only_first_four_games_to_non_admins(client):
    login(client, "emma")
    html = client.get("/spil").text
    for g in PUBLISHED:
        assert f'href="/{g}"' in html, g
    for g in GAMES[4:]:
        assert f'href="/{g}"' not in html, g
    for name in ("Pac-Santa", "Snøkugle-kast", "Pakkepuslespil", "Julebag", "Nisse-hop"):
        assert name not in html, name
    assert "Kommer snart" not in html


def test_spil_hub_lists_every_candidate_with_launchers_for_admins(client):
    login(client, "jimmy")
    html = client.get("/spil").text
    for g in GAMES:
        assert f'href="/{g}"' in html, g
    assert "Kommer snart" in html


def test_non_admin_cannot_open_unpublished_game(client):
    login(client, "emma")
    assert "Under Construction" in client.get("/advent-5").text


def test_inactive_game_card_hides_its_name_and_is_marked_inactive(client):
    login(client, "jimmy")
    client.post("/api/admin/set_game", json={"game": "advent-1", "enabled": False})
    login(client, "emma")
    html = client.get("/spil").text
    card = html[html.index('href="/advent-1"') :].split("</a>", 1)[0]
    assert "Første Advent" in card
    assert "Kommer snart" in card
    assert "Snake" not in card
    assert "Styr nissen" not in card
    assert 'data-disabled="1"' in card
    assert "opacity-60" in card and "grayscale" in card


# --- login seed values -------------------------------------------------------
# Render's env UI and pasted .env lines often add quotes or trailing whitespace.


@pytest.mark.parametrize(
    "wrap", ['"{}"', "'{}'", "{} ", "{}\n", ' "{}" \n'], ids=["dq", "sq", "space", "newline", "mixed"]
)
def test_seed_accepts_hash_with_pasted_quotes_or_whitespace(tmp_path, monkeypatch, wrap):
    from werkzeug.security import generate_password_hash

    for key in ("SCORES_DB", "ENV_FILE", *(f"LOGIN_{n}" for n in NAMES)):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    (tmp_path / ".env").write_text("SECRET_KEY=k\n")
    monkeypatch.setenv("LOGIN_tommy", wrap.format(generate_password_hash("swift-fox-meadow")))
    import app as appmod

    importlib.reload(appmod)
    c = TestClient(appmod.app, follow_redirects=False)
    r = login(c, "tommy", "swift-fox-meadow")
    assert r.status_code == 200, r.text


def test_malformed_stored_hash_is_401_not_500(appmod, client):
    import sqlite3

    con = sqlite3.connect(appmod.DB_PATH)
    con.execute("UPDATE logins SET hash = 'not-a-hash' WHERE name = 'tommy'")
    con.commit()
    con.close()
    r = login(client, "tommy", "swift-fox-meadow")
    assert r.status_code == 401


def test_documented_passphrase_matches_documented_hash_format():
    # README and .env.example must describe the hash format Werkzeug actually emits.
    from pathlib import Path
    from werkzeug.security import generate_password_hash

    root = Path(__file__).resolve().parents[1]
    readme = (root / "README.md").read_text()
    assert "pbkdf2:sha256:260000" not in readme
    assert generate_password_hash("x").startswith(("scrypt:", "pbkdf2:"))
    assert "scripts/hash_password.py" in readme


# --- passwords in the database -----------------------------------------------


def test_logins_are_stored_in_db_and_seeded_from_env(appmod, tmp_path):
    import sqlite3

    con = sqlite3.connect(appmod.DB_PATH)
    rows = dict(con.execute("SELECT name, hash FROM logins").fetchall())
    con.close()
    assert set(rows) == set(PASSWORDS)
    assert all(h.startswith(("scrypt:", "pbkdf2:")) for h in rows.values())


def test_env_login_seed_only_when_table_empty(appmod, client, monkeypatch):
    from werkzeug.security import generate_password_hash

    # Changing the env later must not override what is already in the DB.
    monkeypatch.setenv("LOGIN_jimmy", generate_password_hash("some-other-phrase"))
    appmod.init_db()
    assert login(client, "jimmy").status_code == 200


def test_admin_updates_password_in_db(client, appmod):
    login(client, "jimmy")
    r = client.post(
        "/api/admin/set_password",
        json={"name": "sara", "passphrase": "happy-snow-ember"},
    )
    assert r.json()["success"] is True
    assert login(client, "sara", "happy-snow-ember").status_code == 200
    assert login(client, "sara", "old-phrase").status_code == 401


def test_password_change_survives_restart(client, appmod, monkeypatch):
    login(client, "jimmy")
    client.post(
        "/api/admin/set_password",
        json={"name": "sara", "passphrase": "persist-me-now"},
    )
    reloaded = importlib.reload(appmod)  # simulates a server restart
    c = TestClient(reloaded.app, follow_redirects=False)
    assert login(c, "sara", "persist-me-now").status_code == 200


def test_set_password_writes_no_env_file(client, appmod, tmp_path):
    before = (tmp_path / ".env").read_text()
    login(client, "jimmy")
    client.post("/api/admin/set_password", json={"name": "sara", "passphrase": "x-y-z"})
    assert (tmp_path / ".env").read_text() == before


def test_set_password_requires_admin(client):
    login(client, "emma")
    r = client.post("/api/admin/set_password", json={"name": "sara", "passphrase": "x"})
    assert r.status_code == 403


def test_set_password_hash_is_not_plaintext(client, appmod):
    import sqlite3

    login(client, "jimmy")
    client.post("/api/admin/set_password", json={"name": "sara", "passphrase": "plain-text-check"})
    con = sqlite3.connect(appmod.DB_PATH)
    stored = con.execute("SELECT hash FROM logins WHERE name='sara'").fetchone()[0]
    con.close()
    assert "plain-text-check" not in stored



def test_locked_game_warning_is_a_styled_status_toast():
    base = (Path(__file__).parent.parent / "templates" / "base.html").read_text()
    assert "setAttribute('role', 'status')" in base
    assert "Hov hov. Den låge må du ikke åbne endnu!" in base
    assert "bg-pine-950/95" in base and "border-gold-300/70" in base
    assert "style.bottom = '24px'" in base
