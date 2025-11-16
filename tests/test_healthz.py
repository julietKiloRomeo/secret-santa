def test_healthz_ok():
    from app import app

    client = app.test_client()
    resp = client.get('/healthz')
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    assert data.get('status') == 'ok'

