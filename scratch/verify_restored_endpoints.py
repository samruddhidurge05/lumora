import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.db.session import SessionLocal
from app.services.refund_service import refund_service
from app.admin_api.orders.services import get_orders_list, get_order_by_id
from app.admin_api.payments.services import get_payments_overview, get_transactions_list

db_s = SessionLocal()
try:
    print("=== 1. VERIFY ORDERS ENDPOINT ===")
    orders_res = get_orders_list(page=1, page_size=10)
    items: list = orders_res.get('items', [])
    print(f"Total orders: {orders_res['total']}, returned items count: {len(items)}")
    for item in items[:5]:
        print(f"  Order {item['orderId']}: CustomerName='{item['customerName']}', Email='{item['customerEmail']}', Price=INR {item['price']}")

    print("\n=== 2. VERIFY GET ORDER BY ID ENDPOINT ===")
    if items:
        sample_id = items[0]['id']
        single_order = get_order_by_id(sample_id)
        print(f"  Single Order ORD-{single_order['id']}: CustomerName='{single_order['customerName']}', Email='{single_order['customerEmail']}'")

    print("\n=== 3. VERIFY PAYMENTS ENDPOINT ===")
    overview = get_payments_overview()
    print(f"  Payments Overview Total Revenue: INR {overview['totalRevenue']}, Transactions: {overview['totalTransactions']}")
    txns = get_transactions_list(page=1, page_size=10)
    print(f"  Total transactions returned: {txns['total']}")
    for t in txns['items'][:5]:
        print(f"  Txn {t['id']}: CustomerName='{t['customerName']}', Amount=INR {t['amount']}, Status={t['status']}")

    print("\n=== 4. VERIFY REFUNDS ENDPOINT ===")
    refunds = refund_service.get_all_requests(db=db_s, page=1, page_size=10)
    print(f"  Total refund requests returned: {len(refunds)}")
    for r in refunds:
        print(f"  Refund TKT-{r.id}: Order ID=ORD-{r.order_id}, Product='{r.product_name}', Status={r.status}, Amount=INR {r.requested_amount}")
finally:
    db_s.close()
