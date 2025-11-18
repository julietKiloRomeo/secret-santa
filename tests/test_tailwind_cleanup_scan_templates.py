import re
from pathlib import Path


LEGACY_CLASSES = [
    'card',
    'form-row',
    'muted',
    'form-message',
    'error-message',
    'success-message',
    'login-form',
    'grinch',
]


def test_templates_do_not_use_legacy_css_classes():
    """
    Ensure templates have migrated away from a set of legacy CSS classes
    and instead use Tailwind utilities + data-js attributes.
    """
    pattern = re.compile(r'class\s*=\s*"([^"]+)"')
    for p in Path('templates').glob('*.html'):
        text = p.read_text()
        for m in pattern.finditer(text):
            classes = m.group(1).split()
            for bad in LEGACY_CLASSES:
                assert bad not in classes, f"Legacy class '{bad}' found in {p} (class attribute: {m.group(1)})"

