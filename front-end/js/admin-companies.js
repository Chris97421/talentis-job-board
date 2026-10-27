(() => {
  const common = window.AdminCommon;
  const list = document.getElementById("companies-list");
  if (!list) return;

  const search = document.getElementById("company-search");
  let companies = [];
  let ads = [];

  let currentPage = 1;
  let totalPages = 1;
  const pageSize = 10;

  const previousButton = document.getElementById("company-previous");
  const nextButton = document.getElementById("company-next");
  const pageInfo = document.getElementById("company-page-info");

  let searchTimeout;

  function render() {
    // Les résultats sont déjà filtrés et paginés par le serveur.
    list.innerHTML = companies.length
      ? companies.map(company => {
          const count = ads.filter(
            ad => String(ad.company) === String(company.id)
          ).length;

          return `
            <article class="app">
              <div>
                <h3>${common.escape(company.name)}</h3>
                <p class="muted">
                  ${common.escape(company.city)}
                  · ${common.escape(company.postal_code)}
                </p>
              </div>

              <div class="admin-actions">
                <span class="badge s-active">
                  ${count} offre${count === 1 ? "" : "s"}
                </span>
                <button type="button" class="btn btn-ghost btn-sm"
                        data-action="edit" data-id="${company.id}">
                  Modifier
                </button>
                <button type="button" class="btn btn-danger btn-sm"
                        data-action="delete" data-id="${company.id}">
                  Supprimer
                </button>
              </div>
            </article>
          `;
        }).join("")
      : common.empty(list, "Aucune entreprise trouvée.");

    pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
  }

  async function reload(page = currentPage) {
    const params = new URLSearchParams({
      page,
      page_size: pageSize,
    });

    const query = search.value.trim();
    if (query) params.set("search", query);

    let data;

    try {
      data = await api(`/admin/companies?${params}`);
    } catch (error) {
      // Une suppression peut faire disparaître la dernière page.
      if (error.status === 404 && page > 1) {
        return reload(page - 1);
      }
      throw error;
    }

    currentPage = page;
    companies = data.results || [];
    totalPages = Math.max(1, Math.ceil((data.count || 0) / pageSize));

    render();
  }

  function openCompanyForm(company = null) {
    const dialog = common.formDialog(
      company ? "Modifier une entreprise" : "Ajouter une entreprise",
      [
        ["name", "Nom", company?.name || "", "text"],
        ["siret", "SIRET (14 chiffres)", company?.siret || "", "text"],
        ["city", "Ville", company?.city || "", "text"],
        ["postal_code", "Code postal", company?.postal_code || "", "text"],
        ["website", "Site web", company?.website || "", "url", false],
        ["description", "Description", company?.description || "", "textarea", false],
      ]
    );

    dialog.addEventListener("submit", async event => {
      event.preventDefault();

      try {
        const path = company
          ? `/admin/companies/${company.id}`
          : "/admin/companies";

        await api(path, {
          method: company ? "PATCH" : "POST",
          body: Object.fromEntries(new FormData(event.target)),
        });

        await reload();

        common.report(
          company ? "Entreprise modifiée." : "Entreprise ajoutée."
        );

        dialog.close();
        dialog.remove();
      } catch (error) {
        common.report(error.message, true);
      }
    });
  }

  async function changePage(page) {
    if (page < 1 || page > totalPages) return;

    previousButton.disabled = true;
    nextButton.disabled = true;

    try {
      await reload(page);
    } catch (error) {
      common.report(error.message, true);
    } finally {
      previousButton.disabled = currentPage <= 1;
      nextButton.disabled = currentPage >= totalPages;
    }
  }

  async function init() {
    if (!await common.requireAdmin()) return;

    try {
      ads = await common.list("/admin/ads");
      await reload();

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "btn btn-sm";
      addButton.textContent = "Ajouter une entreprise";
      addButton.addEventListener("click", () => openCompanyForm());

      search.closest(".admin-toolbar").append(addButton);

      search.addEventListener("input", () => {
        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(async () => {
          try {
            await reload(1);
          } catch (error) {
            common.report(error.message, true);
          }
        }, 300);
      });

      previousButton.addEventListener("click", () => {
        changePage(currentPage - 1);
      });

      nextButton.addEventListener("click", () => {
        changePage(currentPage + 1);
      });

      list.addEventListener("click", async event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const company = companies.find(
          item => String(item.id) === button.dataset.id
        );
        if (!company) return;

        if (button.dataset.action === "edit") {
          openCompanyForm(company);
          return;
        }

        if (!confirm(`Supprimer l'entreprise ${company.name} ?`)) return;

        try {
          await api(`/admin/companies/${company.id}`, {
            method: "DELETE",
          });

          await reload();
          common.report("Entreprise supprimée.");
        } catch (error) {
          common.report(error.message, true);
        }
      });
    } catch (error) {
      common.report(
        `Impossible de charger les entreprises : ${error.message}`,
        true
      );
    }
  }

  init();
})();