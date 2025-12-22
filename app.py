# app.py
from flask import Flask, jsonify, request, session, render_template, redirect, url_for
import os
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps
from secret_santa import SecretSanta
from dotenv import load_dotenv, set_key
import sqlite3
from datetime import datetime
from storage import (
    env_file_path,
    ensure_data_dir,
    get_data_dir,
    scores_db_path,
    create_snapshot,
    list_snapshots,
    restore_snapshot,
)


ENV_FILE = env_file_path()
load_dotenv(ENV_FILE, override=True)
ensure_data_dir()
SS = SecretSanta(data_dir=get_data_dir())
try:
    SS.load()
except Exception:
    # If current year's file is missing, generate and save it
    SS.draw()
    SS.save()
    SS.load()
ASSIGNMENTS = SS.config

def load_logins_from_env():
    prefix = "LOGIN_"
    result = {}
    for key, value in os.environ.items():
        if key.startswith(prefix):
            name = key[len(prefix):].lower()
            result[name] = value
    return result

logins = load_logins_from_env()

ADMIN_USERS = {"jimmy", "ditte"}


app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret')

SCORES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TEXT NOT NULL
)
"""


def init_scores_db():
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='scores'")
        row = cur.fetchone()
        if not row or not row[0]:
            cur.execute(SCORES_TABLE_SQL)
        else:
            existing_sql = (row[0] or '').upper()
            if 'UNIQUE' in existing_sql:
                # Legacy schema had UNIQUE(game, name); rebuild table without it.
                cur.execute("ALTER TABLE scores RENAME TO scores__legacy")
                cur.execute(SCORES_TABLE_SQL)
                cur.execute(
                    """
                    INSERT INTO scores (id, game, name, score, created_at)
                    SELECT id, game, name, score, created_at FROM scores__legacy
                    """
                )
                cur.execute("DROP TABLE scores__legacy")
        # Drop any lingering unique index and create simple indexes for lookups
        cur.execute("DROP INDEX IF EXISTS idx_scores_game_name")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores(game, score DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_scores_game_name ON scores(game, name)")
        con.commit()
    finally:
        con.close()

init_scores_db()

def init_games_db():
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS games (
                game TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        # Ensure default games exist and are enabled by default
        default_games = [
            "forste-advent",
            "anden-advent",
            "tredje-advent",
            "fjerde-advent",
        ]
        for g in default_games:
            cur.execute("INSERT OR IGNORE INTO games (game, enabled) VALUES (?, ?)", (g, 1))
        con.commit()
    finally:
        con.close()

init_games_db()


def canonical_game_key(game: str) -> str:
    if game == "reindeer-rush":
        return "fjerde-advent"
    return game


def migrate_reindeer_rush_alias():
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute(
            "UPDATE scores SET game = 'fjerde-advent' WHERE game = 'reindeer-rush'"
        )
        cur.execute("DELETE FROM games WHERE game = 'reindeer-rush'")
        con.commit()
    finally:
        con.close()


migrate_reindeer_rush_alias()


def migrate_tredje_scores_to_fjerde():
    """Move legacy Reindeer Rush scores to the new Fjerde Advent bucket once."""
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM scores WHERE game = 'fjerde-advent'")
        fjerde_count = cur.fetchone()[0] or 0
        cur.execute("SELECT COUNT(*) FROM scores WHERE game = 'tredje-advent'")
        tredje_count = cur.fetchone()[0] or 0
        if tredje_count and fjerde_count == 0:
            cur.execute("UPDATE scores SET game = 'fjerde-advent' WHERE game = 'tredje-advent'")
        con.commit()
    finally:
        con.close()


migrate_tredje_scores_to_fjerde()


def remove_glaedelig_jul_game():
    """Clean up legacy Glædelig Jul rows now that the page is removed."""
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM scores WHERE game = 'glaedelig-jul'")
        cur.execute("DELETE FROM games WHERE game = 'glaedelig-jul'")
        con.commit()
    finally:
        con.close()


remove_glaedelig_jul_game()

def is_game_enabled(game: str) -> bool:
    game = canonical_game_key(game)
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        try:
            cur.execute("SELECT enabled FROM games WHERE game = ?", (game,))
        except sqlite3.OperationalError:
            # games table missing in this DB file; initialize and retry
            con.close()
            init_games_db()
            con2 = sqlite3.connect(scores_db_path())
            try:
                cur2 = con2.cursor()
                cur2.execute("SELECT enabled FROM games WHERE game = ?", (game,))
                row = cur2.fetchone()
                if row is None:
                    return True
                return bool(row[0])
            finally:
                con2.close()
        row = cur.fetchone()
        if row is None:
            return True
        return bool(row[0])
    finally:
        con.close()

def set_game_enabled(game: str, enabled: bool):
    game = canonical_game_key(game)
    # Ensure games table exists (handle cases where app was imported earlier
    # with a different DB path or when the DB file is new)
    init_games_db()
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO games (game, enabled) VALUES (?, ?) "
            "ON CONFLICT(game) DO UPDATE SET enabled = excluded.enabled",
            (game, 1 if enabled else 0),
        )
        con.commit()
    finally:
        con.close()

def get_games():
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute("SELECT game, enabled FROM games ORDER BY game")
        rows = cur.fetchall()
        merged: dict[str, bool] = {}
        for (g, e) in rows:
            key = canonical_game_key(g)
            merged[key] = merged.get(key, False) or bool(e)
        return [{"game": g, "enabled": enabled} for g, enabled in merged.items()]
    finally:
        con.close()


def is_admin_user():
    return 'user' in session and session['user'] in ADMIN_USERS


def game_enabled_for_user(game):
    if is_admin_user():
        return True
    return is_game_enabled(game)


@app.context_processor
def inject_game_helpers():
    return dict(is_admin_user=is_admin_user, game_enabled_for_user=game_enabled_for_user)


def reset_scores_for_game(game: str):
    init_scores_db()
    game = canonical_game_key(game)
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM scores WHERE game = ?", (game,))
        con.commit()
    finally:
        con.close()

def is_hashed(value: str) -> bool:
    return isinstance(value, str) and (value.startswith('pbkdf2:') or value.startswith('scrypt:'))

# Sample data structure for couples

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            # Prefer JSON for API endpoints, but redirect to the front page
            # for regular HTML page requests so users see the login form.
            accept = (request.headers.get('Accept') or '').lower()
            if request.path.startswith('/api') or 'application/json' in accept or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"error": "Unauthorized"}), 401
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        if session['user'] not in {"jimmy", "ditte"}:
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated_function


def render_game_view(game_key: str, template_name: str, title: str, **context):
    if not game_enabled_for_user(game_key):
        return render_template('under_construction.html', title=title)
    return render_template(template_name, **context)


@app.route('/')

def index():
    return render_template('index.html')

@app.route('/healthz')
def healthz():
    return jsonify({"status": "ok"})

@app.route('/forste-advent')
@login_required
def forste_advent():
    default_name = session.get('user', 'Nisse')
    return render_game_view('forste-advent', 'forste_advent.html', title='Første Advent', default_name=default_name)

@app.route('/anden-advent')
@login_required
def anden_advent():
    default_name = session.get('user', 'Nisse')
    return render_game_view('anden-advent', 'anden_advent.html', title='Anden Advent', default_name=default_name)

@app.route('/tredje-advent')
@login_required
def tredje_advent():
    default_name = session.get('user', 'Nisse')
    return render_game_view('tredje-advent', 'tredje_advent.html', title='Tredje Advent', default_name=default_name)

@app.route('/fjerde-advent')
@login_required
def fjerde_advent():
    default_name = session.get('user', 'Nisse')
    return render_game_view('fjerde-advent', 'fjerde_advent.html', title='Fjerde Advent', default_name=default_name)


@app.route('/high-scores')
@login_required
def high_scores():
    games = [
        ("forste-advent", "Første Advent — Snake"),
        ("anden-advent", "Anden Advent — Flappy Santa"),
        ("tredje-advent", "Tredje Advent — Jingle Bell Hero"),
        ("fjerde-advent", "Fjerde Advent — Reindeer Rush"),
    ]
    return render_template('high_scores.html', games=games)

@app.route('/lodtraekning')
@login_required
def lodtraekning():
    # Server-rendered Lodtrækning page: show the recipient for the logged-in user
    user = session.get('user')
    recipient = ''
    try:
        if isinstance(ASSIGNMENTS, dict) and user:
            recipient = ASSIGNMENTS.get(user) or ''
    except Exception:
        recipient = ''
    recipient_text = recipient.capitalize() if recipient else ''
    return render_template('lodtraekning.html', name=user, recipient=recipient_text)

@app.route('/api/scores/<game>', methods=['GET'])
def get_scores(game: str):
    init_scores_db()
    game = canonical_game_key(game)
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT name, score, created_at FROM scores WHERE game = ? ORDER BY score DESC, id ASC LIMIT 10",
            (game,)
        )
        rows = cur.fetchall()
        scores = [
            {"name": name, "score": int(score), "created_at": created_at}
            for (name, score, created_at) in rows
        ]
        return jsonify({"game": game, "scores": scores})
    finally:
        con.close()

@app.route('/api/scores/<game>', methods=['POST'])
def post_score(game: str):
    init_scores_db()
    game = canonical_game_key(game)
    data = request.get_json() or {}
    name = (data.get('name') or '').strip() or session.get('user') or 'Guest'
    try:
        score = int(data.get('score', 0))
    except Exception:
        return jsonify({"success": False, "error": "Invalid score"}), 400
    if score < 0:
        return jsonify({"success": False, "error": "Invalid score"}), 400
    created_at = datetime.utcnow().isoformat()
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO scores (game, name, score, created_at) VALUES (?, ?, ?, ?)",
            (game, name, score, created_at)
        )
        con.commit()
    finally:
        con.close()
    return jsonify({"success": True})

@app.route('/admin')
@login_required
def admin_page():
    if session['user'] not in {"jimmy", "ditte"}:
        return jsonify({"error": "Forbidden"}), 403
    # Expose draw-locked flag to the template so the button can be disabled
    draw_locked = os.environ.get('DRAW_LOCKED', '')
    draw_locked = str(draw_locked).lower() in ('1', 'true', 'yes', 'on')
    # Provide a list of known users (participants) so the admin UI can restrict selections
    try:
        users = sorted(ASSIGNMENTS.keys())
    except Exception:
        users = []
    return render_template('admin.html', year=SS.year, draw_locked=draw_locked, users=users)

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    name = data.get('name').lower()
    code = data.get('code')

    if name in logins:
        stored = logins[name]
        if is_hashed(stored) and check_password_hash(stored, code):
            session['user'] = name
            # Some tests or env setups may not have a mapping for every login
            recipient = ASSIGNMENTS.get(name) if isinstance(ASSIGNMENTS, dict) else None
            recipient_text = recipient.capitalize() if recipient else ''
            return jsonify({"success": True, "name": name, "recipient": recipient_text})

    return jsonify({"success": False, "error": "Invalid credentials"}), 401

@app.route('/api/admin/set_password', methods=['POST'])
@admin_required
def admin_set_password():
    data = request.get_json()
    name = data.get('name', '').lower()
    passphrase = data.get('passphrase', '')
    if not name or not passphrase:
        return jsonify({"success": False, "error": "Missing name or passphrase"}), 400
    # Ensure the admin can only set a password for an existing participant
    if name not in ASSIGNMENTS:
        return jsonify({"success": False, "error": "Unknown user"}), 400
    hashed = generate_password_hash(passphrase)
    key = f"LOGIN_{name}"
    set_key(ENV_FILE, key, hashed)
    load_dotenv(ENV_FILE, override=True)
    global logins
    logins = load_logins_from_env()
    return jsonify({"success": True, "name": name})

@app.route('/api/admin/run_matches', methods=['POST'])
@admin_required
def admin_run_matches():
    # Respect DRAW_LOCKED environment variable to prevent accidental redraws
    def _is_draw_locked():
        v = os.environ.get('DRAW_LOCKED', '')
        return str(v).lower() in ('1', 'true', 'yes', 'on')

    if _is_draw_locked():
        return jsonify({"success": False, "error": "Draw locked by server configuration"}), 403

    global SS, ASSIGNMENTS
    SS = SecretSanta(data_dir=get_data_dir())
    SS.draw()
    SS.save()
    SS.load()
    ASSIGNMENTS = SS.config
    return jsonify({"success": True, "year": SS.year})


@app.route('/api/admin/games', methods=['GET'])
@admin_required
def admin_get_games():
    games = get_games()
    return jsonify({"games": games})


@app.route('/api/admin/set_game', methods=['POST'])
@admin_required
def admin_set_game():
    data = request.get_json() or {}
    game = data.get('game')
    enabled = data.get('enabled')
    if not game or enabled is None:
        return jsonify({"success": False, "error": "Missing game or enabled flag"}), 400
    set_game_enabled(game, bool(enabled))
    return jsonify({"success": True, "game": canonical_game_key(game), "enabled": bool(enabled)})


@app.route('/api/admin/reset_scores', methods=['POST'])
@admin_required
def admin_reset_scores():
    data = request.get_json() or {}
    game = data.get('game')
    if not game:
        return jsonify({"success": False, "error": "Missing game"}), 400
    reset_scores_for_game(game)
    return jsonify({"success": True, "game": canonical_game_key(game)})


@app.route('/api/admin/snapshots', methods=['GET'])
@admin_required
def admin_list_snapshots():
    return jsonify({"snapshots": list_snapshots()})


@app.route('/api/admin/snapshots', methods=['POST'])
@admin_required
def admin_create_snapshot():
    try:
        snapshot_path = create_snapshot()
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    return jsonify({"success": True, "snapshot": os.path.basename(snapshot_path), "path": snapshot_path})


@app.route('/api/admin/snapshots/restore', methods=['POST'])
@admin_required
def admin_restore_snapshot():
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({"success": False, "error": "Missing snapshot name"}), 400
    try:
        restore_snapshot(name)
    except FileNotFoundError:
        return jsonify({"success": False, "error": "Snapshot not found"}), 404
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    global logins, SS, ASSIGNMENTS
    load_dotenv(ENV_FILE, override=True)
    logins = load_logins_from_env()
    SS = SecretSanta(data_dir=get_data_dir())
    SS.load()
    ASSIGNMENTS = SS.config
    init_scores_db()
    init_games_db()
    return jsonify({"success": True, "snapshot": name})


if __name__ == '__main__':
    debug_flag = os.environ.get('FLASK_DEBUG', '1')
    app.run(debug=debug_flag not in ('0', 'false', 'False'))
