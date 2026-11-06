Testing Notes — what I learned while working on mobile UI and e2e
===============================================================

This file collects pragmatic testing guidance for the Secret Santa project so the next developer (or a fresh chat agent) can run tests and reason about failures quickly.

Principles
----------
- Always add tests for new behavior before implementing it. Unit tests go under `tests/` and end-to-end tests under `e2e/` (Playwright).
- Use `uv` for all Python commands: do NOT activate virtualenvs manually. Examples: `uv run pytest`, `uv add <pkg>`, `uv run python app.py`.
- Keep DOM test hooks stable (IDs and element attributes). Tests rely on `id` values like `snake-canvas`, `santa-canvas`, and `admin-link`.

Python tests (pytest)
---------------------
- Run the whole suite: `uv run pytest -q` (the repo's tests are fast and provide good coverage).
- Run a single test: `uv run pytest tests/test_navbar_and_pages.py::test_navbar_has_no_admin_link_before_login`
- If tests fail with DB/state issues, check `.env` used by tests. Many tests set `ENV_FILE` to `.env.test.*` files in `tests/` setup routines.

Playwright (E2E)
-----------------
- Install / ensure playwright browsers are available: `npx playwright install` (only needed once).
- Run the e2e suite: `npx playwright test` or `npm run test:e2e` (package.json contains `test:e2e`).
- `playwright.config.ts` starts the server with `e2e/serve.sh` on port 5001 (a fresh data folder and the `playwright` / `pw-test-123` login). Port 5000 is not used by the tests.
- Log in with `loginAsPlaywright(page)` from `e2e/helpers/login.ts`. It posts to `/api/login`, which sets the session cookie.
- If a Playwright test needs a stable user, provide a test account in `.env` and ensure a matching assignment exists in `secret-santa-<year>.json` (tests assume ASSIGNMENTS[name] exists). Otherwise the server may raise KeyError and return an HTML debug page which breaks response.json() calls.

Mobile testing notes
--------------------
- For mobile screenshots use `page.setViewportSize({ width, height })` or Playwright's `devices` presets (e.g. `devices['iPhone 12']`). The project includes a mobile screenshot test at `e2e/mobile_screenshots.spec.ts` which sets a 390×844 viewport and writes images to `out/`.
- Tests may need small waits after navigation for client JS to resize canvases — use `page.waitForTimeout(250)` or better, wait for the canvas element to be visible.

Debugging tips
--------------
- If you see a Playwright failure complaining about `Unexpected token '<'` when trying to parse JSON, open the browser logs / server logs: the server returned an HTML error (Flask debugger) instead of JSON. The root cause is typically an unhandled exception on the server (e.g., missing assignment for the test user). Fix by adding the test user to `.env` and `secret-santa-<year>.json` or by making the server tolerate missing mapping.
- For flaky UI timing, prefer `page.waitForResponse` (to observe the exact API reply) or `page.waitForSelector` on UI elements that the client updates after a successful action.
- Use debug JS hooks when appropriate (e.g. `window.__snakeDebug__` exists in the Snake game to place gifts and step the game). These help keep tests deterministic.

- Game test hooks are small read-only snapshots: `window.__andenDebug__.snapshot()`, `window.__jbhDebug__.snapshot()`, `window.__rrDebug__.snapshot()`. Snake exposes `window.__snakeDebug__` for placing gifts and stepping the game.
- Phaser draws to canvas, so specs assert on the snapshots and on the visible DOM (the score screen input and `window.__arcadeScores__.state`), not on pixels.

Quick commands
--------------
- Run Python tests: `uv run pytest -q`
- Run game rules tests: `npx jest`
- Run Playwright e2e (single test): `npx playwright test e2e/mobile_screenshots.spec.ts`
- Open Playwright in interactive mode (headed): `npx playwright test --headed --debug` or `npx playwright show-report`

Always run tests after making frontend or game logic changes. The e2e tests are lightweight and capture mobile layout regressions (screenshots are in `out/`).

Secret scanning
---------------
- Run `uvx detect-secrets scan --all-files --baseline .secrets.baseline` before committing. The baseline excludes `node_modules`, local caches, committed `.env.test.*` fixtures, and the admin helper tests so we only see genuinely new findings.
