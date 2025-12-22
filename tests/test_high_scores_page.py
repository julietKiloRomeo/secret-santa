def test_high_scores_page_accessible():
    from app import app

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user'] = 'guest'
    resp = client.get('/high-scores')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    assert 'High Scores' in html
    assert 'hs-prev' in html
    assert 'hs-next' in html


def test_high_scores_games_order_and_labels():
    import re
    import json
    from app import app

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user'] = 'guest'
    resp = client.get('/high-scores')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    match = re.search(r'const games = (\[.*?\]);', html, re.DOTALL)
    assert match, "games array not found in High Scores page"
    games = json.loads(match.group(1))
    assert games[2][0] == "fjerde-advent"
    assert "Fjerde" in games[2][1]
    assert games[3][0] == "tredje-advent"
    assert "Tredje" in games[3][1]
