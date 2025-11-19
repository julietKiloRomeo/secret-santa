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
- Playwright's `playwright.config.ts` is configured to start the web server automatically using: `uv run python app.py`. Ensure port 5000 is free or start the server yourself and set `reuseExistingServer: true` in the config or run Playwright with the server already running.
- Prefer logging in through the real UI in Playwright tests (fill the login form and click submit) instead of using `page.evaluate` fetches. This ensures cookies are set properly and avoids HTML debug pages from leaking into `JSON.parse` attempts when the server errors.
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

- Anden Advent test hooks: The Flappy-Santa page exposes a small optional helper on `window.__ANDEN_TEST__` used by Playwright tests. Available helpers include `getLeadY()`, `getScore()`, `stepPhysics(ms)`, and `getTrail(n)`.

Quick commands
--------------
- Run unit tests: `uv run pytest -q`
- Run Playwright e2e (single test): `npx playwright test e2e/mobile_screenshots.spec.ts`
- Open Playwright in interactive mode (headed): `npx playwright test --headed --debug` or `npx playwright show-report`

Always run tests after making frontend or game logic changes. The e2e tests are lightweight and capture mobile layout regressions (screenshots are in `out/`).
