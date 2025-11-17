# app.py
from flask import Flask, jsonify, request, session, render_template
import os
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
import random
from functools import wraps
from secret_santa import SecretSanta
from dotenv import load_dotenv, set_key
import sqlite3
from datetime import datetime


ENV_FILE = os.environ.get("ENV_FILE", ".env")
load_dotenv(ENV_FILE)
SS = SecretSanta()
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


app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret')

def scores_db_path():
    return os.environ.get('SCORES_DB', os.path.join(os.getcwd(), 'scores.sqlite3'))

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
        default_games = ["forste-advent", "anden-advent"]
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


@app.context_processor
def inject_game_helpers():
    def is_admin_user():
        return 'user' in session and session['user'] in {"jimmy", "ditte"}
    def game_enabled_for_user(game):
        # Admins always have access
        if is_admin_user():
            return True
        return is_game_enabled(game)
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
            return jsonify({"error": "Unauthorized"}), 401
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


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/healthz')
def healthz():
    return jsonify({"status": "ok"})

@app.route('/forste-advent')
def forste_advent():
    default_name = session.get('user', 'Nisse')
    # If the game is disabled and the user is not an admin, show under construction
    if not is_game_enabled('forste-advent') and session.get('user') not in {"jimmy", "ditte"}:
        return render_template('under_construction.html', title='Første Advent')
    return render_template('forste_advent.html', default_name=default_name)

@app.route('/anden-advent')
def anden_advent():
    default_name = session.get('user', 'Nisse')
    if not is_game_enabled('anden-advent') and session.get('user') not in {"jimmy", "ditte"}:
        return render_template('under_construction.html', title='Anden Advent')
    return render_template('anden_advent.html', default_name=default_name)

@app.route('/tredje-advent')
def tredje_advent():
    return render_template('tredje_advent.html')

@app.route('/fjerde-advent')
def fjerde_advent():
    return render_template('fjerde_advent.html')

@app.route('/glaedelig-jul')
def glaedelig_jul():
    return render_template('glaedelig_jul.html')

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
    return render_template('admin.html', year=SS.year)

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    name = data.get('name').lower()
    code = data.get('code')

    if name in logins:
        stored = logins[name]
        if is_hashed(stored) and check_password_hash(stored, code):
            session['user'] = name
            return jsonify({"success": True, "name": name, "recipient": ASSIGNMENTS[name].capitalize()})

    return jsonify({"success": False, "error": "Invalid credentials"}), 401

@app.route('/api/admin/set_password', methods=['POST'])
@admin_required
def admin_set_password():
    data = request.get_json()
    name = data.get('name', '').lower()
    passphrase = data.get('passphrase', '')
    if not name or not passphrase:
        return jsonify({"success": False, "error": "Missing name or passphrase"}), 400
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
    global SS, ASSIGNMENTS
    SS = SecretSanta()
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

    

if __name__ == '__main__':
    app.run(debug=True)
