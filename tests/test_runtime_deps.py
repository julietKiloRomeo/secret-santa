"""The Docker image runs `uv run --no-dev`, so anything the app imports must be a runtime dependency."""

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Third-party modules the app imports at startup (app.py and what it pulls in).
RUNTIME_IMPORTS = {"PIL": "pillow", "multipart": "python-multipart"}


def _runtime_names():
    data = tomllib.loads((ROOT / "pyproject.toml").read_text())
    names = set()
    for dep in data["project"]["dependencies"]:
        names.add(dep.split(">")[0].split("=")[0].split("<")[0].strip().lower())
    return names


def test_startup_imports_are_runtime_dependencies():
    names = _runtime_names()
    for module, package in RUNTIME_IMPORTS.items():
        assert package.lower() in names, f"{module} is imported by the app but {package} is not a runtime dependency"
