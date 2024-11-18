# app.py
from flask import Flask, jsonify, request, session, render_template
from flask_cors import CORS
import random
from functools import wraps
from secret_santa import SecretSanta


SS = SecretSanta()
SS.load()
ASSIGNMENTS = SS.config

logins = {
 'ditte': '5491',
 'camilla': '9915',
 'emma': '4673',
 'andreas': '1284',
 'jimmy': '8476',
 'sara': '0554',
 'mathias': '7355',
 'klaus': '8153',
 'tommy': '6778',
 'jonna': '6022'
}


app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = 'your-secret-key-here'  # Change this to a secure secret key

# Sample data structure for couples

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    name = data.get('name').lower()
    code = data.get('code')

    if code == logins[name]:
        session['user'] = name
        return jsonify({"success": True, "name": name, "recipient": ASSIGNMENTS[name].capitalize()})

    return jsonify({"success": False, "error": "Invalid credentials"}), 401

    

if __name__ == '__main__':
    app.run(debug=True)
