import os
import shutil
from datetime import datetime
from pathlib import Path


def get_data_dir() -> str:
    """Return the directory used for writable data (env, DB, matches)."""
    return os.environ.get('DATA_DIR') or os.getcwd()


def ensure_dir(path: str) -> str:
    if path:
        os.makedirs(path, exist_ok=True)
    return path


def ensure_data_dir() -> str:
    return ensure_dir(get_data_dir())


def env_file_path() -> str:
    env_file = os.environ.get('ENV_FILE')
    if env_file:
        parent = os.path.dirname(env_file)
        if parent:
            ensure_dir(parent)
        return env_file
    return os.path.join(ensure_data_dir(), '.env')


def scores_db_path() -> str:
    path = os.environ.get('SCORES_DB')
    if path:
        parent = os.path.dirname(path)
        if parent:
            ensure_dir(parent)
        return path
    return os.path.join(ensure_data_dir(), 'scores.sqlite3')


def match_file_path(year: int, data_dir: str | None = None) -> str:
    base = data_dir or get_data_dir()
    ensure_dir(base)
    return os.path.join(base, f'secret-santa-{year}.json')


def snapshots_root() -> str:
    path = os.path.join(get_data_dir(), 'snapshots')
    ensure_dir(path)
    return path


def snapshot_sources() -> list[str]:
    files: list[str] = []
    env_path = env_file_path()
    if os.path.exists(env_path):
        files.append(env_path)
    db_path = scores_db_path()
    if os.path.exists(db_path):
        files.append(db_path)
    data_root = Path(get_data_dir())
    for candidate in sorted(data_root.glob('secret-santa-*.json')):
        if candidate.is_file():
            files.append(str(candidate))
    return files


def list_snapshots() -> list[str]:
    root = Path(snapshots_root())
    return sorted(str(p.name) for p in root.iterdir() if p.is_dir())


def create_snapshot() -> str:
    root = Path(snapshots_root())
    stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    target = root / stamp
    target.mkdir(parents=True, exist_ok=True)
    for src in snapshot_sources():
        dest = target / Path(src).name
        shutil.copy2(src, dest)
    return str(target)


def restore_snapshot(name: str) -> str:
    root = Path(snapshots_root())
    source = root / name
    if not source.is_dir():
        raise FileNotFoundError(f"Snapshot '{name}' does not exist")
    dest_root = Path(get_data_dir())
    for entry in source.iterdir():
        target = dest_root / entry.name
        shutil.copy2(entry, target)
    return str(source)
