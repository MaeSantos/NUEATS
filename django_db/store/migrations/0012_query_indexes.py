from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("store", "0011_userprofile_image_url"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="menuitem",
            index=models.Index(fields=["category", "is_available"], name="menu_cat_avail_idx"),
        ),
        migrations.AddIndex(
            model_name="menuitem",
            index=models.Index(fields=["is_available", "stock"], name="menu_avail_stock_idx"),
        ),
        migrations.AddIndex(
            model_name="orderrecord",
            index=models.Index(fields=["created_at"], name="order_created_idx"),
        ),
        migrations.AddIndex(
            model_name="orderrecord",
            index=models.Index(fields=["order_status"], name="order_status_idx"),
        ),
        migrations.AddIndex(
            model_name="orderrecord",
            index=models.Index(fields=["payment_status"], name="order_payment_idx"),
        ),
        migrations.AddIndex(
            model_name="orderrecord",
            index=models.Index(fields=["payment_status", "created_at"], name="order_pay_created_idx"),
        ),
        migrations.AddIndex(
            model_name="orderrecord",
            index=models.Index(fields=["student", "-created_at"], name="order_student_created_idx"),
        ),
    ]
