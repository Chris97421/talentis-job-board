from django.core.management.base import BaseCommand
from api.models import Category
from django.core.management import call_command

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

class Command(BaseCommand):
    help = "Remplit la base avec les catégories de départ"

    def handle(self, *args, **kwargs):
        for category_name in CATEGORIES:
            Category.objects.get_or_create(name=category_name)
        self.stdout.write("Catégories prêtes.")
        call_command("seed_demo")
