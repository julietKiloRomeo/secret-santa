"""Secret Santa + advent mini-games. Run as a single process (state lives in module globals)."""

import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

from dotenv import load_dotenv, set_key
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware
from werkzeug.security import check_password_hash, generate_password_hash

from secret_santa import SecretSanta
from storage import (
    create_snapshot,
    ensure_data_dir,
    env_file_path,
    get_data_dir,
    list_snapshots,
    restore_snapshot,
    scores_db_path,
)

ADMINS = {"jimmy", "ditte"}
# url name -> (title, game name, template)
GAMES = {
    "advent-1": ("Første Advent", "Snake", "forste_advent.html"),
    "advent-2": ("Anden Advent", "Flappy Santa", "anden_advent.html"),
    "advent-3": ("Tredje Advent", "Jingle Bell Hero", "tredje_advent.html"),
    "advent-4": ("Fjerde Advent", "Reindeer Rush", "fjerde_advent.html"),
    "advent-5": ("Femte Advent", "Pac-Santa", "femte_advent.html"),
}
# Games listed in the navbar and high-score page. Change to publish a different four.
PUBLISHED = ["advent-1", "advent-2", "advent-3", "advent-4"]
# Score rows written before the rename, keyed by the old route name.
OLD_GAME_IDS = {
    "forste-advent": "advent-1",
    "anden-advent": "advent-2",
    "tredje-advent": "advent-3",
    "fjerde-advent": "advent-4",
}
MAX_NAME = 18

ENV_FILE = env_file_path()
load_dotenv(ENV_FILE, override=True)
SECRET_KEY = os.environ[
    "SECRET_KEY"
]  # no fallback: a default key makes sessions forgeable
ensure_data_dir()
DB_PATH = scores_db_path()


def load_logins():
    return {
        k[len("LOGIN_") :].lower(): v
        for k, v in os.environ.items()
        if k.startswith("LOGIN_")
    }


def load_draw():
    santa = SecretSanta(data_dir=get_data_dir())
    try:
        santa.load()
    except FileNotFoundError:
        santa.draw()
        santa.save()
    return santa


def db():
    return closing(sqlite3.connect(DB_PATH))


def init_db():
    with db() as con, con:
        con.execute(
            "CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT,"
            " game TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL, created_at TEXT NOT NULL)"
        )
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores(game, score DESC)"
        )
        con.execute(
            "CREATE TABLE IF NOT EXISTS games (game TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1)"
        )
        con.executemany(
            "INSERT OR IGNORE INTO games (game, enabled) VALUES (?, 1)",
            [(g,) for g in GAMES],
        )
        # Rename legacy rows once: copy old ids to new ones, then drop the old rows.
        for old, new in OLD_GAME_IDS.items():
            con.execute(
                "UPDATE OR IGNORE scores SET game = ? WHERE game = ?", (new, old)
            )
            con.execute("DELETE FROM scores WHERE game = ?", (old,))
            con.execute(
                "INSERT INTO games (game, enabled) SELECT ?, enabled FROM games WHERE game = ?"
                " ON CONFLICT(game) DO UPDATE SET enabled = excluded.enabled",
                (new, old),
            )
            con.execute("DELETE FROM games WHERE game = ?", (old,))


SS = load_draw()
logins = load_logins()
init_db()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, same_site="lax")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.exception_handler(HTTPException)
def http_error(request: Request, exc: HTTPException):
    return JSONResponse(
        {"success": False, "error": exc.detail}, status_code=exc.status_code
    )


# --- helpers ---------------------------------------------------------------


def draw_locked():
    return os.environ.get("DRAW_LOCKED", "").lower() in ("1", "true", "yes", "on")


def is_game_enabled(game):
    with db() as con:
        row = con.execute(
            "SELECT enabled FROM games WHERE game = ?", (game,)
        ).fetchone()
    return row is None or bool(row[0])


def known_game(game: str):
    if game not in GAMES:
        raise HTTPException(404, "Unknown game")
    return game


def require_user(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(401, "Unauthorized")
    return user


def require_admin(user=Depends(require_user)):
    if user not in ADMINS:
        raise HTTPException(403, "Forbidden")
    return user


def render(request: Request, template: str, **ctx):
    user = request.session.get("user")
    admin = user in ADMINS
    return templates.TemplateResponse(
        request,
        template,
        {
            "session": request.session,
            "is_admin_user": lambda: admin,
            "game_enabled_for_user": lambda g: admin or is_game_enabled(g),
            "published_games": [{"id": g, "title": GAMES[g][0]} for g in PUBLISHED],
            **ctx,
        },
    )


def to_login():
    return RedirectResponse("/", status_code=302)


# --- pages -----------------------------------------------------------------


@app.get("/")
def index(request: Request):
    return render(request, "index.html")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/lodtraekning")
def lodtraekning(request: Request):
    user = request.session.get("user")
    if not user:
        return to_login()
    return render(
        request,
        "lodtraekning.html",
        name=user,
        recipient=(SS.config.get(user) or "").capitalize(),
    )


# Full-screen shell settings per game: stage/canvas ids, HUD title, hint line and Phaser script.
GAME_SHELL = {
    "advent-1": {"stage_id": "snake-stage", "canvas_wrap_id": "snake-wrap", "game_title": "Jule Snake",
                 "game_hint": "Swipe eller piletaster for at styre", "game_script": "forste_advent.js"},
    "advent-2": {"stage_id": "santa-stage", "canvas_wrap_id": "santa-canvas-wrap", "game_title": "Flappy Santa",
                 "game_hint": "Tryk eller mellemrum for at flyve", "game_script": "anden_advent.js"},
    "advent-3": {"stage_id": "bell-stage", "canvas_wrap_id": "jingle-bell-hero-root", "game_title": "Jingle Bell Hero",
                 "game_hint": "D F J K eller tryk på linjerne", "game_script": "jingle_bell_hero.js"},
    "advent-4": {"stage_id": "reindeer-stage", "canvas_wrap_id": "reindeer-canvas", "game_title": "Reindeer Rush",
                 "game_hint": "Tryk for at hoppe · swipe ned for at ducke · swipe højre for at dashe",
                 "game_script": "reindeer_rush.js"},
    "advent-5": {"stage_id": "pac-stage", "canvas_wrap_id": "pac-santa-canvas-wrap", "game_title": "Pac-Santa",
                 "game_hint": "Swipe eller piletaster for at styre", "game_script": "pac_santa.js"},
}

# One-line promise shown on the games hub, per published game.
GAME_BLURBS = {
    "advent-1": "Styr nissen gennem snefyldte ruter og saml gaverne.",
    "advent-2": "Flyv gennem skorstenene med sleden. Ét tryk, ét hop.",
    "advent-3": "Ram tonerne i takt med klokkeklangen.",
    "advent-4": "Løb, hop og dash med Rudolf over sne og snemænd.",
    "advent-5": "Labyrint med småkager, slik og en sur julemand.",
}


@app.get("/spil")
def spil(request: Request):
    if not request.session.get("user"):
        return to_login()
    cards = [
        {"id": g, "title": GAMES[g][0], "name": GAMES[g][1], "blurb": GAME_BLURBS[g]}
        for g in PUBLISHED
    ]
    return render(request, "spil.html", cards=cards)


@app.get("/high-scores")
def high_scores(request: Request):
    if not request.session.get("user"):
        return to_login()
    games = [(g, f"{GAMES[g][0]} — {GAMES[g][1]}") for g in PUBLISHED]
    return render(request, "high_scores.html", games=games)


@app.get("/admin")
def admin_page(request: Request, user=Depends(require_admin)):
    return render(
        request,
        "admin.html",
        year=SS.year,
        draw_locked=draw_locked(),
        users=sorted(SS.config),
    )


@app.get("/{game}")
def game_page(request: Request, game: str = Depends(known_game)):
    user = request.session.get("user")
    if not user:
        return to_login()
    title, _, template = GAMES[game]
    if user not in ADMINS and not is_game_enabled(game):
        return render(request, "under_construction.html", title=title)
    shell = GAME_SHELL.get(game, {})
    return render(request, template, title=title, game=game, default_name=user, **shell)


# --- api -------------------------------------------------------------------


class LoginIn(BaseModel):
    name: str = ""
    code: str = ""


@app.post("/api/login")
def login(body: LoginIn, request: Request):
    name = body.name.strip().lower()
    stored = logins.get(name)
    if not stored or not check_password_hash(stored, body.code):
        raise HTTPException(401, "Invalid credentials")
    request.session["user"] = name
    return {
        "success": True,
        "name": name,
        "recipient": (SS.config.get(name) or "").capitalize(),
    }


@app.get("/api/scores/{game}")
def get_scores(game: str = Depends(known_game)):
    with db() as con:
        rows = con.execute(
            "SELECT name, score, created_at FROM scores WHERE game = ? ORDER BY score DESC, id ASC LIMIT 10",
            (game,),
        ).fetchall()
    return {
        "game": game,
        "scores": [{"name": n, "score": s, "created_at": c} for n, s, c in rows],
    }


class ScoreIn(BaseModel):
    name: str = ""
    score: float = Field(ge=0, le=10_000_000)


@app.post("/api/scores/{game}")
def post_score(
    body: ScoreIn, game: str = Depends(known_game), user=Depends(require_user)
):
    name = (body.name.strip() or user)[:MAX_NAME]
    with db() as con, con:
        con.execute(
            "INSERT INTO scores (game, name, score, created_at) VALUES (?, ?, ?, ?)",
            (game, name, int(body.score), datetime.now(timezone.utc).isoformat()),
        )
    return {"success": True}


class PasswordIn(BaseModel):
    name: str
    passphrase: str = Field(min_length=1)


@app.post("/api/admin/set_password")
def admin_set_password(body: PasswordIn, _=Depends(require_admin)):
    global logins
    name = body.name.strip().lower()
    if name not in SS.config:
        raise HTTPException(400, "Unknown user")
    set_key(ENV_FILE, f"LOGIN_{name}", generate_password_hash(body.passphrase))
    load_dotenv(ENV_FILE, override=True)
    logins = load_logins()
    return {"success": True, "name": name}


@app.post("/api/admin/run_matches")
def admin_run_matches(_=Depends(require_admin)):
    global SS
    if draw_locked():
        raise HTTPException(403, "Draw locked by server configuration")
    santa = SecretSanta(data_dir=get_data_dir())
    santa.draw()
    santa.save()
    SS = santa
    return {"success": True, "year": SS.year}


@app.get("/api/admin/games")
def admin_games(_=Depends(require_admin)):
    with db() as con:
        rows = con.execute("SELECT game, enabled FROM games").fetchall()
    enabled = dict(rows)
    return {"games": [{"game": g, "enabled": bool(enabled.get(g, 1))} for g in GAMES]}


class GameIn(BaseModel):
    game: str
    enabled: bool = True


@app.post("/api/admin/set_game")
def admin_set_game(body: GameIn, _=Depends(require_admin)):
    known_game(body.game)
    with db() as con, con:
        con.execute(
            "INSERT INTO games (game, enabled) VALUES (?, ?) ON CONFLICT(game) DO UPDATE SET enabled = excluded.enabled",
            (body.game, int(body.enabled)),
        )
    return {"success": True, "game": body.game, "enabled": body.enabled}


@app.post("/api/admin/reset_scores")
def admin_reset_scores(body: GameIn, _=Depends(require_admin)):
    known_game(body.game)
    with db() as con, con:
        con.execute("DELETE FROM scores WHERE game = ?", (body.game,))
    return {"success": True, "game": body.game}


@app.get("/api/admin/snapshots")
def admin_list_snapshots(_=Depends(require_admin)):
    return {"snapshots": list_snapshots()}


@app.post("/api/admin/snapshots")
def admin_create_snapshot(_=Depends(require_admin)):
    path = create_snapshot()
    return {"success": True, "snapshot": os.path.basename(path), "path": path}


class SnapshotIn(BaseModel):
    name: str


@app.post("/api/admin/snapshots/restore")
def admin_restore_snapshot(body: SnapshotIn, _=Depends(require_admin)):
    global SS, logins
    try:
        restore_snapshot(body.name)
    except FileNotFoundError:
        raise HTTPException(404, "Snapshot not found")
    load_dotenv(ENV_FILE, override=True)
    logins = load_logins()
    SS = load_draw()
    init_db()
    return {"success": True, "snapshot": body.name}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", port=5000, reload=True)
