import json
import subprocess
import sys
from pathlib import Path

import pytest

from secret_santa import SecretSanta
from storage import decode_draw, encode_draw

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "draw.py"


def run_draw(*args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )


def test_encode_hides_names_and_roundtrips():
    cfg = {"jimmy": "emma", "emma": "jimmy"}
    text = encode_draw(cfg)
    assert "jimmy" not in text and "emma" not in text
    assert decode_draw(text) == cfg


def test_decode_rejects_garbage():
    with pytest.raises(ValueError):
        decode_draw("not a draw !!!")


def test_load_reads_encoded_file_and_prefers_it(tmp_path):
    cfg = {"a": "b", "b": "a"}
    (tmp_path / "secret-santa-2040.enc").write_text(encode_draw(cfg))
    (tmp_path / "secret-santa-2040.json").write_text(json.dumps({"x": "y"}))
    santa = SecretSanta(year=2040, data_dir=str(tmp_path))
    santa.load()
    assert santa.config == cfg


def test_load_from_encoded_writes_no_plaintext(tmp_path):
    (tmp_path / "secret-santa-2040.enc").write_text(encode_draw({"a": "b"}))
    SecretSanta(year=2040, data_dir=str(tmp_path)).load()
    assert not (tmp_path / "secret-santa-2040.json").exists()


def test_violations_flag_self_spouse_and_bad_permutation(tmp_path):
    santa = SecretSanta(year=2040, data_dir=str(tmp_path))
    santa.draw()
    assert santa.violations(santa.config) == []

    selfish = dict(santa.config)
    giver = next(iter(selfish))
    selfish[giver] = giver
    assert any("self" in v for v in santa.violations(selfish))

    a, b = santa.couples[0]
    spouse = dict(santa.config)
    spouse[a] = b
    assert any("spouse" in v for v in santa.violations(spouse))

    short = dict(santa.config)
    short.pop(giver)
    assert santa.violations(short)


def test_script_writes_json_and_encoded(tmp_path):
    result = run_draw("--year", "2099", "--out", str(tmp_path))
    assert result.returncode == 0, result.stderr
    enc = (tmp_path / "secret-santa-2099.enc").read_text()
    plain = json.loads((tmp_path / "secret-santa-2099.json").read_text())
    assert decode_draw(enc) == plain
    assert SecretSanta(year=2099, data_dir=str(tmp_path)).violations(plain) == []


def test_script_refuses_overwrite_without_force(tmp_path):
    assert run_draw("--year", "2099", "--out", str(tmp_path)).returncode == 0
    before = (tmp_path / "secret-santa-2099.enc").read_text()
    result = run_draw("--year", "2099", "--out", str(tmp_path))
    assert result.returncode != 0
    assert (tmp_path / "secret-santa-2099.enc").read_text() == before

    assert run_draw("--year", "2099", "--out", str(tmp_path), "--force").returncode == 0


def test_load_falls_back_to_encoded_file_in_repo_dir(tmp_path, monkeypatch):
    # DATA_DIR is persistent storage; the committed .enc lives in the app dir.
    repo = tmp_path / "app"
    data = tmp_path / "data"
    repo.mkdir()
    data.mkdir()
    for name in ("couples.yaml", "previous.yaml"):
        (repo / name).write_text((ROOT / name).read_text())
    (repo / "secret-santa-2040.enc").write_text(encode_draw({"a": "b", "b": "a"}))
    monkeypatch.chdir(repo)
    santa = SecretSanta(year=2040, data_dir=str(data))
    santa.load()
    assert santa.config == {"a": "b", "b": "a"}
