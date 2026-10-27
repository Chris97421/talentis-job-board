# Lancer le projet avec Docker

## Avant de commencer
Docker et Docker Compose doivent être installés.

## Démarrage
1. Copier le modèle de réglages : `cp .env.example .env`
2. Ouvrir `.env` et remplacer les `change-me` par vos propres valeurs
3. Lancer le projet : `docker compose up -d --build`
4. Remplir les catégories de départ : `docker compose exec backend python manage.py seed`
5. L'API répond sur http://localhost:8000/api/ads

## Arrêter
- `docker compose stop` : met en pause, les données restent
- `docker compose down` : supprime les conteneurs, les données restent
- `docker compose down -v` : **efface aussi la base de données**
