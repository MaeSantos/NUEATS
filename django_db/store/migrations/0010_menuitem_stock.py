from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("store", "0009_audit_timestamps"),
    ]

    operations = [
        migrations.AddField(
            model_name="menuitem",
            name="stock",
            field=models.PositiveIntegerField(default=50),
        ),
    ]
