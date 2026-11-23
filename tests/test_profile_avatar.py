import io

from PIL import Image

from conftest import login


def _png(size=(600, 400), color=(200, 30, 40)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


def _jpeg(size=(300, 300)):
    buf = io.BytesIO()
    Image.new("RGB", size, (10, 120, 60)).save(buf, "JPEG")
    return buf.getvalue()


def _upload(client, name, data, content_type="image/png"):
    return client.post(
        f"/api/profile/{name}/avatar",
        files={"file": ("pic", data, content_type)},
    )


def test_avatar_upload_needs_login(client, appmod):
    assert _upload(client, "ditte", _png()).status_code == 401


def test_owner_uploads_png_and_it_is_stored_as_256_square_jpeg(client, appmod):
    login(client, "ditte")
    r = _upload(client, "ditte", _png())
    assert r.status_code == 200, r.text
    stored = client.get("/api/profile/ditte").json()["avatar"]
    assert stored and stored.startswith("/avatars/ditte")
    got = client.get(stored)
    assert got.status_code == 200
    img = Image.open(io.BytesIO(got.content))
    assert img.size == (256, 256)
    assert img.format == "JPEG"


def test_jpeg_is_accepted(client, appmod):
    login(client, "ditte")
    assert _upload(client, "ditte", _jpeg(), "image/jpeg").status_code == 200


def test_non_image_is_rejected(client, appmod):
    login(client, "ditte")
    r = _upload(client, "ditte", b"<html>not an image</html>", "text/html")
    assert r.status_code == 400


def test_file_that_is_not_really_an_image_is_rejected_even_with_image_type(client, appmod):
    login(client, "ditte")
    r = _upload(client, "ditte", b"GIF89a-but-not-really", "image/png")
    assert r.status_code == 400


def test_oversize_upload_is_rejected(client, appmod):
    login(client, "ditte")
    r = _upload(client, "ditte", b"0" * (2 * 1024 * 1024 + 1))
    assert r.status_code == 413


def test_other_player_cannot_upload_for_someone_else(client, appmod):
    login(client, "emma")
    assert _upload(client, "ditte", _png()).status_code == 403


def test_a_new_upload_replaces_the_old_avatar(client, appmod):
    login(client, "ditte")
    _upload(client, "ditte", _png((50, 50), (0, 0, 0)))
    first = client.get("/api/profile/ditte").json()["avatar"]
    _upload(client, "ditte", _png((50, 50), (255, 255, 255)))
    second = client.get("/api/profile/ditte").json()["avatar"]
    # The URL changes on every upload so browsers fetch the new picture.
    assert first != second
    assert client.get(second).status_code == 200
