from django.db import transaction
from rest_framework import serializers
from .models import User, Company, Ad, Application, Message, Category
import requests
from .password_reset import read_token


# Serializer pour l'inscription

class RegisterSerializer(serializers.Serializer):

    # ----paramètres communs ------
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=12)
    role = serializers.ChoiceField(choices=["candidate", "recruiter"])      # On met pas l'admin ici
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    telephone = serializers.CharField(max_length=30, required=False, allow_blank=True)

    # ---------candidate -------------
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    postal_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    cv = serializers.FileField(required=False, allow_empty_file=False)

    # --- recruteur : son entreprise --- les champs peuvent être vides quand c'est candidat
    company_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    siret = serializers.CharField(max_length=14, required=False, allow_blank=True)
    company_city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    company_postal_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    website = serializers.URLField(max_length=255, required=False, allow_blank=True)

    # Validation des adresses mail
    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Cette adresse mail est déjà utilisée.")
        return value

    # Validation des mots de passe
    def validate_password(self, value):
        if not(any(c.isalpha() for c in value) and any(c.isdigit() for c in value)):
            raise serializers.ValidationError("Le mot de passe doit contenir uniquement des lettres et des chiffres.")
        return value

    # Validation fichier CV
    def validate_cv(self,f):
        if not f.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Le fichier doit être en format pdf.")
        if f.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Le fichier ne doit pas dépasser 5 Mo.")
        if f.read(5) != b"%PDF-":
            raise serializers.ValidationError("Ce fichier n'est pas en format PDF.")
        f.seek(0)   
        return f


    # def pour vérifier si l'entreprise est bien enregistré dans la DB du gouvernement
    @staticmethod 
    def siret_exists(siret):
        try:
            r = requests.get("https://recherche-entreprises.api.gouv.fr/search",
                         params={"q": siret}, timeout=5)
            r.raise_for_status()
        except requests.RequestException:
            return None
        return len(r.json().get("results", [])) > 0
    

    # Validation des certains champs rendus obligatoires selon role
    def validate(self, data):
        if data["role"] == "candidate":
            required = ("city", "postal_code")
        else:
            required = ("company_name", "siret", "company_city", "company_postal_code")

        errors = {f: "Champ obligatoire." for f in required if not data.get(f)}
        if errors:
            raise serializers.ValidationError(errors)

        if data["role"] == "recruiter":
            siret = data["siret"]
            if len(siret) != 14 or not siret.isdigit():
                raise serializers.ValidationError({"siret": "Le numéro SIRET doit contenir 14 chiffres."})
            if Company.objects.filter(siret=siret).exists():
                raise serializers.ValidationError({"siret": "Cette entreprise est déjà inscrite."})
            if self.siret_exists(siret) is False:
                raise serializers.ValidationError({"siret": "Ce numéro SIRET n'existe pas dans la base officielle."})
        return data

    @transaction.atomic
    def create(self, d):
        company = None
        if d["role"] == "recruiter":
            company = Company.objects.create(
                name=d["company_name"], siret=d["siret"],
                city=d["company_city"], postal_code=d["company_postal_code"],
                description=d.get("description", ""), website=d.get("website", ""),
            )
            # le recruteur prend la localisation de son entreprise
            city, postal_code = company.city, company.postal_code
        else:
            city, postal_code = d["city"], d["postal_code"]

        return User.objects.create_user(
            email=d["email"], password=d["password"], role=d["role"],
            first_name=d["first_name"], last_name=d["last_name"],
            telephone=d.get("telephone", ""),
            city=city, postal_code=postal_code, company=company,
            cv=d.get("cv") if d["role"] == "candidate" else None,   # CV ne peut qu'être déposé par les candidats
        )

# Serializer pour annonces                                  ============MODIF===============

class AdSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    company_name = serializers.CharField(source="company.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
 
    class Meta:
        model = Ad
        fields = "__all__"
        # le client ne peut pas choisir ces champs : le serveur les remplit
        read_only_fields = ["status", "company", "recruiter", "created_at", "modified_at"]
 
    def validate(self, data):
        low, high = data.get("monthly_salary_min"), data.get("monthly_salary_max")
        if low is not None and high is not None and high < low:
            raise serializers.ValidationError(
                {"monthly_salary_max": "Le salaire maximum doit être supérieur au minimum."})
        return data

# Serializer pour candidature

class ApplicationSerializer(serializers.ModelSerializer):
    cv = serializers.FileField(required=False, write_only=True)
    use_saved_cv = serializers.BooleanField(default=False, write_only=True)
    cv_download_url = serializers.SerializerMethodField()

    def get_cv_download_url(self, obj):
        return f"/api/applications/{obj.pk}/cv" if obj.cv else None

    def validate_cv(self, value):
        return RegisterSerializer().validate_cv(value)

    def validate(self, data):
        use_saved = data.pop("use_saved_cv", False)
        if use_saved and data.get("cv"):
            raise serializers.ValidationError({"cv": "Choisissez le CV enregistré ou un nouveau fichier."})
        if use_saved:
            user = self.context["request"].user
            if not user.cv or not user.cv.storage.exists(user.cv.name):
                raise serializers.ValidationError({"cv": "Aucun CV enregistré disponible. Ajoutez un PDF."})
            data["cv"] = user.cv.name
        return data

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=150) 

    ad_title = serializers.CharField(source="ad.title", read_only=True)

    company_name = serializers.CharField(source="ad.company.name", read_only=True)
    city = serializers.CharField(source="ad.city", read_only=True)

    class Meta:
        model = Application
        fields = [
            "id", "ad", "ad_title", "company_name", "city", "first_name", "last_name", "email",
            "telephone", "message", "status", "created_at",
            "cv", "use_saved_cv", "cv_download_url",
        ]
        read_only_fields = ["id", "ad", "status", "created_at"]

        
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]       

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "candidate", "ad", "object", "content", "sent_at", "status"]
class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["object", "content"]

class ProfileSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=12)
    current_password = serializers.CharField(write_only=True, required=False)

    # Champs de l'entreprise (recruteur uniquement)
    company_name = serializers.CharField(max_length=150, required=False)
    siret = serializers.CharField(max_length=14, required=False)
    company_city = serializers.CharField(max_length=100, required=False)
    company_postal_code = serializers.CharField(max_length=10, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    website = serializers.URLField(max_length=255, required=False, allow_blank=True)

    # nom du champ envoyé par la page -> nom du champ dans la table Company
    COMPANY_FIELDS = {"company_name": "name", "siret": "siret", "company_city": "city",
                      "company_postal_code": "postal_code", "description": "description",
                      "website": "website"}

    class Meta:
        read_only_fields = ["email"]
        model = User
        fields = ["email", "first_name", "last_name", "telephone", "city",
                  "postal_code", "cv", "password", "current_password",
                  "company_name", "siret", "company_city", "company_postal_code",
                  "description", "website"]

    def validate_cv(self, value):
        return RegisterSerializer().validate_cv(value)

    def validate_siret(self, value):
        if len(value) != 14 or not value.isdigit():
            raise serializers.ValidationError("Le numéro SIRET doit contenir 14 chiffres.")
        if Company.objects.filter(siret=value).exclude(pk=self.instance.company_id).exists():
            raise serializers.ValidationError("Cette entreprise est déjà inscrite.")
        return value

    def validate_password(self, value):
        return RegisterSerializer().validate_password(value)

    def validate(self, data):
        current = data.pop("current_password", None)
        if "password" in data and not (current and self.instance.check_password(current)):
            raise serializers.ValidationError({"current_password": "Mot de passe actuel incorrect."})
        if any(name in data for name in self.COMPANY_FIELDS) and not self.instance.company:
            raise serializers.ValidationError("Ce compte n'est lié à aucune entreprise.")
        return data

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        company_data = {model_name: validated_data.pop(name)
                        for name, model_name in self.COMPANY_FIELDS.items() if name in validated_data}
        user = super().update(instance, validated_data)
        if company_data:
            for attr, value in company_data.items():
                setattr(user.company, attr, value)
            user.company.save()
        if password:
            user.set_password(password)
            user.save()
        return user

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=12)

    def validate_password(self, value):
        return RegisterSerializer().validate_password(value)

    def validate(self, data):
        user = read_token(data["token"])
        if user is None:
            raise serializers.ValidationError({"token": "Ce lien est invalide ou a expiré."})
        data["user"] = user
        return data

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=12)

    def validate_new_password(self, value):
        return RegisterSerializer().validate_password(value)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value