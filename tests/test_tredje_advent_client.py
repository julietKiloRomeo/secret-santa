def test_tredje_advent_page_contains_reindeer_rush_canvas_and_script():
    from app import app

    client = app.test_client()
    # login_required redirects if no session user set, so set a session user
    with client.session_transaction() as sess:
        sess['user'] = 'guest'
    r = client.get('/tredje-advent')
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    # Page should include the placeholder canvas container
    assert 'id="reindeer-canvas"' in html
    # Script include for client
    assert '/static/reindeer_rush.js' in html
    # New HUD controls and text should be present
    assert 'id="reindeer-score"' in html
    assert 'Controls:' in html
    assert 'reindeer-next-item' in html
