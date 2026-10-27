// script pour faire appeel à l'API pour retourner les annonces dans la base de donnée + filter annonces
let timer;
let currentUser = null;
let currentPage = 1;
let totalPages = 1;
const pageSize = 10;

const previousButton = document.getElementById("main-previous");
const nextButton = document.getElementById("main-next");
const pageInfo = document.getElementById("main-page-info");

function updatePagination() {
    pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
}

const labels = {
    full_time: "Temps plein",
    part_time: "Temps partiel",
    remote: "Télétravail",
    hybrid: "Hybride",
    onsite: "Sur site",
    debutant: "Moins d’un an",
    junior: "1 à 3 ans",
    confirme: "3 à 5 ans",
    senior: "Plus de 5 ans",
};

const educationLabels = {
    bac: "BAC / BAC Pro",
    bac2: "BAC+2",
    bac3: "BAC+3, Licence, Bachelor",
    bac5: "BAC+5, Master, Grande Ecole",
}

async function loadAds() {
    const list = document.querySelector(".ad-list");
    list.textContent = "Chargement des offres...";

    try {
        const params = buildParams();
        params.set("page", currentPage);
        params.set("page_size", pageSize);

        const data = await api("/ads?" + params);

        const ads = data.results || [];
        totalPages = Math.max(1, Math.ceil(data.count / pageSize));
        updatePagination();
        
        const cards = document.createDocumentFragment();

        for (const ad of ads) {
            const card = document.getElementById("template-ad").content.firstElementChild.cloneNode(true);

            card.dataset.id = ad.id;

            card.querySelector(".ad-title").textContent = ad.title;
            card.querySelector(".ad-meta").textContent = [
                ad.company_name,
                ad.city,
                ad.postal_code,
            ].filter(Boolean).join(" · ");

            card.querySelector(".ad-desc").textContent = ad.short_description;

            const tags = card.querySelector(".ad-tags");
            tags.replaceChildren();

            for (const [index, value] of [
                ad.contract_type,
                ad.working_time,
                ad.work_mode,
                ad.experience,
            ].entries()) {
                if (!value) continue;

                const tag = document.createElement("li");
                tag.textContent = labels[value] || value;
                if (index === 0) tag.className = "is-contract";
                tags.append(tag);
            }


            const min = ad.monthly_salary_min;
            const max = ad.monthly_salary_max;
            const euros = value => Number(value).toLocaleString("fr-FR") + " €";

            card.querySelector(".ad-salary").textContent = min != null && max != null
                ? `${euros(min)} à ${euros(max)} / mois`
                : min != null
                        ? `À partir de ${euros(min)} / mois`
                        : max != null
                            ? `Jusqu’à ${euros(max)} / mois`
                            : "Salaire non précisé";
            
            
            const date = card.querySelector(".ad-date");
            date.dateTime = ad.created_at;
            date.textContent = new Date(ad.created_at).toLocaleDateString("fr-FR");

            card.querySelector("[data-apply]").hidden = currentUser?.role !== "candidate";

            const detail = document.getElementById("template-detail").content.firstElementChild.cloneNode(true);

            const values = {
                category_name: ad.category_name,
                company_name: ad.company_name,
                location: [ad.city, ad.postal_code].filter(Boolean).join(" "),
                salary: card.querySelector(".ad-salary").textContent,
                contract_type: ad.contract_type,
                working_time: labels[ad.working_time] || ad.working_time,
                work_mode: labels[ad.work_mode] || ad.work_mode,
                experience: labels[ad.experience] || ad.experience,
                education_level: educationLabels[ad.education_level] || ad.education_level,
                start_time: ad.start_time ? new Date(ad.start_time + "T00:00:00").toLocaleDateString("fr-FR"): "Dès que possible",
                description: ad.full_description,
            }

            detail.querySelectorAll("[data-field]").forEach(element => {
                element.textContent = values[element.dataset.field] || "Non précisé";
            });

            detail.hidden = true;
            card.append(detail);
            cards.append(card);
        }

        list.replaceChildren(cards);

        if (ads.length === 0) {
            list.textContent = "Aucune offre disponible pour le moment.";
        }
    } catch (error) {
        list.textContent = "Impossible de charger les offres : " + error.message;
    }
}




function buildParams() {
    const p = new URLSearchParams();

    const search = document.getElementById("search-form");
    for (const el of search.elements)
        if (el.name && el.value) p.append(el.name, el.value);

    const filters = new FormData(document.getElementById('filters-form'));
    for (const [name, value] of filters) p.append(name, value);

    return p;
}

async function start() {
    currentUser = await initPage();
    await loadAds();
    
}


function resetPageAndLoad(){
    currentPage = 1;
    return loadAds();
}

// "submit" to search + filtres fonctionnent en direct

document.getElementById('search-form').addEventListener('submit', e => { 
    e.preventDefault(); resetPageAndLoad(); 
});

document.getElementById('filters-form').addEventListener('change', resetPageAndLoad);   // cases et radios : en direct


// réinitialiser le filtre

document.getElementById("reset-filter").addEventListener("click", () => {
    document.getElementById("filters-form").reset();
    document.getElementById("search-form").reset();
    resetPageAndLoad();
});

previousButton.addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage --;
    loadAds();
});

nextButton.addEventListener("click", () => {
    if (currentPage >= totalPages) return;
    currentPage ++;
    loadAds();
});

start();