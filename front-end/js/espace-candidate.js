let applications = [];

// pour lire la candidature => GET /candidate/applications
async function apiLoadApplications(){
  return api("/candidate/applications");
}

// pour modifier la candidature (CV/message) => PATCH cnadidate/applications/id
async function apiUpdateApplication(id, { message, cvChoice, file }){
  const fd = new FormData();
  fd.append("message", message);
  fd.append("use_saved_cv", cvChoice === "saved" ? "true" : "false");

  if (cvChoice === "new" && file) fd.append("cv", file);

  return api(`/candidate/applications/${id}`, { method: "PATCH", body: fd });
}

// pour supprimer la candidature
async function apiDeleteApplication(id){
  return api(`/candidate/applications/${id}`, { method: "DELETE" });
}

// pour télécharger le cv
async function downloadCV(appId, filename) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/applications/${appId}/cv`, { headers: { Authorization: "Bearer " + token } });

  if (!res.ok) { 
    toast("Impossible de récupérer ce CV."); 
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename || "cv.pdf"; a.click();
  URL.revokeObjectURL(url);
}

//
const STATUS = { sent:"Envoyée", seen:"Vue", interview: "Entretien", rejected: "Refusée", accepted: "Acceptée" };
const CLOSED = ["accepted", "rejected"];
const $ = id => document.getElementById(id);
let currentId = null;

function esc(s){ const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }
function fmt(d){ return new Date(d).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric"}); }
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); }
const fail = err => toast(err?.message || "Une erreur est survenue. Veuillez réessayer.");

function renderStats(){
  const count = s => applications.filter(a => a.status === s).length;
  $("stats").innerHTML =
    `<div><strong>${applications.length}</strong><span class="muted">Candidatures</span></div>` +
    `<div><strong>${count("sent") + count("seen")}</strong><span class="muted">En attente</span></div>` +
    `<div><strong>${count("interview")}</strong><span class="muted">Entretien</span></div>`+
    `<div><strong>${count("accepted")}</strong><span class="muted">Acceptée</span></div>`+
    `<div><strong>${count("rejected")}</strong><span class="muted">Refusée</span></div>`;
}

function renderList(){
  const f = $("filter").value;
  const items = f === "all" ? applications : applications.filter(a => a.status === f);
  if (!items.length){
    $("list").innerHTML = `<div class="empty">${applications.length
      ? "Aucune candidature avec ce statut."
      : 'Vous n\'avez pas encore postulé. <a href="main.html">Voir les offres</a>'}</div>`;
    return;
  }
  $("list").innerHTML = items.map(a => {
    const closed = CLOSED.includes(a.status);
    const short = (a.message || "").length > 140;
    return `
    <article class="app" data-id="${a.id}">
      <div>
        <h3>${esc(a.ad_title)}</h3>
        <div class="muted">postulé le ${fmt(a.created_at)}</div>
        <span class="badge s-${a.status}">${STATUS[a.status] ?? esc(a.status)}</span>
      </div>

      <div class="actions">
        <button class="btn btn-sm btn-ghost" data-edit="${a.id}" ${closed ? 'disabled title="Candidature clôturée"' : ""}>Modifier</button>
        <button class="btn btn-sm btn-danger" data-del="${a.id}" ${closed ? 'disabled title="Candidature clôturée"' : ""}>Retirer</button>
      </div>
      <p class="letter" data-expanded="false">${esc(short ? a.message.slice(0, 140) + "…" : a.message)}</p>
      ${short ? `<button type="button" class="btn-link" data-toggle-msg="${a.id}">Lire tout le message</button>` : ""}
      ${a.cv_download_url ? `<button type="button" class="btn-link" data-cv="${a.id}">Voir mon CV joint</button>` : ""}

    </article>`;
  }).join("");
}

function render() { renderStats(); renderList(); }
 
$("list").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  const toggle = e.target.closest("[data-toggle-msg]"), cv = e.target.closest("[data-cv]");

$("e-cv-choice").addEventListener("change", () => {
    $("e-cv-field").hidden = $("e-cv-choice").value !== "new";
});

 
  if (edit) {
    const a = applications.find(x => x.id === +edit.dataset.edit);
    currentId = a.id;
    $("edit-title").textContent = "Modifier : " + a.ad_title;
    $("e-cv").value = "";
    $("e-cv-choice").value = "keep";
    $("e-cv-field").hidden = true;
    $("e-cv-current").textContent = a.cv_download_url
      ? "Un CV est déjà joint (choisis un fichier pour le remplacer)."
      : "Aucun CV joint actuellement.";
    $("e-cv-error").textContent = "";
    $("e-letter").value = a.message;
    $("dlg-edit").showModal();
  }

  if (del){
    const a = applications.find(x => x.id === +del.dataset.del);
    currentId = a.id;
    $("del-text").textContent = `Votre candidature pour l'offre « ${a.ad_title} » sera retirée.`;
    $("dlg-del").showModal();
  }
  if (toggle) {
    const a = applications.find(x => x.id === +toggle.dataset.toggleMsg);
    const p = toggle.previousElementSibling;
    const expanded = p.dataset.expanded === "true";
    p.textContent = expanded ? a.message.slice(0, 140) + "…" : a.message;
    p.dataset.expanded = String(!expanded);
    toggle.textContent = expanded ? "Lire tout le message" : "Réduire";
  }
  if (cv) {
    const a = applications.find(x => x.id === +cv.dataset.cv);
    downloadCV(a.id, `cv-${a.id}.pdf`);
  }
});



$("form-edit").addEventListener("submit", async e => {
  e.preventDefault();
  const file = $("e-cv").files[0];
  if (file){
    if (!/\.pdf$/i.test(file.name))  { $("e-cv-error").textContent = "Le CV doit être un fichier PDF."; return; }
    if (file.size > 5 * 1024 * 1024) { $("e-cv-error").textContent = "Le fichier dépasse 5 Mo."; return; }
  }
  try {
    await apiUpdateApplication(currentId, { 
      message: $("e-letter").value.trim(), 
      cvChoice: $("e-cv-choice").value, file });
    applications = await apiLoadApplications();
    $("dlg-edit").close(); render(); toast("Candidature modifiée");
  } catch (err) { fail(err); }
});

$("edit-cancel").onclick = () => $("dlg-edit").close();

$("del-ok").onclick = async () => {
  try {
    await apiDeleteApplication(currentId);
    applications = await apiLoadApplications();
    $("dlg-del").close(); render(); toast("Candidature retirée");
  } catch (err) { fail(err); }
};
$("del-cancel").onclick = () => $("dlg-del").close();
$("filter").addEventListener("change", renderList);

(async () => {
  const user =await initPage();
    if (!user || user.role !== "candidate") { location.href = "login.html"; return; }
  if (typeof initMenu === "function") initMenu(user);
  try { applications = await apiLoadApplications(); } catch (err) { fail(err); applications = []; }
  render();
})();
