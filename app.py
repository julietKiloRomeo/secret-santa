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
 'ditte': '1234',
 'camilla': '1234',
 'emma': '1234',
 'andreas': '1234',
 'jimmy': '1234',
 'sara': '1234',
 'mathias': '1234',
 'klaus': '1234',
 'tommy': '1234',
 'jonna': '1234'
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
    name = data.get('name')
    code = data.get('code')

    if code == logins[name]:
        session['user'] = name
        return jsonify({"success": True, "name": name})

    return jsonify({"success": False, "error": "Invalid credentials"}), 401

@app.route('/api/names', methods=['GET'])
@login_required
def get_eligible_names():
    current_user = session['user']
    
    return jsonify({"names": list(SS.get_eligible_names(current_user))})

@app.route('/api/secret-santa', methods=['GET'])
@login_required
def get_assignment():
    current_user = session['user']
    
    return jsonify({"recipient": ASSIGNMENTS[current_user]})
    

if __name__ == '__main__':
    app.run(debug=True)