from conftest import login


def test_profile_read_needs_login(client, appmod):
    assert client.get("/api/profile/ditte").status_code == 401


def test_profile_defaults_to_empty(client, appmod):
    login(client, "ditte")
    r = client.get("/api/profile/ditte")
    assert r.status_code == 200
    assert r.json() == {"name": "ditte", "wish_html": "", "avatar": None}


def test_owner_can_save_a_sanitized_wish(client, appmod):
    login(client, "ditte")
    r = client.put(
        "/api/profile/ditte",
        json={"wish_html": '<b>socks</b><script>x</script><a href="https://a.example">link</a>'},
    )
    assert r.status_code == 200
    wish = client.get("/api/profile/ditte").json()["wish_html"]
    assert "<b>socks</b>" in wish
    assert "script" not in wish.lower()
    assert 'href="https://a.example"' in wish


def test_other_player_cannot_edit_a_profile(client, appmod):
    login(client, "emma")  # emma is not an admin
    r = client.put("/api/profile/ditte", json={"wish_html": "hacked"})
    assert r.status_code == 403


def test_admin_can_edit_another_profile(client, appmod):
    login(client, "jimmy")  # jimmy is in ADMINS
    r = client.put("/api/profile/emma", json={"wish_html": "from admin"})
    assert r.status_code == 200
    assert client.get("/api/profile/emma").json()["wish_html"] == "from admin"


def test_wish_length_is_capped(client, appmod):
    login(client, "ditte")
    r = client.put("/api/profile/ditte", json={"wish_html": "x" * 4001})
    assert r.status_code == 422


def test_unknown_player_profile_is_404(client, appmod):
    login(client, "ditte")
    assert client.get("/api/profile/nobody").status_code == 404
