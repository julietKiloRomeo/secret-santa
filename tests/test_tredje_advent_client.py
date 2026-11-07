from conftest import login


def test_tredje_advent_page_mounts_phaser_jingle_bell_hero(client):
    login(client, 'emma')
    resp = client.get('/advent-3')
    assert resp.status_code == 200
    html = resp.text
    assert 'id="jingle-bell-hero-root"' in html
    assert '/static/vendor/phaser-4.2.1.min.js' in html
    assert '/static/jingle_bell_hero.js' in html
    assert 'react' not in html.lower()


def test_tredje_advent_page_blocks_touch_callouts_and_selection(client):
    login(client, 'emma')
    resp = client.get('/advent-3')
    assert resp.status_code == 200
    html = resp.text
    css = open('static/app.css').read().replace(' ', '')
    assert '-webkit-touch-callout:none' in css
    assert 'user-select:none' in css


def test_tredje_advent_uses_game_shell_with_back_to_hub(client):
    login(client, 'emma')
    html = client.get('/advent-3').text
    assert 'class="game-stage"' in html
    assert 'href="/spil" class="game-back"' in html
