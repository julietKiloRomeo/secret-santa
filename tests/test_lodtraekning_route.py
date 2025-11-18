def test_lodtraekning_redirects_when_not_logged_in():
    from app import app
    client = app.test_client()
    resp = client.get('/lodtraekning')
    # Expect a redirect to the index/login page when not authenticated
    assert resp.status_code in (301, 302), 'Expected redirect for unauthenticated access to /lodtraekning'


def test_lodtraekning_shows_recipient_when_logged_in():
    from app import app, ASSIGNMENTS
    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user'] = 'jimmy'
    resp = client.get('/lodtraekning')
    assert resp.status_code == 200
    recipient = (ASSIGNMENTS.get('jimmy') or '').capitalize()
    assert recipient.encode() in resp.data
