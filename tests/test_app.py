import json
from pathlib import Path

import pytest
from conftest import NAMES, login

GAMES = ["forste-advent", "anden-advent", "tredje-advent", "fjerde-advent"]


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


def test_login_ok_and_wrong(client, appmod):
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


def test_lodtraekning_shows_recipient(client, appmod):
    login(client, "jimmy")
    assert appmod.SS.config["jimmy"].capitalize() in client.get("/lodtraekning").text


def test_navbar(client):
    assert 'href="/forste-advent"' not in client.get("/").text
    login(client, "emma")
    html = client.get("/").text
    assert all(f'href="/{g}"' in html for g in GAMES)
    assert 'id="admin-link"' not in html
    login(client, "jimmy")
    for page in ["/", "/lodtraekning", "/high-scores", "/admin", "/forste-advent"]:
        assert 'id="admin-link"' in client.get(page).text, page


def test_high_scores_page_lists_games_in_order(client):
    login(client, "emma")
    html = client.get("/high-scores").text
    assert "hs-prev" in html and "hs-next" in html
    positions = [html.index(f'"{g}"') for g in GAMES]
    assert positions == sorted(positions)


def test_unknown_game_404(client):
    login(client, "emma")
    assert client.get("/glaedelig-jul").status_code == 404
    assert client.get("/api/scores/glaedelig-jul").status_code == 404


# --- admin -------------------------------------------------------------------


def test_admin_forbidden_for_non_admin(client):
    login(client, "emma")
    assert client.get("/admin").status_code == 403
    assert client.post("/api/admin/run_matches").status_code == 403


def test_admin_set_password_and_run_matches(client, appmod):
    login(client, "jimmy")
    assert client.get("/admin").status_code == 200
    r = client.post(
        "/api/admin/set_password",
        json={"name": "sara", "passphrase": "happy-snow-ember"},
    )
    assert r.json()["success"] is True
    assert login(client, "sara", "happy-snow-ember").status_code == 200

    login(client, "jimmy")
    r = client.post("/api/admin/run_matches")
    assert r.json()["success"] is True
    saved = json.loads(Path(appmod.SS.file_path).read_text())
    assert saved == appmod.SS.config and set(saved) == set(NAMES)


def test_admin_set_password_rejects_unknown(client):
    login(client, "jimmy")
    r = client.post(
        "/api/admin/set_password", json={"name": "ghost", "passphrase": "nope"}
    )
    assert r.status_code == 400 and r.json()["success"] is False


def test_draw_locked(client, monkeypatch):
    monkeypatch.setenv("DRAW_LOCKED", "1")
    login(client, "jimmy")
    r = client.post("/api/admin/run_matches")
    assert r.status_code == 403 and r.json()["error"]
    html = client.get("/admin").text
    i = html.index('id="runMatchesBtn"')
    assert "disabled" in html[i : html.index(">", i)]


def test_admin_game_toggle(client):
    login(client, "jimmy")
    for game in GAMES:
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
    path = Path(appmod.SS.file_path)
    original = path.read_text()
    path.write_text("{}")
    assert (
        client.post("/api/admin/snapshots/restore", json={"name": name}).json()[
            "success"
        ]
        is True
    )
    assert path.read_text() == original
    assert appmod.SS.config == json.loads(original)
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
            "/api/scores/anden-advent", json={"name": f"p{i}", "score": score}
        ).json()["success"]
    scores = client.get("/api/scores/anden-advent").json()["scores"]
    assert [s["score"] for s in scores] == [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]
    assert client.get("/api/scores/forste-advent").json()["scores"] == []

    login(client, "jimmy")
    assert client.post("/api/admin/reset_scores", json={"game": "anden-advent"}).json()[
        "success"
    ]
    assert client.get("/api/scores/anden-advent").json()["scores"] == []


def test_score_post_requires_login(client):
    assert (
        client.post(
            "/api/scores/forste-advent", json={"name": "x", "score": 1}
        ).status_code
        == 401
    )


def test_score_name_defaults_and_is_capped(client):
    login(client, "emma")
    client.post("/api/scores/forste-advent", json={"name": "  ", "score": 2})
    client.post("/api/scores/forste-advent", json={"name": "x" * 500, "score": 1})
    names = [
        s["name"] for s in client.get("/api/scores/forste-advent").json()["scores"]
    ]
    assert names == ["emma", "x" * 18]


@pytest.mark.parametrize("score", [-1, "abc", None, 10**12])
def test_score_rejects_bad_values(client, score):
    login(client, "emma")
    assert (
        client.post(
            "/api/scores/forste-advent", json={"name": "a", "score": score}
        ).status_code
        == 422
    )
