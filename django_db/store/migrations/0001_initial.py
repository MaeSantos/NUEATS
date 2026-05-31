from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("student_id", models.CharField(max_length=50, primary_key=True, serialize=False)),
                ("name", models.CharField(blank=True, default="", max_length=255)),
                ("phone", models.CharField(blank=True, default="", max_length=50)),
                ("password", models.CharField(blank=True, default="", max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name="OrderRecord",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("items_json", models.JSONField(default=list)),
                ("total", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "payment_method",
                    models.CharField(
                        choices=[("gcash", "GCash"), ("maya", "Maya"), ("cash", "Cash")],
                        max_length=20,
                    ),
                ),
                ("payment_info", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="SessionToken",
            fields=[
                ("token", models.CharField(max_length=255, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="store.userprofile",
                    ),
                ),
            ],
        ),
    ]
