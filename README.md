# Job Board : Talentis

Projet Epitech T-WEB-501 : un site d'offres d'emploi (marque « Talentis »).

- **Back-end** : Django 5.2 + Django REST Framework + MySQL 8, le tout dans Docker.
- **Front-end** : HTML, CSS et JavaScript (sans framework), servi par nginx.
- Le navigateur charge une page HTML. Le JavaScript de la page appelle l'API
  (`fetch`) avec un token, puis affiche la réponse JSON sans recharger la page.

## Lancer le projet avec Docker

Prérequis : Docker et Docker Compose installés.

1. Copier le modèle de réglages : `cp .env.example .env`
2. Ouvrir `.env` et remplacer les `change-me` par ses propres valeurs
   (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY`, `MYSQL_ROOT_PASSWORD`).
   Le fichier `.env` n'est jamais envoyé sur GitHub.
3. Lancer : `docker compose up -d --build`
   (les tables sont créées automatiquement au démarrage du back-end)
4. Remplir la base (une seule fois) : `docker compose exec backend python manage.py seed`
   Cette commande crée les 16 catégories, des entreprises, des offres et des comptes de démo.
   Elle peut être relancée sans créer de doublons.
   Pour remettre les données de démonstration à neuf (statuts, candidatures, noms d'origine) :
   `docker compose exec backend python manage.py seed_demo --reset`.
   Cette commande ne supprime que les données de démonstration, pas les autres comptes.

Adresses :
- API : http://localhost:8000/api/
- Front : http://localhost:5500/main.html

Arrêter : `docker compose stop` (les données restent).
Repartir d'une base vide : `docker compose down -v` (après un `down -v`, refaire l'étape 4).

Si le back-end s'arrête avec `Access denied for user`, la base a été créée avec d'anciens
identifiants (par exemple un `.env` vide) : faire `docker compose down -v` puis relancer.

## Comptes de démo

Mot de passe de tous les comptes : `motdepasse123`

| Rôle | E-mail |
|---|---|
| Candidat | `lea.martin@example.com` |
| Recruteur | `recruiter.decathlon@example.com` |
| Administrateur | `admin@example.com` |

Les mots de passe sont stockés hachés. Ces comptes ne servent qu'à la démonstration.
Une connexion réussie envoie un administrateur vers `espace-admin.html`,
un recruteur vers son espace recruteur et un candidat vers la page des offres.

## Schéma de la base de données

Base MySQL, 6 tables (les `id` sont créés automatiquement par Django).

| Table | Champs principaux | Liens |
|---|---|---|
| `User` | email (unique, sert d'identifiant), mot de passe haché, first_name, last_name, telephone, city, postal_code, role (`candidate`, `recruiter` ou `admin`), cv | `company` → Company (facultatif, pour un recruteur) |
| `Company` | name, siret (14 caractères, unique), description, website, city, postal_code | |
| `Category` | name (unique), slug (unique) | |
| `Ad` (offre) | title, short_description, full_description, city, contract_type, monthly_salary_min / max, working_time, education_level, experience, work_mode, start_time, status (`open` ou `closed`) | `company` → Company, `recruiter` → User, `category` → Category |
| `Application` (candidature) | first_name, last_name, email, telephone, cv, message, status (`sent`, `seen`, `interview`, `rejected`, `accepted`) | `candidate` → User, `ad` → Ad |
| `Message` | object, content, sent_at, status (`unread` ou `read`) | `candidate` → User, `ad` → Ad |

Relations importantes :
- Un candidat ne peut postuler **qu'une fois** par offre (contrainte `unique_candidate_ad`).
- Supprimer un utilisateur supprime ses candidatures, ses messages et ses offres (`CASCADE`).
- On ne peut pas supprimer une entreprise ou une catégorie tant que des offres y sont rattachées (`PROTECT`).
- Si une entreprise est supprimée, les recruteurs rattachés gardent leur compte (`SET_NULL`).

## Routes de l'API

Toutes les routes commencent par `/api/`.
Les routes marquées « connecté » demandent l'en-tête `Authorization: Bearer LE_TOKEN`.
Les erreurs de validation sont renvoyées en français, champ par champ (code 400).

### Comptes
| Méthode | Route | Qui | Rôle |
|---|---|---|---|
| POST | `auth/register` | tout le monde | Créer un compte candidat ou recruteur |
| POST | `auth/login` | tout le monde | Se connecter, renvoie un token |
| GET | `auth/me` | connecté | Profil complet (CV, et entreprise pour un recruteur) |
| PATCH | `auth/me` | connecté | Modifier son profil, son CV (PDF, 5 Mo max) et son entreprise |
| DELETE | `auth/me` | connecté | Supprimer son compte (ses candidatures, messages et offres sont supprimés avec) |
| POST | `auth/logout` | connecté | Se déconnecter |
| POST | `auth/password` | connecté | Changer son mot de passe (`old_password`, `new_password`) |
| POST | `auth/forgot-password` | tout le monde | Demander un lien de réinitialisation par e-mail |
| POST | `auth/reset-password` | tout le monde | Choisir un nouveau mot de passe avec le lien reçu (`token`, `password`) |

Règle des mots de passe : 12 caractères minimum, avec au moins une lettre et un chiffre.

Réinitialisation : en développement, l'e-mail n'est pas envoyé pour de vrai, il s'affiche dans les journaux :
`docker compose logs backend`. Le lien est utilisable une seule fois.

### Offres
| Méthode | Route | Qui | Rôle |
|---|---|---|---|
| GET | `categories` | tout le monde | Liste des catégories (id, name, slug) |
| GET | `ads` | tout le monde | Liste des offres ouvertes. Filtres : `search`, `city`, `contract_type`, `working_time`, `education_level`, `experience`, `work_mode`, `category` (ex. `ads?search=python&city=Paris`) |
| GET | `ads?mine=true` | recruteur | Toutes mes offres, ouvertes et fermées |
| GET | `ads/<id>` | tout le monde | Détail d'une offre ouverte |
| POST | `ads` | recruteur | Créer une offre (`category` = l'id de la catégorie) |
| PUT / PATCH | `ads/<id>` | recruteur propriétaire | Modifier une offre |
| DELETE | `ads/<id>` | recruteur propriétaire | Fermer une offre (elle n'est pas effacée) |

### Candidatures et messages
| Méthode | Route | Qui | Rôle |
|---|---|---|---|
| POST | `ads/<id>/apply` | candidat | Postuler à une offre (une seule fois par offre, CV en PDF facultatif) |
| GET | `candidate/applications` | candidat | Mes candidatures |
| PATCH | `candidate/applications/<id>` | candidat propriétaire | Modifier sa candidature (impossible si acceptée ou refusée) |
| DELETE | `candidate/applications/<id>` | candidat propriétaire | Retirer sa candidature (impossible si acceptée ou refusée) |
| GET | `recruiter/applications` | recruteur | Candidatures reçues sur mes offres |
| PATCH | `applications/<id>/status` | recruteur | Changer le statut (sent, seen, interview, rejected, accepted) |
| GET | `applications/<id>/cv` | candidat ou recruteur concerné | Télécharger le CV |
| POST | `ads/<id>/messages` | candidat | Écrire au recruteur |
| GET | `ads/<id>/messages` | connecté | Messages d'une offre (le recruteur voit tous les messages de son offre, le candidat voit les siens) |
| PATCH | `messages/<id>/read` | recruteur | Marquer un message comme lu |

### Administration
Les routes `admin/companies`, `admin/categories`, `admin/ads`, `admin/applications`,
`admin/messages` et `admin/users` sont réservées aux comptes administrateurs.
Chacune fait le CRUD complet :

| Méthode | Route | Rôle |
|---|---|---|
| GET | `admin/<table>` | Lister (paginé) |
| POST | `admin/<table>` | Créer |
| GET | `admin/<table>/<id>` | Détail |
| PATCH / PUT | `admin/<table>/<id>` | Modifier |
| DELETE | `admin/<table>/<id>` | Supprimer |

Les autres comptes reçoivent 403, les visiteurs non connectés 401.

Pagination : 10 éléments par page par défaut. `?page=2` choisit la page,
`?page_size=50` change la taille (100 maximum). La réponse contient
`count`, `next`, `previous` et `results`.
Pour les utilisateurs, `?search=` cherche dans l'e-mail, le prénom et le nom,
et `?role=candidate|recruiter|admin` filtre par rôle.

## Pages du front

Toutes les pages sont dans `front-end/` et utilisent `js/api.js`
(appels à l'API avec le token, déconnexion automatique si le token est refusé).

| Page | Rôle |
|---|---|
| `main.html` | Liste des offres, filtres, « En savoir plus » (détail affiché sans rechargement) et formulaire « Postuler » |
| `login.html` | Connexion, et demande de lien « mot de passe oublié » |
| `account.html` | Création de compte (candidat ou recruteur) |
| `profile.html` | Modifier son profil, son CV, son mot de passe |
| `reset-password.html` | Choisir un nouveau mot de passe avec le lien reçu |
| `espace-candidate.html` | Espace candidat : mes candidatures et mes messages |
| `espace-recruiter.html` | Espace recruteur : mes offres, candidatures reçues et messages |
| `espace-admin.html` | Espace administrateur : une seule page avec 6 sections (menu à gauche) : tableau de bord, utilisateurs, entreprises, offres, candidatures, messages |

`espace-admin.html` ne s'affiche que pour un compte administrateur.
Les autres sont renvoyés vers la page de connexion. Le détail de l'administration est dans la section suivante.

## Interface d'administration

`espace-admin.html` appelle les routes `admin/...` de l'API. Chaque section a son fichier JavaScript
(`js/admin-*.js`) et le fichier `js/admin-common.js` contient les éléments partagés
(fenêtres de formulaire, messages de confirmation ou d'erreur, chargement des listes).

| Section | Ce que l'administrateur peut faire |
|---|---|
| Tableau de bord | Voir les chiffres réels (utilisateurs, entreprises, offres ouvertes, candidatures) et les derniers enregistrements |
| Utilisateurs | Rechercher (nom, prénom, e-mail), filtrer par rôle, pagination, **ajouter**, **modifier**, **supprimer** |
| Entreprises | Rechercher, pagination, **ajouter**, **modifier**, **supprimer** |
| Offres | Rechercher, filtrer par statut, **ajouter** (en choisissant l'entreprise, le recruteur et la catégorie), **modifier**, fermer ou rouvrir, **supprimer** |
| Candidatures | Filtrer par statut, changer le statut, **supprimer** |
| Messages | Rechercher, **supprimer** |

Protections :
- Un administrateur ne peut pas supprimer son propre compte, ni retirer son propre rôle administrateur.
- Supprimer une entreprise qui a encore des offres est refusé par l'API (erreur 409) : un message explique pourquoi.
- Supprimer une offre supprime aussi ses candidatures (après confirmation).

## Lancer les tests

```
docker compose exec backend python manage.py test
```

La suite contient 60 tests (comptes, offres, candidatures, administration, droits d'accès).

Au premier lancement, MySQL peut refuser la création de la base de test
(`Access denied ... test_jobboard_db`). Il faut alors donner le droit à
`jobboard_user` (à refaire après chaque `docker compose down -v`) :

```
docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON test_jobboard_db.* TO \"jobboard_user\"@\"%\";"'
```

## Organisation du dépôt

```
back-end/     Django (api/models.py, api/views.py, api/admin_api.py, api/serializers.py, api/tests.py)
front-end/    pages HTML, js/ (un fichier par page), style/ (CSS)
docker-compose.yml   3 services : db (MySQL), backend (Django), frontend (nginx)
.env.example  modèle des réglages (copier en .env)
```

## Équipe
Projet réalisé en équipe de 3 à Epitech : Christophe Malet (back-end / API, Docker), [@mengqichenn](https://github.com/mengqichenn) et [@majjoutmeryam6-source](https://github.com/majjoutmeryam6-source).
