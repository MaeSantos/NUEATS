from decimal import Decimal

from django.db import migrations, models


INITIAL_MENU_ITEMS = [
    {
        "key": 1,
        "name": "Menudo and Rice",
        "description": "Classic pork menudo served with warm steamed rice, cooked in a rich tomato sauce with potatoes, carrots, and spices for a hearty and flavorful meal.",
        "price": 80,
        "category": "Meal",
    },
    {
        "key": 2,
        "name": "Sisig and Rice",
        "description": "Sizzling pork sisig served with warm steamed rice, mixed with onions, spices, and a savory tangy flavor that makes every bite rich, tasty, and satisfying.",
        "price": 95,
        "category": "Meal",
    },
    {
        "key": 3,
        "name": "Adobo and Rice",
        "description": "Tender chicken adobo served with warm steamed rice, cooked in a rich savory sauce with garlic, soy sauce, and spices for a delicious and satisfying meal.",
        "price": 75,
        "category": "Meal",
    },
    {
        "key": 4,
        "name": "Fried Chicken and Rice",
        "description": "Crispy fried chicken served with warm steamed rice, seasoned with flavorful spices and fried to golden perfection for a crunchy and satisfying meal.",
        "price": 85,
        "category": "Meal",
    },
    {
        "key": 5,
        "name": "Karekare and Rice",
        "description": "Traditional kare kare served with bagoong and warm steamed rice, cooked in a rich peanut sauce with tender meat and vegetables for a savory and satisfying meal.",
        "price": 95,
        "category": "Meal",
    },
    {
        "key": 6,
        "name": "French Fries",
        "description": "Golden french fries served with rich tomato ketchup, cooked until crispy on the outside and soft inside for a simple yet satisfying snack.",
        "price": 35,
        "category": "Snack",
    },
    {
        "key": 7,
        "name": "Pancit Canton",
        "description": "A flavorful noodle dish stir-fried with savory sauces, mixed vegetables, and delicious seasonings, creating a rich and satisfying meal in every bite.",
        "price": 45,
        "category": "Snack",
    },
    {
        "key": 8,
        "name": "Tokneneng",
        "description": "Crispy kwek kwek served with flavorful vinegar dip, coated in a crunchy orange batter and fried to perfection for a tasty and satisfying snack.",
        "price": 20,
        "category": "Snack",
    },
    {
        "key": 9,
        "name": "Cheese Stick",
        "description": "A crispy and cheesy snack made with golden-fried wrappers, filled with melted cheese for a rich, savory, and satisfying bite.",
        "price": 15,
        "category": "Snack",
    },
    {
        "key": 10,
        "name": "Dynamite",
        "description": "A spicy and crispy Filipino snack made with chili peppers stuffed with flavorful filling, wrapped in a crunchy lumpia wrapper, and fried to golden perfection.",
        "price": 25,
        "category": "Snack",
    },
    {
        "key": 11,
        "name": "Coca Cola",
        "description": "A refreshing carbonated drink with a distinctive flavor, perfect for quenching your thirst and satisfying your taste buds.",
        "price": 25,
        "category": "Drink",
    },
    {
        "key": 12,
        "name": "Sprite",
        "description": "A refreshing carbonated drink with a distinctive flavor, perfect for quenching your thirst and satisfying your taste buds.",
        "price": 25,
        "category": "Drink",
    },
    {
        "key": 13,
        "name": "Royal",
        "description": "A refreshing carbonated drink with a distinctive flavor, perfect for quenching your thirst and satisfying your taste buds.",
        "price": 25,
        "category": "Drink",
    },
    {
        "key": 14,
        "name": "NesTea",
        "description": "A refreshing carbonated drink with a distinctive flavor, perfect for quenching your thirst and satisfying your taste buds.",
        "price": 25,
        "category": "Drink",
    },
    {
        "key": 15,
        "name": "Halo halo",
        "description": "A refreshing dessert perfect for hot summer days.",
        "price": 55,
        "category": "Drink",
    },
]


def seed_menu_items(apps, _schema_editor):
    MenuItem = apps.get_model("store", "MenuItem")
    for item in INITIAL_MENU_ITEMS:
        MenuItem.objects.update_or_create(
            key=item["key"],
            defaults={
                "name": item["name"],
                "description": item["description"],
                "price": Decimal(str(item["price"])),
                "category": item["category"],
                "is_available": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0004_assign_legacy_orders"),
    ]

    operations = [
        migrations.CreateModel(
            name="MenuItem",
            fields=[
                ("key", models.PositiveIntegerField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                ("price", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "category",
                    models.CharField(
                        choices=[("Meal", "Meal"), ("Snack", "Snack"), ("Drink", "Drink")],
                        max_length=30,
                    ),
                ),
                ("is_available", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["key"],
            },
        ),
        migrations.RunPython(seed_menu_items, migrations.RunPython.noop),
    ]
