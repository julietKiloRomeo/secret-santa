from conftest import login

from achievement_catalog import CATALOG, highest_tiers, tier_for


def _insert_score(appmod, game, name, score):
    import sqlite3
    from datetime import datetime, timezone

    con = sqlite3.connect(appmod.DB_PATH)
    con.execute(
        "INSERT INTO scores (game, name, score, created_at) VALUES (?, ?, ?, ?)",
        (game, name, score, datetime.now(timezone.utc).isoformat()),
    )
    con.commit()
    con.close()


def _unlock(appmod, name, achievement_id):
    import sqlite3
    from datetime import datetime, timezone

    con = sqlite3.connect(appmod.DB_PATH)
    con.execute(
        "INSERT OR IGNORE INTO achievements (name, achievement_id, unlocked_at) VALUES (?, ?, ?)",
        (name, achievement_id, datetime.now(timezone.utc).isoformat()),
    )
    con.commit()
    con.close()


# --- catalogue ---------------------------------------------------------------

def test_catalogue_has_nine_tiers_in_three_tracks_of_three():
    assert len(CATALOG) == 9
    tracks = {}
    for entry in CATALOG.values():
        tracks.setdefault(entry["track"], []).append(entry["tier"])
    assert sorted(tracks) == ["loops", "shield", "trim"]
    assert sorted(tracks["loops"]) == [1, 2, 3]
    assert sorted(tracks["shield"]) == [3, 6, 10]
    assert sorted(tracks["trim"]) == [3, 6, 10]


def test_every_entry_has_a_name_snark_and_reward():
    for aid, entry in CATALOG.items():
        assert entry["name"], aid
        assert entry["snark"], aid
        assert entry["reward"], aid


def test_highest_tier_per_track_only():
    ids = ["advent-1:shield:3", "advent-1:shield:6", "advent-1:trim:3"]
    picked = highest_tiers(ids)
    assert picked == ["advent-1:shield:6", "advent-1:trim:3"]


def test_unknown_achievement_ids_are_ignored():
    assert highest_tiers(["advent-1:nope:9", "bogus"]) == []
    assert tier_for("advent-1:nope:9") is None


# --- api ---------------------------------------------------------------------

def test_players_endpoint_needs_login(client, appmod):
    assert client.get("/api/players").status_code == 401


def test_players_lists_every_player_with_profile_scores_and_badges(client, appmod):
    login(client, "ditte")
    _insert_score(appmod, "advent-1", "ditte", 12)
    _insert_score(appmod, "advent-1", "emma", 30)
    _insert_score(appmod, "advent-2", "ditte", 7)
    _unlock(appmod, "ditte", "advent-1:shield:3")
    _unlock(appmod, "ditte", "advent-1:shield:6")
    r = client.get("/api/players")
    assert r.status_code == 200
    by = {p["name"]: p for p in r.json()["players"]}
    assert "ditte" in by and "emma" in by
    assert by["ditte"]["best_scores"] == {"advent-1": 12, "advent-2": 7}
    assert [b["id"] for b in by["ditte"]["badges"]] == ["advent-1:shield:6"]
    assert by["ditte"]["badges"][0]["name"] == "Aegis"


def test_players_shows_wish_and_avatar_when_set(client, appmod):
    login(client, "ditte")
    client.put("/api/profile/ditte", json={"wish_html": "<b>sokker</b>"})
    by = {p["name"]: p for p in client.get("/api/players").json()["players"]}
    assert by["ditte"]["wish_html"] == "<b>sokker</b>"
    assert by["ditte"]["avatar"] is None
    assert by["emma"]["wish_html"] == ""


def test_players_page_renders_cards(client, appmod):
    login(client, "ditte")
    r = client.get("/spillere")
    assert r.status_code == 200
    assert 'id="player-cards"' in r.text
    assert 'href="/spillere"' in client.get("/profil").text


def test_players_page_needs_login(client, appmod):
    r = client.get("/spillere")
    assert r.status_code == 302 and r.headers["location"] == "/"


def test_players_api_never_returns_unsanitized_wish_html(client, appmod):
    # The card template inserts wish_html as HTML. Only the sanitizer stands between a
    # stored wish and the page, so a script in the store must not reach the API.
    import sqlite3

    login(client, "ditte")
    con = sqlite3.connect(appmod.DB_PATH)
    con.execute(
        "INSERT INTO profiles (name, wish_html, updated_at) VALUES ('emma', '<script>x()</script><b>hi</b>', 'now')"
        " ON CONFLICT(name) DO UPDATE SET wish_html = excluded.wish_html"
    )
    con.commit()
    con.close()
    by = {p["name"]: p for p in client.get("/api/players").json()["players"]}
    assert "<script" not in by["emma"]["wish_html"].lower()
    assert "<b>hi</b>" in by["emma"]["wish_html"]


def test_every_badge_has_a_committed_image():
    from pathlib import Path

    root = Path(__file__).resolve().parent.parent
    for aid, entry in CATALOG.items():
        assert entry.get("image"), aid
        assert (root / "static" / entry["image"]).is_file(), entry["image"]


def test_players_api_returns_badge_image_urls(client, appmod):
    login(client, "ditte")
    _unlock(appmod, "ditte", "advent-1:loops:3")
    by = {p["name"]: p for p in client.get("/api/players").json()["players"]}
    badge = by["ditte"]["badges"][0]
    assert badge["image"] == "/static/badges/jormungandr.png"


def test_badge_images_are_clipped_to_a_circle():
    # The PNGs carry an opaque square background, so the card must clip them round.
    from pathlib import Path

    template = Path(__file__).resolve().parent.parent / "templates" / "spillere.html"
    assert "rounded-full object-cover" in template.read_text()


def test_player_cards_show_badges_not_scores():
    from pathlib import Path

    template = Path(__file__).resolve().parent.parent / "templates" / "spillere.html"
    text = template.read_text()
    assert "best_scores" not in text
    assert "Ingen scores" not in text
