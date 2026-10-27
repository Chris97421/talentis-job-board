(() => {
  const labels = { open: "Ouverte", closed: "Fermée", sent: "Envoyée", seen: "Vue", interview: "Entretien", rejected: "Refusée", accepted: "Acceptée", unread: "Non lu", read: "Lu" };
  const classes = { open: "s-active", closed: "s-fermee", sent: "s-attente", unread: "s-attente", seen: "s-vue", read: "s-vue", interview: "s-vue", accepted: "s-accepte", rejected: "s-refuse" };
  const common = {
    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    },
    name(user) { return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Utilisateur"; },
    date(value) { return value ? new Date(value).toLocaleDateString("fr-FR") : "Date inconnue"; },
    statusLabel(value) { return labels[value] || value || "Inconnu"; },
    statusClass(value) { return classes[value] || "s-fermee"; },
    async list(path) {
      const first = await api(`${path}?page_size=100`);
      if (Array.isArray(first)) return first;
      const results = [...(first?.results || [])];
      let next = first?.next;
      while (next) {
        const url = new URL(next, location.href);
        const pagePath = `${url.pathname.replace(/^\/api/, "")}${url.search}`;
        const page = await api(pagePath);
        results.push(...(page?.results || []));
        next = page?.next;
      }
      return results;
    },
    report(message, isError = false) {
      const main = document.querySelector(".admin-content");
      let box = document.getElementById("admin-feedback");
      if (!box && main) {
        box = document.createElement("p");
        box.id = "admin-feedback";
        box.className = "notice";
        box.setAttribute("role", "status");
        box.setAttribute("aria-live", "polite");
        main.prepend(box);
      }
      if (!box) return;
      box.textContent = message;
      box.hidden = !message;
      box.classList.toggle("error", isError);
    },
    empty(list, message) {
      const markup = `<p class="empty">${common.escape(message)}</p>`;
      list.innerHTML = markup;
      return markup;
    },
    companyName(companies, id) { return companies.find(company => String(company.id) === String(id))?.name || "Entreprise"; },
    async requireAdmin() {
      if (!localStorage.getItem("token")) { location.replace("login.html"); return null; }
      let user;
      try { user = await api("/auth/me", { redirectOn401: false }); }
      catch { localStorage.removeItem("token"); location.replace("login.html"); return null; }
      if (user?.role !== "admin") { localStorage.removeItem("token"); location.replace("login.html"); return null; }
      common.updateMenu(user);
      common.bindLogout();
      return user;
    },
    updateMenu(user) {
      const name = common.name(user);
      const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "AD";
      document.querySelectorAll(".menu-name").forEach(node => { node.textContent = name; });
      document.querySelectorAll(".menu .avatar").forEach(node => { node.textContent = initials; });
      document.querySelectorAll(".menu-profile").forEach(node => {
        const strong = node.querySelector("strong"), small = node.querySelector("small");
        if (strong) strong.textContent = name;
        if (small) small.textContent = user.email || "";
      });
    },
    bindLogout() {
      document.querySelectorAll('.menu-panel a[href="login.html"]').forEach(link => link.addEventListener("click", async event => {
        event.preventDefault();
        try { await api("/auth/logout", { method: "POST", redirectOn401: false }); } catch {}
        localStorage.removeItem("token");
        location.href = "login.html";
      }));
    },
    formDialog(title, fields, selects = []) {
      const dialog = document.createElement("dialog");
      dialog.className = "modal";
      const inputs = fields.map(([name, label, value, type, required = true]) => `<div class="field"><label for="admin-${name}">${common.escape(label)}</label>${type === "textarea" ? `<textarea id="admin-${name}" name="${name}" ${required ? "required" : ""}>${common.escape(value)}</textarea>` : `<input id="admin-${name}" name="${name}" type="${type}" value="${common.escape(value)}" ${type === "number" ? 'min="0"' : ""} ${required ? "required" : ""}>`}</div>`).join("");
      const options = selects.map(([name, label, value, choices]) => `<div class="field"><label for="admin-${name}">${common.escape(label)}</label><select id="admin-${name}" name="${name}">${choices.map(([key, text]) => `<option value="${common.escape(key)}" ${key === value ? "selected" : ""}>${common.escape(text)}</option>`).join("")}</select></div>`).join("");
      dialog.innerHTML = `<form class="modal-body"><div class="modal-head"><h2>${common.escape(title)}</h2><button class="modal-close" type="button" aria-label="Fermer">×</button></div>${inputs}${options}<div class="modal-actions"><button class="btn btn-ghost" type="button" data-cancel>Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form>`;
      document.body.append(dialog);
      dialog.showModal();
      const close = () => { dialog.close(); dialog.remove(); };
      dialog.querySelector(".modal-close").addEventListener("click", close);
      dialog.querySelector("[data-cancel]").addEventListener("click", close);
      dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
      return dialog;
    },
  };
  window.AdminCommon = common;
})();