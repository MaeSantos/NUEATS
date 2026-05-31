from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0002_orderrecord_status_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="orderrecord",
            name="student",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="orders",
                to="store.userprofile",
            ),
        ),
    ]
