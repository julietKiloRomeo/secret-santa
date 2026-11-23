"""Sanitize a player's wish list HTML. Allowlist only; this is the trust boundary.

Anything not explicitly allowed is dropped, and all text is re-escaped on output.
"""

import html
from html.parser import HTMLParser
from urllib.parse import urlsplit

ALLOWED_TAGS = {"b", "i", "u", "ul", "ol", "li", "br", "a"}
# Void tags have no closing tag in the output.
VOID_TAGS = {"br"}
ALLOWED_SCHEMES = {"http", "https", "mailto"}
# Tags whose whole content must be dropped, not just the tag itself.
DROP_CONTENT = {"script", "style"}


def _safe_href(value: str | None) -> str | None:
    if not value:
        return None
    parts = urlsplit(value.strip())
    # Relative and scheme-less values are refused, so only explicit safe schemes get through.
    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        return None
    return value.strip()


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._skip = 0  # depth inside a dropped element such as <script>

    def handle_starttag(self, tag, attrs):
        if tag in DROP_CONTENT:
            self._skip += 1
            return
        if self._skip or tag not in ALLOWED_TAGS:
            return
        if tag == "a":
            href = _safe_href(dict(attrs).get("href"))
            if href is None:
                return  # a link without a safe target keeps its text, not the tag
            self.out.append(
                f'<a href="{html.escape(href, quote=True)}" rel="nofollow noopener" target="_blank">'
            )
            return
        self.out.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag in DROP_CONTENT:
            self._skip = max(0, self._skip - 1)
            return
        if self._skip or tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not self._skip:
            self.out.append(html.escape(data, quote=False))


def sanitize_wish(raw: str) -> str:
    parser = _Sanitizer()
    parser.feed(raw or "")
    parser.close()
    return "".join(parser.out)
