import re


def _rule_font_size_px(css: str, selector: str) -> float:
    match = re.search(re.escape(selector) + r"\{([^}]*)\}", css)
    assert match, f"{selector} rule missing from app.css"
    size = re.search(r"font-size:([\d.]+)(px|rem)", match.group(1))
    assert size, f"{selector} has no font-size"
    value, unit = float(size.group(1)), size.group(2)
    return value * 16 if unit == "rem" else value


def test_field_font_size_at_least_16px_to_prevent_ios_zoom():
    css = open("static/app.css").read()
    assert _rule_font_size_px(css, ".field") >= 16
