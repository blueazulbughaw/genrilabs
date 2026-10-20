/* ============================================================
   GENRI LABS — OPT WORK LOG

   Lists work sessions from /api/worklog, edits them through one
   form, and shows weekly approved hours against the 20-hr minimum.
   Drafts (posted by Claude, no hours) only count once Glad sets
   the hours and saves — saving from here always approves.
   ============================================================ */

(function () {
  "use strict";

  const API = window.API_WORKLOG_URL;
  const MIN = window.WEEKLY_MINIMUM;
  const list = document.getElementById("log-list");
  const weekBody = document.getElementById("week-body");
  const form = document.getElementById("log-form");
  const formTitle = document.getElementById("form-title");
  const f = form.elements;
  const statusEl = document.getElementById("status");
  let sessions = [];
  let editingId = null;

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("status--error", !!isError);
  }

  /* fetch wrapper: 401 → session died → public site */
  async function api(url, options) {
    const res = await fetch(url, Object.assign({ headers: { "Content-Type": "application/json" } }, options));
    if (res.status === 401) {
      window.GLSession.goHome(url + " returned 401 Unauthorized");
      throw new Error("unauthorized");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
    return data;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function localToday() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function hrs(n) { return (Math.round(n * 100) / 100).toString(); }

  function renderCards(weeks) {
    const current = weeks[0] || { hours: 0 };
    document.getElementById("week-hours").textContent = hrs(current.hours);
    document.getElementById("week-left").textContent = hrs(Math.max(0, MIN - current.hours));
    document.getElementById("draft-count").textContent = sessions.filter((s) => s.status === "draft").length;
  }

  function renderList() {
    list.replaceChildren();
    if (!sessions.length) {
      list.appendChild(el("li", "project-list__empty", "Nothing logged yet. Click Log work after each work block."));
      return;
    }
    sessions.forEach((s) => {
      const li = el("li", "project-row" + (s.status === "draft" ? " project-row--draft" : ""));

      const main = el("div", "project-row__main");
      const title = el("p", "project-row__title", fmtDate(s.work_date) + " · " + (s.hours === null ? "? hrs" : hrs(s.hours) + " hrs"));
      title.appendChild(el("span", "tag tag--lab", s.category));
      if (s.status === "draft") title.appendChild(el("span", "tag tag--client", "Draft from Claude · set hours"));
      main.appendChild(title);
      main.appendChild(el("p", "project-row__desc", s.activity));
      const meta = [s.project, s.evidence && "Evidence: " + s.evidence, s.notes].filter(Boolean).join(" · ");
      if (meta) main.appendChild(el("p", "project-row__meta", meta));

      const actions = el("div", "project-row__actions");
      const edit = el("button", s.status === "draft" ? "btn-accent" : "btn-ghost", s.status === "draft" ? "Review" : "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => openForm(s));
      const del = el("button", "btn-ghost btn-ghost--danger", "Delete");
      del.type = "button";
      del.addEventListener("click", () => remove(s));
      actions.append(edit, del);

      li.append(main, actions);
      list.appendChild(li);
    });
  }

  function renderWeeks(weeks) {
    weekBody.replaceChildren();
    weeks.forEach((w) => {
      const tr = el("tr");
      tr.appendChild(el("td", "", fmtDate(w.week_start)));
      tr.appendChild(el("td", "", hrs(w.hours)));
      const check = w.hours === 0 ? "" : (w.meets_minimum ? "Meets " + MIN : "Under " + MIN + " — add a note");
      tr.appendChild(el("td", w.hours === 0 ? "" : (w.meets_minimum ? "week-ok" : "week-short"), check));
      tr.appendChild(el("td", "", w.drafts ? String(w.drafts) : ""));
      weekBody.appendChild(tr);
    });
  }

  function apply(data, message) {
    sessions = data.sessions;
    renderList();
    renderWeeks(data.weeks);
    renderCards(data.weeks);
    if (message) setStatus(message);
  }

  function openForm(s) {
    editingId = s ? s.id : null;
    formTitle.textContent = s ? (s.status === "draft" ? "Review draft" : "Edit entry") : "Log work";
    form.reset();
    f.work_date.value = s ? s.work_date : localToday();
    f.hours.value = s && s.hours !== null ? s.hours : "";
    f.category.value = s ? s.category : f.category.options[0].value;
    f.project.value = s ? s.project : "";
    f.activity.value = s ? s.activity : "";
    f.evidence.value = s ? s.evidence : "";
    f.notes.value = s ? s.notes : "";
    form.hidden = false;
    (s && s.hours === null ? f.hours : f.work_date).focus();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    form.hidden = true;
    editingId = null;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      work_date: f.work_date.value,
      hours: f.hours.value,
      category: f.category.value,
      project: f.project.value,
      activity: f.activity.value,
      evidence: f.evidence.value,
      notes: f.notes.value,
    };
    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true;
    try {
      const data = editingId === null
        ? await api(API, { method: "POST", body: JSON.stringify(payload) })
        : await api(API + "/" + editingId, { method: "PUT", body: JSON.stringify(payload) });
      closeForm();
      apply(data, "Saved.");
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  async function remove(s) {
    if (!window.confirm("Delete the " + fmtDate(s.work_date) + " entry? This can't be undone.")) return;
    try {
      apply(await api(API + "/" + s.id, { method: "DELETE" }), "Deleted.");
      if (editingId === s.id) closeForm();
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  document.getElementById("add-btn").addEventListener("click", () => openForm(null));
  document.getElementById("cancel-btn").addEventListener("click", closeForm);

  api(API)
    .then((data) => apply(data))
    .catch((err) => setStatus("Couldn't load the work log: " + err.message, true));
})();
