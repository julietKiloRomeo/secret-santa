import json

from secret_santa import SecretSanta


def test_draw_respects_all_rules(tmp_path):
    # Last two years' draws live in the data dir and must not repeat.
    last = {"jimmy": "emma", "emma": "jimmy"}
    two_ago = {"jimmy": "sara"}
    (tmp_path / "secret-santa-2029.json").write_text(json.dumps(last))
    (tmp_path / "secret-santa-2028.json").write_text(json.dumps(two_ago))
    santa = SecretSanta(year=2030, data_dir=str(tmp_path))
    partner = {a: b for a, b in santa.couples} | {b: a for a, b in santa.couples}

    for _ in range(50):
        santa.draw()
        cfg = santa.config
        assert set(cfg) == santa.names == set(cfg.values())
        for giver, receiver in cfg.items():
            assert receiver != giver
            assert receiver != partner[giver]
            assert receiver not in santa.previous[giver]
        assert cfg["jimmy"] not in ("emma", "sara")
        assert cfg["emma"] != "jimmy"
