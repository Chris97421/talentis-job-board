from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

User = get_user_model()


def make_token(user):
    """Fabrique le code du lien : 'identifiant.clé'."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return f"{uid}.{default_token_generator.make_token(user)}"


def read_token(token):
    """Renvoie l'utilisateur si le code est bon, sinon None."""
    try:
        uid, key = token.split(".", 1)
        user = User.objects.get(pk=urlsafe_base64_decode(uid).decode())
    except (ValueError, OverflowError, User.DoesNotExist):
        return None
    return user if default_token_generator.check_token(user, key) else None