(() => {
  const common = window.AdminCommon;
  const list = document.getElementById("applications-list");

  if (!list) return;

  const filter = document.getElementById("application-status");

  const previousButton = document.getElementById("application-previous");
  const nextButton = document.getElementById("application-next");
  const pageInfo = document.getElementById("application-page-info");

  let applications = [];
  let users = [];
  let ads = [];
  let companies = [];

  let currentPage = 1;
  const pageSize = 10;

  function getFilteredApplications() {
    return applications.filter(
      application =>
        filter.value === "all" ||
        application.status === filter.value
    );
  }

  function render() {
    const filtered = getFilteredApplications();

    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / pageSize)
    );

    // Vérifier que la page actuelle existe toujours.
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    const start = (currentPage - 1) * pageSize;
    const results = filtered.slice(start, start + pageSize);

    list.innerHTML = results.length
      ? results.map(application => {
          const ad = ads.find(
            item => String(item.id) === String(application.ad)
          );

          const user = users.find(
            item => String(item.id) === String(application.candidate)
          );

          const candidate = user
            ? common.name(user)
            : `${application.first_name || "Candidat"} ${
                application.last_name || ""
              }`.trim();

          const options = [
            ["sent", "Envoyée"],
            ["seen", "Vue"],
            ["interview", "Entretien"],
            ["accepted", "Acceptée"],
            ["rejected", "Refusée"]
          ];

          return `
            <article class="app">
              <div>
                <h3>
                  ${common.escape(candidate)}
                  · ${common.escape(ad?.title || "Offre inconnue")}
                </h3>

                <p class="muted">
                  ${common.escape(application.email || "")}
                  · ${
                    common.escape(
                      ad
                        ? common.companyName(companies, ad.company)
                        : "Entreprise inconnue"
                    )
                  }
                  · ${common.date(application.created_at)}
                </p>

                <p class="letter">
                  ${common.escape(application.message || "")}
                </p>
              </div>

              <div class="admin-actions">
                <span class="badge ${common.statusClass(application.status)}">
                  ${common.escape(
                    common.statusLabel(application.status)
                  )}
                </span>

                <label
                  class="admin-control"
                  for="application-status-${application.id}"
                >
                  Statut

                  <select
                    id="application-status-${application.id}"
                    data-application-status="${application.id}"
                  >
                    ${options.map(([value, label]) => `
                      <option
                        value="${value}"
                        ${application.status === value ? "selected" : ""}
                      >
                        ${label}
                      </option>
                    `).join("")}
                  </select>
                </label>

                <button
                  class="btn btn-danger btn-sm"
                  type="button"
                  data-delete-application="${application.id}"
                >
                  Supprimer
                </button>
              </div>
            </article>
          `;
        }).join("")
      : common.empty(list, "Aucune candidature pour le moment.");

    // Mettre à jour la pagination.
    pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;

    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
  }

  async function reloadApplications() {
    applications = await common.list("/admin/applications");
    render();
  }

  async function changePage(page) {
    const filtered = getFilteredApplications();
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
      [
        applications,
        users,
        ads,
        companies
      ] = await Promise.all([
        common.list("/admin/applications"),
        common.list("/admin/users"),
        common.list("/admin/ads"),
        common.list("/admin/companies")
      ]);

      render();

      // Filtrer les candidatures par statut.
      filter.addEventListener("change", () => {
        currentPage = 1;
        render();
      });

      // Page précédente.
      previousButton.addEventListener("click", () => {
        changePage(currentPage - 1);
      });

      // Page suivante.
      nextButton.addEventListener("click", () => {
        changePage(currentPage + 1);
      });

      // Modifier le statut d'une candidature.
      list.addEventListener("change", async event => {
        const select = event.target.closest(
          "[data-application-status]"
        );

        if (!select) return;

        const applicationId = select.dataset.applicationStatus;
        const newStatus = select.value;

        try {
          await api(`/admin/applications/${applicationId}`, {
            method: "PATCH",
            body: {
              status: newStatus
            }
          });

          await reloadApplications();

          common.report("Statut de candidature mis à jour.");
        } catch (error) {
          common.report(error.message, true);

          // Restaurer l'affichage depuis les données actuelles.
          render();
        }
      });

      // Supprimer une candidature.
      list.addEventListener("click", async event => {
        const button = event.target.closest(
          "[data-delete-application]"
        );

        if (!button) return;

        if (
          !confirm(
            "Supprimer définitivement cette candidature ?"
          )
        ) {
          return;
        }

        try {
          await api(
            `/admin/applications/${button.dataset.deleteApplication}`,
            {
              method: "DELETE"
            }
          );

          // Recharger les données et corriger la page si nécessaire.
          await reloadApplications();

          common.report("Candidature supprimée.");
        } catch (error) {
          common.report(error.message, true);
        }
      });

    } catch (error) {
      common.report(
        `Impossible de charger les candidatures : ${error.message}`,
        true
      );
    }
  }

  init();
})();