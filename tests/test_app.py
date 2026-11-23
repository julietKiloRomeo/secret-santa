import json
from pathlib import Path

import pytest
from conftest import NAMES, login

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
    assert "Kommer snart" in html
    assert "Første Advent" in html and "Snake" in html


def test_spil_hub_requires_login(client):
    resp = client.get("/spil", follow_redirects=False)
    assert resp.status_code == 302


def test_spil_hub_lists_every_candidate_with_launchers(client):
    login(client, "emma")
    html = client.get("/spil").text
    for g in GAMES:
        assert f'href="/{g}"' in html, g
    assert "Kommer snart" in html
