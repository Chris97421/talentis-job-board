const emailForm = document.getElementById("forgot-password-form");
const resetForm = document.getElementById("new-password-form");
const email = document.getElementById("email");
const password = document.getElementById("new-password");
const confirmation = document.getElementById("confirm-password");
const token = new URLSearchParams(location.search).get("token")?.trim() || "";

// Le serveur vérifiera le token ; ici, on choisit seulement le formulaire.
emailForm.hidden = Boolean(token);
resetForm.hidden = !token;

// Gestion commune : validation, message, bouton et appel API.
function handleForm(form, path, getData, successMessage) {
    const message = form.querySelector('[role="status"]');
    const button = form.querySelector('button[type="submit"]');
    let completed = false;

    form.addEventListener("input", () => {
        if (completed) return;
        message.hidden = true;
        form.querySelectorAll("input").forEach(input => input.setCustomValidity(""));
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (button.disabled) return;
        message.hidden = true;

        const body = getData();
        if (!form.reportValidity()) return;
        if (form === resetForm && !token) {
            message.textContent = "Veuillez ouvrir le lien reçu par mail.";
            message.className = "notice error";
            message.hidden = false;
            return;
        }

        button.disabled = true;
        try {
            await api(path, { method: "POST", body, redirectOn401: false });
            message.textContent = successMessage;
            message.className = "notice";
            if (form === resetForm) {
                completed = true;
                form.reset();
                setTimeout(() => location.replace("login.html"), 1500);   //renvoie à la page login
            }
        } catch (err) {
            message.textContent = "Impossible d’envoyer la demande. Veuillez réessayer.";
            if (err.status === 429) {
                message.textContent = "Trop de demandes. Veuillez réessayer plus tard.";
            } else if (form === resetForm && [400, 401, 403, 410].includes(err.status)) {
                message.textContent = "Demande refusée : lien invalide ou expiré, ou mot de passe non accepté.";
            }
            message.className = "notice error";
        } finally {
            message.hidden = false;
            button.disabled = completed;
        }
    });
}

handleForm(emailForm, "/auth/forgot-password", () => {
    email.value = email.value.trim();
    return { email: email.value };
}, "Si un compte correspond à cette adresse, un lien de réinitialisation vous a été envoyé.");

handleForm(resetForm, "/auth/reset-password", () => {
    const validPassword = password.value.length >= 12
        && /\p{L}/u.test(password.value) && /\d/.test(password.value);

    password.setCustomValidity(validPassword ? "" :
        "Le mot de passe doit contenir au moins 12 caractères, avec des lettres et des chiffres.");
    confirmation.setCustomValidity(password.value === confirmation.value ? "" :
        "Les deux mots de passe ne correspondent pas.");

    return { token, password: password.value };
}, "Votre mot de passe a été modifié. Redirection vers la connexion…");
