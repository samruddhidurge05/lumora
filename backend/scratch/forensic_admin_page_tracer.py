import os
import sys
import json
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

from app.db.session import SessionLocal
from app.shared.firebase.connection import db as fdb, firebase_connected
from app.models import (
    Product, Order, Payment, RefundRequest, Review, SQLReport, User,
    Vendor, VendorProfile, AffiliateProfile, AffiliateCommission, AffiliatePayout,
    ReferralLink, ReferralClick, ProductDownloadEvent, AuditLog, AdminInvitation,
    PlatformSetting, Notification, Coupon, Withdrawal, PlatformWithdrawal,
    WishlistItem, CartItem, AdminRole, Verification, UserActivity, RecentlyViewed,
    PriceAlert, SearchHistory, StorageMetadata, AffiliateReferral
)

admin_pages = [
    {
        "name": "Dashboard",
        "react_component": "frontend/src/pages/admin/Dashboard.jsx",
        "api_endpoints": ["/api/admin/analytics/kpis", "/api/admin/analytics/charts"],
        "backend_routes": ["app/admin_api/analytics/routes.py", "admin/routes/analytics.py"],
        "service_layers": ["app/admin_api/analytics/services.py"],
        "models": [Order, Payment, Product, User, AffiliateProfile],
        "tables": ["orders", "payments", "products", "users", "affiliate_profiles"],
    },
    {
        "name": "Orders",
        "react_component": "frontend/src/pages/admin/OrdersManagement.jsx",
        "api_endpoints": ["/api/admin/orders"],
        "backend_routes": ["app/admin_api/orders/routes.py"],
        "service_layers": ["app/admin_api/orders/services.py"],
        "models": [Order],
        "tables": ["orders"],
    },
    {
        "name": "Payments",
        "react_component": "frontend/src/pages/admin/Payments.jsx",
        "api_endpoints": ["/api/admin/payments"],
        "backend_routes": ["app/admin_api/payments/routes.py"],
        "service_layers": ["app/admin_api/payments/services.py"],
        "models": [Payment],
        "tables": ["payments"],
    },
    {
        "name": "Refunds",
        "react_component": "frontend/src/pages/admin/OrdersManagement.jsx (Refunds Tab)",
        "api_endpoints": ["/api/admin/refunds"],
        "backend_routes": ["app/admin_api/refunds/routes.py"],
        "service_layers": ["app/services/refund_service.py"],
        "models": [RefundRequest],
        "tables": ["refund_requests"],
    },
    {
        "name": "Products",
        "react_component": "frontend/src/pages/admin/ProductsManagement.jsx",
        "api_endpoints": ["/api/admin/products"],
        "backend_routes": ["app/admin_api/products/routes.py", "admin/routes/products.py"],
        "service_layers": ["app/admin_api/products/services.py"],
        "models": [Product],
        "tables": ["products"],
    },
    {
        "name": "Customers",
        "react_component": "frontend/src/pages/admin/CustomersManagement.jsx",
        "api_endpoints": ["/api/admin/customers"],
        "backend_routes": ["app/admin_api/customers/routes.py"],
        "service_layers": ["app/admin_api/customers/services.py"],
        "models": [User],
        "tables": ["users (role='customer')"],
    },
    {
        "name": "Vendors",
        "react_component": "frontend/src/pages/admin/Vendors.jsx",
        "api_endpoints": ["/api/admin/vendors"],
        "backend_routes": ["admin/routes/vendors.py"],
        "service_layers": ["admin_controls/vendor/services.py"],
        "models": [Vendor, VendorProfile, User],
        "tables": ["vendors", "vendor_profiles", "users"],
    },
    {
        "name": "Affiliates",
        "react_component": "frontend/src/pages/admin/AffiliateManagement.jsx",
        "api_endpoints": ["/api/admin/affiliates"],
        "backend_routes": ["admin/routes/affiliates.py"],
        "service_layers": ["admin_controls/affiliate/services.py"],
        "models": [AffiliateProfile, User],
        "tables": ["affiliate_profiles", "users"],
    },
    {
        "name": "Promoters / Referral Campaigns",
        "react_component": "frontend/src/pages/admin/CampaignManager.jsx",
        "api_endpoints": ["/api/admin/referral-links", "/api/admin/referrals/campaigns"],
        "backend_routes": ["admin/routes/referral_links.py", "admin_controls/referral/routes.py"],
        "service_layers": ["admin_controls/referral/service.py"],
        "models": [ReferralLink, AffiliateReferral],
        "tables": ["referral_links", "affiliate_referrals"],
    },
    {
        "name": "Affiliate Transactions",
        "react_component": "frontend/src/pages/admin/AffiliateManagement.jsx (Transactions/Payouts)",
        "api_endpoints": ["/api/admin/affiliates/payouts", "/api/admin/affiliates/commissions"],
        "backend_routes": ["admin/routes/affiliates.py"],
        "service_layers": ["admin_controls/affiliate/services.py", "app/payments/payout/completion_handler.py"],
        "models": [AffiliatePayout, AffiliateCommission],
        "tables": ["affiliate_payouts", "affiliate_commissions"],
    },
    {
        "name": "Reviews",
        "react_component": "frontend/src/pages/admin/Reviews.jsx",
        "api_endpoints": ["/api/admin/reviews"],
        "backend_routes": ["app/admin_api/reviews/routes.py", "admin/routes/reviews.py"],
        "service_layers": ["app/admin_api/reviews/services.py"],
        "models": [Review],
        "tables": ["reviews"],
    },
    {
        "name": "Reports",
        "react_component": "frontend/src/pages/admin/Reports.jsx",
        "api_endpoints": ["/api/admin/reports"],
        "backend_routes": ["app/admin_api/reports/routes.py", "admin/routes/reports.py"],
        "service_layers": ["app/admin_api/reports/services.py"],
        "models": [SQLReport],
        "tables": ["reports"],
    },
    {
        "name": "Analytics",
        "react_component": "frontend/src/pages/admin/Analytics.jsx",
        "api_endpoints": ["/api/admin/analytics/kpis", "/api/admin/analytics/charts"],
        "backend_routes": ["app/admin_api/analytics/routes.py"],
        "service_layers": ["app/admin_api/analytics/services.py"],
        "models": [Order, Payment, Product, User],
        "tables": ["orders", "payments", "products", "users"],
    },
    {
        "name": "Audit Logs",
        "react_component": "frontend/src/pages/admin/AuditLogs.jsx",
        "api_endpoints": ["/api/admin/audit-logs"],
        "backend_routes": ["app/admin_api/routes.py"],
        "service_layers": ["app/services/audit_log_service.py"],
        "models": [AuditLog],
        "tables": ["audit_logs"],
    },
    {
        "name": "Support",
        "react_component": "frontend/src/pages/admin/AdminSupportInbox.jsx",
        "api_endpoints": ["/api/admin/support/tickets"],
        "backend_routes": ["app/admin_api/support/routes.py"],
        "service_layers": ["app/admin_api/support/services.py"],
        "models": [SQLReport],
        "tables": ["reports"],
    },
    {
        "name": "Settings",
        "react_component": "frontend/src/pages/admin/Settings.jsx",
        "api_endpoints": ["/api/admin/settings"],
        "backend_routes": ["app/admin_api/routes.py", "admin/routes/settings.py"],
        "service_layers": ["app/api/settings_router.py"],
        "models": [PlatformSetting],
        "tables": ["platform_settings"],
    },
    {
        "name": "Platform / Treasury",
        "react_component": "frontend/src/pages/admin/platform/PlatformSettings.jsx",
        "api_endpoints": ["/api/admin/treasury/withdrawals", "/api/admin/treasury/withdraw"],
        "backend_routes": ["app/admin_api/treasury/routes.py"],
        "service_layers": ["app/admin_api/treasury/services.py"],
        "models": [PlatformWithdrawal, PlatformSetting],
        "tables": ["platform_withdrawals", "platform_settings"],
    },
    {
        "name": "Withdrawals",
        "react_component": "frontend/src/pages/admin/AffiliateManagement.jsx (Withdrawals Tab)",
        "api_endpoints": ["/api/admin/affiliates/payouts"],
        "backend_routes": ["admin/routes/affiliates.py"],
        "service_layers": ["admin_controls/affiliate/services.py"],
        "models": [AffiliatePayout, Withdrawal],
        "tables": ["affiliate_payouts", "withdrawals"],
    },
    {
        "name": "Team / Admin Users",
        "react_component": "frontend/src/pages/admin/AdminUserManagement.jsx",
        "api_endpoints": ["/api/admin/team", "/api/admin/admin-roles"],
        "backend_routes": ["app/admin_api/admin_users/routes.py"],
        "service_layers": ["app/admin_api/admin_users/services.py"],
        "models": [AdminRole, User],
        "tables": ["admin_roles", "users"],
    },
    {
        "name": "Invitations",
        "react_component": "frontend/src/pages/admin/AdminUserManagement.jsx (Invitations Tab)",
        "api_endpoints": ["/api/admin/invitations"],
        "backend_routes": ["app/admin_api/admin_users/routes.py"],
        "service_layers": ["app/admin_api/admin_users/services.py"],
        "models": [AdminInvitation],
        "tables": ["admin_invitations"],
    },
    {
        "name": "Campaigns",
        "react_component": "frontend/src/pages/admin/CampaignManager.jsx",
        "api_endpoints": ["/api/admin/referrals/campaigns"],
        "backend_routes": ["admin_controls/referral/routes.py"],
        "service_layers": ["admin_controls/referral/service.py"],
        "models": [AffiliateReferral],
        "tables": ["affiliate_referrals"],
    },
    {
        "name": "Promotions",
        "react_component": "frontend/src/pages/admin/PromotionsManagement.jsx",
        "api_endpoints": ["/api/admin/coupons", "/api/admin/promotions"],
        "backend_routes": ["app/admin_api/routes.py"],
        "service_layers": ["app/admin_api/services.py"],
        "models": [Coupon],
        "tables": ["coupons"],
    },
    {
        "name": "Notifications",
        "react_component": "frontend/src/pages/admin/Navbar.jsx / AdminHeader",
        "api_endpoints": ["/api/admin/notifications"],
        "backend_routes": ["app/admin_api/notifications/routes.py"],
        "service_layers": ["app/admin_api/notifications/services.py"],
        "models": [Notification],
        "tables": ["notifications"],
    }
]

def run_trace():
    session = SessionLocal()

    print("=" * 120)
    print("P0 FORENSIC CERTIFICATION TRACE: REACT --> API --> ROUTE --> SERVICE --> MODEL --> PG TABLE")
    print("=" * 120)

    certification_results = []

    for page in admin_pages:
        name = page["name"]
        react_comp = page["react_component"]
        endpoints = page["api_endpoints"]
        routes = page["backend_routes"]
        services = page["service_layers"]
        models = page["models"]
        tables = page["tables"]

        # Check DB row count in PostgreSQL
        pg_counts = {}
        total_pg_records = 0
        for m in models:
            try:
                if name == "Customers" and m == User:
                    c = session.query(User).filter(User.role == "customer").count()
                elif name == "Team / Admin Users" and m == User:
                    c = session.query(User).filter(User.role == "admin").count()
                else:
                    c = session.query(m).count()
                pg_counts[m.__tablename__] = c
                total_pg_records += c
            except Exception as e:
                pg_counts[str(m)] = f"Error: {e}"

        # Check Firestore dependency in backend code for these routes/services
        fs_dependency = False
        fs_reason = "None"
        fs_col = "None"

        # Scan route files for firestore references
        for r_file in routes + services:
            full_path = os.path.join(project_root, r_file)
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    # Check if firestore is used for READ operations
                    if "firestore_db" in content or "fdb" in content or "collection(" in content:
                        # Check if it's read or optional dual-write
                        if ".stream()" in content or ".get()" in content or ".on_snapshot" in content:
                            fs_dependency = True
                            fs_reason = f"Read call found in {r_file}"
                            match = re.search(r'collection\(["\'](\w+)["\']\)', content)
                            if match:
                                fs_col = match.group(1)

        # Certification evaluation
        status = "🟢 CERTIFIED"
        if fs_dependency:
            status = "🟡 PARTIALLY MIGRATED"
        elif total_pg_records == 0 and name not in ["Promotions", "Withdrawals", "Promoters / Referral Campaigns"]:
            status = "🟡 NO RECORDS"

        certification_results.append({
            "page": name,
            "react_comp": react_comp,
            "endpoints": ", ".join(endpoints),
            "routes": ", ".join(routes),
            "services": ", ".join(services),
            "tables": ", ".join(tables),
            "pg_counts": json.dumps(pg_counts),
            "fs_dependency": "YES" if fs_dependency else "NO",
            "fs_col": fs_col,
            "status": status
        })

    session.close()

    print("\n" + "=" * 140)
    print(f"| {'Page':<24} | {'PG Table(s)':<30} | {'PG Counts':<30} | {'FS Dep?':<8} | {'Status':<16} |")
    print("=" * 140)
    for r in certification_results:
        print(f"| {r['page']:<24} | {r['tables']:<30} | {r['pg_counts']:<30} | {r['fs_dependency']:<8} | {r['status']:<16} |")
    print("=" * 140)

if __name__ == "__main__":
    run_trace()
