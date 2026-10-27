(() => {
  const common = window.AdminCommon;
  const list = document.getElementById("users-list");

  if (!list) return;

  let users = [];
  let me = null;
  let currentPage = 1;
  let totalPages = 1;
  let searchTimeout = null;

  const pageSize = 10;

  const search = document.getElementById("search");
  const roleFilter = document.getElementById("role-filter");
  const roleNames = {
    candidate: "Candidat",
    recruiter: "Recruteur",
    admin: "Admin"
  };
  const roleChoices = [
    ["candidate", "Candidat"],
    ["recruiter", "Recruteur"],
    ["admin", "Admin"]
  ];

  const previousButton = document.getElementById("user-previous");
  const nextButton = document.getElementById("user-next");
  const pageInfo = document.getElementById("user-page-info");

  function refuse(message) {
    common.report(message, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    list.innerHTML = users.length
      ? users.map(user => `
        <article class="app">
          <div>
            <h3>${common.escape(common.name(user))}</h3>
            <p class="muted">
              ${common.escape(user.email)}
              ${user.city ? ` · ${common.escape(user.city)}` : ""}
            </p>
          </div>
          <div class="admin-actions">
            <span class="badge${user.role === "recruiter" ? "s-active" : user.role === "admin" ? "s-vue" : "s-attente"}">
              ${common.escape(roleNames[user.role] || user.role)}
            </span>
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              data-action="edit"
              data-id="${user.id}"
            >
              Modifier
            </button>
            <button
              class="btn btn-danger btn-sm"
              type="button"
              data-action="delete"
              data-id="${user.id}"
            >
              Supprimer
            </button>
          </div>
        </article>
      `).join("")
      : common.empty(list, "Aucun utilisateur pour le moment.");

    pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
  }

  async function reload() {
    const params = new URLSearchParams({
      page: currentPage,
      page_size: pageSize
    });

    const query = search.value.trim();

    if (query) params.set("search", query);
    if (roleFilter.value !== "all") {
      params.set("role", roleFilter.value);
    }

    const data = await api(`/admin/users?${params}`);

    users = data.results || [];
    totalPages = Math.max(
      1,
      Math.ceil((data.count || 0) / pageSize)
    );

    // Si la page actuelle n'existe plus, revenir à la dernière page.
    if (currentPage > totalPages) {
      currentPage = totalPages;
      return reload();
    }

    // Si une page vide est renvoyée alors qu'il reste des pages,
    // revenir à la page précédente.
    if (users.length === 0 && currentPage > 1) {
      currentPage--;
      return reload();
    }

    render();
  }

  function create() {
    const dialog = common.formDialog("Ajouter un utilisateur", [
      ["first_name", "Prénom", "", "text"],
      ["last_name", "Nom", "", "text"],
      ["email", "Adresse e-mail", "", "email"],
      ["telephone", "Téléphone", "", "tel", false],
      ["city", "Ville", "", "text"],
      ["postal_code", "Code postal", "", "text"],
      [
        "password",
        "Mot de passe (12 caractères minimum, lettres et chiffres)",
        "",
        "password",
        false
      ]
    ], [
      ["role", "Rôle", "candidate", roleChoices]
    ]);

    dialog.addEventListener("submit", async event => {
      event.preventDefault();

      const data = Object.fromEntries(new FormData(event.target));

      if (!data.password) delete data.password;

      try {
        await api("/admin/users", {
          method: "POST",
          body: data
        });

        await reload();
        common.report("Utilisateur ajouté.");
        dialog.close();
        dialog.remove();
      } catch (error) {
        common.report(error.message, true);
      }
    });
  }

  function edit(user) {
    const dialog = common.formDialog("Modifier un utilisateur", [
      ["first_name", "Prénom", user.first_name, "text"],
      ["last_name", "Nom", user.last_name, "text"],
      ["email", "Adresse e-mail", user.email, "email"],
      ["telephone", "Téléphone", user.telephone, "tel", false],
      ["city", "Ville", user.city, "text"],
      ["postal_code", "Code postal", user.postal_code, "text"]
    ], [
      ["role", "Rôle", user.role, roleChoices]
    ]);

    dialog.addEventListener("submit", async event => {
      event.preventDefault();

      const data = Object.fromEntries(new FormData(event.target));

      if (user.email === me.email && data.role !== "admin") {
        dialog.close();
        dialog.remove();
        refuse("Vous ne pouvez pas retirer votre propre rôle administrateur.");
        return;
      }

      try {
        await api(`/admin/users/${user.id}`, {
          method: "PATCH",
          body: data
        });

        await reload();
        common.report("Utilisateur modifié.");
        dialog.close();
        dialog.remove();
      } catch (error) {
        common.report(error.message, true);
      }
    });
  }

  function restart() {
    currentPage = 1;

    reload().catch(error => {
      common.report(error.message, true);
    });
  }

  async function init() {
    me = await common.requireAdmin();

    if (!me) return;

    try {
      await reload();

      // Bouton d'ajout d'un utilisateur.
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "btn btn-sm";
      addButton.textContent = "Ajouter un utilisateur";
      addButton.addEventListener("click", create);
      search.closest(".admin-toolbar")?.append(addButton);

      // Recherche avec délai de 300 ms.
      search.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(restart, 300);
      });

      // Filtrer par rôle.
      roleFilter.addEventListener("change", restart);

      // Page précédente.
      previousButton.addEventListener("click", async () => {
        if (currentPage <= 1) return;

        currentPage--;

        try {
          await reload();
        } catch (error) {
          currentPage++;
          common.report(error.message, true);
        }
      });

      // Page suivante.
      nextButton.addEventListener("click", async () => {
        if (currentPage >= totalPages) return;

        currentPage++;

        try {
          await reload();
        } catch (error) {
          currentPage--;
          common.report(error.message, true);
        }
      });

      // Modifier ou supprimer un utilisateur.
      list.addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const user = users.find(
          item => String(item.id) === button.dataset.id
        );

        if (!user) return;

        if (button.dataset.action === "edit") {
          edit(user);
          return;
        }

        // Empêcher l'admin de supprimer son propre compte.
        if (user.email === me.email) {
          refuse("Vous ne pouvez pas supprimer votre propre compte.");
          return;
        }

        if (!confirm(`Supprimer le compte de ${common.name(user)} ?`)) {
          return;
        }

        try {
          await api(`/admin/users/${user.id}`, {
            method: "DELETE"
          });

          // Si on supprime le dernier utilisateur de la page,
          // reculer d'une page avant de recharger.
          if (users.length === 1 && currentPage > 1) {
            currentPage--;
          }

          await reload();
          common.report("Utilisateur supprimé.");
        } catch (error) {
          common.report(error.message, true);
        }
      });
    } catch (error) {
      common.report(
        `Impossible de charger les utilisateurs : ${error.message}`,
        true
      );
    }
  }

  init();
})();
