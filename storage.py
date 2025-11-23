import os
import shutil
from datetime import datetime
from pathlib import Path


def _clean_dir(path: str | None) -> str | None:
    if not path:
        return None
    expanded = os.path.expanduser(path)
    if not expanded:
        return None
    return os.path.abspath(expanded)


def _dir_from_file(value: str | None) -> str | None:
    if not value:
        return None
    directory = os.path.dirname(value)
    if not directory:
        directory = os.getcwd()
    return _clean_dir(directory)


def _derive_data_dir() -> str | None:
    direct = _clean_dir(os.environ.get('DATA_DIR'))
    if direct:
        return direct
    scores_dir = _dir_from_file(os.environ.get('SCORES_DB'))
    if scores_dir:
        return scores_dir
    env_file_dir = _dir_from_file(os.environ.get('ENV_FILE'))
    if env_file_dir:
        return env_file_dir
    return None


def get_data_dir() -> str:
    """Return the directory used for writable data (env, DB, matches)."""
    derived = _derive_data_dir()
    if derived:
        return derived
    return os.getcwd()


def ensure_dir(path: str) -> str:
    if path:
        os.makedirs(path, exist_ok=True)
    return path


def ensure_data_dir() -> str:
    return ensure_dir(get_data_dir())


def _existing_in_data_dir(filename: str) -> str | None:
    data_dir = _derive_data_dir()
    if not data_dir:
        return None
    ensure_dir(data_dir)
    candidate = os.path.join(data_dir, filename)
    if os.path.exists(candidate):
        return candidate
    return None


def env_file_path() -> str:
    data_env = _existing_in_data_dir('.env')
    if data_env:
        return data_env
    env_file = os.environ.get('ENV_FILE')
    if env_file:
        parent = os.path.dirname(env_file)
        if parent:
            ensure_dir(parent)
        return env_file
    return os.path.join(ensure_data_dir(), '.env')


def scores_db_path() -> str:
    data_db = _existing_in_data_dir('scores.sqlite3')
    if data_db:
        return data_db
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


def ensure_match_file(year: int, data_dir: str | None = None) -> str:
    """Return a match file path, copying from the repo if DATA_DIR lacks it."""
    target = match_file_path(year, data_dir=data_dir)
    if os.path.exists(target):
        return target
    repo_candidate = os.path.join(os.getcwd(), f'secret-santa-{year}.json')
    if os.path.exists(repo_candidate):
        if os.path.abspath(repo_candidate) == os.path.abspath(target):
            return target
        parent = os.path.dirname(target)
        if parent:
            ensure_dir(parent)
        shutil.copy2(repo_candidate, target)
        return target
    return target


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
