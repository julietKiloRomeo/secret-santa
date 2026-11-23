"""Check a participant's passphrase against the hash the server would use.

Run on the server (Render Shell) or locally:
    uv run python scripts/check_login.py jimmy

Mirrors app.py: the logins table wins when it has a row for the user,
otherwise LOGIN_<name> from the environment is used. Prints no hash and no passphrase.
"""

import getpass
import os
import sqlite3
import sys

import yaml
from werkzeug.security import check_password_hash, generate_password_hash

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from storage import get_data_dir, scores_db_path  # noqa: E402


def _clean(value):
    # Same cleanup as app.load_logins(): quotes and whitespace from pasted values.
    return value.strip().strip("'\"").strip()


def _db_hash(name):
    path = scores_db_path()
    if not os.path.exists(path):
        return None, "no database"
    con = sqlite3.connect(path)
    try:
        table = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='logins'"
        ).fetchone()
        if not table:
            return None, "no logins table"
        row = con.execute("SELECT hash FROM logins WHERE name = ?", (name,)).fetchone()
        return (row[0], "database") if row else (None, "no row in logins table")
    finally:
        con.close()


def _env_hash(name):
    value = os.environ.get(f"LOGIN_{name}")
    return (_clean(value), "env seed") if value else (None, "no LOGIN_ env value")


def _is_seeded_db(name):
    """True when the DB has any rows; then the app ignores LOGIN_* env values."""
    path = scores_db_path()
    if not os.path.exists(path):
        return False
    con = sqlite3.connect(path)
    try:
        return bool(con.execute("SELECT COUNT(*) FROM logins").fetchone()[0])
    except sqlite3.OperationalError:
        return False
    finally:
        con.close()


def _participants():
    with open(os.path.join(os.path.dirname(__file__), "..", "couples.yaml")) as f:
        return {n for couple in yaml.safe_load(f) for n in couple}


def _set(name, reader):
    """Write a new hash to the logins table. Used when the old row is stale."""
    if name not in _participants():
        print(f"unknown participant '{name}'")
        return 1
    first = reader(f"new passphrase for {name}: ")
    again = reader("repeat it: ")
    if first != again:
        print("passphrases do not match; nothing changed")
        return 1
    con = sqlite3.connect(scores_db_path())
    try:
        with con:
            con.execute(
                "CREATE TABLE IF NOT EXISTS logins (name TEXT PRIMARY KEY, hash TEXT NOT NULL)"
            )
            con.execute(
                "INSERT INTO logins (name, hash) VALUES (?, ?)"
                " ON CONFLICT(name) DO UPDATE SET hash = excluded.hash",
                (name, generate_password_hash(first)),
            )
    finally:
        con.close()
    print(f"stored new hash for {name} in the database")
    return check(name, reader=lambda _p: first)


def check(name, reader):
    stored, source = _db_hash(name)
    if stored is None and _is_seeded_db(name):
        print(f"no login for '{name}' in the database; LOGIN_ env is ignored once the table has rows")
        return 1
    if stored is None:
        stored, source = _env_hash(name)
    if stored is None:
        print(f"no login for '{name}' ({source})")
        return 1

    phrase = reader(f"passphrase for {name}: ")
    print(f"source={source}")
    try:
        ok = check_password_hash(stored, phrase)
    except ValueError:
        print("malformed stored hash; set a new passphrase")
        return 1
    print("MATCH" if ok else "NO MATCH")
    return 0 if ok else 1


def main(argv=None, reader=None):
    argv = sys.argv[1:] if argv is None else argv
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print("usage: check_login.py <name> [--set]")
        return 2
    name = args[0].strip().lower()
    reader = reader or (lambda prompt: getpass.getpass(prompt))

    print(f"data_dir={get_data_dir()}")
    print(f"secret_key={'set' if os.environ.get('SECRET_KEY') else 'NOT SET'}")
    if "--set" in argv:
        return _set(name, reader)

    return check(name, reader)


if __name__ == "__main__":
    raise SystemExit(main())
