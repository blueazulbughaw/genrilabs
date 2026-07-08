# Deploying to Namecheap shared hosting (cPanel)

Two deployable parts, two destinations:

| Part | Lives at (server) | Served as |
|---|---|---|
| `public_html/` (landing page) | `~/public_html/` | Static files at `https://genrilabs.com` |
| `flask_app/` (admin app) | `~/genri_admin/` (outside web root) | Passenger Python app mounted at a hidden path |

Keeping the Flask app **outside** `public_html` means your Python source,
env vars, and DB credentials are never in a web-served directory.

---

## 0. One-time local setup

```bash
git clone <your-repo-url> genri-labs-site
cd genri-labs-site/flask_app
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # fill in values; use a local MySQL or adjust DB_* vars
python app.py           # local dev server at http://localhost:5000
```

---

## 1. Create the MySQL database (cPanel)

1. cPanel → **MySQL Databases** → create database (e.g. `cpuser_genrilabs`).
2. Create a DB user with a strong password; add the user to the database
   with **All Privileges**.
3. cPanel → **phpMyAdmin** → select the database → **Import** →
   upload `database/schema.sql`. Tables + sample metrics are created.

## 2. Create the Python app (cPanel)

1. cPanel → **Setup Python App** → *Create Application*:
   - **Python version:** newest available 3.x
   - **Application root:** `genri_admin`  ← the folder Passenger runs from
   - **Application URL:** pick your hidden path, e.g. `gl-admin`
     (the login page becomes `https://genrilabs.com/gl-admin/` — memorize it,
     it is linked nowhere)
   - **Application startup file:** `passenger_wsgi.py`
2. After creation, in the same screen add **Environment Variables**:
   `JWT_SECRET`, `PUBLIC_SITE_URL`, `DB_HOST` (`localhost`), `DB_NAME`,
   `DB_USER`, `DB_PASSWORD`. (Same names as `.env.example`.)

## 3. Upload the code

**Option A — Git (recommended).** cPanel → **Git Version Control** →
*Create* → clone your GitHub repo (use an HTTPS deploy token or an SSH
key added under cPanel → SSH Access). Then either:

- add a `.cpanel.yml` later for automated deploys, or
- SSH in and copy manually after each pull:

```bash
ssh cpaneluser@yourserver
cd ~/repos/genri-labs-site        # wherever cPanel cloned it
git pull
cp -r public_html/* ~/public_html/
cp -r flask_app/*   ~/genri_admin/
```

**Option B — no Git on the host.** Zip locally, upload via cPanel
File Manager, extract into the two destinations above.

## 4. Install Python dependencies

In **Setup Python App**, the app's page shows a command like
`source /home/cpuser/virtualenv/genri_admin/3.11/bin/activate`.
SSH in, run it, then:

```bash
cd ~/genri_admin
pip install -r requirements.txt
```

## 5. Create your admin login

Still inside the activated virtualenv:

```bash
cd ~/genri_admin
python create_admin.py     # prompts for username + password (hidden input)
```

## 6. Restart and verify

1. **Setup Python App** → *Restart* the application.
2. Visit `https://genrilabs.com/` → landing page with animations.
3. Visit `https://genrilabs.com/gl-admin/` → login page.
4. Sign in → dashboard with charts. Wait for expiry (or delete the
   cookies) → you're bounced back to the landing page. ✓

---

## Routine deploys after code changes

```bash
git push                                  # from VS Code
ssh cpaneluser@yourserver
cd ~/repos/genri-labs-site && git pull
cp -r public_html/* ~/public_html/
cp -r flask_app/*   ~/genri_admin/
touch ~/genri_admin/tmp/restart.txt       # tells Passenger to reload (create tmp/ once)
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 503 / "Web application could not be started" | Missing env var (`JWT_SECRET` etc.) — check Setup Python App → Environment Variables, then Restart |
| Login always says "Invalid credentials" | Admin user not created — rerun `create_admin.py` on the **server** (it writes to the server DB) |
| Charts empty | `schema.sql` not imported, or metrics table empty |
| `pymysql.err.OperationalError: (1045 ...)` | DB user not added to the database, or wrong `DB_*` env values |
| Styles broken on dashboard | `flask_app/static/` didn't get copied — recopy and restart |

## Security checklist (already wired in, just don't undo it)

- JWT in an `httpOnly` `Secure` cookie — enable **AutoSSL** in cPanel so HTTPS is always on
- bcrypt password hashing; plaintext never stored
- Login rate limiting: 5 failures / 15 min / IP
- Admin path appears in no nav, footer, sitemap, or `robots.txt`; login and dashboard send `noindex, nofollow`
- Rotate `JWT_SECRET` any time you want to force-invalidate all sessions
