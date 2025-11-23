import sqlite3
from pathlib import Path

from secret_santa import SecretSanta
from storage import env_file_path, scores_db_path


def test_data_dir_paths_redirect(tmp_path, monkeypatch):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    # Env and DB paths should live underneath DATA_DIR
    assert str(tmp_path) in env_file_path()
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
