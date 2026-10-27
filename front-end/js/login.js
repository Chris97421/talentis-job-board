initPage();

/* ---------- Connexion tous utilisateurs ---------- */

const form = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.hidden = true;
    loginError.textContent = "";

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const data = await api("/auth/login", {
            method: "POST",
            body: { email: email, password: password },
            redirectOn401: false
        });

        localStorage.setItem("token", data.token);

        if (data.user.role === "admin") {
            location.href = "espace-admin.html";
        } else {
            location.href = "main.html";
        }
        

    } catch (err) {
        loginError.textContent = err.status === 401
            ? "Adresse mail ou mot de passe incorrect."
            : "Une erreur est survenue. Veuillez réessayer.";

        loginError.hidden = false;
    }
});

/* ---------- Affichage entre les deux panneaux selon role ---------- */

function showAdmin(show) {
    document.getElementById("panel-user").hidden = show;
    document.getElementById("panel-admin").hidden = !show;
    document.getElementById("nav-user").hidden = show;
    document.getElementById("nav-admin").hidden = !show;
}

document.getElementById("login-admin").addEventListener("click", e => { e.preventDefault(); showAdmin(true); });
document.getElementById("login-user").addEventListener("click", e => { e.preventDefault(); showAdmin(false); });

/* ---------- Connexion administrateur ---------- */

const adminForm = document.getElementById("admin-login-form");
const adminError = document.getElementById("admin-error");

function showAdminError(message) { adminError.textContent = message; adminError.hidden = false; }
function clearAdminError() { adminError.hidden = true; }

adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAdminError();

    const email = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;
    const submitBtn = adminForm.querySelector("button[type='submit']");

    submitBtn.disabled = true;
    submitBtn.textContent = "Connexion...";

    try {
        const data = await api("/auth/login", {
            method: "POST",
            body: { email: email, password: password },
            redirectOn401: false
        });

        localStorage.setItem("token", data.token);
        if (data.user.role !== "admin") {
            // Compte valide mais pas admin : on supprime le token
            await api("/auth/logout", { method: "POST", redirectOn401: false }).catch(() => {});
            localStorage.removeItem("token");
            showAdminError("Accès réservé aux administrateurs.");
            return;
        }

        localStorage.setItem("token", data.token);
        location.href = "espace-admin.html";

    } catch (err) {
        showAdminError(err.status === 401 ? "Adresse mail ou mot de passe incorrect." : "Une erreur est survenue. Veuillez réessayer.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Se connecter";
    }
});