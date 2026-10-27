(function () {
const NAME = "cookie_consent";

function readChoice() {
    const cookies = document.cookie.split("; ");
    const found = cookies.find(c => c.startsWith(NAME + "="));
    return found ? found.split("=")[1] : null;
}

function saveChoice(value) {
    document.cookie = `${NAME}=${value}; max-age=31536000; path=/; SameSite=Lax`;
}

function showBanner() {
    const banner = document.createElement("div");
    banner.textContent = "Ce site utilise des cookies pour fonctionner.";
    banner.style.cssText = "position: fixed; bottom: 0; left: 0; right: 0; padding: 16px; background: #1f2937; color: white; display: flex; gap: 12px; align-items: center; justify-content: center; z-index: 1000;";
    const accept = document.createElement("button"); 
    accept.textContent = "Accepter";
    accept.style.cssText = "padding: 8px 16px; border: none; border-radius: 6px; background: #22c55e; color: white; cursor: pointer;";
    accept.addEventListener("click", () => {
        saveChoice("accepted");
        banner.remove();       
    });
    const refuse = document.createElement("button");
    refuse.textContent = "Refuser";
    refuse.style.cssText = "padding: 8px 16px; border: none; border-radius: 6px; background: #6b7280; color: white; cursor: pointer;";
    refuse.addEventListener("click", () => {
        saveChoice("refused");
        banner.remove();
    }); 
    banner.append(accept, refuse);
    document.body.append(banner);
}

if (readChoice() === null) {
    showBanner();
}
})();