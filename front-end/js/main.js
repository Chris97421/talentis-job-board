// click sur boutons "En savoir plus" et "postuler" pour afficher les contenus cachés
document.addEventListener("click", async e => {
    const btn = e.target.closest('[data-more], [data-apply], [data-cancel]');
    if (!btn) return;
    const card = btn.closest('.ad');
    const action = btn.hasAttribute('data-more') ? 'detail' : 'apply';
    const cls = '.ad-' + action;
    let panel = card.querySelector(cls)
    
    if (btn.hasAttribute('data-cancel')) {
        panel.hidden = true;
    } else if (!panel) {
        card.append(document.getElementById('template-' + action).content.cloneNode(true));
        panel = card.querySelector(cls);
    } else {
        panel.hidden = !panel.hidden;
    }
    const trigger = card.querySelector(action === "detail" ? '[data-more]' : '[data-apply]');
    trigger.setAttribute('aria-expanded', !panel.hidden);
    if (action === "apply" && !panel.hidden) {
        try {
            const user = await api("/auth/me", { redirectOn401: false });
            const saved = panel.querySelector('option[value="saved"]');
            saved.disabled = !user.cv_name;
            saved.textContent = user.cv_name ? `Utiliser mon CV : ${user.cv_name}` : "Aucun CV enregistré";
            if (!panel.dataset.cvInitialized) {
                panel.querySelector('[name="cv_choice"]').value = user.cv_name ? "saved" : "none";
                panel.dataset.cvInitialized = "true";
            }
        } catch (err) {
            panel.querySelector('option[value="saved"]').textContent = "CV enregistré indisponible";
        }
    }
});


// <select> avec choix pour charger le cv
document.addEventListener("change", e => {
    if (!e.target.matches('[name="cv_choice"]')) return;
    const form = e.target.closest("form");
    const upload = form.querySelector('[name="cv"]');
    const isNew = e.target.value === "new";
    upload.disabled = !isNew;
    upload.required = isNew;
    form.querySelector("label.cv-upload").hidden = !isNew;
});



// submit pour envoyer la candidature
document.addEventListener("submit", async e => { 
    if (!e.target.matches(".ad-apply")) return;
    e.preventDefault(); 
    const form = e.target;
    const adId = form.closest(".ad").dataset.id;
    const button = form.querySelector('[type="submit"]');
    const body = new FormData(form);
    const choice = body.get("cv_choice");
    body.delete("cv_choice");
    body.set("use_saved_cv", choice === "saved" ? "true" : "false");
    if (choice !== "new") body.delete("cv");

    button.disabled = true;

    try {
        await api(`/ads/${adId}/apply`, {
            method: "POST",
            body,
            redirectOn401: false
        });

        alert("Votre candidature a bien été envoyée.");
        form.reset();
        form.querySelector('[name="cv_choice"]').dispatchEvent(new Event("change", { bubbles: true }));
    } catch (err) {
        alert(
            err.status === 401 
                ? "Connectez-vous pour postuler."
                : err.message
        );
    } finally {
        button.disabled = false;
    }
    
});


// Publier une annonce (réservé aux recruteurs)
const publishDialog = document.getElementById('publish-dialog');
const publishForm = document.getElementById('publish-form');
const publishError = document.getElementById('publish-error');

// Catégories
document.getElementById('p-category').innerHTML = [...document.querySelectorAll('#category option')]
    .filter(o => o.value)
    .map(o => `<option value="${o.value}">${o.textContent}</option>`).join('');

document.getElementById('open-publish').addEventListener('click', () => {
    publishError.hidden = true;
    publishDialog.showModal();      // ouvre la fenêtre : fond grisé, Échap pour fermer
});

// Ferme avec un bouton [data-close] ou en cliquant sur le fond grisé
publishDialog.addEventListener('click', e => {
    if (e.target === publishDialog || e.target.closest('[data-close]')) publishDialog.close();
});
publishDialog.addEventListener('close', () => publishForm.reset());

publishForm.addEventListener('submit', async e => {
    e.preventDefault();
    publishError.hidden = true;

    const data = Object.fromEntries(new FormData(publishForm));
    ['monthly_salary_min', 'monthly_salary_max', 'start_time'].forEach(k => { if (data[k] === '') data[k] = null; });

    const btn = publishForm.querySelector('[type=submit]');
    btn.disabled = true;
    try {
        await api('/ads', { method: 'POST', body: data });
        publishDialog.close();
        await loadAds();
    } catch (ex) {
        publishError.textContent = (ex.errors ? Object.values(ex.errors).flat() : [ex.message]).join(' ');
        publishError.hidden = false;
    } finally {
        btn.disabled = false;
    }
});


