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
load_dotenv(ENV_FILE)
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

def init_scores_db():
    con = sqlite3.connect(scores_db_path())
    try:
        cur = con.cursor()
        # Ensure table exists with a uniqueness constraint on (game, name)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game TEXT NOT NULL,
                name TEXT NOT NULL,
                score INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(game, name)
            )
            """
        )
        # Index to speed up top-N queries
        cur.execute("CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores(game, score DESC)")
        # Also ensure unique index exists (for older SQLite versions this is redundant)
        try:
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_game_name ON scores(game, name)")
        except sqlite3.IntegrityError:
            # There are duplicate (game, name) rows in an existing DB. Deduplicate
            # by keeping the highest score for each (game, name).
            cur.execute("SELECT game, name, COUNT(*) as c FROM scores GROUP BY game, name HAVING c > 1")
            duplicates = cur.fetchall()
            for g, n, _ in duplicates:
                cur.execute(
                    "SELECT id FROM scores WHERE game = ? AND name = ? ORDER BY score DESC, id ASC LIMIT 1",
                    (g, n),
                )
                keep = cur.fetchone()[0]
                cur.execute(
                    "DELETE FROM scores WHERE game = ? AND name = ? AND id != ?",
                    (g, n, keep),
                )
            # Try creating the unique index again
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_game_name ON scores(game, name)")
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
            "reindeer-rush",
            "tredje-advent",
            "fjerde-advent",
            "glaedelig-jul",
        ]
        for g in default_games:
            cur.execute("INSERT OR IGNORE INTO games (game, enabled) VALUES (?, ?)", (g, 1))
        con.commit()
    finally:
        con.close()

init_games_db()

def is_game_enabled(game: str) -> bool:
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
        return [{"game": g, "enabled": bool(e)} for (g, e) in rows]
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

@app.route('/reindeer-rush')
@login_required
def reindeer_rush():
    default_name = session.get('user', 'Nisse')
    return render_game_view('reindeer-rush', 'reindeer_rush.html', title='Reindeer Rush', default_name=default_name)

@app.route('/tredje-advent')
@login_required
def tredje_advent():
    default_name = session.get('user', 'Nisse')
    return render_game_view('tredje-advent', 'tredje_advent.html', title='Tredje Advent', default_name=default_name)

@app.route('/fjerde-advent')
@login_required
def fjerde_advent():
    return render_game_view('fjerde-advent', 'fjerde_advent.html', title='Fjerde Advent')

@app.route('/glaedelig-jul')
@login_required
def glaedelig_jul():
    return render_game_view('glaedelig-jul', 'glaedelig_jul.html', title='Glædelig Jul')

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
        # Determine whether this score would qualify for the top-10 list.
        cur.execute(
            "SELECT name, score FROM scores WHERE game = ? ORDER BY score DESC, id ASC LIMIT 10",
            (game,)
        )
        rows = cur.fetchall()
        lowest = rows[-1][1] if rows and len(rows) >= 10 else None
        # If there are already 10 entries and this score is not strictly greater than
        # the lowest score, do not insert it.
        if lowest is not None and score <= lowest:
            return jsonify({"success": False, "error": "Score does not qualify for leaderboard"})

        # Upsert: keep only one row per (game, name). If a new score is higher, update it.
        cur.execute(
            """
            INSERT INTO scores (game, name, score, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(game, name) DO UPDATE SET
                score = CASE WHEN excluded.score > score THEN excluded.score ELSE score END,
                created_at = CASE WHEN excluded.score > score THEN excluded.created_at ELSE created_at END
            """,
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
    return jsonify({"success": True, "game": game, "enabled": bool(enabled)})


@app.route('/api/admin/reset_scores', methods=['POST'])
@admin_required
def admin_reset_scores():
    data = request.get_json() or {}
    game = data.get('game')
    if not game:
        return jsonify({"success": False, "error": "Missing game"}), 400
    reset_scores_for_game(game)
    return jsonify({"success": True, "game": game})


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
    app.run(debug=True)
