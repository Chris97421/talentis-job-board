// admin.js - page "Gestion des utilisateurs"

const ROLE_LABELS = { candidate: "Candidat", recruiter: "Recruteur", admin: "Admin" };
const ROLE_BADGES = { candidate: "s-vue", recruiter: "s-active", admin: "s-attente" };

let currentUser = null;   // l'admin connecté
let currentPage = 1;      // la page affichée
let usersById = {};       // les utilisateurs affichés, rangés par numéro
let searchText = "";      // ce qui est tapé dans "Rechercher"
let roleFilter = "all";   // le rôle choisi dans le menu

// Empêche qu'un texte venant de la base soit lu comme du HTML (sécurité)
function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Construit le HTML d'une ligne d'utilisateur
function userRow(u) {
  const name = `${u.first_name} ${u.last_name}`.trim() || u.email;
  const city = u.city ? ` · ${u.city}` : "";
  return `
    <article class="app" data-user-id="${u.id}" data-user-role="${esc(u.role)}">
      <div>
        <h3>${esc(name)}</h3>
        <p class="muted">${esc(u.email)}${esc(city)}</p>
      </div>
      <div class="admin-actions">
        <span class="badge ${ROLE_BADGES[u.role] || ""}">${esc(ROLE_LABELS[u.role] || u.role)}</span>
        <button class="btn btn-ghost btn-sm" data-act="edit">Modifier</button>
        <button class="btn btn-danger btn-sm" data-act="delete">Supprimer</button>
      </div>
    </article>`;
}

// Barre de pagination : Précédent / Suivant
function renderPager(data, page) {
  let pager = document.getElementById("users-pager");
  if (!pager) {
    pager = document.createElement("div");
    pager.id = "users-pager";
    pager.className = "admin-actions";
    document.getElementById("users-list").after(pager);
  }
  pager.innerHTML = `
    <button class="btn btn-ghost btn-sm" data-page="${page - 1}" ${data.previous ? "" : "disabled"}>Précédent</button>
    <span class="muted">Page ${page} · ${data.count} utilisateurs</span>
    <button class="btn btn-ghost btn-sm" data-page="${page + 1}" ${data.next ? "" : "disabled"}>Suivant</button>`;
}

// Va chercher une page d'utilisateurs et l'affiche
async function loadUsers(page = 1) {
  const params = new URLSearchParams({ page });
  if (searchText) params.set("search", searchText);
  if (roleFilter !== "all") params.set("role", roleFilter);
  const data = await api(`/admin/users?${params}`);
  const list = document.getElementById("users-list");
  const empty = document.getElementById("users-empty");

  currentPage = page;
  usersById = Object.fromEntries(data.results.map(u => [u.id, u]));
  list.querySelectorAll("article").forEach(a => a.remove());
  empty.insertAdjacentHTML("beforebegin", data.results.map(userRow).join(""));
  renderPager(data, page);
  empty.hidden = data.results.length > 0;
}

// Fenêtre de modification d'un utilisateur
function openEditDialog(user) {
  let dialog = document.getElementById("edit-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "edit-dialog";
    document.body.appendChild(dialog);
  }
  dialog.innerHTML = `
    <form id="edit-form" class="card" data-user-id="${user.id}">
      <h2>Modifier l'utilisateur</h2>
      <label>Prénom <input name="first_name" value="${esc(user.first_name)}"></label>
      <label>Nom <input name="last_name" value="${esc(user.last_name)}"></label>
      <label>Email <input name="email" type="email" required value="${esc(user.email)}"></label>
      <label>Téléphone <input name="telephone" value="${esc(user.telephone)}"></label>
      <label>Ville <input name="city" value="${esc(user.city)}"></label>
      <label>Code postal <input name="postal_code" value="${esc(user.postal_code)}"></label>
      <label>Rôle
        <select name="role">
          ${Object.entries(ROLE_LABELS).map(([value, label]) =>
            `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </label>
      <label><input name="is_active" type="checkbox" ${user.is_active ? "checked" : ""}> Compte actif</label>
      <p id="edit-error" class="muted"></p>
      <div class="admin-actions">
        <button type="button" class="btn btn-ghost" id="edit-cancel">Annuler</button>
        <button type="submit" class="btn">Enregistrer</button>
      </div>
    </form>`;
  dialog.querySelector("#edit-cancel").onclick = () => dialog.close();
  dialog.showModal();
}

// Supprime un utilisateur (avec confirmation)
async function deleteUser(id) {
  if (id === currentUser.id) {
    alert("Tu ne peux pas supprimer ton propre compte.");
    return;
  }
  if (!confirm("Supprimer définitivement cet utilisateur ?")) return;

  try {
    await api(`/admin/users/${id}`, { method: "DELETE" });
    await loadUsers(currentPage).catch(() => loadUsers(1));
  } catch (err) {
    alert(err.message);
  }
}

// Clic sur un bouton de pagination
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-page]");
  if (btn && !btn.disabled) loadUsers(Number(btn.dataset.page));
});

// Clic sur un bouton d'action (Modifier / Supprimer)
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = Number(btn.closest("article").dataset.userId);
  if (btn.dataset.act === "delete") deleteUser(id);
  if (btn.dataset.act === "edit") openEditDialog(usersById[id]);
});

// Enregistrement de la fenêtre de modification
document.addEventListener("submit", async e => {
  if (e.target.id !== "edit-form") return;
  e.preventDefault();

  const form = e.target;
  const id = Number(form.dataset.userId);
  const f = new FormData(form);
  const body = {
    first_name: f.get("first_name"),
    last_name: f.get("last_name"),
    email: f.get("email"),
    telephone: f.get("telephone"),
    city: f.get("city"),
    postal_code: f.get("postal_code"),
    role: f.get("role"),
    is_active: f.has("is_active"),
  };

  // Sécurité : on ne peut pas se retirer ses propres droits
  if (id === currentUser.id && (body.role !== "admin" || !body.is_active)) {
    document.getElementById("edit-error").textContent =
      "Tu ne peux pas retirer le rôle admin ou désactiver ton propre compte.";
    return;
  }

  try {
    await api(`/admin/users/${id}`, { method: "PATCH", body });
    document.getElementById("edit-dialog").close();
    await loadUsers(currentPage);
  } catch (err) {
    document.getElementById("edit-error").textContent = err.message;
  }
});

// Recherche (on attend 0,3 s après la dernière lettre tapée)
let searchTimer;
document.getElementById("search").addEventListener("input", e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchText = e.target.value.trim();
    loadUsers(1);
  }, 300);
});

// Filtre par rôle
document.getElementById("role-filter").addEventListener("change", e => {
  roleFilter = e.target.value;
  loadUsers(1);
});

// Démarrage : on vérifie que c'est bien un admin, sinon retour à la connexion
async function startAdminPage() {
  try {
    currentUser = await api("/auth/me");
    if (!currentUser || currentUser.role !== "admin") {
      location.href = "login.html";
      return;
    }
    await loadUsers();
  } catch (err) {
    console.error(err);
    location.href = "login.html";
  }
}

startAdminPage();