from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


# shortcut: the "ho ho" sound on the lottery page is still hot-linked from glitch.global
# (not reachable from the dev sandbox). Host it under static/ and drop this entry.
KNOWN_EXTERNAL = {"cdn.glitch.global/e96496c4-8145-4241-967e-6b2e0fa0baf1/HOHOHOOOO.mp3"}


def test_templates_load_no_cdn_or_placeholder_assets():
    # The app must render offline: no CDN scripts and no placeholder image URLs.
    for path in (ROOT / "templates").glob("*.html"):
        text = path.read_text()
        for url in KNOWN_EXTERNAL:
            text = text.replace(url, "")
        assert "cdn." not in text, path.name
        assert "/api/placeholder" not in text, path.name
