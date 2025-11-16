# Secret Santa Web App

A lightweight Secret Santa web app that lets participants securely log in with their name and a passphrase (xkcd‑style multi‑word sequence) and see who they’re gifting to. Pairings are generated with constraints (no self, no spouse, no repeats from prior years) and stored per year.

## Overview

- Backend: Flask server exposing a simple login API and a Jinja template UI (`app.py`).
- Assignment logic: `secret_santa.py` generates valid assignments using `couples.yaml` and `previous.yaml`, then saves to `secret-santa-<year>.json`.
- Frontend: `templates/index.html` + `static/styles.css` provides a festive login and reveal screen.
- Data: Current year’s assignments in `secret-santa-2024.json`. Couples and previous pairings are YAML files.

## How It Works

1. `secret_santa.py` builds assignments ensuring:
   - You can’t draw yourself.
   - You can’t draw your spouse (from `couples.yaml`).
   - You can’t draw someone you gifted to in previous years (from `previous.yaml`).
2. `app.py` loads the saved assignments on startup and serves:
   - `GET /` renders the login page.
   - `POST /api/login` validates name + passphrase and returns your assigned recipient.

## Repo Layout

- `app.py` — Flask app and API.
- `secret_santa.py` — pairing generator and persistence helpers.
- `couples.yaml` — couples list used to avoid spouse draws.
- `previous.yaml` — historical receivers to avoid repeats.
- `secret-santa-2024.json` — current year’s assignments.
- `templates/index.html` — UI template.
- `static/styles.css` — app styling.
- `Dockerfile` — container build for production.
- `pyproject.toml` — Python project config and dependencies.

## Development

We use `uv` to manage Python environments. Do not activate virtualenvs manually; instead, run commands via `uv run ...`.

### Environment configuration

Create a `.env` file (use `.env.example` as a template) to configure secrets and login passphrases. Store HASHED values using Werkzeug (salted PBKDF2):

```
SECRET_KEY=<strong-random-hex>
LOGIN_ditte=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_camilla=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_emma=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_andreas=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_jimmy=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_sara=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_mathias=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_klaus=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_tommy=pbkdf2:sha256:260000$<salt>$<hash>
LOGIN_jonna=pbkdf2:sha256:260000$<salt>$<hash>
```

The app loads `.env` on startup and builds logins from environment variables with the `LOGIN_` prefix. Passphrases can be any string; hyphenated multi‑word sequences are recommended for memorability. Values must be hashed (plaintext is not supported).

### Set a user passphrase

Generate a salted hash for a user’s passphrase and paste it into `.env`:

```
uv run python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('horse-staple-orange'))"
```

Or use the helper script:

```
uv run python scripts/hash_password.py horse-staple-orange
```

Then set in `.env`:

```
LOGIN_ditte=pbkdf2:sha256:260000$<salt>$<hash>
```

### Prerequisites

- Python 3.10+
- `uv` installed: https://github.com/astral-sh/uv

### Install dependencies

If you need to add or update deps, use `uv add` (not `pip`):

```
uv add Flask flask-cors
```

### Run the app (dev)

- Simple dev run using the built-in Flask dev server:

```
uv run python app.py
```

- Or via Flask CLI (explicit app module):

```
uv run flask --app app.py run --debug --host 0.0.0.0 --port 5000
```

The app listens on `http://localhost:5000` and serves the UI at `/`.

### Generate/refresh assignments

If you need to generate a new year’s assignments:

```
uv run python -c "from secret_santa import SecretSanta; ss=SecretSanta(2024); ss.draw(); ss.save()"
```

- Update the year as needed (e.g., `2025`).
- The file `secret-santa-<year>.json` will be created in the project root.
- `app.py` loads the file for the current year.

### Testing

- Python tests (pytest):

```
uv run pytest
```

- Lint with `ruff` (if configured):

```
uv run ruff check .
```

## Production

There is a `Dockerfile` for production builds using Poetry inside the container (no local pip needed).

### Build the image

```
docker build -t secret-santa .
```

### Run the container

```
docker run --rm -p 5000:5000 \
  -e FLASK_APP=app.py \
  -e SECRET_KEY=change-me \
  secret-santa
```

- Access at `http://localhost:5000`.
- For security, set a strong `SECRET_KEY` via env and update `app.py` to read it (e.g., `app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")`).

### Alternative production run (without Docker)

Use a production WSGI server if you prefer a direct host deployment. Example with `gunicorn` (add it via `uv add gunicorn`):

```
uv run gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

## Configuration

- Update `couples.yaml` to reflect current couples.
- Update `previous.yaml` with prior years’ draws.
- Regenerate assignments with `secret_santa.py` and commit the new `secret-santa-<year>.json`.
- Login codes live in `app.py` — avoid committing real codes; consider moving to env or a secure store.
- Admins: `jimmy` and `ditte` are admins and can access `/admin` to manage passphrases and regenerate matches.
- To target a specific env file (useful in tests), set `ENV_FILE` to the path of the `.env` you want the app to load/update.

## Notes

- The project currently uses Flask for simplicity; if migrating to FastAPI, keep most logic in Python services and reuse the pairing logic from `secret_santa.py`.
- Frontend is server-rendered; if adding a React UI, use Jest + React Testing Library for components and Playwright for E2E as per project conventions.

## Admin Usage

- Visit `/admin` after logging in as an admin (jimmy or ditte).
- The top navigation shows an Admin link only for admins once logged in.
- Set user passphrase: enter a first name and a new passphrase; the app stores a salted hash in the `.env` file and reloads logins immediately.
- Run current year’s matches: generates and saves `secret-santa-<year>.json` and hot-reloads assignments so subsequent logins see the new matches.
