/* ============================================================
   GENRI LABS — DASHBOARD LOGIC

   Two jobs:
     1. Fetch /api/metrics and render charts (config-driven —
        add charts by editing the CHARTS array, nothing else).
     2. Fill metric cards from series totals.
   The session countdown + logout live in session.js (shared).
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
    const res = await fetch(window.API_METRICS_URL);
    if (res.status === 401) return window.GLSession.goHome("api/metrics returned 401 Unauthorized");
    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable body>");
      throw new Error(`api/metrics returned ${res.status}: ${body.slice(0, 300)}`);
    }
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

  /* -------- Boot --------
     Only an actual 401 (handled inside loadMetrics) means the session
     died — any other failure (e.g. a chart library that failed to load)
     is a rendering bug, not an auth problem, and must not kick an
     otherwise-valid session out to the public site. */
  loadMetrics().catch((err) => console.error("[dashboard] failed to load metrics/charts:", err));
})();
