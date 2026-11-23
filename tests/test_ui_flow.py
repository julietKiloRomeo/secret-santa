def test_viewport_covers_notch_and_nav_clears_safe_area(client):
    html = client.get("/").text
    assert "viewport-fit=cover" in html
    assert "env(safe-area-inset-top" in html


def test_login_messages_announced_to_screen_readers(client):
    html = client.get("/").text
    assert 'role="alert"' in html
    assert 'aria-live="polite"' in html


def test_login_labels_are_16px_or_larger(client):
    html = client.get("/").text
    assert "text-sm text-snow-100/90" not in html


def test_mobile_menu_closes_on_escape(client):
    html = client.get("/").text
    assert "'Escape'" in html
