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
