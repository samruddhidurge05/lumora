from app.db.session import SessionLocal
from app.models.order import Order
from app.models.user import User
from app.models.payment import Payment
from app.models.refund_request import RefundRequest
from app.admin_api.orders.services import get_orders_list
from app.admin_api.payments.services import get_payments_telemetry, get_payments_overview
from app.services.refund_service import refund_service

db = SessionLocal()

print("=================== 1. DATABASE SQL ROWS ===================")
print(f"SQL Orders Row Count: {db.query(Order).count()}")
print(f"SQL Users Row Count: {db.query(User).count()}")
print(f"SQL Payments Row Count: {db.query(Payment).count()}")
print(f"SQL RefundRequests Row Count: {db.query(RefundRequest).count()}")

print("\nFirst 5 Database Orders:")
for o in db.query(Order).limit(5).all():
    u = db.query(User).filter(User.id == o.user_id).first()
    uname = u.name if u else "N/A"
    uemail = u.email if u else "N/A"
    print(f"  [Order #{o.id}] User ID: {o.user_id} | Name: {uname} | Email: {uemail} | Total: INR {o.total_amount} | Status: {o.status}")

print("\n=================== 2. API RESPONSES ===================")
orders_data = get_orders_list(page=1, page_size=50)
print(f"Orders API Total Count: {orders_data.get('total')}")
print("Sample Orders API Payload:")
for o in orders_data.get('orders', [])[:5]:
    print(f"  ID: {o['id']} | OrderID: {o['orderId']} | Name: {o['customerName']} | Email: {o['customerEmail']} | Price: INR {o['totalUSD']} | Paid: {o['paymentStatus']}")

telemetry = get_payments_telemetry()
print(f"\nPayments Telemetry Orders Count: {len(telemetry.get('orders', []))}")
print("Sample Payments Telemetry Payload:")
for p in telemetry.get('orders', [])[:5]:
    print(f"  ID: {p['id']} | OrderID: {p['orderId']} | Name: {p['customerName']} | Email: {p['customerEmail']} | Price: INR {p['price']} | Status: {p['status']}")

overview = get_payments_overview()
print(f"\nPayments Overview: {overview}")

refunds = refund_service.get_all_requests(db=db)
print(f"\nRefund Requests API Count: {len(refunds)}")

db.close()
