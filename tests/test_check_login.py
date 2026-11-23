import sqlite3
import sys
from pathlib import Path

import pytest
from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import check_login  # noqa: E402

PHRASE = "cozy-winter-lantern"
SECRET_PHRASE_LEAK = "must-not-print-this"


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    for key in ("SCORES_DB", "ENV_FILE", "LOGIN_jimmy", "SECRET_KEY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    return tmp_path


def make_db(path, rows):
    con = sqlite3.connect(path / "scores.sqlite3")
    con.execute("CREATE TABLE logins (name TEXT PRIMARY KEY, hash TEXT NOT NULL)")
    con.executemany("INSERT INTO logins VALUES (?, ?)", rows)
    con.commit()
    con.close()


def run(name, phrase, capsys):
    code = check_login.main([name], reader=lambda _prompt: phrase)
    return code, capsys.readouterr().out


def test_matches_hash_in_database(data_dir, capsys):
    make_db(data_dir, [("jimmy", generate_password_hash(PHRASE))])
    code, out = run("jimmy", PHRASE, capsys)
    assert code == 0
    assert "MATCH" in out and "source=database" in out


def test_wrong_passphrase_fails(data_dir, capsys):
    make_db(data_dir, [("jimmy", generate_password_hash(PHRASE))])
    code, out = run("jimmy", "wrong-words-here", capsys)
    assert code == 1 and "NO MATCH" in out


def test_database_row_wins_over_env_seed(data_dir, monkeypatch, capsys):
    # The app ignores LOGIN_* once the table has rows. The checker must say so too.
    make_db(data_dir, [("jimmy", generate_password_hash("old-phrase-here"))])
    monkeypatch.setenv("LOGIN_jimmy", generate_password_hash(PHRASE))
    code, out = run("jimmy", PHRASE, capsys)
    assert code == 1
    assert "source=database" in out


def test_falls_back_to_env_when_no_table(data_dir, monkeypatch, capsys):
    monkeypatch.setenv("LOGIN_jimmy", generate_password_hash(PHRASE))
    code, out = run("jimmy", PHRASE, capsys)
    assert code == 0 and "source=env seed" in out


def test_env_value_with_pasted_quotes_is_cleaned(data_dir, monkeypatch, capsys):
    monkeypatch.setenv("LOGIN_jimmy", f'"{generate_password_hash(PHRASE)}" ')
    code, _ = run("jimmy", PHRASE, capsys)
    assert code == 0


def test_unknown_user(data_dir, capsys):
    make_db(data_dir, [("jimmy", generate_password_hash(PHRASE))])
    code, out = run("ghost", PHRASE, capsys)
    assert code == 1 and "no login for 'ghost'" in out


def test_malformed_stored_hash(data_dir, capsys):
    make_db(data_dir, [("jimmy", "not-a-hash")])
    code, out = run("jimmy", PHRASE, capsys)
    assert code == 1 and "malformed" in out


def test_reports_secret_key_presence_without_value(data_dir, monkeypatch, capsys):
    make_db(data_dir, [("jimmy", generate_password_hash(PHRASE))])
    monkeypatch.setenv("SECRET_KEY", "super-secret-value")
    _, out = run("jimmy", PHRASE, capsys)
    assert "secret_key=set" in out and "super-secret-value" not in out


def test_never_prints_hash_or_passphrase(data_dir, capsys):
    h = generate_password_hash(PHRASE)
    make_db(data_dir, [("jimmy", h)])
    _, out = run("jimmy", PHRASE, capsys)
    assert h not in out and PHRASE not in out


def test_set_writes_new_hash_to_database(data_dir, capsys):
    make_db(data_dir, [("jimmy", generate_password_hash("old-phrase-here"))])
    answers = iter([PHRASE, PHRASE])
    code = check_login.main(["jimmy", "--set"], reader=lambda _p: next(answers))
    out = capsys.readouterr().out
    assert code == 0 and "MATCH" in out and "source=database" in out
    con = sqlite3.connect(data_dir / "scores.sqlite3")
    stored = con.execute("SELECT hash FROM logins WHERE name='jimmy'").fetchone()[0]
    con.close()
    assert check_password_hash_ok(stored, PHRASE)


def test_set_refuses_when_repeat_differs(data_dir, capsys):
    make_db(data_dir, [("jimmy", generate_password_hash("old-phrase-here"))])
    answers = iter([PHRASE, "typo-words-here"])
    code = check_login.main(["jimmy", "--set"], reader=lambda _p: next(answers))
    out = capsys.readouterr().out
    assert code == 1 and "do not match" in out
    con = sqlite3.connect(data_dir / "scores.sqlite3")
    stored = con.execute("SELECT hash FROM logins WHERE name='jimmy'").fetchone()[0]
    con.close()
    assert check_password_hash_ok(stored, "old-phrase-here")


def test_set_creates_row_for_unknown_name_only_if_user_exists(data_dir, capsys):
    make_db(data_dir, [("jimmy", generate_password_hash(PHRASE))])
    answers = iter([PHRASE, PHRASE])
    code = check_login.main(["ghost", "--set"], reader=lambda _p: next(answers))
    assert code == 1 and "unknown participant" in capsys.readouterr().out


def check_password_hash_ok(stored, phrase):
    from werkzeug.security import check_password_hash

    return check_password_hash(stored, phrase)
