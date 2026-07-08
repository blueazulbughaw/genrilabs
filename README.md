# Genri Labs — site + admin dashboard

Two-part site: a static public landing page with GSAP scroll animations,
and a hidden Flask admin dashboard protected by JWT auth. Built for
Namecheap shared cPanel hosting (Passenger + MySQL).

## Folder structure

```
genri-labs-site/
├── public_html/                  # STATIC LANDING PAGE → deploy to ~/public_html
│   ├── index.html                # page structure; data-anim attributes are GSAP hooks
│   ├── css/
│   │   ├── tokens.css            # ★ design tokens — the palette lives here
│   │   └── landing.css           # layout + components, mobile-first
│   ├── js/
│   │   └── landing.js            # GSAP/ScrollTrigger animation systems
│   └── assets/
│       └── logo.svg              # circuit-tree mark (aqua; darken to #2E8B8B on light bg)
│
├── flask_app/                    # ADMIN APP → deploy OUTSIDE web root (~/genri_admin)
│   ├── passenger_wsgi.py         # cPanel/Passenger entry point — don't rename
│   ├── app.py                    # routes: login page, login API, dashboard, metrics, logout
│   ├── auth.py                   # JWT issue/verify + @login_required (redirect on expiry)
│   ├── config.py                 # all settings from env vars — no secrets in code
│   ├── db.py                     # PyMySQL helpers (parameterized queries only)
│   ├── create_admin.py           # CLI: create/update the admin user (bcrypt)
│   ├── requirements.txt
│   ├── .env.example              # template for local dev env
│   ├── templates/
│   │   ├── login.html            # the hidden login page (noindex, linked nowhere)
│   │   └── dashboard.html        # metric cards + Chart.js slots + session countdown
│   └── static/
│       ├── css/tokens.css        # same tokens as the landing page
│       ├── css/dashboard.css
│       └── js/dashboard.js       # ★ CHARTS registry — add charts here
│
├── database/
│   └── schema.sql                # import via phpMyAdmin; includes sample metrics
├── DEPLOYMENT.md                 # step-by-step Namecheap cPanel guide
└── .gitignore
```

## The two ★ extension points

**Palette** — every color on both sites comes from
`public_html/css/tokens.css` (mirrored in `flask_app/static/css/`).
Change a hex there, the whole product restyles.

**Charts** — the dashboard is config-driven. To add a chart:
1. Insert rows with a new `metric_key` into the `metrics` table.
2. Add a `<canvas>` in `dashboard.html`.
3. Add one line to the `CHARTS` array in `dashboard.js`.
No backend changes needed — `/api/metrics` returns every series it finds.

## Auth flow in one paragraph

Login posts to `/api/login`; the server checks the bcrypt hash, then sets
a signed JWT in an `httpOnly Secure` cookie (30-min lifetime) plus a
readable `gl_token_exp` cookie holding only the expiry time. Every
protected route runs `@login_required`: valid token → proceed; missing or
expired → **redirect to the public landing page** (pages) or 401 (API,
which `dashboard.js` also turns into a redirect). The dashboard shows a
live countdown from `gl_token_exp` and leaves on its own at zero.

## Local development

See the top of `DEPLOYMENT.md`. Short version: venv, `pip install -r
requirements.txt`, copy `.env.example` → `.env`, `python app.py`.
