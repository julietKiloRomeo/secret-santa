from conftest import login


def test_profile_page_needs_login(client, appmod):
    r = client.get("/profil")
    assert r.status_code == 302 and r.headers["location"] == "/"


def test_profile_page_shows_own_editor(client, appmod):
    login(client, "ditte")
    r = client.get("/profil")
    assert r.status_code == 200
    html = r.text
    assert 'id="wish-editor"' in html
    assert 'id="avatar-input"' in html
    assert 'data-player="ditte"' in html


def test_profile_page_has_ctrl_k_and_context_menu_hooks(client, appmod):
    login(client, "ditte")
    html = client.get("/profil").text
    assert 'data-link-dialog' in html
    assert 'contenteditable' in html


def test_profile_page_saves_through_the_api_not_a_form(client, appmod):
    login(client, "ditte")
    html = client.get("/profil").text
    # The wish editor itself is not inside a form: it saves with fetch to the JSON API.
    editor_block = html.split('id="wish-editor"')[0].rsplit("<section", 1)[-1]
    assert "<form" not in editor_block
    assert "/api/profile/" in html


def test_profile_nav_link_is_present_for_logged_in_players(client, appmod):
    login(client, "ditte")
    html = client.get("/profil").text
    assert 'href="/profil"' in html


def test_avatar_picker_is_a_modal_behind_the_portrait(client, appmod):
    login(client, "ditte")
    html = client.get("/profil").text
    # The grid and the old "Vælg billede" button no longer sit on the page.
    assert "Vælg billede" not in html
    assert 'id="avatar-modal"' in html
    assert 'id="avatar-open"' in html  # the clickable portrait with the hint icon


def test_wish_list_is_a_list_of_rows_with_add_button(client, appmod):
    login(client, "ditte")
    html = client.get("/profil").text
    assert 'id="wish-rows"' in html
    assert 'id="wish-add"' in html
