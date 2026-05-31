from django.db import migrations


def assign_legacy_orders(apps, _schema_editor):
    OrderRecord = apps.get_model("store", "OrderRecord")
    UserProfile = apps.get_model("store", "UserProfile")
    student = UserProfile.objects.filter(student_id="732382772").first()
    if student:
        OrderRecord.objects.filter(student__isnull=True).update(student=student)


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0003_orderrecord_student"),
    ]

    operations = [
        migrations.RunPython(assign_legacy_orders, migrations.RunPython.noop),
    ]
