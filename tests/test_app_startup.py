"""Exercise the direct development entry point without starting a real server."""

import runpy
from unittest.mock import patch


def test_direct_entry_point_starts_uvicorn(appmod):
    with patch("uvicorn.run") as run:
        runpy.run_path(appmod.__file__, run_name="__main__")
    run.assert_called_once_with("app:app", port=5000, reload=True)
