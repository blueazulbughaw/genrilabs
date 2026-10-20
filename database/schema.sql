-- ============================================================
-- GENRI LABS — DATABASE SCHEMA
-- Import via cPanel > phpMyAdmin > (your database) > Import.
-- Plain MySQL/InnoDB — no extensions, works on any shared host.
-- ============================================================

-- ------------------------------------------------------------
-- Admin users. Passwords are bcrypt hashes created by
-- flask_app/create_admin.py — never insert plaintext here.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Metrics: the extensible heart of the dashboard.
-- Each row is one data point in one named series (metric_key).
-- Adding a new chart = inserting rows with a new metric_key.
-- No schema changes, no backend changes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    metric_key  VARCHAR(64)   NOT NULL,   -- series name, e.g. 'hours_logged'
    label       VARCHAR(64)   NOT NULL,   -- x-axis label, e.g. 'Week 27'
    value       DECIMAL(12,2) NOT NULL,
    recorded_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_key (metric_key),
    INDEX idx_recorded  (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Login attempts: powers the rate limiter (5 fails / 15 min / IP).
-- Safe to prune old rows periodically.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip_address   VARCHAR(45) NOT NULL,      -- fits IPv6
    succeeded    TINYINT(1)  NOT NULL DEFAULT 0,
    attempted_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Projects: the landing page's "Real products, shipped" cards.
-- Edited at /projects in the admin; every save publishes
-- public_html/data/projects.json. flask_app/projects.py also
-- creates + seeds this table on first use, so importing it here
-- is optional.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(120)  NOT NULL,
    url         VARCHAR(255)  NOT NULL,
    domain      VARCHAR(120)  NOT NULL DEFAULT '',
    description VARCHAR(600)  NOT NULL DEFAULT '',
    kind        VARCHAR(16)   NOT NULL DEFAULT 'client',  -- 'client' | 'lab'
    sort_order  INT           NOT NULL DEFAULT 0,
    is_visible  TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Work sessions: the OPT work log at /worklog in the admin.
-- One row per work block. Claude posts DRAFTS (hours NULL) to
-- /api/worklog/ingest; only approved rows count toward the
-- weekly 20-hour total. flask_app/worklog.py also creates this
-- table on first use, so importing it here is optional.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_sessions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_date   DATE          NOT NULL,
    hours       DECIMAL(5,2)  NULL,
    category    VARCHAR(64)   NOT NULL,
    activity    TEXT          NOT NULL,
    project     VARCHAR(120)  NOT NULL DEFAULT '',
    evidence    VARCHAR(500)  NOT NULL DEFAULT '',
    degree_link VARCHAR(500)  NOT NULL DEFAULT '',          -- optional: how the work applies the MBA-MIS
    notes       VARCHAR(500)  NOT NULL DEFAULT '',
    status      VARCHAR(16)   NOT NULL DEFAULT 'approved',  -- 'draft' | 'approved'
    source      VARCHAR(16)   NOT NULL DEFAULT 'manual',    -- 'manual' | 'claude'
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_work_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Existing installs: worklog.py adds degree_link automatically, or run
-- ALTER TABLE work_sessions ADD COLUMN degree_link VARCHAR(500) NOT NULL DEFAULT '' AFTER evidence;

-- ------------------------------------------------------------
-- Sample seed data so the dashboard charts render immediately.
-- Replace with real numbers whenever — the charts just follow.
-- ------------------------------------------------------------
INSERT INTO metrics (metric_key, label, value) VALUES
  ('hours_logged', 'Week 24', 18.5),
  ('hours_logged', 'Week 25', 22.0),
  ('hours_logged', 'Week 26', 19.5),
  ('hours_logged', 'Week 27', 26.0),
  ('outreach_sent', 'Week 24', 8),
  ('outreach_sent', 'Week 25', 12),
  ('outreach_sent', 'Week 26', 9),
  ('outreach_sent', 'Week 27', 14),
  ('activity_by_category', 'Development', 34),
  ('activity_by_category', 'Outreach', 21),
  ('activity_by_category', 'Content', 15),
  ('activity_by_category', 'Admin', 12);
