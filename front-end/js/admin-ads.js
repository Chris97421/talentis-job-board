(() => {
  const common = window.AdminCommon;
  const list = document.getElementById("ads-list");

  if (!list) return;

  const search = document.getElementById("ads-search");
  const status = document.getElementById("ads-status");

  const previousButton = document.getElementById("ad-previous");
  const nextButton = document.getElementById("ad-next");
  const pageInfo = document.getElementById("ad-page-info");

  let ads = [];
  let companies = [];

  const contractChoices = [["CDI", "CDI"], ["CDD", "CDD"], ["Stage", "Stage"], ["Alternance", "Alternance"], ["Interim", "Intérim"]];

  let currentPage = 1;
  const pageSize = 10;

  function getFilteredAds() {
    const query = search.value.trim().toLocaleLowerCase("fr");

    return ads.filter(ad => {
      const companyName = common.companyName(companies, ad.company);

      const matchesSearch = [
        ad.title || "",
        companyName || "",
        ad.city || ""
      ]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(query);

      const matchesStatus =
        status.value === "all" || status.value === ad.status;

      return matchesSearch && matchesStatus;
    });
  }

  function render() {
    const filtered = getFilteredAds();

    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / pageSize)
    );

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    const start = (currentPage - 1) * pageSize;
    const results = filtered.slice(start, start + pageSize);

    list.innerHTML = results.length
      ? results.map(ad => `
          <article class="app">
            <div>
              <h3>${common.escape(ad.title || "")}</h3>

              <p class="muted">
                ${common.escape(common.companyName(companies, ad.company))}
                · ${common.escape(ad.city || "")}
                · ${common.escape(ad.contract_type || "")}
              </p>
            </div>

            <div class="admin-actions">
              <span class="badge ${common.statusClass(ad.status)}">
                ${common.escape(common.statusLabel(ad.status))}
              </span>

              <button
                class="btn btn-ghost btn-sm"
                type="button"
                data-action="edit"
                data-id="${ad.id}"
              >
                Modifier
              </button>

              <button
                class="btn btn-ghost btn-sm"
                type="button"
                data-action="toggle"
                data-id="${ad.id}"
              >
                ${ad.status === "open" ? "Fermer" : "Rouvrir"}
              </button>

              <button
                class="btn btn-danger btn-sm"
                type="button"
                data-action="delete"
                data-id="${ad.id}"
              >
                Supprimer
              </button>
            </div>
          </article>
        `).join("")
      : common.empty(list, "Aucune offre pour le moment.");

    pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;

    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
  }

  async function reload() {
    ads = await common.list("/admin/ads");
    render();
  }

  async function create() {
    try {
      const [categories, users] = await Promise.all([common.list("/admin/categories"), common.list("/admin/users")]);
      const recruiters = users.filter(user => user.role === "recruiter");
      if (!companies.length || !categories.length || !recruiters.length) {
        common.report("Impossible de créer une offre : il faut au moins une entreprise, une catégorie et un recruteur.", true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const dialog = common.formDialog("Ajouter une offre", [
        ["title", "Intitulé", "", "text"],
        ["short_description", "Description courte", "", "text"],
        ["full_description", "Description complète", "", "textarea"],
        ["city", "Ville", "", "text", false],
        ["postal_code", "Code postal", "", "text", false],
      ], [
        ["company", "Entreprise", "", companies.map(company => [String(company.id), company.name])],
        ["recruiter", "Recruteur", "", recruiters.map(user => [String(user.id), common.name(user)])],
        ["category", "Catégorie", "", categories.map(category => [String(category.id), category.name])],
        ["contract_type", "Contrat", "CDI", contractChoices],
      ]);
      dialog.addEventListener("submit", async event => {
        event.preventDefault();
        try {
          await api("/admin/ads", { method: "POST", body: Object.fromEntries(new FormData(event.target)) });
          await reload(); common.report("Offre ajoutée."); dialog.close(); dialog.remove();
        } catch (error) { common.report(error.message, true); }
      });
    } catch (error) { common.report(error.message, true); }
  }

  function edit(ad) {
    const dialog = common.formDialog("Modifier une offre", [
      ["title", "Intitulé", ad.title, "text"],
      ["short_description", "Description courte", ad.short_description, "text"],
      ["full_description", "Description complète", ad.full_description, "textarea"],
      ["city", "Ville", ad.city, "text", false],
      ["postal_code", "Code postal", ad.postal_code, "text", false]
    ], [
      ["contract_type", "Contrat", ad.contract_type, contractChoices],
      ["status", "Statut", ad.status, [["open", "Ouverte"], ["closed", "Fermée"]]]
    ]);

    dialog.addEventListener("submit", async event => {
      event.preventDefault();

      try {
        await api(`/admin/ads/${ad.id}`, {
          method: "PATCH",
          body: Object.fromEntries(new FormData(event.target))
        });

        await reload();

        common.report("Offre modifiée.");
        dialog.close();
        dialog.remove();
      } catch (error) {
        common.report(error.message, true);
      }
    });
  }

  function changePage(page) {
    const filtered = getFilteredAds();

    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / pageSize)
    );

    if (page < 1 || page > totalPages) return;

    currentPage = page;
    render();
  }

  async function init() {
    if (!await common.requireAdmin()) return;

    try {
      [ads, companies] = await Promise.all([
        common.list("/admin/ads"),
        common.list("/admin/companies")
      ]);

      render();
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "btn btn-sm";
      addButton.textContent = "Ajouter une offre";
      addButton.addEventListener("click", create);
      search.closest(".admin-toolbar")?.append(addButton);

      search.addEventListener("input", () => {
        currentPage = 1;
        render();
      });

      status.addEventListener("change", () => {
        currentPage = 1;
        render();
      });

      previousButton.addEventListener("click", () => {
        changePage(currentPage - 1);
      });

      nextButton.addEventListener("click", () => {
        changePage(currentPage + 1);
      });
      list.addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const ad = ads.find(
          item => String(item.id) === button.dataset.id
        );

        if (!ad) return;

        try {
          if (button.dataset.action === "edit") {
            edit(ad);
            return;
          }

          if (button.dataset.action === "delete") {
            if (!confirm(
              `Supprimer l'offre « ${ad.title} » et ses candidatures ?`
            )) {
              return;
            }

            await api(`/admin/ads/${ad.id}`, {
              method: "DELETE"
            });

            common.report("Offre supprimée.");
          } else if (button.dataset.action === "toggle") {
            const nextStatus =
              ad.status === "open" ? "closed" : "open";

            await api(`/admin/ads/${ad.id}`, {
              method: "PATCH",
              body: { status: nextStatus }
            });

            common.report(
              nextStatus === "closed"
                ? "Offre fermée."
                : "Offre rouverte."
            );
          }

          await reload();
        } catch (error) {
          common.report(error.message, true);
        }
      });
    } catch (error) {
      common.report(
        `Impossible de charger les offres : ${error.message}`,
        true
      );
    }
  }

  init();
})();