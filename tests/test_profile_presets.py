from pathlib import Path

from conftest import login

from avatar_presets import PRESETS, preset_url


def test_there_are_25_presets_with_files():
    assert len(PRESETS) == 25
    root = Path(__file__).resolve().parent.parent
    for key in PRESETS:
        assert (root / "static" / "avatars" / "presets" / f"{key}.png").is_file(), key


def test_presets_list_endpoint_needs_login(client, appmod):
    assert client.get("/api/avatar-presets").status_code == 401


def test_presets_list_returns_key_name_and_url(client, appmod):
    login(client, "ditte")
    items = client.get("/api/avatar-presets").json()["presets"]
    assert len(items) == 25
    assert {"key", "name", "url"} <= set(items[0])
    assert items[0]["url"] == preset_url(items[0]["key"])


def test_owner_can_pick_a_preset(client, appmod):
    login(client, "ditte")
    r = client.post("/api/profile/ditte/preset", json={"preset": "santa"})
    assert r.status_code == 200, r.text
    assert client.get("/api/profile/ditte").json()["avatar"] == preset_url("santa")


def test_unknown_preset_is_rejected(client, appmod):
    login(client, "ditte")
    r = client.post("/api/profile/ditte/preset", json={"preset": "../../etc/passwd"})
    assert r.status_code == 400


def test_other_player_cannot_pick_a_preset_for_someone_else(client, appmod):
    login(client, "emma")
    assert client.post("/api/profile/ditte/preset", json={"preset": "elf"}).status_code == 403


def test_picking_a_preset_replaces_an_uploaded_picture(client, appmod):
    login(client, "ditte")
    client.post("/api/profile/ditte/preset", json={"preset": "robin"})
    assert client.get("/api/profile/ditte").json()["avatar"] == preset_url("robin")
