from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="orderrecord",
            name="payment_status",
            field=models.CharField(blank=True, default="Pending payment", max_length=30),
        ),
        migrations.AddField(
            model_name="orderrecord",
            name="order_status",
            field=models.CharField(blank=True, default="Queued", max_length=30),
        ),
    ]
