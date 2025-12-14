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
