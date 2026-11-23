import pytest

from profile_sanitize import sanitize_wish


def test_plain_text_is_kept_and_escaped():
    assert sanitize_wish("socks & chocolate <3") == "socks &amp; chocolate &lt;3"


@pytest.mark.parametrize(
    "tag", ["b", "i", "u", "ul", "ol", "li", "br"]
)
def test_allowed_formatting_tags_survive(tag):
    html = f"<{tag}>x</{tag}>" if tag != "br" else "a<br>b"
    assert f"<{tag}>" in sanitize_wish(html) or f"<{tag}" in sanitize_wish(html)


def test_script_and_event_handlers_are_removed():
    out = sanitize_wish('<script>alert(1)</script><b onclick="x()">hi</b>')
    assert "script" not in out.lower()
    assert "onclick" not in out.lower()
    assert "<b>hi</b>" in out


def test_javascript_href_is_removed():
    out = sanitize_wish('<a href="javascript:alert(1)">bad</a>')
    assert "javascript" not in out.lower()
    assert "href" not in out.lower()


def test_https_link_survives_with_safe_rel():
    out = sanitize_wish('<a href="https://example.com/x">ring</a>')
    assert 'href="https://example.com/x"' in out
    assert 'rel="nofollow noopener"' in out
    assert 'target="_blank"' in out


def test_mailto_link_survives():
    out = sanitize_wish('<a href="mailto:a@example.com">mail</a>')
    assert 'href="mailto:a@example.com"' in out


def test_unknown_tags_are_dropped_but_text_kept():
    out = sanitize_wish("<img src=x onerror=alert(1)>hello<iframe></iframe>")
    assert "img" not in out.lower() and "iframe" not in out.lower()
    assert "hello" in out


def test_nested_bad_markup_does_not_leak_text_of_scripts():
    out = sanitize_wish("<scr<script>ipt>alert(1)</script>")
    assert "<script" not in out.lower()
