# Secret Santa — Specification (synchronized from tests)

This document summarizes the current behavior and public surface of the Secret Santa application. It's generated to reflect the expectations encoded by the repository tests and is intended as the authoritative spec for developers and integrators.

Overview
--------
- The application is a lightweight FastAPI web app serving a small number of pages and JSON APIs.
- Two small in-browser mini-games are available for advent pages:
  - `Første Advent` — Jule Snake (classic snake game)
- `Anden Advent` — Flappy Santa (santa flapping through chimneys)
- `Tredje Advent` — Jingle Bell Hero rhythm bells: match the falling notes with lane keys D/F/J/K across six tiers. Phaser scene in `static/jingle_bell_hero.js`, rules in `static/jingle_bell_rules.js`. Posts to `/api/scores/advent-3`.
- `Fjerde Advent` — Reindeer Rush endless runner now lives at `/advent-4` with the immersive canvas (`static/reindeer_rush.js`) and posts to `/api/scores/advent-4`. Server/client coverage comes from `tests/test_fjerde_advent_client.py` and the Playwright spec (`e2e/reindeer_rush.spec.ts`).
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
- `/advent-1` — Snake mini-game. If the game is disabled for non-admins, shows an Under Construction page with title "Første Advent". Admins always see the game.
- `/advent-2` — Flappy Santa mini-game. Same availability rules as above.
- `/advent-3` — Hosts the Jingle Bell Hero Phaser scene. If the game is disabled for non-admins it falls back to the standard Under Construction view.
- `/advent-4` — Hosts the Reindeer Rush endless runner (Phaser scene in `static/reindeer_rush.js`).
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
  - default rows created for `advent-1`, `advent-2`, `advent-3`, and `advent-4`

Client behavior / Mini-games
----------------------------

All four games are Phaser 4 scenes (`static/vendor/phaser-4.2.1.min.js`). The rules live in pure modules that Jest tests; the views draw them and handle input. Every game ends with the shared score screen (`static/arcade_scene.js`): it shows the top 10, asks for a name if the score qualifies (max 18 characters, pre-filled with the player's name), and posts it. The game pauses while the screen is open.

- Jule Snake (`/advent-1`, `static/forste_advent.js`, rules `static/snake_core.js` and `static/snake_powerups.js`, feedback values `static/snake_feel.js`):
  - Arrow keys or swipe (24px threshold) steer. The board matches the screen aspect (`static/snake_board.js`), about 400 cells.
  - Turns are queued: up to two per tick, applied in press order. A reverse is refused against the direction in use.
  - The snake starts as a 5-segment body with four present segments. Gifts come from a shuffle bag and become body segments in the order eaten.
  - Tick time starts at 190 ms, drops 4 ms per gift, and never goes below 70 ms. A queued turn steps early once half a tick has passed.
  - The floor holds one item: a gift, or with 20% chance a powerup. Gifts never spawn in row 0, under the HUD.
  - Powerups: `shield` absorbs one wall or self hit; `ghost` lets the head pass through its body for 6 ticks; `trim` removes 3 tail segments and their presents with no score loss (the snake keeps at least 5). Pickups stack. Shield and ghost counts show on the HUD.
  - A powerup has a timer of max(8, ceil(path length × 1.5)) ticks, where path length is the shortest walk from the head around the body. It blinks in its last 3 ticks, then becomes a normal gift on the same cell.
  - The first pickup of each powerup kind pauses the game and shows a loot-style card (name, flavor line, effect line). A key or tap dismisses it and leaves the game paused with the message "Good luck. Press a direction to start again". Only a direction (key or swipe) resumes it; Space, Enter and taps do not. Later pickups of that kind only play a sound. Card text lives in `POWERUP_CARDS` in `static/snake_powerups.js`.
  - A shield absorbs a wall hit (the snake stops) or a body hit (the head moves into the body). A ghost that runs out inside a body loop is a death on the next move.
  - Eating a gift gives a 50 ms hit-stop and a burst. Death gives a 120 ms hit-stop, a shake and a red flash.
  - Space, Enter or an arrow key restart after game over. Scores post to `/api/scores/advent-1`.
  - Debug hooks for Playwright: `window.__snakeDebug__` (see `TESTING.md`), including `placePowerupNextToHead`, `getEffects`, `getQueue`.

- Flappy Santa (`/advent-2`, `static/anden_advent.js`, rules `static/anden_core.js`):
  - Tap, click or Space flaps. Gravity, flap impulse and speed scale with the canvas width.
  - Chimneys have a gap that moves between spawns. Passing one scores a point.
  - Levels at 25 and 50 points: from level 2 the next gap is previewed one second before it spawns; from level 3 it is always shown.
  - Hitbox is 72% of the reindeer size. Scores post to `/api/scores/advent-2`.

- Jingle Bell Hero (`/advent-3`, `static/jingle_bell_hero.js`, rules `static/jingle_bell_rules.js`, audio and chart `static/jingle_bell_hero_core.js` / `static/jingle_bell_hero_chart.js`):
  - Notes scroll down four lanes to the hit line. Tap a lane key at the beat, or hold for sustained notes and release at the end.
  - Timing: PERFECT, GOOD and OK inside a 0.318s window; releases allow 1.2x that window.
  - Four misses in a row cost a life; three lives. The first two levels use only the first note of each event.
  - Level order: partridge-1 twice, partridge-2 twice, partridge-3 twice, then endless speed-ups. Scores post to `/api/scores/advent-3`.

- Reindeer Rush (`/advent-4`, `static/reindeer_rush.js`, rules `static/reindeer_core.js`):
  - Rudolph runs at a speed that grows with distance. Tap or Space jumps once more in the air (double jump); swipe down or Down ducks; swipe right or Right dashes.
  - Dashing gives brief invulnerability and smashes snowmen for 120 bonus points. Hitting a snowman otherwise ends the run, and so does falling off the screen.
  - Score is distance (1 point per 50px) plus snowman bonuses. Simulation is fixed-step (1/60s), so the outcome does not depend on frame rate.
  - Scores post to `/api/scores/advent-4`.


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
  - Verifies `/api/scores/advent-1` initially empty, accepts many scores, and returns top 10 sorted by score.

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
- The server runs under uvicorn inside the provided `Dockerfile` for production usage.

If a behavior in this document becomes out-of-sync with tests in the repository, update SPECS.md by re-generating the appropriate summaries from tests and commit the change.

Testing learnings
-----------------
Practical notes from recent mobile UI work have been collected in `TESTING.md`. Highlights:

- Use `uv run pytest` for Python tests, `npx jest` for the game rules and `npx playwright test` for E2E. Playwright starts its own server on port 5001 via `e2e/serve.sh`, with a throwaway data folder and a known test login.
- Playwright specs log in through `e2e/helpers/login.ts` (API call), not the login form, to avoid navigation races.
- Ensure test accounts exist both in the `.env` used by tests and in the `secret-santa-<year>.json` assignments — missing mappings can raise server KeyErrors seen as HTML debug responses.
- Keep the debug hooks the Playwright specs rely on stable: `window.__snakeDebug__`, `window.__andenDebug__`, `window.__jbhDebug__`, `window.__rrDebug__`, `window.__arcadeScores__`.

See `TESTING.md` for the full checklist and commands.
