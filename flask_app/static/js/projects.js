/* ============================================================
   GENRI LABS — PROJECTS EDITOR

   Lists projects from /api/projects and edits them through one
   form. Every save/delete re-publishes public_html/data/projects.json
   on the server, so changes show on the landing page right away.
   ============================================================ */

(function () {
  "use strict";

  const API = window.API_PROJECTS_URL;
  const list = document.getElementById("project-list");
  const form = document.getElementById("project-form");
  const formTitle = document.getElementById("form-title");
  const f = form.elements;
  const statusEl = document.getElementById("status");
  let projects = [];
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

  function render() {
    list.replaceChildren();
    if (!projects.length) {
      list.appendChild(el("li", "project-list__empty", "No projects yet. Add one to fill the Work section."));
      return;
    }
    projects.forEach((p) => {
      const li = el("li", "project-row" + (p.is_visible ? "" : " project-row--hidden"));

      const main = el("div", "project-row__main");
      const title = el("p", "project-row__title", p.title);
      title.appendChild(el("span", "tag tag--" + p.kind, p.kind === "lab" ? "Lab" : "Client"));
      if (!p.is_visible) title.appendChild(el("span", "tag", "Hidden"));
      main.appendChild(title);
      main.appendChild(el("p", "project-row__meta", "#" + p.sort_order + " · " + p.domain));
      if (p.description) main.appendChild(el("p", "project-row__desc", p.description));

      const actions = el("div", "project-row__actions");
      const edit = el("button", "btn-ghost", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => openForm(p));
      const del = el("button", "btn-ghost btn-ghost--danger", "Delete");
      del.type = "button";
      del.addEventListener("click", () => remove(p));
      actions.append(edit, del);

      li.append(main, actions);
      list.appendChild(li);
    });
  }

  function openForm(p) {
    editingId = p ? p.id : null;
    formTitle.textContent = p ? "Edit " + p.title : "Add project";
    form.reset();
    const next = projects.reduce((m, x) => Math.max(m, x.sort_order), 0) + 10;
    f.title.value = p ? p.title : "";
    f.url.value = p ? p.url : "";
    f.domain.value = p ? p.domain : "";
    f.kind.value = p ? p.kind : "client";
    f.description.value = p ? p.description : "";
    f.sort_order.value = p ? p.sort_order : next;
    f.is_visible.checked = p ? !!p.is_visible : true;
    form.hidden = false;
    f.title.focus();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    form.hidden = true;
    editingId = null;
  }

  function applyResult(data, message) {
    projects = data.projects;
    render();
    setStatus(message + " " + data.published + " project(s) live on the site.");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: f.title.value,
      url: f.url.value,
      domain: f.domain.value,
      kind: f.kind.value,
      description: f.description.value,
      sort_order: f.sort_order.value,
      is_visible: f.is_visible.checked,
    };
    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true;
    try {
      const data = editingId === null
        ? await api(API, { method: "POST", body: JSON.stringify(payload) })
        : await api(API + "/" + editingId, { method: "PUT", body: JSON.stringify(payload) });
      closeForm();
      applyResult(data, "Saved.");
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  async function remove(p) {
    if (!window.confirm("Delete “" + p.title + "”? It will disappear from the public site.")) return;
    try {
      applyResult(await api(API + "/" + p.id, { method: "DELETE" }), "Deleted.");
      if (editingId === p.id) closeForm();
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  document.getElementById("add-btn").addEventListener("click", () => openForm(null));
  document.getElementById("cancel-btn").addEventListener("click", closeForm);

  api(API)
    .then((data) => { projects = data.projects; render(); })
    .catch((err) => setStatus("Couldn't load projects: " + err.message, true));
})();
