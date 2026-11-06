from conftest import login


def test_tredje_advent_page_mounts_phaser_jingle_bell_hero(client):
    login(client, 'emma')
    resp = client.get('/tredje-advent')
    assert resp.status_code == 200
    html = resp.text
    assert 'id="jingle-bell-hero-root"' in html
    assert '/static/vendor/phaser-4.2.1.min.js' in html
    assert '/static/jingle_bell_hero.js' in html
    assert 'react' not in html.lower()


def test_tredje_advent_page_blocks_touch_callouts_and_selection(client):
    login(client, 'emma')
    resp = client.get('/tredje-advent')
    assert resp.status_code == 200
    html = resp.text
    compact = " ".join(html.split())
    assert '#jingle-bell-hero-root, #jingle-bell-hero-root * {' in compact
    assert '-webkit-touch-callout: none' in compact
    assert 'user-select: none' in compact


def test_tredje_advent_back_link_is_offset_from_playfield_on_mobile(client):
    login(client, 'emma')
    resp = client.get('/tredje-advent')
    assert resp.status_code == 200
    html = resp.text
    compact = " ".join(html.split())
    assert 'href="/" class="fixed left-3 top-3' in compact
    assert 'sm:top-auto sm:bottom-4' in compact
