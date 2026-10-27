// admin-messages.js
// Gestion des messages et pagination côté frontend.

(() => {
  const common = window.AdminCommon;
  const list = document.getElementById("messages-list");
  const search = document.getElementById("messages-search");

  if (!common || !list || !search) {
    console.error("Admin messages : éléments principaux introuvables.");
    return;
  }

  const previousButton = document.getElementById("message-previous");
  const nextButton = document.getElementById("message-next");
  const pageInfo = document.getElementById("message-page-info");

  if (!previousButton || !nextButton || !pageInfo) {
    console.error("Admin messages : éléments de pagination introuvables.");
    return;
  }

  let messages = [];
  let users = [];
  let ads = [];

  let currentPage = 1;
  const pageSize = 10;

  function relatedUsers(message) {
    const ad = ads.find(
      item => String(item.id) === String(message.ad)
    );

    const candidate = users.find(
      item => String(item.id) === String(message.candidate)
    );

    const recruiter = ad
      ? users.find(
          item => String(item.id) === String(ad.recruiter)
        )
      : undefined;

    return { ad, candidate, recruiter };
  }

  function getFilteredMessages() {
    const query = search.value.trim().toLocaleLowerCase("fr");

    return messages.filter(message => {
      const { ad, candidate, recruiter } = relatedUsers(message);

      const text = [
        message.object || "",
        message.content || "",
        common.name(candidate || {}),
        common.name(recruiter || {}),
        ad?.title || ""
      ]
        .join(" ")
        .toLocaleLowerCase("fr");

      return text.includes(query);
    });
  }

  function render() {
    const filtered = getFilteredMessages();

    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / pageSize)
    );

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    const start = (currentPage - 1) * pageSize;
    const results = filtered.slice(start, start + pageSize);

    console.log("[Admin messages pagination]", {
      totalMessages: messages.length,
      filteredMessages: filtered.length,
      pageSize,
      currentPage,
      totalPages,
      displayedMessages: results.length
    });

    if (!results.length) {
      common.empty(list, "Aucun message pour le moment.");
    } else {
      list.innerHTML = results.map(message => {
        const { ad, candidate, recruiter } = relatedUsers(message);

        const emails = [
          candidate?.email,
          recruiter?.email
        ]
          .filter(Boolean)
          .map(email => common.escape(email))
          .join(" · ");

        return `
          <article class="app">
            <div>
              <h3 class="ad-title">
                <span class="ad-new">Annonce</span>
                ${common.escape(ad?.title || "Annonce supprimée")}
              </h3>

              <p>
                <strong>
                  ${common.escape(common.name(candidate || {}))}
                </strong>
                <span class="muted">→</span>
                <strong>
                  ${common.escape(common.name(recruiter || {}))}
                </strong>
              </p>

              <p class="muted">
                ${emails}
                · ${common.date(message.sent_at ?? message.created_at)}
              </p>

              <p class="letter">
                <strong>${common.escape(message.object || "")}</strong><br>
                ${common.escape(message.content || "")}
              </p>
            </div>

            <div class="admin-actions">
              <button
                class="btn btn-danger btn-sm"
                type="button"
                data-delete-message="${message.id}"
              >
                Supprimer
              </button>
            </div>
          </article>
        `;
      }).join("");
    }

    pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
  }

  async function reloadMessages() {
    messages = await common.list("/admin/messages");
    currentPage = 1;
    render();
  }

  function changePage(page) {
    const filtered = getFilteredMessages();
    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / pageSize)
    );

    if (page < 1 || page > totalPages) return;

    currentPage = page;
    render();
  }

  async function deleteMessage(id) {
    try {
      await api(`/admin/messages/${id}`, {
        method: "DELETE"
      });

      await reloadMessages();
      common.report("Message supprimé.");
    } catch (error) {
      common.report(error.message, true);
    }
  }

  async function init() {
    if (!(await common.requireAdmin())) return;

    try {
      [messages, users, ads] = await Promise.all([
        common.list("/admin/messages"),
        common.list("/admin/users"),
        common.list("/admin/ads")
      ]);
    } catch (error) {
      common.report(
        `Impossible de charger les messages : ${error.message}`,
        true
      );
      return;
    }

    render();

    search.addEventListener("input", () => {
      currentPage = 1;
      render();
    });

    previousButton.addEventListener("click", () => {
      changePage(currentPage - 1);
    });

    nextButton.addEventListener("click", () => {
      changePage(currentPage + 1);
    });

    list.addEventListener("click", event => {
      const button = event.target.closest("[data-delete-message]");

      if (!button) return;

      if (!confirm("Supprimer définitivement ce message ?")) {
        return;
      }

      deleteMessage(button.dataset.deleteMessage);
    });
  }

  init();
})();