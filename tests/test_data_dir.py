import json
import sqlite3
from pathlib import Path

from secret_santa import SecretSanta
from storage import env_file_path, scores_db_path


def test_data_dir_paths_redirect(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    monkeypatch.delenv('SCORES_DB', raising=False)
    (tmp_path / '.env').write_text('SECRET_KEY=test\n')
    # Env and DB paths should live underneath DATA_DIR
    assert str(tmp_path) in env_file_path()
    db_file = tmp_path / 'scores.sqlite3'
    db_file.write_text('')
    db_path = scores_db_path()
    assert str(tmp_path) in db_path
    # Creating the SQLite file should land inside DATA_DIR
    conn = sqlite3.connect(db_path)
    conn.execute('CREATE TABLE IF NOT EXISTS tmp (id INTEGER PRIMARY KEY)')
    conn.commit()
    conn.close()
    assert Path(db_path).exists()


def test_secret_santa_uses_data_dir(tmp_path):
    santa = SecretSanta(year=2040, data_dir=str(tmp_path))
    santa.draw()
    santa.save()
    file_path = Path(tmp_path) / f'secret-santa-{santa.year}.json'
    assert file_path.exists()
    # Reload from the same directory
    other = SecretSanta(year=santa.year, data_dir=str(tmp_path))
    other.load()
    assert other.config == santa.config


def test_env_file_prefers_data_dir_file(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    data_env = tmp_path / '.env'
    data_env.write_text('SECRET_KEY=data-dir\n')
    custom = tmp_path / 'custom' / '.env'
    custom.parent.mkdir(parents=True, exist_ok=True)
    custom.write_text('SECRET_KEY=custom\n')
    monkeypatch.setenv('ENV_FILE', str(custom))
    assert env_file_path() == str(data_env)


def test_env_file_falls_back_when_missing(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    custom = tmp_path / 'custom' / '.env'
    custom.parent.mkdir(parents=True, exist_ok=True)
    custom.write_text('SECRET_KEY=custom\n')
    monkeypatch.setenv('ENV_FILE', str(custom))
    # No .env in DATA_DIR yet, so we should use ENV_FILE
    assert env_file_path() == str(custom)


def test_scores_db_prefers_data_dir_file(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    data_db = tmp_path / 'scores.sqlite3'
    data_db.write_text('')
    custom = tmp_path / 'dbs' / 'scores.sqlite3'
    custom.parent.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv('SCORES_DB', str(custom))
    assert scores_db_path() == str(data_db)


def test_scores_db_falls_back_when_missing(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    custom = tmp_path / 'dbs' / 'scores.sqlite3'
    custom.parent.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv('SCORES_DB', str(custom))
    assert scores_db_path() == str(custom)


def test_secret_santa_prefers_data_dir_file(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    year = 2095
    repo_path = Path(f'secret-santa-{year}.json')
    data_assignments = {"jimmy": "data-dir"}
    repo_assignments = {"jimmy": "repo"}
    data_path = tmp_path / repo_path.name
    data_path.write_text(json.dumps(data_assignments))
    repo_path.write_text(json.dumps(repo_assignments))
    try:
        santa = SecretSanta(year=year, data_dir=str(tmp_path))
        santa.load()
        assert santa.config == data_assignments
    finally:
        repo_path.unlink(missing_ok=True)


def test_secret_santa_copies_repo_file_into_data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    year = 2096
    repo_path = Path(f'secret-santa-{year}.json')
    repo_assignments = {"jimmy": "repo"}
    repo_path.write_text(json.dumps(repo_assignments))
    try:
        santa = SecretSanta(year=year, data_dir=str(tmp_path))
        santa.load()
        saved_path = tmp_path / repo_path.name
        assert saved_path.exists()
        assert json.loads(saved_path.read_text()) == repo_assignments
        assert santa.config == repo_assignments
    finally:
        repo_path.unlink(missing_ok=True)


def test_data_dir_fallbacks_to_env_file_dir(tmp_path, monkeypatch):
    env_file = tmp_path / '.env'
    env_file.write_text('SECRET_KEY=data\n')
    monkeypatch.delenv('DATA_DIR', raising=False)
    monkeypatch.delenv('SCORES_DB', raising=False)
    monkeypatch.setenv('ENV_FILE', str(env_file))
    from storage import get_data_dir
    resolved = str(tmp_path.resolve())
    assert get_data_dir() == resolved
    santa = SecretSanta(year=2051, data_dir=get_data_dir())
    santa.draw()
    santa.save()
    assert (tmp_path / f'secret-santa-{santa.year}.json').exists()


def test_data_dir_fallbacks_to_scores_db_dir(tmp_path, monkeypatch):
    db_path = tmp_path / 'scores.sqlite3'
    monkeypatch.delenv('DATA_DIR', raising=False)
    monkeypatch.delenv('ENV_FILE', raising=False)
    monkeypatch.setenv('SCORES_DB', str(db_path))
    from storage import get_data_dir
    resolved = str(tmp_path.resolve())
    assert get_data_dir() == resolved
