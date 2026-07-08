# CLAUDE.md — Genri Labs site

Project context for Claude Code. Loaded automatically each session.

## What this is
Two-part site for Genri Labs LLC:
1. `public_html/` — static landing page (HTML/CSS/JS + GSAP ScrollTrigger animations)
2. `flask_app/` — hidden admin dashboard (Flask + PyJWT + bcrypt + PyMySQL, Chart.js frontend)

Deployed to Namecheap shared cPanel hosting: static files → `~/public_html`,
Flask app → `~/genri_admin` via Passenger (`passenger_wsgi.py` is the entry point — never rename it).

## Architecture rules — do not break these
- ALL colors come from `css/tokens.css` (duplicated at `flask_app/static/css/tokens.css` —
  if you change one, change both). Never hardcode hex values in components.
- Palette semantics: aqua `#5EC4C4` = primary (CTAs, links, stats, primary chart series);
  blue `#6FA8CE` = analytical/informational only. Two accents max; grey does everything else.
- Text on aqua backgrounds is `--color-on-accent` (near-black `#0B1014`), NEVER white.
- JWT lives in an httpOnly Secure cookie; only the expiry epoch is in a readable cookie
  (`gl_token_exp`). Never move the token to localStorage or a readable cookie.
- Expired/invalid JWT on a page route → redirect to `PUBLIC_SITE_URL`; on an `/api/` route → 401.
  This behavior lives in `auth.py:login_required` — preserve it in any refactor.
- All SQL goes through parameterized queries in `db.py`. Never string-format SQL.
- Secrets come from environment variables only (`config.py`). Never commit `.env`.
- The admin path must never be linked from `public_html/` — no nav links, no footer links,
  no sitemap entries, no robots.txt mentions.

## Extension points (use these instead of restructuring)
- New animated element on landing: add `data-anim="float"` (scroll entrance) or
  `data-anim="rise"` (load entrance) — `js/landing.js` picks them up automatically.
- New dashboard chart: (1) insert rows with a new `metric_key` into the `metrics` table,
  (2) add a `<canvas>` in `templates/dashboard.html`, (3) add one entry to the `CHARTS`
  array in `static/js/dashboard.js`. The `/api/metrics` endpoint needs no changes.

## Commands
- Local Flask dev: `cd flask_app && source .venv/bin/activate && python app.py` (port 5000)
- Create/update admin user: `python create_admin.py` (run on the server for production)
- Landing page preview: open `public_html/index.html` directly in a browser
- Deploy: push to GitHub, then pull + copy on the server (see SETUP-GUIDE.md part 5)

## Style
- Fonts: Space Grotesk (display) + Inter (body), loaded from Google Fonts
- Mobile-first CSS; breakpoints at 640px and 960px
- Respect `prefers-reduced-motion` in any new animation (CSS guard + JS early-return exist)
