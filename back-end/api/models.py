from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MinLengthValidator

# Create your models here.

# définir les users
class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("L'adresse mail est obligatoire.")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", "admin")
        return self.create_user(email, password, **extra)


# Users table
class User(AbstractUser):

    ROLE_CHOICES = [("candidate", "Candidate"), ("recruiter", "Recruiter"), ("admin", "Admin")]
    
    username = None

    #first_name, last_name, password, created_at déjà inclus

    email = models.EmailField(max_length=150, unique=True)
    telephone = models.CharField(max_length=30, blank=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="candidate")
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=10)
    company = models.ForeignKey("Company", on_delete=models.SET_NULL, null=True, blank=True)  # => premary key de la Company table
    modified_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    cv = models.FileField(upload_to="cv/", blank=True, null=True)      
    # le fichier .pdf stocké dans fichier cv/ et le path enregistré dans la base de donnée

    def __str__(self):
        return self.email


# Company table
class Company(models.Model):        # Django crée automatiquement les IDs
    name = models.CharField(max_length=150)
    siret = models.CharField(max_length=14, validators=[MinLengthValidator(14)], unique=True)        # length fixe
    description = models.TextField(blank=True)
    website = models.URLField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=10)

    created_at = models.DateTimeField(auto_now_add=True)        # se remplisse automatiquement lors de la création
    modified_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name



# Category table                                                                                        ===========rajouté (slug)===========
class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True, null=True)

    class Meta:
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


# Ads table
class Ad(models.Model):
    CONTRACT_CHOICES = [(c, c) for c in ["CDI", "CDD", "Stage", "Alternance", "Interim"]]
    EDUCATION_CHOICES = [("bac", "BAC / BAC Pro"), ("bac2", "BAC+2"), ("bac3", "BAC+3"), ("bac5", "BAC+5")]
    EXPERIENCE_CHOICES = [("debutant", "< 1 an"), ("junior", "1 à 3 ans"),
                          ("confirme", "3 à 5 ans"), ("senior", "> 5 ans")]
    WORK_MODE_CHOICES = [("remote", "Télétravail"), ("hybrid", "Hybride"), ("onsite", "Sur site")]
    WORKING_TIME_CHOICES = [("full_time", "Temps plein"), ("part_time", "Temps partiel")]
    STATUS_CHOICES = [("open", "Ouverte"), ("closed", "Fermée")]

    title = models.CharField(max_length=150)
    short_description = models.CharField(max_length=255)
    full_description = models.TextField()
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=10, blank=True)

    contract_type = models.CharField(max_length=20, choices=CONTRACT_CHOICES)
    monthly_salary_min = models.PositiveIntegerField(null=True, blank=True)
    monthly_salary_max = models.PositiveIntegerField(null=True, blank=True)
    working_time = models.CharField(max_length=100, choices=WORKING_TIME_CHOICES, blank=True)

    # PROTECT pour ne peut pas supprimer la company tant que la company a des annonces associées
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="ads")      # pareil les primary keys de chaque table
    recruiter = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_ads")       
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="ads")

    education_level = models.CharField(max_length=20, choices=EDUCATION_CHOICES, blank=True)
    experience = models.CharField(max_length=20, choices=EXPERIENCE_CHOICES, blank=True)
    start_time = models.DateField(null=True, blank=True)       # vide = dès que possible
    work_mode = models.CharField(max_length=20, choices=WORK_MODE_CHOICES, default="onsite")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="open")
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return self.title


# Application table
class Application(models.Model):
    STATUS_CHOICES = [("sent", "Envoyée"), ("seen", "Vue"), ("interview", "Entretien"),
                      ("rejected", "Refusée"), ("accepted", "Acceptée")]

    candidate = models.ForeignKey(User, on_delete=models.CASCADE, related_name="applications")
    ad = models.ForeignKey(Ad, on_delete=models.CASCADE, related_name="applications")
    first_name = models.CharField(max_length=150, default="")
    last_name = models.CharField(max_length=150, default="")
    email = models.EmailField(max_length=150, default="")
    telephone = models.CharField(max_length=30, blank=True, default="")
    cv = models.FileField(upload_to="cv/", blank=True, null=True)
    message = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="sent")
    created_at = models.DateTimeField(auto_now_add=True)

    # contraints pour empêcher que le candidat postule à la même offre
    class Meta:
        constraints = [
            models.UniqueConstraint(
            fields=["candidate", "ad"],
            name="unique_candidate_ad"
            )
        ]

# Message table
class Message(models.Model):
    STATUS_CHOICES = [("unread", "Non lu"), ("read", "Lu")]

    candidate = models.ForeignKey(User, on_delete=models.CASCADE, related_name="messages")
    ad = models.ForeignKey(Ad, on_delete=models.CASCADE, related_name="messages")
    object = models.CharField(max_length=255)
    content = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="unread")


    

