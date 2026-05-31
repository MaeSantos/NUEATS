from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    student_id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    password = models.CharField(max_length=255, blank=True, default="")
    is_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def to_dict(self):
        return {
            "studentId": self.student_id,
            "name": self.name,
            "phone": self.phone,
            "password": self.password,
            "isAdmin": self.is_admin,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class SessionToken(models.Model):
    token = models.CharField(max_length=255, primary_key=True)
    student = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="sessions")
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            "token": self.token,
            "studentId": self.student_id,
            "createdAt": self.created_at.isoformat(),
        }


class MenuItem(models.Model):
    category_choices = [
        ("Meal", "Meal"),
        ("Snack", "Snack"),
        ("Drink", "Drink"),
    ]

    key = models.PositiveIntegerField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=30, choices=category_choices)
    image_url = models.TextField(blank=True, default="")
    is_available = models.BooleanField(default=True)
    stock = models.PositiveIntegerField(default=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def to_dict(self):
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "price": float(self.price),
            "category": self.category,
            "imageUrl": self.image_url,
            "isAvailable": self.is_available,
            "stock": self.stock,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class OrderRecord(models.Model):
    payment_method_choices = [
        ("gcash", "GCash"),
        ("maya", "Maya"),
        ("cash", "Cash"),
    ]

    payment_status_choices = [
        ("Pending payment", "Pending payment"),
        ("Payment received", "Payment received"),
        ("Refunded", "Refunded"),
    ]

    order_status_choices = [
        ("Queued", "Queued"),
        ("Preparing", "Preparing"),
        ("Ready for pickup", "Ready for pickup"),
        ("Picked up", "Picked up"),
        ("Cancelled", "Cancelled"),
    ]

    id = models.AutoField(primary_key=True)
    student = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        related_name="orders",
        null=True,
        blank=True,
    )
    items_json = models.JSONField(default=list)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=payment_method_choices)
    payment_info = models.CharField(max_length=255, blank=True, default="")
    payment_status = models.CharField(
        max_length=30,
        choices=payment_status_choices,
        default="Pending payment"
    )
    order_status = models.CharField(
        max_length=30,
        choices=order_status_choices,
        default="Queued"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def to_dict(self):
        return {
            "orderId": self.id,
            "studentId": self.student_id,
            "items": self.items_json,
            "total": float(self.total),
            "paymentMethod": self.payment_method,
            "paymentMessage": self.get_payment_message(),
            "paymentInfo": self.payment_info,
            "paymentStatus": self.payment_status,
            "status": self.order_status,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

    def get_payment_message(self):
        if self.payment_method == "gcash":
            return "Send payment to GCash number 0917-123-4567."
        if self.payment_method == "maya":
            return "Send payment to Maya number 0917-987-6543."
        if self.payment_method == "cash":
            return "Pay cash when you pick up your order."
        return ""


class OrderItem(models.Model):
    order = models.ForeignKey(OrderRecord, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(MenuItem, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def to_dict(self):
        return {
            "name": self.name,
            "price": float(self.price),
            "quantity": self.quantity,
            "menuItemKey": self.menu_item_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
