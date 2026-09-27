"""
Marginalia — Python backend

Serves the static front end (index.html, login.html, dashboard.html,
upload.html) and exposes:

    POST /api/auth/register
    POST /api/auth/login
    POST /api/materials/upload      (multipart PDF upload)
    POST /api/materials/generate    (explanation/summary/quiz/flashcards/plan)
    POST /api/chat

Run:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=your_key_here   # optional — see README
    python app.py

Then open http://localhost:5000
"""

import json
import os
import sqlite3
import uuid

from flask import Flask, request, jsonify, send_from_directory, g
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder=".", static_url_path="")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "marginalia.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if ANTHROPIC_API_KEY:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ------------------------------------------------------------------
# Database (SQLite — swap for Postgres/etc. once this grows up)
# ------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS materials (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            text_content TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


# ------------------------------------------------------------------
# Pages (static files also serve directly, e.g. /login.html)
# ------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(".", "index.html")


# ------------------------------------------------------------------
# Auth
#
# NOTE: this issues a placeholder token, not a real session/JWT. It's
# enough to demo the front end end-to-end; swap in Flask-Login, a
# signed JWT, or your framework of choice before this goes anywhere
# real.
# ------------------------------------------------------------------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "name, email, and a 6+ character password are required"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify({"error": "An account with that email already exists"}), 400

    user_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
        (user_id, name, email, generate_password_hash(password)),
    )
    db.commit()

    return jsonify({"user": {"name": name, "email": email}, "token": user_id})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Incorrect email or password"}), 401

    return jsonify({"user": {"name": user["name"], "email": user["email"]}, "token": user["id"]})


# ------------------------------------------------------------------
# Materials: upload a PDF, extract its text, generate study content
# ------------------------------------------------------------------
@app.route("/api/materials/upload", methods=["POST"])
def upload_material():
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"error": "No file provided"}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported right now"}), 400

    filename = secure_filename(file.filename)
    material_id = str(uuid.uuid4())
    saved_path = os.path.join(UPLOAD_DIR, f"{material_id}_{filename}")
    file.save(saved_path)

    text_content = extract_pdf_text(saved_path)

    db = get_db()
    db.execute(
        "INSERT INTO materials (id, filename, text_content) VALUES (?, ?, ?)",
        (material_id, filename, text_content),
    )
    db.commit()

    return jsonify({"material_id": material_id, "filename": filename})


def extract_pdf_text(path, max_chars=12000):
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(path)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text[:max_chars]
    except Exception as exc:
        print(f"PDF extraction failed: {exc}")
        return ""


@app.route("/api/materials/generate", methods=["POST"])
def generate_material():
    data = request.get_json(force=True) or {}
    material_id = data.get("material_id")

    db = get_db()
    material = db.execute("SELECT * FROM materials WHERE id = ?", (material_id,)).fetchone()
    if not material:
        return jsonify({"error": "Material not found"}), 404

    text = material["text_content"]
    filename = material["filename"]

    if ANTHROPIC_API_KEY and text.strip():
        result = generate_with_model(text, filename)
    else:
        result = generate_mock(text, filename)

    return jsonify(result)


GENERATE_SYSTEM_PROMPT = """You turn study material into structured study content.
Reply with ONLY valid JSON (no markdown fences, no commentary) matching this shape:
{
  "explanation": ["paragraph 1", "paragraph 2"],
  "summary": ["paragraph 1"],
  "quiz": [{"question": "...", "options": ["...", "...", "...", "..."], "correct": 0}],
  "flashcards": [{"front": "term", "back": "definition"}],
  "plan": [{"day": "Day 1", "task": "...", "minutes": 20}]
}
Write explanation in plain, simple language as if to someone new to the topic.
Include 4-6 quiz questions, 6-10 flashcards, and a 5-7 day plan."""


def generate_with_model(text, filename):
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=GENERATE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Material: {filename}\n\n{text}"}],
    )
    raw = "".join(block.text for block in response.content if block.type == "text")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print("Model did not return valid JSON, falling back to mock content.")
        return generate_mock(text, filename)


def generate_mock(text, filename):
    """Used when no ANTHROPIC_API_KEY is set, or extraction found no text.
    Keeps the app usable end-to-end with zero setup."""
    topic = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
    snippet = (text[:220] + "…") if text.strip() else "(no extractable text found in this PDF)"

    return {
        "explanation": [
            f"Here's {topic} in plain terms — this placeholder will become a real, "
            f"plain-language walkthrough once ANTHROPIC_API_KEY is set.",
            f"Extracted from your file: \u201c{snippet}\u201d",
        ],
        "summary": [
            f"A short summary of {topic} will appear here once a model is connected."
        ],
        "quiz": [
            {
                "question": f"Which best describes how {topic} was introduced in the material?",
                "options": [
                    "It builds on ideas covered earlier",
                    "It has no connection to anything else",
                    "It only appears in an appendix",
                    "It contradicts the summary above",
                ],
                "correct": 0,
            }
        ],
        "flashcards": [
            {"front": topic, "back": "Definition will appear here once a model is connected."}
        ],
        "plan": [
            {"day": "Day 1", "task": f"Read through the {topic} summary", "minutes": 20},
            {"day": "Day 2", "task": "Take the generated quiz", "minutes": 15},
        ],
    }


# ------------------------------------------------------------------
# Ask AI chat (same endpoint the home page and dashboard call)
# ------------------------------------------------------------------
SYSTEM_PROMPT = (
    "You are Marginalia, an AI study companion. You help students work "
    "through problems using a Socratic approach: ask a guiding question "
    "before giving the answer outright, keep replies short (3-5 sentences), "
    "and adapt to the subject the student mentions."
)


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True) or {}
    message = data.get("message", "")
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "message is required"}), 400

    if ANTHROPIC_API_KEY:
        messages = [{"role": h["role"], "content": h["content"]} for h in history]
        messages.append({"role": "user", "content": message})
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        reply = "".join(block.text for block in response.content if block.type == "text")
    else:
        reply = (
            "I'm running without a model connected yet — set the "
            "ANTHROPIC_API_KEY environment variable to turn on real "
            "answers. For now: what have you tried on this so far?"
        )

    return jsonify({"reply": reply})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
