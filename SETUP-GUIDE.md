# Genri Labs — complete setup guide
### From zip file → VS Code + Claude Code → GitHub → live on Namecheap

Follow the parts in order the first time. After that, your daily loop is
just **Part 6** (the routine workflow).

---

# Part 1 — Install the tools (one time)

You need four things on your computer:

| Tool | Get it from | Check it works |
|---|---|---|
| Git | https://git-scm.com (Windows: install with defaults) | `git --version` |
| VS Code | https://code.visualstudio.com | opens |
| Python 3.10+ | https://python.org (Windows: check "Add to PATH" during install) | `python --version` |
| Claude Code | see below | `claude --version` |

### Installing Claude Code

The native installer is the recommended method (no Node.js needed):

**macOS / Linux** (Terminal):
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows** (PowerShell — the prompt must show `PS C:\`, not plain `C:\`):
```powershell
irm https://claude.ai/install.ps1 | iex
```

Then verify and sign in:
```bash
claude --version     # a version number = success
claude               # first launch opens your browser to authenticate
```

Sign in with your Claude account (Claude Code requires a paid plan — Pro or
above — or an Anthropic Console API account; the free plan doesn't include it).
If anything misbehaves, `claude doctor` diagnoses install and auth issues.

Full official docs: https://code.claude.com/docs/en/setup

---

# Part 2 — Project into VS Code

1. Unzip `genri-labs-site.zip` somewhere permanent, e.g. `Documents/projects/genri-labs-site`.
2. VS Code → **File → Open Folder** → select `genri-labs-site`.
3. Open the built-in terminal: **Terminal → New Terminal** (or `` Ctrl+` ``).
4. Set up the Python environment for the Flask app:

```bash
cd flask_app
python -m venv .venv

# activate it:
source .venv/bin/activate        # macOS/Linux
.venv\Scripts\activate           # Windows

pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
```

5. Open `.env` in VS Code and fill in values. Generate the JWT secret:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
(For local dev without MySQL installed, you can preview only the landing
page for now — just open `public_html/index.html` in a browser. The Flask
app needs a database to run; you can test it fully on the server in Part 5.)

**Recommended VS Code extensions** (Extensions panel, `Ctrl+Shift+X`):
- *Python* (Microsoft)
- *Claude Code* (Anthropic) — puts Claude Code in a side panel instead of the terminal

---

# Part 3 — Git and GitHub

### 3a. First-time Git identity (once per computer)
```bash
git config --global user.name "Gladwin Cedeño"
git config --global user.email "you@example.com"   # use your GitHub email
```

### 3b. Turn the folder into a repository
In the VS Code terminal, from the project root (`genri-labs-site/`):
```bash
git init
git add .
git status        # confirm .env is NOT listed — .gitignore excludes it
git commit -m "Initial commit: landing page, Flask admin, schema, deploy guide"
```
⚠️ If `.env` ever appears in `git status`, stop — it contains secrets and
must never be committed. The included `.gitignore` already excludes it.

### 3c. Create the GitHub repo and push
1. github.com → **New repository** → name it `genri-labs-site` →
   **Private** (it contains your infrastructure layout — keep it private) →
   create **without** README/.gitignore (you already have them).
2. Connect and push (GitHub shows these exact commands after creation):
```bash
git remote add origin https://github.com/YOUR-USERNAME/genri-labs-site.git
git branch -M main
git push -u origin main
```
GitHub will prompt you to sign in the first time (browser popup or a
personal access token).

From now on, saving work is:
```bash
git add .
git commit -m "describe what changed"
git push
```
You can also do all three from VS Code's **Source Control** panel (the
branch icon in the left sidebar): stage with `+`, type a message, commit, sync.

---

# Part 4 — Working with Claude Code

Claude Code is an AI agent that edits this repo directly. The project ships
with a `CLAUDE.md` file that teaches it the architecture — the palette rules,
the JWT flow, the chart extension system — so it makes changes the right way
without you re-explaining anything.

### Starting a session
```bash
cd genri-labs-site      # always start from the project root
claude
```

### Using it inside VS Code (recommended for you)
1. Extensions panel (`Ctrl+Shift+X`) → search **Claude Code** → install the
   one published by **Anthropic** (not lookalikes). The extension bundles
   the CLI, and it signs in with the same Claude account.
2. Open the project folder, then open any file — the **Spark icon (✱)**
   appears top-right of the editor. Click it to open the Claude panel.
   (No icon? Run "Developer: Reload Window" from `Ctrl+Shift+P`.)
3. Type requests in the panel. Reference files precisely with
   `@` — e.g. `@flask_app/app.py` — or select lines in the editor and press
   `Alt+K` (Windows) / `Option+K` (Mac) to insert them into the prompt.
4. Claude proposes edits as **side-by-side diffs** with Accept / Reject
   buttons — you approve every change before it touches disk.
5. For bigger changes, switch the mode selector (bottom of the prompt box)
   to **Plan mode**: Claude writes out its full plan as a document you can
   annotate before it edits anything. Use this for anything touching
   `auth.py` or the deployment files.

### How to work
Describe outcomes; let it find the files. It will show you diffs and ask
before running commands. Some prompts tailored to this project:

```text
Add a fourth stat to the landing page stats bar that says "Human-led" /
"AI assists, people decide". Keep the responsive layout working.
```
```text
Add a new dashboard chart showing weekly outreach replies. Walk me through
the SQL insert I need, then wire up the canvas and CHARTS entry.
```
```text
The hero card animation feels too subtle on mobile. Make the rotation
stronger below 640px but keep prefers-reduced-motion respected.
```
```text
Review flask_app/app.py for security issues before I deploy.
```

### Useful commands inside a session
| Command | What it does |
|---|---|
| `/init` | (Re)generate CLAUDE.md by analyzing the codebase — run if the project grows a lot |
| `/help` | List available commands |
| `Esc` | Interrupt Claude mid-task |
| `claude doctor` (from shell) | Diagnose install/auth problems |

### The Claude Code + Git rhythm
Claude Code edits files; **Git is your undo button**. Commit before asking
for anything big, so you can always walk back:
```bash
git add . && git commit -m "checkpoint before dashboard refactor"
# ...let Claude Code work...
git diff            # review what changed
# happy? commit. unhappy? →
git checkout -- .   # discard all uncommitted changes
```

---

# Part 5 — Deploy to Namecheap (cPanel)

Two parts go to two places on the server:

| Repo folder | Server destination | Why |
|---|---|---|
| `public_html/` | `~/public_html/` | Served as your static site |
| `flask_app/` | `~/genri_admin/` | Outside the web root — code and secrets never web-served |

### 5a. Database
1. cPanel → **MySQL Databases** → create a database (e.g. `cpuser_genrilabs`).
2. Create a DB user with a strong password → **Add User to Database** → All Privileges.
3. cPanel → **phpMyAdmin** → select the database → **Import** → upload
   `database/schema.sql`. Tables + sample chart data are created.

### 5b. Python app
1. cPanel → **Setup Python App** → Create Application:
   - Python version: newest 3.x offered
   - Application root: `genri_admin`
   - Application URL: your hidden admin path, e.g. `gl-admin`
     → login will live at `https://yourdomain.com/gl-admin/` (linked nowhere; memorize it)
   - Startup file: `passenger_wsgi.py`
2. On the app's page, add **Environment Variables** with the same names as
   `.env.example`: `JWT_SECRET`, `PUBLIC_SITE_URL`, `DB_HOST` = `localhost`,
   `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

### 5c. Get the code onto the server

**Set up SSH access once:** cPanel → **SSH Access** → Manage SSH Keys →
generate or import a key → Authorize it. Then from your computer:
```bash
ssh cpaneluser@yourdomain.com -p 21098    # Namecheap shared hosting uses port 21098
```

**Clone via cPanel Git:** cPanel → **Git™ Version Control** → Create →
paste your GitHub repo's HTTPS URL. For a private repo, create a GitHub
**fine-grained personal access token** (GitHub → Settings → Developer
settings) with read access to this repo, and use the URL format:
`https://YOUR-TOKEN@github.com/YOUR-USERNAME/genri-labs-site.git`
Repository path: e.g. `repos/genri-labs-site`.

**Copy into place** (SSH terminal):
```bash
cp -r ~/repos/genri-labs-site/public_html/* ~/public_html/
cp -r ~/repos/genri-labs-site/flask_app/*   ~/genri_admin/
mkdir -p ~/genri_admin/tmp                   # Passenger restart mechanism
```

### 5d. Install dependencies + create your login
The Setup Python App page shows your virtualenv activate command
(looks like `source /home/cpuser/virtualenv/genri_admin/3.11/bin/activate`).
In SSH:
```bash
source /home/cpuser/virtualenv/genri_admin/3.11/bin/activate   # yours will differ
cd ~/genri_admin
pip install -r requirements.txt
python create_admin.py        # prompts for username + password (typing hidden)
```

### 5e. Go live
1. Setup Python App → **Restart**.
2. cPanel → **SSL/TLS Status** → make sure AutoSSL is active (the auth
   cookies are HTTPS-only by design).
3. Verify:
   - `https://yourdomain.com/` → landing page, animations working
   - `https://yourdomain.com/gl-admin/` → login page
   - Sign in → dashboard with charts and the session countdown
   - Delete cookies (or wait 30 min) → refresh → bounced to the landing page ✓

### Troubleshooting
| Symptom | Fix |
|---|---|
| 503 "Web application could not be started" | An env var is missing (usually `JWT_SECRET`) — set it, Restart |
| Login always "Invalid credentials" | `create_admin.py` was run locally, not on the server — rerun via SSH |
| Charts empty | `schema.sql` not imported into the server DB |
| `OperationalError: (1045 ...)` | DB user not added to database, or wrong `DB_*` values |
| Dashboard unstyled | `flask_app/static/` didn't get copied — recopy, restart |
| SSH connection refused | Use port 21098: `ssh user@domain -p 21098` |

---

# Part 6 — The routine (your daily loop)

```bash
# 1. Work locally with Claude Code
cd genri-labs-site
claude                          # describe the change, review the diff

# 2. Checkpoint it
git add . && git commit -m "what changed" && git push

# 3. Ship it
ssh cpaneluser@yourdomain.com -p 21098
cd ~/repos/genri-labs-site && git pull
cp -r public_html/* ~/public_html/
cp -r flask_app/*   ~/genri_admin/
touch ~/genri_admin/tmp/restart.txt      # Passenger reloads the Flask app
exit
```

Landing-page-only changes don't need the restart line — static files are
live the moment they're copied.

That's the whole machine: **Claude Code edits → Git records → cPanel serves.**
And each cycle through this loop is a documentable business activity —
commit history is timestamped evidence of ongoing self-employment work.
