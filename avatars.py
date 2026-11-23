"""Profile pictures: validate, re-encode to a 256 px JPEG, store under DATA_DIR/avatars.

Pillow decodes the bytes, so only real images get through. The output is always a JPEG we
wrote ourselves, which removes any metadata or payload from the upload.
"""

import io
import os
import re
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from storage import get_data_dir

SIZE = 256
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
NAME_OK = re.compile(r"^[a-z0-9_-]{1,40}$")


class AvatarError(ValueError):
    pass


def avatar_dir() -> Path:
    path = Path(get_data_dir()) / "avatars"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _square_crop(img: Image.Image) -> Image.Image:
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    return img.crop((left, top, left + side, top + side)).resize(
        (SIZE, SIZE), Image.LANCZOS
    )


def save_avatar(name: str, data: bytes, directory: Path) -> str:
    """Store the picture for `name` and return its file name. Raises AvatarError on bad input."""
    if not NAME_OK.match(name):
        raise AvatarError("Bad player name")
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()  # cheap structural check
        img = Image.open(io.BytesIO(data))
        img.load()  # full decode: catches truncated or fake images
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise AvatarError("Not a valid picture") from exc
    if img.format not in ALLOWED_FORMATS:
        raise AvatarError("Only JPEG, PNG or WebP pictures are allowed")
    out = _square_crop(img.convert("RGB"))
    filename = f"{name}.jpg"
    target = directory / filename
    tmp = directory / f".{filename}.tmp"
    out.save(tmp, "JPEG", quality=88)
    os.replace(tmp, target)  # atomic: no half-written picture is ever served
    return filename
