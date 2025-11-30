# Secret Santa — Specification (synchronized from tests)

This document summarizes the current behavior and public surface of the Secret Santa application. It's generated to reflect the expectations encoded by the repository tests and is intended as the authoritative spec for developers and integrators.

Overview
--------
- The application is a lightweight Flask web app serving a small number of pages and JSON APIs.
- Two small in-browser mini-games are available for advent pages:
  - `Første Advent` — Jule Snake (classic snake game)
- `Anden Advent` — Flappy Santa (santa flapping through chimneys)
- `Tredje Advent` — Reindeer Rush endless runner: guide a reindeer through a scrolling winter landscape, jumping over frozen ponds and ducking under low-hanging icicles while collecting carrots and candy canes. The game lives at `/tredje-advent`, submits scores to `/api/scores/tredje-advent`, and is powered by `static/reindeer_rush.js`; art, richer audio, and power-ups remain TODO. Automated tests cover the API (`tests/test_tredje_advent_scores.py`, `tests/test_tredje_advent_integration.py`) and HTML shell (`tests/test_tredje_advent_client.py`).
- Scores are stored in a SQLite database and surfaced through HTTP APIs. Admin users can manage games and reset high scores.

API Endpoints
-------------

- `GET /healthz`
  - Returns status `{"status": "ok"}` (200) when healthy.

- `POST /api/login`
  - Body: `{ "name": <fornavn>, "code": <passphrase> }`
  - Auth: login values are supplied by environment variables with prefix `LOGIN_` (hashed). The server compares the provided code with the stored hashed value.
  - Success: 200 and JSON `{ "success": true, "name": name, "recipient": <recipient> }`.
  - Failure: 401 with `{ "success": false, "error": "Invalid credentials" }`.

- `GET /api/scores/<game>`
  - Returns top 10 scores for `<game>` in JSON: `{ "game": <game>, "scores": [ {name, score, created_at}, ... ] }` ordered by score descending.

- `POST /api/scores/<game>`
  - Body: `{ "name": <name>, "score": <int> }` (name may be omitted, then session user or 'Guest' is used).
  - Validation: score must be an integer >= 0.
  - Behavior: Upsert semantics by `(game, name)` — only one row per (game,name). If a new score is higher than the stored score, it upgrades the stored score; lower submissions do not overwrite a higher existing score.
  - Response: `{ "success": true }` on success.

Admin APIs (require admin login: `jimmy` or `ditte`)
-------------------------------------------------

- `POST /api/admin/set_password`
  - Body: `{ "name": <fornavn>, "passphrase": <pass> }`.
  - Stores a hashed passphrase in the configured `.env` file and re-loads the login env.

- `POST /api/admin/run_matches`
  - Regenerates current-year matches and saves `secret-santa-<year>.json`.

- `GET /api/admin/games`
  - Returns list of games and whether they are enabled.

- `POST /api/admin/set_game`
  - Body: `{ "game": <key>, "enabled": true|false }` to toggle availability to non-admins.

- `POST /api/admin/reset_scores`
  - Body: `{ "game": <key> }` deletes all scores for that game.

Pages / Routes
--------------

- `/` — Index / roulette login page. After successful login it reveals the recipient.
- `/forste-advent` — Snake mini-game. If the game is disabled for non-admins, shows an Under Construction page with title "Første Advent". Admins always see the game.
- `/anden-advent` — Flappy Santa mini-game. Same availability rules as above.
- `/tredje-advent` — Hosts the Reindeer Rush endless runner. If the game is disabled for non-admins it falls back to the standard Under Construction view.
- `/fjerde-advent`, `/glaedelig-jul` — pages exist and may show "Under Construction" until implemented or enabled.
- `/admin` — Admin panel, only accessible to admin users after login.

Database schema
---------------

- `scores` table (`init_scores_db()`):
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `game TEXT NOT NULL`
  - `name TEXT NOT NULL`
  - `score INTEGER NOT NULL`
  - `created_at TEXT NOT NULL`
  - `UNIQUE(game, name)` ensures one row per (game,name)
  - `idx_scores_game_score` indices on `(game, score DESC)` for top-N queries

- `games` table (`init_games_db()`):
  - `game TEXT PRIMARY KEY`
  - `enabled INTEGER NOT NULL DEFAULT 1`
  - default rows created for `forste-advent`, `anden-advent`, `tredje-advent`, `fjerde-advent`, and `glaedelig-jul`

Client behavior / Mini-games
----------------------------

- Jule Snake (`/forste-advent`, `static/forste_advent.js`):
  - Classic snake movement with arrow keys.
  - On touch devices swiping in a direction also controls the snake; a decorative on-screen D-pad is present but does not obscure gameplay.
  - Presents a high-score overlay titled "Søde Børn" when the game ends and the score qualifies.
  - The overlay inserts an empty row at the player’s earned rank (lower entries shift down) and embeds the blinking cursor/input in that slot so the new name is typed directly into place; after saving, the panel remains open and shows the refreshed top 10 with the submitted score.
  - High score submission uses `/api/scores/forste-advent` and respects the upsert semantics.

- Flappy Santa (`/anden-advent`, `static/anden_advent.js`):
  - Santa is represented by `static/santa.gif`, riding a sleigh pulled by two stylized reindeer.
  - Jump (flap) uses spacebar or mouse click. Flap height is tuned for playability and gravity is moderate.
  - Background includes parallax layers:
    - far clouds (slow), near clouds (faster), and silhouettes (trees/houses) at horizon.
  - Speed slowly increases as score grows.
  - Audio: The game attempts to detect a user-provided audio file in `static/` (e.g. `sleigh_bell.mp3`, `jingle.mp3`, etc.) and will use it for the flap jingle; otherwise a synthesized jingle is played.
  - On game over the same inline high-score overlay flow appears and submits to `/api/scores/anden-advent`, keeping the leaderboard visible after the score is saved.
  - Tuning: `static/anden_config.js` exposes additional tuning keys for sprite and hitbox sizing: `reindeerSpriteScale`, `santaSpriteScale`, and `reindeerHitBoxScale`.

Authentication & Admins
-----------------------

- Login codes are stored as environment variables beginning with `LOGIN_` and should be generated using `werkzeug.security.generate_password_hash` (PBKDF2).
- Admins are the users `jimmy` and `ditte` (hard-coded). Admins have additional privileges: access to `/admin`, ability to toggle game availability, reset scores, set passphrases, and generate matches.

Testing / Guarantees
--------------------

The following tests are present in `tests/` and were used to derive this spec (high-level summaries):

- `tests/test_healthz.py`
  - Verifies `/healthz` returns status OK.

- `tests/test_login_hashed.py` and `tests/test_login_passphrase.py`
  - Verify login works for hashed passphrases and rejects incorrect passphrases.

- `tests/test_scores_forste_advent.py`
  - Verifies `/api/scores/forste-advent` initially empty, accepts many scores, and returns top 10 sorted by score.

- `tests/test_scores_upsert.py` and `tests/test_scores_upsert_anden_advent.py`
  - Verify POST upsert behavior: only one record per (game,name), higher submitted score upgrades stored score, lower submissions do not overwrite.

- `tests/test_admin.py`
  - Verifies admin access controls, setting passphrases, and regenerating matches.

- `tests/test_admin_games.py`
  - Verifies an admin can toggle game availability and reset scores; non-admins see Under Construction when a game is disabled.

- `tests/test_navbar_and_pages.py` and `tests/test_navbar_games_links.py`
  - Verify navigation behavior and that game links and admin links appear appropriately after login.

Developer notes
---------------

- Run the test-suite: `uv run pytest`.
- The app uses `uv` for virtualenv management; prefer `uv run` for all Python commands.
- The server is configured to run under `gunicorn` inside the provided `Dockerfile` for production usage.

If a behavior in this document becomes out-of-sync with tests in the repository, update SPECS.md by re-generating the appropriate summaries from tests and commit the change.

Testing learnings
-----------------
Practical notes from recent mobile UI work have been collected in `TESTING.md`. Highlights:

- Use `uv run pytest` for Python tests and `npx playwright test` for E2E; Playwright can auto-start the dev server via the `webServer` setting in `playwright.config.ts` (it runs `uv run python app.py`).
- Prefer UI interactions in Playwright tests (fill form + submit) rather than `page.evaluate` fetch calls because server-side errors may return HTML debug pages which break JSON parsing.
- Ensure test accounts exist both in the `.env` used by tests and in the `secret-santa-<year>.json` assignments — missing mappings can raise server KeyErrors seen as HTML debug responses.
- Keep DOM IDs and debug hooks stable (e.g., `snake-canvas`, `santa-canvas`, `window.__snakeDebug__`) so tests remain robust.

See `TESTING.md` for the full checklist and commands.
