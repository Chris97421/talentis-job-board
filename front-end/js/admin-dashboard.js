(() => {
  const common = window.AdminCommon;
  const main = document.querySelector(".admin-content");
  if (!main || !document.getElementById("stats")) return;

  async function init() {
    if (!await common.requireAdmin()) return;
    try {
      const [users, companies, ads, applications] = await Promise.all([
        common.list("/admin/users"), common.list("/admin/companies"),
        common.list("/admin/ads"), common.list("/admin/applications"),
      ]);
      document.getElementById("stat-users").textContent = users.length;
      document.getElementById("stat-companies").textContent = companies.length;
      document.getElementById("stat-ads").textContent = ads.filter(ad => ad.status === "open").length;
      document.getElementById("stat-apps").textContent = applications.length;

      const recentUsers = [...users].sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined)).slice(0, 5);
      const usersList = document.getElementById("recent-users-list");
      usersList.innerHTML = recentUsers.length ? recentUsers.map(user => `
        <article class="app"><div><h3>${common.escape(common.name(user))}</h3><p class="muted">${common.escape(user.email)}${user.city ? ` · ${common.escape(user.city)}` : ""}</p></div>
        <span class="badge ${user.role === "recruiter" ? "s-active" : user.role === "admin" ? "s-vue" : "s-attente"}">${common.escape({ candidate: "Candidat", recruiter: "Recruteur", admin: "Admin" }[user.role] || user.role)}</span></article>`).join("") : common.empty(usersList, "Aucun utilisateur pour le moment.");

      const recentAds = [...ads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
      const adsList = document.getElementById("recent-ads-list");
      adsList.innerHTML = recentAds.length ? recentAds.map(ad => {
        const company = companies.find(item => String(item.id) === String(ad.company))?.name || "Entreprise";
        return `<article class="app"><div><h3>${common.escape(ad.title)}</h3><p class="muted">${common.escape(company)} · ${common.escape(ad.city)} · ${common.escape(ad.contract_type)}</p></div>
          <span class="badge ${common.statusClass(ad.status)}">${common.escape(common.statusLabel(ad.status))}</span></article>`;
      }).join("") : common.empty(adsList, "Aucune offre pour le moment.");
    } catch (error) {
      common.report(`Impossible de charger le tableau de bord : ${error.message}`, true);
    }
  }
  init();
})();