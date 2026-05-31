from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0005_menuitem"),
    ]

    operations = [
        migrations.AddField(
            model_name="menuitem",
            name="image_url",
            field=models.TextField(blank=True, default=""),
        ),
    ]
