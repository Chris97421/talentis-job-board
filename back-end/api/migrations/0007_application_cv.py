from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("api", "0006_category_slug_application_unique_candidate_ad")]
    operations = [
        migrations.AddField(
            model_name="application", name="cv",
            field=models.FileField(upload_to="cv/", blank=True, null=True),
        ),
    ]
