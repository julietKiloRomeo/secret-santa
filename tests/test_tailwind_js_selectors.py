from pathlib import Path


def test_index_has_data_js_selectors():
    p = Path('templates/index.html')
    assert p.exists()
    s = p.read_text()
    need = ['login-form', 'form-message', 'error', 'success', 'gif-container', 'result']
    missing = [k for k in need if f'data-js="{k}"' not in s]
    assert not missing, f"Missing data-js attributes in templates/index.html: {missing}"


def test_admin_has_data_js_selectors():
    p = Path('templates/admin.html')
    assert p.exists()
    s = p.read_text()
    need = ['set-password-form', 'set-pass-msg', 'run-matches-btn', 'games-list', 'reset-msg']
    missing = [k for k in need if f'data-js="{k}"' not in s]
    assert not missing, f"Missing data-js attributes in templates/admin.html: {missing}"

