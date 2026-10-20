/* ============================================================
   GENRI LABS — ADMIN SESSION (shared by every admin page)

   Watches the JWT expiry: shows a countdown, warns at 2 min, and
   redirects to the public site the moment it expires. Also wires
   the Log out button. Exposes window.GLSession.goHome so page
   scripts can bail out on a 401.
   ============================================================ */

(function () {
  "use strict";

  /* The httpOnly cookie holds the token itself (unreadable to JS,
     by design). A second, readable cookie holds just the expiry
     epoch so we can count down without exposing the token. */
  function getExpiryEpoch() {
    const m = document.cookie.match(/(?:^|;\s*)gl_token_exp=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function goHome(reason) {
    if (reason) console.warn("[admin] redirecting to public site:", reason);
    window.location.href = window.PUBLIC_SITE_URL || "/";
  }

  function startSessionWatch() {
    const pill = document.getElementById("session-pill");
    const out = document.getElementById("session-countdown");
    const exp = getExpiryEpoch();
    if (!exp) return goHome("no gl_token_exp cookie found (document.cookie: " + document.cookie + ")");

    const tick = () => {
      const remaining = exp - Math.floor(Date.now() / 1000);
      if (remaining <= 0) return goHome("session countdown reached zero");   // THE requirement: expiry → landing page
      const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
      const ss = String(remaining % 60).padStart(2, "0");
      out.textContent = `${mm}:${ss}`;
      if (remaining <= 120) pill.classList.add("session-pill--warning");
    };
    tick();
    setInterval(tick, 1000);
  }

  document.getElementById("logout-btn").addEventListener("click", async () => {
    const res = await fetch(window.API_LOGOUT_URL, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    window.location.href = data.redirect || window.PUBLIC_SITE_URL;
  });

  window.GLSession = { goHome };
  startSessionWatch();
})();
