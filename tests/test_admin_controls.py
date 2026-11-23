import json
import sqlite3

import pytest
from conftest import login

from storage import archive_scores_path


def scores_rows(appmod):
    con = sqlite3.connect(appmod.DB_PATH)
    rows = con.execute("SELECT game, name, score, created_at FROM scores").fetchall()
    con.close()
    return rows


def add_scores(appmod):
    con = sqlite3.connect(appmod.DB_PATH)
    con.executemany(
        "INSERT INTO scores (game, name, score, created_at) VALUES (?, ?, ?, ?)",
        [
            ("advent-1", "emma", 10, "2025-12-01T10:00:00"),
            ("advent-2", "tommy", 20, "2025-12-02T10:00:00"),
            ("advent-3", "sara", 30, "2025-12-03T10:00:00"),
        ],
    )
    con.commit()
    con.close()


# --- live draw toggle --------------------------------------------------------


def test_live_defaults_off_and_admin_can_toggle(client, appmod):
    login(client, "jimmy")
    assert client.get("/api/admin/draw_live").json() == {"live": False}
    assert client.post("/api/admin/draw_live", json={"live": True}).json()["live"] is True
    assert client.get("/api/admin/draw_live").json() == {"live": True}


def test_live_toggle_takes_effect_on_login_without_restart(client, appmod):
    real = appmod.SS.config["emma"].capitalize()
    login(client, "jimmy")
    assert login(client, "emma").json()["recipient"] == appmod.DUMMY_RECIPIENT
    # Each admin step logs in as jimmy again: the session is per user.
    login(client, "jimmy")
    client.post("/api/admin/draw_live", json={"live": True})
    assert login(client, "emma").json()["recipient"] == real
    assert real in client.get("/lodtraekning").text
    login(client, "jimmy")
    client.post("/api/admin/draw_live", json={"live": False})
    assert login(client, "emma").json()["recipient"] == appmod.DUMMY_RECIPIENT


def test_live_toggle_requires_admin(client):
    login(client, "emma")
    assert client.post("/api/admin/draw_live", json={"live": True}).status_code == 403


def test_admin_page_has_live_toggle(client):
    login(client, "jimmy")
    html = client.get("/admin").text
    assert 'data-js="draw-live-toggle"' in html


# --- reset all scores --------------------------------------------------------


def test_reset_all_requires_archive_first(client, appmod):
    add_scores(appmod)
    login(client, "jimmy")
    r = client.post("/api/admin/reset_all_scores")
    assert r.status_code == 409
    assert scores_rows(appmod)  # nothing deleted


def test_archive_then_reset_all(client, appmod, tmp_path):
    add_scores(appmod)
    login(client, "jimmy")
    r = client.post("/api/admin/archive_scores", json={"label": "2025"})
    assert r.json()["success"] is True
    archived = json.loads(archive_scores_path("2025", data_dir=str(tmp_path)).read_text())
    assert len(archived) == 3 and {row["game"] for row in archived} == {"advent-1", "advent-2", "advent-3"}

    r = client.post("/api/admin/reset_all_scores")
    assert r.json()["success"] is True
    assert scores_rows(appmod) == []


def test_archive_is_never_overwritten(client, appmod, tmp_path):
    add_scores(appmod)
    login(client, "jimmy")
    client.post("/api/admin/archive_scores", json={"label": "2025"})
    r = client.post("/api/admin/archive_scores", json={"label": "2025"})
    assert r.status_code == 409


def test_reset_all_requires_admin(client, appmod):
    login(client, "emma")
    assert client.post("/api/admin/reset_all_scores").status_code == 403


def test_archive_label_is_safe(client):
    login(client, "jimmy")
    for bad in ["../x", "a/b", "", "x" * 50]:
        assert client.post("/api/admin/archive_scores", json={"label": bad}).status_code == 422


def test_admin_page_has_reset_all_and_archive(client):
    login(client, "jimmy")
    html = client.get("/admin").text
    assert 'data-js="reset-all-scores"' in html
    assert 'data-js="archive-scores"' in html


# --- reset one game (scores + achievements) ----------------------------------


def test_reset_game_clears_its_scores_and_achievements_only(client, appmod):
    import sqlite3
    from datetime import datetime, timezone

    add_scores(appmod)
    con = sqlite3.connect(appmod.DB_PATH)
    now = datetime.now(timezone.utc).isoformat()
    con.executemany(
        "INSERT INTO achievements (name, achievement_id, unlocked_at) VALUES (?, ?, ?)",
        [("emma", "advent-1:loops:1", now), ("emma", "advent-2:loops:1", now)],
    )
    con.commit()
    con.close()
    login(client, "jimmy")
    r = client.post("/api/admin/reset_scores", json={"game": "advent-1"})
    assert r.json()["success"] is True
    assert all(row[1] != "advent-1" for row in scores_rows(appmod))
    con = sqlite3.connect(appmod.DB_PATH)
    left = con.execute("SELECT achievement_id FROM achievements").fetchall()
    con.close()
    assert left == [("advent-2:loops:1",)]


def test_reset_game_requires_admin(client, appmod):
    login(client, "emma")
    assert client.post("/api/admin/reset_scores", json={"game": "advent-1"}).status_code == 403
