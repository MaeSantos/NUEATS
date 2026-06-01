import argparse
from datetime import datetime, time
import json
import os
import re
import sys
from decimal import Decimal

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nueats_db.settings")

import django  # noqa: E402
from django.contrib.auth.hashers import check_password, identify_hasher, make_password  # noqa: E402
from django.core.management import call_command  # noqa: E402
from django.db import transaction  # noqa: E402
from django.db.models import F, Max, Sum  # noqa: E402
from django.db.models.functions import TruncDate, TruncMonth, TruncYear  # noqa: E402
from django.utils import timezone  # noqa: E402

django.setup()

from store.models import MenuItem, OrderItem, OrderRecord, SessionToken, UserProfile  # noqa: E402

USERS_FILE = os.path.join(ROOT_DIR, "users.json")
SESSIONS_FILE = os.path.join(ROOT_DIR, "sessions.json")
VALID_PAYMENT_METHODS = {"gcash", "maya", "cash"}
VALID_PAYMENT_STATUSES = {"Pending payment", "Payment received", "Refunded"}
VALID_ORDER_STATUSES = {"Queued", "Preparing", "Ready for pickup", "Picked up", "Cancelled"}


def normalize_reference_number(value):
    return re.sub(r"\D+", "", str(value or ""))


def validate_reference_number(reference):
    if not reference:
        return "Reference number is required for e-wallet payments"
    if not reference.isdigit():
        return "Reference number must contain numbers only"
    if len(reference) < 8 or len(reference) > 20:
        return "Reference number must be 8 to 20 digits"
    return None


def is_hashed_password(password):
    if not password:
        return False

    try:
        identify_hasher(password)
        return True
    except ValueError:
        return False


def normalize_password(password):
    password = str(password or "")
    if not password or is_hashed_password(password):
        return password
    return make_password(password)


def password_matches(raw_password, stored_password):
    if not stored_password:
        # If no password is set in DB, only allow if raw_password is also empty.
        # This handles auto-created users from the original server.js.
        return not raw_password
    if is_hashed_password(stored_password):
        return check_password(raw_password, stored_password)
    return raw_password == stored_password


def seed_password_matches(seed_password, stored_password):
    if is_hashed_password(seed_password):
        return seed_password == stored_password
    return password_matches(seed_password, stored_password)


def read_json_file(path, fallback):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return fallback


def read_stdin_json():
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    return json.loads(raw)


def bootstrap_from_files():
    # Regular Users
    users = read_json_file(USERS_FILE, {})
    for student_id, profile in users.items():
        normalized_student_id = str(student_id)
        seed_password = str(profile.get("password", ""))
        defaults = {
            "name": profile.get("name", ""),
            "phone": profile.get("phone", ""),
            "password": normalize_password(seed_password),
            "is_admin": False
        }
        existing = UserProfile.objects.filter(student_id=normalized_student_id).first()
        if not existing:
            UserProfile.objects.create(student_id=normalized_student_id, **defaults)
            continue

        update_fields = []
        if not existing.name and defaults["name"]:
            existing.name = defaults["name"]
            update_fields.append("name")
        if not existing.phone and defaults["phone"]:
            existing.phone = defaults["phone"]
            update_fields.append("phone")
        if not seed_password_matches(seed_password, existing.password):
            existing.password = defaults["password"]
            update_fields.append("password")
        elif not is_hashed_password(existing.password):
            existing.password = defaults["password"]
            update_fields.append("password")

        if update_fields:
            existing.save(update_fields=update_fields)

    # Admin Users from legacy file
    ADMIN_FILE = os.path.join(ROOT_DIR, "admin-users.local.json")
    admin_data = read_json_file(ADMIN_FILE, {})
    admins = admin_data.get("admins", [])
    for admin in admins:
        username = admin.get("username")
        if not username:
            continue
        
        student_id = f"admin_{username}"
        name = admin.get("name", "Admin")
        raw_password = str(admin.get("password", "admin123"))
        
        existing = UserProfile.objects.filter(student_id=student_id).first()
        if not existing:
            UserProfile.objects.create(
                student_id=student_id,
                name=name,
                password=normalize_password(raw_password),
                is_admin=True
            )
            continue
            
        update_fields = []
        if not existing.name and name:
            existing.name = name
            update_fields.append("name")
        if not existing.is_admin:
            existing.is_admin = True
            update_fields.append("is_admin")
            
        if not seed_password_matches(raw_password, existing.password):
            existing.password = normalize_password(raw_password)
            update_fields.append("password")
        elif not is_hashed_password(existing.password):
            existing.password = normalize_password(raw_password)
            update_fields.append("password")
            
        if update_fields:
            existing.save(update_fields=update_fields)

    sessions = read_json_file(SESSIONS_FILE, {})
    for token, student_id in sessions.items():
        student = UserProfile.objects.filter(student_id=str(student_id)).first()
        if not student:
            continue

        normalized_token = str(token)
        existing = SessionToken.objects.filter(token=normalized_token).first()
        if not existing:
            SessionToken.objects.create(token=normalized_token, student=student)
        elif existing.student_id != student.student_id:
            existing.student = student
            existing.save(update_fields=["student"])

    # Migrate legacy order items to OrderItem table
    for order in OrderRecord.objects.all():
        if not order.items.exists() and order.items_json:
            for item in order.items_json:
                menu_item_key = item.get("key") or item.get("menuItemKey")
                OrderItem.objects.get_or_create(
                    order=order,
                    name=item.get("name", "Unknown item"),
                    defaults={
                        "menu_item_id": menu_item_key,
                        "price": Decimal(str(item.get("price", 0))),
                        "quantity": int(item.get("quantity", 1)),
                    }
                )


def ensure_db():
    call_command("migrate", run_syncdb=True, interactive=False, verbosity=0)
    bootstrap_from_files()


def serialize_user(profile):
    if not profile:
        return None
    return profile.to_dict()


def serialize_public_user(profile):
    user = serialize_user(profile)
    if user:
        user.pop("password", None)
    return user


def serialize_session(session):
    if not session:
        return None
    return session.to_dict()


def serialize_menu_item(item):
    if not item:
        return None
    return item.to_dict()


def serialize_order(order):
    items = [item.to_dict() for item in order.items.all()]
    if not items:
        # Fallback for old orders that only have JSON
        items = order.items_json

    return {
        "orderId": order.id,
        "studentId": order.student_id,
        "studentName": order.student.name if order.student else "Guest",
        "items": items,
        "total": float(order.total),
        "paymentMethod": order.payment_method,
        "paymentMessage": get_payment_message(order.payment_method),
        "paymentInfo": order.payment_info,
        "paymentStatus": order.payment_status,
        "status": order.order_status,
        "createdAt": order.created_at.isoformat(),
    }


def get_payment_message(method):
    if method == "gcash":
        return "Send payment to GCash number 0917-123-4567."
    if method == "maya":
        return "Send payment to Maya number 0917-987-6543."
    if method == "cash":
        return "Pay cash when you pick up your order."
    return ""


def cmd_init(_args):
    ensure_db()
    print(
        json.dumps(
            {
                "success": True,
                "users": UserProfile.objects.count(),
                "sessions": SessionToken.objects.count(),
                "orders": OrderRecord.objects.count(),
            }
        )
    )


def cmd_user_get(args):
    profile = UserProfile.objects.filter(student_id=str(args.student_id)).first()
    print(json.dumps({"success": True, "profile": serialize_user(profile)}))


def cmd_user_verify(args):
    profile = UserProfile.objects.filter(student_id=str(args.student_id)).first()
    valid = bool(profile and password_matches(str(args.password), profile.password))

    if valid and not is_hashed_password(profile.password):
        profile.password = make_password(str(args.password))
        profile.save(update_fields=["password"])

    print(json.dumps({
        "success": True, 
        "valid": valid, 
        "profile": serialize_public_user(profile) if valid else None,
        "isAdmin": profile.is_admin if (valid and profile) else False
    }))


def cmd_user_upsert(_args):
    payload = read_stdin_json()
    student_id = str(payload.get("studentId", "")).strip()
    if not student_id:
        print(json.dumps({"success": False, "error": "studentId is required"}))
        return

    profile, _ = UserProfile.objects.update_or_create(
        student_id=student_id,
        defaults={
            "name": payload.get("name", ""),
            "phone": payload.get("phone", ""),
            "image_url": payload.get("imageUrl", ""),
            "password": normalize_password(payload.get("password", "")),
        },
    )
    print(json.dumps({"success": True, "profile": serialize_user(profile)}))


def cmd_session_get(args):
    session = SessionToken.objects.filter(token=str(args.token)).first()
    print(json.dumps({"success": True, "session": serialize_session(session)}))


def cmd_session_create(args):
    student = UserProfile.objects.filter(student_id=str(args.student_id)).first()
    if not student:
        print(json.dumps({"success": False, "error": "student not found"}))
        return

    session, _ = SessionToken.objects.update_or_create(
        token=str(args.token),
        defaults={"student": student},
    )
    print(json.dumps({"success": True, "session": serialize_session(session)}))


def cmd_session_delete(args):
    deleted, _ = SessionToken.objects.filter(token=str(args.token)).delete()
    print(json.dumps({"success": True, "deleted": deleted}))


def cmd_menu_list(args):
    items = MenuItem.objects.order_by("key")
    if getattr(args, "available_only", False):
        items = items.filter(is_available=True, stock__gt=0)
    print(json.dumps({"success": True, "menu": [serialize_menu_item(item) for item in items]}))


def cmd_menu_get(args):
    item = MenuItem.objects.filter(key=int(args.key)).first()
    if not item:
        print(json.dumps({"success": False, "error": "Menu item not found"}))
        return
    print(json.dumps({"success": True, "item": serialize_menu_item(item)}))


def clean_menu_payload(payload, existing=None):
    name = str(payload.get("name", existing.name if existing else "")).strip()
    description = str(payload.get("description", existing.description if existing else "")).strip()
    category = str(payload.get("category", existing.category if existing else "")).strip()
    price = payload.get("price", existing.price if existing else "")
    is_available = payload.get("isAvailable", existing.is_available if existing else True)
    image_url = str(payload.get("imageUrl", existing.image_url if existing else "")).strip()
    stock = payload.get("stock", existing.stock if existing else 0)

    if not name:
        return None, "Menu item name is required"
    if category not in {"Meal", "Snack", "Drink"}:
        return None, "Category must be Meal, Snack, or Drink"

    try:
        price = Decimal(str(price))
    except Exception:
        return None, "Price must be a valid number"
    if price < 0:
        return None, "Price cannot be negative"

    try:
        stock = int(stock)
    except Exception:
        return None, "Stock must be a whole number"
    if stock < 0:
        return None, "Stock cannot be negative"

    return {
        "name": name,
        "description": description,
        "category": category,
        "price": price,
        "image_url": image_url,
        "is_available": bool(is_available),
        "stock": stock,
    }, None


def cmd_menu_create(_args):
    payload = read_stdin_json()
    next_key = int(MenuItem.objects.aggregate(max_key=Max("key"))["max_key"] or 0) + 1
    data, error = clean_menu_payload(payload)
    if error:
        print(json.dumps({"success": False, "error": error}))
        return
    item = MenuItem.objects.create(key=next_key, **data)
    print(json.dumps({"success": True, "item": serialize_menu_item(item)}))


def cmd_menu_update(args):
    item = MenuItem.objects.filter(key=int(args.key)).first()
    if not item:
        print(json.dumps({"success": False, "error": "Menu item not found"}))
        return

    payload = read_stdin_json()
    data, error = clean_menu_payload(payload, item)
    if error:
        print(json.dumps({"success": False, "error": error}))
        return

    for field, value in data.items():
        setattr(item, field, value)
    item.save()
    print(json.dumps({"success": True, "item": serialize_menu_item(item)}))


def cmd_menu_delete(args):
    deleted, _ = MenuItem.objects.filter(key=int(args.key)).delete()
    print(json.dumps({"success": True, "deleted": deleted}))


def cmd_order_create(_args):
    payload = read_stdin_json()
    items = payload.get("items", [])
    payment_method = str(payload.get("paymentMethod", "")).strip()
    payment_info = normalize_reference_number(payload.get("paymentInfo", ""))
    student_id = str(payload.get("studentId", "")).strip()

    if not items:
        print(json.dumps({"success": False, "error": "No items in order"}))
        return

    if payment_method not in VALID_PAYMENT_METHODS:
        print(json.dumps({"success": False, "error": "Invalid payment method"}))
        return

    if payment_method in {"gcash", "maya"}:
        reference_error = validate_reference_number(payment_info)
        if reference_error:
            print(json.dumps({"success": False, "error": reference_error}))
            return
        duplicate_reference = OrderRecord.objects.filter(payment_info=payment_info).exists()
        if duplicate_reference:
            print(json.dumps({"success": False, "error": "This reference number was already used"}))
            return
    else:
        payment_info = ""

    student = UserProfile.objects.filter(student_id=student_id).first() if student_id else None

    try:
        with transaction.atomic():
            normalized_items = []
            total = Decimal("0")

            for raw_item in items:
                menu_item_key = raw_item.get("key") or raw_item.get("menuItemKey")
                try:
                    menu_item_key = int(menu_item_key)
                    quantity = int(raw_item.get("quantity", 1))
                except Exception:
                    raise ValueError("Invalid item in order")

                if quantity <= 0:
                    raise ValueError("Item quantity must be greater than zero")

                menu_item = MenuItem.objects.select_for_update().filter(key=menu_item_key).first()
                if not menu_item or not menu_item.is_available:
                    raise ValueError("One or more items are no longer available")
                if menu_item.stock < quantity:
                    raise ValueError(f"Only {menu_item.stock} {menu_item.name} left in stock")

                menu_item.stock -= quantity
                menu_item.save(update_fields=["stock", "updated_at"])

                item_total = menu_item.price * quantity
                total += item_total
                normalized_items.append({
                    "key": menu_item.key,
                    "menuItemKey": menu_item.key,
                    "name": menu_item.name,
                    "price": float(menu_item.price),
                    "quantity": quantity,
                    "category": menu_item.category,
                })

            order = OrderRecord.objects.create(
                student=student,
                items_json=normalized_items,
                total=total,
                payment_method=payment_method,
                payment_info=payment_info,
                payment_status="Payment received" if payment_method == "cash" else "Pending payment",
                order_status="Queued",
            )

            for item in normalized_items:
                OrderItem.objects.create(
                    order=order,
                    menu_item_id=item["menuItemKey"],
                    name=item["name"],
                    price=Decimal(str(item["price"])),
                    quantity=item["quantity"],
                )
    except Exception as error:
        print(json.dumps({"success": False, "error": str(error) or "Unable to place order"}))
        return

    print(json.dumps({"success": True, **serialize_order(order)}))


def restore_order_stock(order):
    for item in order.items.all():
        if item.menu_item_id:
            MenuItem.objects.filter(key=item.menu_item_id).update(
                stock=F("stock") + item.quantity,
                updated_at=timezone.now(),
            )


def cmd_order_get(args):
    order = OrderRecord.objects.filter(id=int(args.order_id)).first()
    if not order:
        print(json.dumps({"success": False, "error": "Order not found"}))
        return
    print(json.dumps({"success": True, **serialize_order(order)}))


def cmd_order_list(_args):
    orders = OrderRecord.objects.order_by("created_at", "id")
    print(json.dumps({"success": True, "orders": [serialize_order(order) for order in orders]}))


def cmd_order_list_user(args):
    orders = OrderRecord.objects.filter(student_id=str(args.student_id)).order_by("-created_at", "-id")
    print(json.dumps({"success": True, "orders": [serialize_order(order) for order in orders]}))


def cmd_order_update(args):
    payload = read_stdin_json()
    order = OrderRecord.objects.filter(id=int(args.order_id)).first()
    if not order:
        print(json.dumps({"success": False, "error": "Order not found"}))
        return

    payment_status = str(payload.get("paymentStatus", "")).strip()
    order_status = str(payload.get("status", "")).strip()
    previous_status = order.order_status

    if payment_status:
        if payment_status not in VALID_PAYMENT_STATUSES:
            print(json.dumps({"success": False, "error": "Invalid payment status"}))
            return
        order.payment_status = payment_status
    if order_status:
        if order_status not in VALID_ORDER_STATUSES:
            print(json.dumps({"success": False, "error": "Invalid order status"}))
            return
        order.order_status = order_status
        if order_status == "Picked up" and order.payment_status == "Pending payment":
            order.payment_status = "Payment received"

    with transaction.atomic():
        if order_status == "Cancelled" and previous_status != "Cancelled":
            restore_order_stock(order)
        order.save()
    print(json.dumps({"success": True, "order": serialize_order(order)}))


def period_key(value, granularity):
    if hasattr(value, "date"):
        value = value.date()
    if granularity == "year":
        return f"{value.year:04d}"
    if granularity == "month":
        return f"{value.year:04d}-{value.month:02d}"
    return value.isoformat()


def serialize_period_rows(rows, current_period, granularity):
    serialized = [
        {
            "period": row["period"].isoformat() if hasattr(row["period"], "isoformat") else str(row["period"] or ""),
            "total": float(row["total"] or 0),
        }
        for row in rows
    ]

    current_key = period_key(current_period, granularity)
    if not any(period_key(datetime.fromisoformat(row["period"]).date(), granularity) == current_key for row in serialized if row["period"]):
        serialized.insert(0, {"period": current_period.isoformat(), "total": 0.0})

    return serialized


def cmd_report_summary(_args):
    today = timezone.localdate()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)
    current_month_period = timezone.make_aware(datetime.combine(month_start, time.min))
    current_year_period = timezone.make_aware(datetime.combine(year_start, time.min))

    paid_orders = OrderRecord.objects.filter(payment_status="Payment received")
    today_orders = paid_orders.filter(created_at__date=today)
    month_orders = paid_orders.filter(created_at__date__gte=month_start)
    year_orders = paid_orders.filter(created_at__date__gte=year_start)

    # Use the new OrderItem table for accurate reporting, filtered by paid orders
    item_counts = {}
    item_sales = {}
    for item in OrderItem.objects.filter(order__payment_status="Payment received"):
        name = item.name
        qty = item.quantity
        price = float(item.price)
        item_counts[name] = item_counts.get(name, 0) + qty
        item_sales[name] = item_sales.get(name, 0) + (qty * price)

    most_ordered = [
        {"name": name, "quantity": quantity, "sales": item_sales.get(name, 0)}
        for name, quantity in sorted(item_counts.items(), key=lambda entry: entry[1], reverse=True)
    ]

    daily_rows = (
        paid_orders.annotate(period=TruncDate("created_at"))
        .values("period")
        .annotate(total=Sum("total"))
        .order_by("-period")[:14]
    )
    monthly_rows = (
        paid_orders.annotate(period=TruncMonth("created_at"))
        .values("period")
        .annotate(total=Sum("total"))
        .order_by("-period")[:12]
    )
    yearly_rows = (
        paid_orders.annotate(period=TruncYear("created_at"))
        .values("period")
        .annotate(total=Sum("total"))
        .order_by("-period")[:5]
    )

    if not daily_rows.exists():
        all_orders = OrderRecord.objects.all()
        daily_rows = (
            all_orders.annotate(period=TruncDate("created_at"))
            .values("period")
            .annotate(total=Sum("total"))
            .order_by("-period")[:14]
        )

    if not monthly_rows.exists():
        all_orders = OrderRecord.objects.all()
        monthly_rows = (
            all_orders.annotate(period=TruncMonth("created_at"))
            .values("period")
            .annotate(total=Sum("total"))
            .order_by("-period")[:12]
        )

    if not yearly_rows.exists():
        all_orders = OrderRecord.objects.all()
        yearly_rows = (
            all_orders.annotate(period=TruncYear("created_at"))
            .values("period")
            .annotate(total=Sum("total"))
            .order_by("-period")[:5]
        )

    print(
        json.dumps(
            {
                "success": True,
                "summary": {
                    "dailyEarnings": float(today_orders.aggregate(total=Sum("total"))["total"] or 0),
                    "monthlyEarnings": float(month_orders.aggregate(total=Sum("total"))["total"] or 0),
                    "yearlyEarnings": float(year_orders.aggregate(total=Sum("total"))["total"] or 0),
                    "pendingPayments": OrderRecord.objects.filter(payment_status="Pending payment").count(),
                    "activeQueue": OrderRecord.objects.exclude(order_status__in=["Picked up", "Cancelled"]).count(),
                    "mostOrdered": most_ordered[:8],
                    "daily": serialize_period_rows(daily_rows, today, "day"),
                    "monthly": serialize_period_rows(monthly_rows, current_month_period, "month"),
                    "yearly": serialize_period_rows(yearly_rows, current_year_period, "year"),
                },
            }
        )
    )


def cmd_report_reset_pending(_args):
    # Update all "Pending payment" orders to "Payment received" or "Cancelled"
    # To "restart" to 0, we can just mark them as cancelled or processed.
    # Let's mark them as "Payment received" so they count towards earnings if they were valid,
    # or just delete them if they were tests.
    count = OrderRecord.objects.filter(payment_status="Pending payment").update(payment_status="Payment received")
    print(json.dumps({"success": True, "resetCount": count}))


def cmd_order_delete(args):
    deleted, _ = OrderRecord.objects.filter(id=int(args.order_id)).delete()
    print(json.dumps({"success": True, "deleted": deleted}))


def build_parser():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="resource", required=True)

    init_parser = subparsers.add_parser("init")
    init_parser.set_defaults(func=cmd_init)

    user_parser = subparsers.add_parser("user")
    user_sub = user_parser.add_subparsers(dest="action", required=True)

    user_get = user_sub.add_parser("get")
    user_get.add_argument("--student-id", required=True)
    user_get.set_defaults(func=cmd_user_get)

    user_verify = user_sub.add_parser("verify")
    user_verify.add_argument("--student-id", required=True)
    user_verify.add_argument("--password", required=True)
    user_verify.set_defaults(func=cmd_user_verify)

    user_upsert = user_sub.add_parser("upsert")
    user_upsert.set_defaults(func=cmd_user_upsert)

    session_parser = subparsers.add_parser("session")
    session_sub = session_parser.add_subparsers(dest="action", required=True)

    session_get = session_sub.add_parser("get")
    session_get.add_argument("--token", required=True)
    session_get.set_defaults(func=cmd_session_get)

    session_create = session_sub.add_parser("create")
    session_create.add_argument("--token", required=True)
    session_create.add_argument("--student-id", required=True)
    session_create.set_defaults(func=cmd_session_create)

    session_delete = session_sub.add_parser("delete")
    session_delete.add_argument("--token", required=True)
    session_delete.set_defaults(func=cmd_session_delete)

    menu_parser = subparsers.add_parser("menu")
    menu_sub = menu_parser.add_subparsers(dest="action", required=True)

    menu_list = menu_sub.add_parser("list")
    menu_list.add_argument("--available-only", action="store_true")
    menu_list.set_defaults(func=cmd_menu_list)

    menu_get = menu_sub.add_parser("get")
    menu_get.add_argument("--key", required=True)
    menu_get.set_defaults(func=cmd_menu_get)

    menu_create = menu_sub.add_parser("create")
    menu_create.set_defaults(func=cmd_menu_create)

    menu_update = menu_sub.add_parser("update")
    menu_update.add_argument("--key", required=True)
    menu_update.set_defaults(func=cmd_menu_update)

    menu_delete = menu_sub.add_parser("delete")
    menu_delete.add_argument("--key", required=True)
    menu_delete.set_defaults(func=cmd_menu_delete)

    order_parser = subparsers.add_parser("order")
    order_sub = order_parser.add_subparsers(dest="action", required=True)

    order_create = order_sub.add_parser("create")
    order_create.set_defaults(func=cmd_order_create)

    order_list = order_sub.add_parser("list")
    order_list.set_defaults(func=cmd_order_list)

    order_list_user = order_sub.add_parser("list-user")
    order_list_user.add_argument("--student-id", required=True)
    order_list_user.set_defaults(func=cmd_order_list_user)

    order_get = order_sub.add_parser("get")
    order_get.add_argument("--order-id", required=True)
    order_get.set_defaults(func=cmd_order_get)

    order_update = order_sub.add_parser("update")
    order_update.add_argument("--order-id", required=True)
    order_update.set_defaults(func=cmd_order_update)

    order_delete = order_sub.add_parser("delete")
    order_delete.add_argument("--order-id", required=True)
    order_delete.set_defaults(func=cmd_order_delete)

    report_parser = subparsers.add_parser("report")
    report_sub = report_parser.add_subparsers(dest="action", required=True)
    report_summary = report_sub.add_parser("summary")
    report_summary.set_defaults(func=cmd_report_summary)
    report_reset = report_sub.add_parser("reset-pending")
    report_reset.set_defaults(func=cmd_report_reset_pending)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
