/* ============================================================
   GENRI LABS — DASHBOARD LOGIC

   Three jobs:
     1. Fetch /api/metrics and render charts (config-driven —
        add charts by editing the CHARTS array, nothing else).
     2. Fill metric cards from series totals.
     3. Watch the JWT expiry: show a countdown, warn at 2 min,
        redirect to the public site the moment it expires.
   ============================================================ */

(function () {
  "use strict";

  /* -------- Brand palette for charts (mirrors tokens.css) -------- */
  const AQUA = "#5EC4C4";       // primary series
  const AQUA_DIM = "rgba(94, 196, 196, 0.15)";
  const BLUE = "#6FA8CE";       // secondary / comparison series
  const GRID = "#1F2A34";
  const MUTED = "#8B98A3";

  /* ================================================================
     CHART REGISTRY — the extension point.
     To add a chart: add a <canvas> in dashboard.html, insert rows
     with a new metric_key into the metrics table, then add an
     entry here. Types: any Chart.js type ('line', 'bar', 'doughnut'…)
     ================================================================ */
  const CHARTS = [
    { canvasId: "chart-hours",    metricKey: "hours_logged",         type: "line", color: AQUA },
    { canvasId: "chart-activity", metricKey: "activity_by_category", type: "bar",  color: BLUE },
  ];

  /* Shared Chart.js styling so every chart is automatically on-brand */
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: GRID }, ticks: { color: MUTED } },
      y: { grid: { color: GRID }, ticks: { color: MUTED }, beginAtZero: true },
    },
  };

  function buildChart({ canvasId, type, color }, points) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    new Chart(el, {
      type,
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            data: points.map((p) => p.value),
            borderColor: color,
            backgroundColor: type === "line" ? AQUA_DIM : color,
            borderWidth: 2,
            tension: 0.35,          // gentle curve on line charts
            fill: type === "line",
            borderRadius: type === "bar" ? 4 : 0,
            pointBackgroundColor: color,
          },
        ],
      },
      options: baseOptions,
    });
  }

  /* -------- Load metrics; a 401 means the JWT died → leave -------- */
  async function loadMetrics() {
    const res = await fetch("api/metrics");
    if (res.status === 401) return goHome();
    const { series, totals } = await res.json();

    // Metric cards: any element with data-total="<metric_key>"
    document.querySelectorAll("[data-total]").forEach((el) => {
      const key = el.dataset.total;
      if (totals[key] !== undefined) {
        el.textContent = Number.isInteger(totals[key])
          ? totals[key].toLocaleString()
          : totals[key].toFixed(1);
      }
    });

    // Charts from the registry
    CHARTS.forEach((cfg) => {
      const points = series[cfg.metricKey];
      if (points) buildChart(cfg, points);
    });
  }

  /* -------- JWT session countdown + auto-redirect --------
     The httpOnly cookie holds the token itself (unreadable to JS,
     by design). A second, readable cookie holds just the expiry
     epoch so we can count down without exposing the token. */
  function getExpiryEpoch() {
    const m = document.cookie.match(/(?:^|;\s*)gl_token_exp=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function goHome() {
    window.location.href = window.PUBLIC_SITE_URL || "/";
  }

  function startSessionWatch() {
    const pill = document.getElementById("session-pill");
    const out = document.getElementById("session-countdown");
    const exp = getExpiryEpoch();
    if (!exp) return goHome(); // no expiry cookie = no session

    const tick = () => {
      const remaining = exp - Math.floor(Date.now() / 1000);
      if (remaining <= 0) return goHome();   // THE requirement: expiry → landing page
      const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
      const ss = String(remaining % 60).padStart(2, "0");
      out.textContent = `${mm}:${ss}`;
      if (remaining <= 120) pill.classList.add("session-pill--warning");
    };
    tick();
    setInterval(tick, 1000);
  }

  /* -------- Logout -------- */
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const res = await fetch("api/logout", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    window.location.href = data.redirect || window.PUBLIC_SITE_URL;
  });

  /* -------- Boot -------- */
  startSessionWatch();
  loadMetrics().catch(goHome);
})();
