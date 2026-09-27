# Marginalia — AI Study Companion

A 4-stage full-stack starter: **Home → Login/Register → Dashboard →
Upload PDF**, with a Flask backend behind all of it.

## Pages

| Page | File | What it does |
|---|---|---|
| Home | `index.html` | Landing page, live chat demo |
| Login / Register | `login.html` | Tabbed auth form, calls `/api/auth/*` |
| Dashboard | `dashboard.html` | Stats, Ask AI, planner, progress roadmap, links to upload |
| Upload PDF | `upload.html` | Drag-and-drop PDF → explanation, summary, quiz, flashcards, plan |

## Files

```
study-companion/
├── index.html
├── login.html
├── dashboard.html
├── upload.html
├── style.css            # shared design system for every page
├── script.js             # home page (chat demo, scroll)
├── auth.js                # login/register page logic
├── dashboard.js            # dashboard page logic
├── upload.js                # upload page logic
├── app.py                    # Flask backend + all API routes
├── requirements.txt
└── README.md
```

## Run it locally

```bash
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5000**. On first run, `app.py` creates a local
SQLite database (`marginalia.db`) for user accounts and uploaded
materials, and an `uploads/` folder for the PDFs themselves.

Everything works with zero setup: register a demo account, upload any
PDF, and you'll get placeholder explanation/summary/quiz/flashcards/plan
content generated from the file. To get **real** AI-generated content
instead of placeholders, set an API key before starting the server:

```bash
export ANTHROPIC_API_KEY=your_key_here     # macOS/Linux
setx ANTHROPIC_API_KEY "your_key_here"     # Windows (new terminal after)
python app.py
```

## How the front end talks to the backend

Each page's JS calls a backend route first, and falls back to local
placeholder content if the backend isn't reachable — so you can open
any page directly and see it work before `app.py` is even running:

| Route | Called from | Purpose |
|---|---|---|
| `POST /api/auth/register` | `auth.js` | Create an account |
| `POST /api/auth/login` | `auth.js` | Log in |
| `POST /api/materials/upload` | `upload.js` | Save a PDF, extract its text |
| `POST /api/materials/generate` | `upload.js` | Turn that text into study material |
| `POST /api/chat` | `script.js`, `dashboard.js` | Ask-AI tutor replies |

Login state is currently kept in the browser's `localStorage`
(`marginalia_user`) rather than a real server session/cookie — good
enough to demo the flow, but swap in Flask sessions or a signed token
before this handles real accounts.

## Getting this into VS Code

1. Download the files below into a folder, e.g. `study-companion/`.
2. Open that folder in VS Code: `File → Open Folder…`.
3. Open the built-in terminal (`` Ctrl+` ``) and run the commands above.

To push it to a git repo from that same terminal:

```bash
cd study-companion
git init
git add .
git commit -m "Home, login, dashboard, upload — stage 1-4 scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on GitHub first, then paste its URL into the
`git remote add` line.)

## Where to go next

- **Real sessions** — replace the `localStorage` login flag with a
  Flask session cookie or JWT, and protect `/api/materials/*` and
  `/api/chat` so they're tied to the logged-in user.
- **Per-user data** — right now materials, stats, and the planner
  aren't scoped to a user; add a `user_id` foreign key once accounts
  are wired to sessions.
- **More file types** — `app.py`'s `extract_pdf_text()` is the only
  place that knows about PDFs; add a similar function for `.docx` or
  `.pptx` uploads if you want to accept those too.
- **Swap models** — `generate_with_model()` and the chat route both
  call Anthropic's API as an example; point them at any other model
  provider the same way.
