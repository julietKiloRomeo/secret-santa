def test_tredje_advent_page_mounts_jingle_bell_hero_react_shell():
    from app import app

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user'] = 'guest'
    resp = client.get('/tredje-advent')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    assert 'id="jingle-bell-hero-root"' in html
    assert '/static/jingle_bell_hero_app.js' in html
    assert '__jbhSongBase' in html
    assert 'react.production.min.js' in html
    assert 'react-dom.production.min.js' in html
    assert 'ReactDOMClient = window.ReactDOM' in html


def test_tredje_advent_page_keeps_arcade_leaderboard_controls():
    from app import app

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user'] = 'guest'
    resp = client.get('/tredje-advent')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    assert 'data-arcade-leaderboard' not in html


def test_tredje_advent_page_blocks_touch_callouts_and_selection():
    from app import app

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user'] = 'guest'
    resp = client.get('/tredje-advent')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    compact = " ".join(html.split())
    assert '#jingle-bell-hero-root, #jingle-bell-hero-root * {' in compact
    assert '-webkit-touch-callout: none' in compact
    assert 'user-select: none' in compact


def test_tredje_advent_back_link_is_offset_from_playfield_on_mobile():
    from app import app

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user'] = 'guest'
    resp = client.get('/tredje-advent')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    compact = " ".join(html.split())
    assert 'href="/" class="fixed left-3 top-3' in compact
    assert 'sm:top-auto sm:bottom-4' in compact
