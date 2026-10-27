// Contrat API : GET/PATCH/DELETE /auth/me et POST /auth/password.
// /auth/me doit renvoyer les champs de l'inscription à plat, ainsi que role.
const $ = id => document.getElementById(id);
const infoForm = $("form-info");
const passForm = $("form-pass");
const dialog = $("dlg-del");
let profile = null;
let busy = false;
let toastTimer;

function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3000);
}

// Créer un message accessible sous chaque champ, sans répéter le HTML.
for (const input of document.querySelectorAll(".accountform input")) {
    let error = $("err-" + input.id);
    if (!error) {
        error = document.createElement("p");
        error.id = "err-" + input.id;
        error.className = "error";
        error.setAttribute("role", "alert");
        input.parentElement.append(error);
    }
    error.hidden = true;
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), error.id].filter(Boolean).join(" "));
    input.addEventListener("input", () => {
        error.textContent = "";
        error.hidden = true;
        input.removeAttribute("aria-invalid");
    });
}

function fieldError(input, message) {
    const error = $("err-" + input.id);
    error.textContent = message;
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
}

function clearErrors(form) {
    form.querySelectorAll(".error").forEach(el => { el.textContent = ""; });
    form.querySelectorAll("input").forEach(el => el.removeAttribute("aria-invalid"));
}

function validate(form) {
    let valid = true;
    for (const input of form.querySelectorAll("input")) {
        if (input.matches(":disabled")) continue;
        if (!input.validity.valid) {
            fieldError(input, input.validationMessage);
            valid = false;
        }
    }
    return valid;
}

function serverError(err, form, fallback) {
    if (err.status === 401) {
        localStorage.removeItem("token");
        location.replace("login.html");
        return;
    }
    let matched = false;
    const other = [];
    for (const [name, messages] of Object.entries(err.data || {})) {
        const input = form?.elements.namedItem(name);
        const message = Array.isArray(messages) ? messages.join(" ") : String(messages);
        if (input?.tagName === "INPUT") {
            fieldError(input, message);
            matched = true;
        } else other.push(message);
    }
    $(fallback).textContent = other.join(" ") || (matched ? "" : "Impossible de terminer la demande. Veuillez réessayer.");
    form?.querySelector('[aria-invalid="true"]')?.focus();
}

function lock(locked) {
    busy = locked;
    document.querySelectorAll(".accountform input, .accountform button, #del-ok, #del-cancel").forEach(el => {
        el.disabled = locked;
    });
}

function fillForm() {
    for (const input of infoForm.querySelectorAll("input[name]")) {
        if (input.type !== "file") input.value = profile[input.name] ?? "";
    }
    for (const role of ["candidate", "recruiter"]) {
        const fieldset = $("fs-" + role);
        fieldset.hidden = fieldset.disabled = profile.role !== role;
    }
    $("cv").value = "";
    $("cv-current").textContent = profile.cv ? "CV actuel : " + profile.cv : "Aucun CV enregistré.";
    applyRole(profile.role);
    initMenu(profile);
    const spaces = {
        candidate: "espace-candidate.html",
        recruiter: "espace-recruiter.html",
        admin: "espace-admin.html",
    };
    $("back-link").href = spaces[profile.role];
}

infoForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !profile) return;
    clearErrors(infoForm);
    if (!validate(infoForm)) {
        infoForm.querySelector('[aria-invalid="true"]')?.focus();
        return;
    }
    const file = $("cv").files[0];
    if (profile.role === "candidate" && file && (!/\.pdf$/i.test(file.name) || file.size > 5 * 1024 * 1024)) {
        fieldError($("cv"), "Choisissez un PDF de 5 Mo maximum.");
        $("cv").focus();
        return;
    }
    const changes = new FormData();
    for (const [name, value] of new FormData(infoForm)) {
        if (value instanceof File) {
            if (value.name) changes.append(name, value);
        } else if (value !== String(profile[name] ?? "")) changes.append(name, value);
    }
    if (!Array.from(changes.keys()).length) return toast("Aucune modification à enregistrer.");
    lock(true);
    try {
        const saved = await api("/auth/me", { method: "PATCH", body: changes, redirectOn401: false });
        // Accepter aussi une réponse 204 ; ne pas perdre les champs inchangés.
        for (const [name, value] of changes) profile[name] = value instanceof File ? value.name : value;
        if (saved && typeof saved === "object") Object.assign(profile, saved);
        fillForm();
        toast("Profil mis à jour.");
    } catch (err) { serverError(err, infoForm, "err-form"); }
    finally { lock(false); }
});

passForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !profile) return;
    clearErrors(passForm);
    let valid = validate(passForm);
    const password = $("new-pass").value;
    if (password.length < 12 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
        fieldError($("new-pass"), "Utilisez au moins 12 caractères, avec des lettres et des chiffres.");
        valid = false;
    }
    if (password !== $("new-pass2").value) {
        fieldError($("new-pass2"), "Les deux mots de passe ne correspondent pas.");
        valid = false;
    }
    if (!valid) return passForm.querySelector('[aria-invalid="true"]')?.focus();
    const body = { old_password: $("old-pass").value, new_password: password };
    lock(true);
    try {
        await api("/auth/password", { method: "POST", body, redirectOn401: false });
        passForm.reset();
        toast("Mot de passe modifié.");
    } catch (err) { serverError(err, passForm, "err-pass"); }
    finally { lock(false); }
});

$("btn-delete").addEventListener("click", () => {
    if (busy || !profile) return;
    $("err-delete").textContent = "";
    dialog.showModal();
    $("del-cancel").focus();
});
$("del-cancel").addEventListener("click", () => dialog.close());
dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
$("del-ok").addEventListener("click", async () => {
    if (busy || !profile) return;
    lock(true);
    let deleted = false;
    try {
        await api("/auth/me", { method: "DELETE", redirectOn401: false });
        deleted = true;
        localStorage.removeItem("token");
        location.replace("main.html");
    } catch (err) { serverError(err, null, "err-delete"); }
    finally { if (!deleted) lock(false); }
});

// Aucune action ne doit être possible avant le chargement du compte.
lock(true);
if (!localStorage.getItem("token")) {
    location.replace("login.html");
} else {
    try {
        profile = await api("/auth/me", { redirectOn401: false });
        if (!profile || !["candidate", "recruiter", "admin"].includes(profile.role)) throw new Error("Profil invalide");
        fillForm();
        lock(false);
    } catch (err) { profile = null; serverError(err, infoForm, "err-form"); }
}
