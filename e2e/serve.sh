#!/usr/bin/env bash
# Throwaway server for Playwright: fresh data dir with the login the specs use.
set -euo pipefail
export UV_DEFAULT_INDEX=${UV_DEFAULT_INDEX:-https://pypi.org/simple}
DATA_DIR=$(mktemp -d)
HASH=$(uv run python -c "from werkzeug.security import generate_password_hash as g; print(g('pw-test-123'))")
printf "SECRET_KEY=e2e-only\nLOGIN_PLAYWRIGHT='%s'\n" "$HASH" > "$DATA_DIR/.env"
DATA_DIR=$DATA_DIR exec uv run uvicorn app:app --port 5001
