from django.core.management.base import BaseCommand
from api.models import User, Company, Ad, Application, Category, Message

from datetime import date
from django.db import transaction
from django.utils.text import slugify

TEST_PASSWORD = "motdepasse123"

CATEGORIES = [
    "Informatique et numérique",
    "Administration et gestion",
    "Commerce et vente",
    "Marketing et communication",
    "Finance, banque et comptabilité",
    "Ressources humaines",
    "Santé et services sociaux",
    "Éducation et formation",
    "Industrie et production",
    "Logistique et transport",
    "Tourisme et hôtellerie",
    "Agriculture",
    "BTP et construction",
    "Juridique et droit",
    "Création et design",
    "Autres",
]

# 10 entreprises réelles

COMPANIES = [
    dict(siret="30613890001294", name="Decathlon (demo)", city="Villeneuve-d'Ascq", postal_code="59650",
         website="https://www.decathlon.fr",
         description="Distributeur et concepteur d'articles de sport, avec des magasins dans toute la France."),
    
    dict(siret="85520050700017", name="Michelin (demo)", city="Clermont-Ferrand", postal_code="63000",
         website="https://www.michelin.fr",
         description="Fabricant de pneumatiques, dont le siège historique est à Clermont-Ferrand."),
    
    dict(siret="42091691800048", name="Airbus Operations (demo)", city="Toulouse", postal_code="31300",
         website="https://www.airbus.com",
         description="Constructeur aéronautique : conception et assemblage d'avions commerciaux à Toulouse."),
    
    dict(siret="35355586500073", name="Ubisoft Montpellier (demo)", city="Castelnau-le-Lez", postal_code="34170",
         website="https://www.ubisoft.com",
         description="Studio de développement de jeux vidéo situé à Castelnau-le-Lez, près de Montpellier."),
    
    dict(siret="42476141900045", name="OVHcloud (demo)", city="Roubaix", postal_code="59100",
         website="https://www.ovhcloud.com",
         description="Fournisseur européen de services cloud : serveurs, hébergement et infrastructures."),
    
    dict(siret="38456094200045", name="Leroy Merlin France (demo)", city="Lezennes", postal_code="59260",
         website="https://www.leroymerlin.fr",
         description="Enseigne de bricolage, de jardinage et d'aménagement de l'habitat."),
    
    dict(siret="63201210000012", name="L'Oréal (demo)", city="Paris", postal_code="75008",
         website="https://www.loreal.com",
         description="Groupe de cosmétique présent dans la beauté, le soin et la coiffure."),
    
    dict(siret="51903758414786", name="SNCF Voyageurs (demo)", city="Saint-Denis", postal_code="93210",
         website="https://www.sncf-voyageurs.com",
         description="Transporteur ferroviaire de voyageurs : TGV, Intercités, TER et Transilien."),
    
    dict(siret="55212022200013", name="Société Générale (demo)", city="Paris", postal_code="75009",
         website="https://www.societegenerale.com",
         description="Groupe bancaire proposant des services aux particuliers, entreprises et institutions."),
    
    dict(siret="40217165600018", name="Le Creuset (demo)", city="Fresnoy-le-Grand", postal_code="02230",
         website="https://www.lecreuset.fr",
         description="Fabricant de cocottes en fonte émaillée et d'articles de cuisine, installé dans l'Aisne."),

]

# Utilisateurs fictifs

RECRUITERS = [
    ("recruiter.decathlon@example.com", "Camille", "Durand", "0320000001"),
    ("recruiter.michelin@example.com", "Julien", "Moreau", "0473000002"),
    ("recruiter.airbus@example.com", "Nadia", "Benali", "0561000003"),
    ("recruiter.ubisoft@example.com", "Thomas", "Garnier", "0467000004"),
    ("recruiter.ovh@example.com", "Élodie", "Roux", "0320000005"),
    ("recruiter.leroymerlin@example.com", "Karim", "Haddad", "0320000006"),
    ("recruiter.loreal@example.com", "Claire", "Fontaine", "0140000007"),
    ("recruiter.sncf@example.com", "Maxime", "Lefort", "0155000008"),
    ("recruiter.societegenerale@example.com", "Inès", "Caron", "0142000009"),
    ("recruiter.lecreuset@example.com", "Paul", "Marchand", "0323000010"),
]

CANDIDATES = [
    ("lea.martin@example.com", "Léa", "Martin", "0601020304", "Montpellier", "34000"),
    ("hugo.petit@example.com", "Hugo", "Petit", "0605060708", "Paris", "75011"),
    ("sara.lopez@example.com", "Sara", "Lopez", "0611223344", "Toulouse", "31000"),
    ("yanis.bernard@example.com", "Yanis", "Bernard", "0622334455", "Lyon", "69003"),
    ("manon.dubois@example.com", "Manon", "Dubois", "0633445566", "Bordeaux", "33000"),
    ("lucas.robert@example.com", "Lucas", "Robert", "0644556677", "Nantes", "44000"),
    ("chloe.richard@example.com", "Chloé", "Richard", "0655667788", "Lille", "59000"),
    ("nathan.simon@example.com", "Nathan", "Simon", "0666778899", "Marseille", "13001"),
    ("emma.laurent@example.com", "Emma", "Laurent", "0677889900", "Angers", "49000"),
    ("adam.michel@example.com", "Adam", "Michel", "0688990011", "Strasbourg", "67000"),
]

# 10 annoncesc fictives
ADS = [
    dict(title="Vendeur(se) week-end - Rayon cycle", category="Commerce et vente",
         short_description="Conseillez nos clients et participez à la vie du magasin les week-ends.",
         full_description=(
             "Au sein du rayon cycle, vous accueillez et conseillez les clients, mettez en rayon les produits "
             "et participez à l'animation du magasin.\n\n"
             "Missions : conseil et vente, encaissement, mise en rayon, entretien de l'espace de vente.\n"
             "Profil : niveau Bac, goût du contact client, passion du sport appréciée. Débutant accepté.\n"
             "Avantages : remise sur les articles de sport, formation produit, horaires planifiés à l'avance."),
         contract_type="CDD", working_time="part_time", work_mode="onsite",
         education_level="bac", experience="debutant",
         monthly_salary_min=900, monthly_salary_max=1100, start_time=date(2026, 11, 7)),
    
    dict(title="Responsable amélioration continue - Usine", category="Industrie et production",
         short_description="Pilotez la performance industrielle d'un site de fabrication de pneumatiques.",
         full_description=(
             "Vous animez la démarche d'amélioration continue d'un atelier de production : réduction des pertes, "
             "sécurité, qualité et productivité.\n\n"
             "Missions : analyser les indicateurs, conduire des chantiers lean, former et encadrer les équipes.\n"
             "Profil : Bac+5 en ingénierie industrielle, plus de 5 ans d'expérience en production, leadership.\n"
             "Avantages : intéressement, mutuelle, mobilité interne vers d'autres sites du groupe."),
         contract_type="CDI", working_time="full_time", work_mode="onsite",
         education_level="bac5", experience="senior",
         monthly_salary_min=4200, monthly_salary_max=5000, start_time=date(2027, 1, 11)),
    
    dict(title="Alternance - Data analyst qualité de production", category="Informatique et numérique",
         short_description="Exploitez les données de la chaîne d'assemblage pour suivre la qualité.",
         full_description=(
             "Au sein de l'équipe qualité, vous analysez les données issues des lignes d'assemblage pour détecter "
             "des écarts et proposer des actions correctives.\n\n"
             "Missions : tableaux de bord, requêtes SQL, automatisation de rapports en Python, présentation aux équipes.\n"
             "Profil : Bac+4/5 en data ou ingénierie, bases de SQL et de Python, rigueur.\n"
             "Rythme : alternance de 12 à 24 mois, rémunération selon le barème de l'alternance."),
         contract_type="Alternance", working_time="full_time", work_mode="hybrid",
         education_level="bac5", experience="debutant",
         monthly_salary_min=1200, monthly_salary_max=1500, start_time=date(2026, 12, 1)),
    
    dict(title="Game artist 3D", category="Création et design",
         short_description="Créez des personnages et des décors 3D pour un jeu en développement.",
         full_description=(
             "Au sein d'une équipe pluridisciplinaire, vous modélisez, texturez et intégrez des éléments 3D "
             "(personnages, accessoires, environnements) dans le moteur du jeu.\n\n"
             "Missions : modélisation, texturing, optimisation, retours avec les directeurs artistiques.\n"
             "Profil : Bac+3 en arts numériques ou jeu vidéo, maîtrise de Blender/Maya et ZBrush, portfolio indispensable.\n"
             "Avantages : 2 jours de télétravail, mutuelle, budget formation."),
         contract_type="CDI", working_time="full_time", work_mode="hybrid",
         education_level="bac3", experience="junior",
         monthly_salary_min=2500, monthly_salary_max=3100, start_time=date(2027, 1, 18)),
    
    dict(title="Développeur(se) back-end - Infrastructure cloud", category="Informatique et numérique",
         short_description="Concevez les API qui pilotent les serveurs et les services cloud.",
         full_description=(
             "Au sein d'une équipe produit, vous développez des services back-end qui automatisent la gestion "
             "d'infrastructures : provisionnement, facturation, supervision.\n\n"
             "Missions : API REST, tests automatisés, revues de code, mise en production continue.\n"
             "Profil : Bac+5 en informatique, Python ou Go, bases de données relationnelles, culture DevOps.\n"
             "Avantages : télétravail complet possible, matériel au choix, budget formation."),
         contract_type="CDI", working_time="full_time", work_mode="remote",
         education_level="bac5", experience="junior",
         monthly_salary_min=3300, monthly_salary_max=4000, start_time=date(2027, 1, 4)),
    
    dict(title="Chargé(e) de recrutement", category="Ressources humaines",
         short_description="Recrutez les futurs collaborateurs de nos magasins et de nos équipes support.",
         full_description=(
             "Vous prenez en charge le recrutement de profils variés : rédaction des annonces, présélection, "
             "entretiens et accompagnement des managers.\n\n"
             "Missions : sourcing, entretiens, suivi des candidatures, reporting.\n"
             "Profil : Bac+3 en ressources humaines, première expérience en recrutement, sens du relationnel.\n"
             "Avantages : télétravail partiel, participation, prime d'intéressement."),
         contract_type="CDD", working_time="full_time", work_mode="hybrid",
         education_level="bac3", experience="junior",
         monthly_salary_min=2300, monthly_salary_max=2700, start_time=date(2026, 12, 7)),
    
    dict(title="Stage - Assistant(e) chef de produit marketing", category="Marketing et communication",
         short_description="Stage de 6 mois pour accompagner le lancement de nouveaux produits de soin.",
         full_description=(
             "Vous assistez l'équipe marketing dans le lancement de produits : analyse du marché, suivi des "
             "campagnes, coordination avec les agences et les équipes commerciales.\n\n"
             "Profil : Bac+4/5 en école de commerce ou marketing, aisance avec Excel et PowerPoint, curiosité.\n"
             "Gratification de stage mensuelle, remise sur les produits du groupe."),
         contract_type="Stage", working_time="full_time", work_mode="hybrid",
         education_level="bac5", experience="debutant",
         monthly_salary_min=1100, monthly_salary_max=1100, start_time=date(2027, 2, 1)),
    
    dict(title="Gestionnaire de planification du matériel roulant", category="Logistique et transport",
         short_description="Planifiez l'affectation des trains et la maintenance du matériel.",
         full_description=(
             "Vous organisez l'affectation du matériel roulant aux circulations et coordonnez les opérations "
             "de maintenance avec les ateliers et les équipes de conduite.\n\n"
             "Missions : planification quotidienne, gestion des aléas, suivi des indicateurs de régularité.\n"
             "Profil : Bac+2 en logistique ou transport, rigueur, réactivité, aisance avec les outils informatiques.\n"
             "Avantages : avantages de circulation, mutuelle, évolution interne."),
         contract_type="CDI", working_time="full_time", work_mode="onsite",
         education_level="bac2", experience="junior",
         monthly_salary_min=2200, monthly_salary_max=2700, start_time=date(2027, 1, 4)),
    
    dict(title="Analyste risques crédit", category="Finance, banque et comptabilité",
         short_description="Évaluez le risque de crédit des dossiers de financement entreprises.",
         full_description=(
             "Au sein de la direction des risques, vous analysez la solvabilité des clients entreprises et "
             "formulez des avis sur les demandes de financement.\n\n"
             "Missions : analyse financière, notation, rédaction de synthèses, suivi des portefeuilles.\n"
             "Profil : Bac+5 en finance ou économie, 3 à 5 ans d'expérience en banque, excellente maîtrise d'Excel.\n"
             "Avantages : télétravail partiel, intéressement, plan d'épargne entreprise."),
         contract_type="CDI", working_time="full_time", work_mode="hybrid",
         education_level="bac5", experience="confirme",
         monthly_salary_min=3200, monthly_salary_max=3900, start_time=date(2027, 2, 15)),
    
    dict(title="Opérateur(trice) de fonderie - Intérim", category="Industrie et production",
         short_description="Mission d'intérim en atelier de fonderie : coulée, démoulage et contrôle.",
         full_description=(
             "Vous participez à la fabrication de pièces en fonte : préparation des moules, coulée, démoulage "
             "et contrôle visuel de la qualité.\n\n"
             "Profil : niveau Bac pro ou expérience en production, goût du travail manuel, respect des consignes de sécurité.\n"
             "Mission de 3 mois renouvelable, travail en équipes, équipements de protection fournis."),
         contract_type="Interim", working_time="full_time", work_mode="onsite",
         education_level="bac", experience="debutant",
         monthly_salary_min=1800, monthly_salary_max=2100, start_time=date(2026, 11, 2)),
]


# Candidatures (2/candidats)
APPLICATIONS = [
    ("lea.martin@example.com", 3, "Passionnée de jeu vidéo, je vous joins mon portfolio de modélisation 3D.", "seen"),
    ("lea.martin@example.com", 4, "Étudiante en informatique, l'infrastructure cloud est un domaine qui m'attire beaucoup.", "interview"),
    ("hugo.petit@example.com", 4, "Je développe en Python et en Go depuis deux ans, notamment sur des API REST.", "sent"),
    ("hugo.petit@example.com", 8, "Diplômé en finance, je souhaite rejoindre votre équipe d'analyse des risques.", "sent"),
    ("sara.lopez@example.com", 2, "Je recherche une alternance en data dans l'aéronautique, à Toulouse.", "interview"),
    ("sara.lopez@example.com", 6, "Intéressée par le marketing de la beauté, je suis disponible dès février.", "sent"),
    ("yanis.bernard@example.com", 8, "J'ai trois ans d'expérience en analyse de crédit en banque régionale.", "seen"),
    ("yanis.bernard@example.com", 2, "Les données de production m'intéressent ; je maîtrise SQL et Python.", "sent"),
    ("manon.dubois@example.com", 6, "Étudiante en école de commerce, je souhaite effectuer mon stage de fin d'études chez vous.", "accepted"),
    ("manon.dubois@example.com", 5, "J'aimerais mettre mon expérience du recrutement au service de vos équipes.", "seen"),
    ("lucas.robert@example.com", 1, "Ingénieur en génie industriel, j'ai piloté plusieurs chantiers lean en usine.", "rejected"),
    ("lucas.robert@example.com", 9, "Disponible immédiatement pour une mission d'intérim en production.", "accepted"),
    ("chloe.richard@example.com", 5, "Diplômée en ressources humaines, je souhaite poursuivre dans le recrutement.", "interview"),
    ("chloe.richard@example.com", 0, "Je cherche un emploi à temps partiel le week-end à Villeneuve-d'Ascq.", "seen"),
    ("nathan.simon@example.com", 7, "Titulaire d'un BTS transport-logistique, je souhaite évoluer vers la planification.", "sent"),
    ("nathan.simon@example.com", 1, "Ingénieur avec une première expérience en amélioration continue en usine.", "sent"),
    ("emma.laurent@example.com", 0, "Sportive et disponible le week-end, je serais ravie de conseiller vos clients.", "accepted"),
    ("emma.laurent@example.com", 6, "Je suis très motivée par le marketing des produits de beauté.", "sent"),
    ("adam.michel@example.com", 4, "Je travaille sur des projets back-end depuis deux ans et souhaite évoluer vers le cloud.", "seen"),
    ("adam.michel@example.com", 3, "Je suis aussi infographiste 3D en parallèle de mes études.", "sent"),
]

class Command(BaseCommand):
    help = "Remplit la base avec des données de démo (relançable sans doublons)."
 
    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Supprime d'abord les données de démo avant de les recréer.",
        )
 
    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            self.reset()
 
        companies = self.create_companies()
        categories = self.create_categories()
        recruiters = self.create_recruiters(companies)
        candidates = self.create_candidates()
        self.create_admin()
        ads = self.create_ads(companies, recruiters, categories)
        self.create_applications(ads, candidates)
 
        self.stdout.write(self.style.SUCCESS("Base remplie avec les données de démo."))
        self.stdout.write(f"Admin     : admin@example.com / {TEST_PASSWORD}")
        self.stdout.write(f"Recruteur : {RECRUITERS[0][0]} / {TEST_PASSWORD}")
        self.stdout.write(f"Candidat  : {CANDIDATES[0][0]} / {TEST_PASSWORD}")
 
    # ------------------------------------------------------------------ reset
    def reset(self):
        """Supprime uniquement les données du seed (actuelles), pas les autres comptes."""
        sirets = [c["siret"] for c in COMPANIES]
        emails = (
            ["admin@example.com"]
            + [r[0] for r in RECRUITERS]
            + [c[0] for c in CANDIDATES]
        )
        # Ad.company est en PROTECT : on supprime les annonces avant les entreprises.
        # Les candidatures partent en cascade avec les annonces et les utilisateurs.
        Ad.objects.filter(company__siret__in=sirets).delete()
        User.objects.filter(email__in=emails).delete()
        Company.objects.filter(siret__in=sirets).delete()
        self.stdout.write("Anciennes données de démo supprimées.")
 
    # ---------------------------------------------------------------- builders
    def create_companies(self):
        return [
            Company.objects.get_or_create(siret=d["siret"], defaults=d)[0]
            for d in COMPANIES
        ]
 
    def create_categories(self):
        return {
            name: Category.objects.get_or_create(
                name=name, defaults={"slug": slugify(name)}
            )[0]
            for name in CATEGORIES
        }
 
    def make_user(self, email, **fields):
        user, created = User.objects.get_or_create(email=email, defaults=fields)
        if created:
            user.set_password(TEST_PASSWORD)  # le mot de passe est hashé
            user.save()
        return user
 
    def create_admin(self):
        return self.make_user(
            "admin@example.com", first_name="Admin", last_name="Root",
            role="admin", is_staff=True, is_superuser=True,
            city="Montpellier", postal_code="34000",
        )
 
    def create_recruiters(self, companies):
        return [
            self.make_user(
                email, first_name=first, last_name=last, telephone=phone,
                role="recruiter", company=company,
                city=company.city, postal_code=company.postal_code,
            )
            for (email, first, last, phone), company in zip(RECRUITERS, companies)
        ]
 
    def create_candidates(self):
        return {
            email: self.make_user(
                email, first_name=first, last_name=last, telephone=phone,
                role="candidate", city=city, postal_code=postal_code,
            )
            for email, first, last, phone, city, postal_code in CANDIDATES
        }
 
    def create_ads(self, companies, recruiters, categories):
        ads = []
        for data, company, recruiter in zip(ADS, companies, recruiters):
            fields = dict(data)
            fields["category"] = categories[fields["category"]]
            fields.update(
                company=company,
                recruiter=recruiter,
                city=company.city,
                postal_code=company.postal_code,
                status="open",
            )
            ad, _ = Ad.objects.get_or_create(
                title=fields["title"], company=company, defaults=fields
            )
            ads.append(ad)
        return ads
 
    def create_applications(self, ads, candidates):
        for email, ad_index, message, status in APPLICATIONS:
            candidate = candidates[email]

            application, _ = Application.objects.get_or_create(
                candidate=candidate,
                ad=ads[ad_index],
                defaults=dict(
                    first_name=candidate.first_name,
                    last_name=candidate.last_name,
                    email=candidate.email,
                    telephone=candidate.telephone,
                    message=message,
                    status=status,
                ),
            )

            Message.objects.get_or_create(
                candidate=candidate,
                ad=application.ad,
                object=f"Candidature : {application.ad.title}"[:255],
                content=application.message,
                defaults={"status": "unread"},
            )


