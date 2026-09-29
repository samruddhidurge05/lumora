#!/usr/bin/env python3
"""
Production-Ready OpenAPI & Postman Collection Exporter for Lumora Digital Marketplace
====================================================================================
Generates:
  1. docs/lumora_openapi.json        (OpenAPI 3.0.3 Specification)
  2. docs/lumora_postman_collection.json (Postman v2.1.0 Collection)

Usage:
  python scripts/export_openapi.py
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# Add backend directory to python path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure environment variables satisfy startup config validation and use fast local SQLite for spec export
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "a" * 32
os.environ["FIREBASE_PROJECT_ID"] = "lumora-dev"
os.environ["PAYMENT_GATEWAY"] = "mock"
os.environ["STORAGE_PROVIDER"] = "local"
os.environ["SMTP_ENABLED"] = "False"

# Prevent dotenv override from restoring remote PostgreSQL DATABASE_URL
try:
    import dotenv
    _orig_load_dotenv = dotenv.load_dotenv
    def _fast_load_dotenv(*args, **kwargs):
        res = _orig_load_dotenv(*args, **kwargs)
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"
        os.environ["STORAGE_PROVIDER"] = "local"
        return res
    dotenv.load_dotenv = _fast_load_dotenv
except ImportError:
    pass

# Mock storage service and migration hooks to prevent network/DB I/O during spec extraction
import unittest.mock as mock

mock_storage_mod = mock.MagicMock()
mock_storage_mod.storage_service.check_health.return_value = {"status": "HEALTHY", "provider": "local"}
sys.modules["app.services.storage_service"] = mock_storage_mod

mock.patch("app.main._run_schema_migrations", lambda: None).start()
mock.patch("app.main.restore_products", lambda: None).start()


def generate_openapi_spec() -> Dict[str, Any]:
    """Imports FastAPI app and extracts/enhances OpenAPI 3.0 specification."""
    try:
        from app.main import app
    except ImportError as e:
        print(f"ERROR: Failed to import FastAPI application: {e}", file=sys.stderr)
        sys.exit(1)

    openapi_schema = app.openapi()

    # 1. OpenAPI Specification Metadata
    openapi_schema["openapi"] = "3.0.3"
    openapi_schema["info"] = {
        "title": "Lumora Digital Marketplace API",
        "description": (
            "Production-grade REST API specification for Lumora digital assets marketplace. "
            "Supports Customers, Vendors, Affiliates, and Admins across products, orders, "
            "payments, refunds, reviews, and analytics."
        ),
        "version": "1.0.0",
        "contact": {
            "name": "Lumora Engineering Team",
            "email": "durgesamruddhi@gmail.com",
            "url": "https://lumora.vercel.app",
        },
        "license": {
            "name": "Proprietary / Enterprise",
            "url": "https://lumora.vercel.app",
        },
    }

    # 2. Server Configuration
    openapi_schema["servers"] = [
        {
            "url": "http://localhost:8000",
            "description": "Development Server (Local)",
        },
        {
            "url": "https://lumora-api.onrender.com",
            "description": "Production Server (Render)",
        },
    ]

    # 3. Security Schemes (Bearer JWT)
    components = openapi_schema.setdefault("components", {})
    security_schemes = components.setdefault("securitySchemes", {})
    security_schemes["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT Authorization header using the Bearer scheme. Example: 'Bearer <token>'",
    }

    # 4. Route-level Security Annotation & Tag Refinement
    unprotected_keywords = [
        "/docs", "/redoc", "/openapi.json", "/health", "/ready", "/live",
        "/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"
    ]

    paths = openapi_schema.get("paths", {})
    all_tags = set()

    for path, methods in paths.items():
        for method, operation in methods.items():
            if method.lower() not in ["get", "post", "put", "delete", "patch", "options", "head"]:
                continue

            # Check if endpoint is public or protected
            is_unprotected = any(kw in path for kw in unprotected_keywords)
            if not is_unprotected:
                if "security" not in operation:
                    operation["security"] = [{"BearerAuth": []}]

            # Collect tags
            tags = operation.get("tags", [])
            for t in tags:
                all_tags.add(t)

    # 5. Populate Structured Tags Section
    tag_descriptions = {
        "Auth": "User authentication, registration, password management, and OAuth.",
        "Products": "Digital product catalog, listing, creation, and management.",
        "Orders": "Customer orders, checkout, purchase history, and fulfillment.",
        "Reviews": "Product reviews, ratings, and customer feedback.",
        "Vendors": "Vendor dashboard, profile, product management, and payouts.",
        "Wishlist": "Customer wishlist operations and saved items.",
        "Cart": "Shopping cart lifecycle and item quantities.",
        "Messages": "Direct messaging between buyers, vendors, and admins.",
        "Notifications": "User notifications, alerts, and system broadcast messages.",
        "Price Alerts": "Customer price drop monitoring and notifications.",
        "Search": "Advanced product search, filtering, and indexing.",
        "User Activity": "User activity logging and behavioral tracking.",
        "Search History": "User search query history and recommendations.",
        "Product Versions": "Digital file version control and release updates.",
        "File Uploads": "Digital asset uploads (B2 / Firebase / Local storage).",
        "Affiliate": "Affiliate referral links, commission tracking, and payouts.",
        "Admin": "System admin analytics, governance, and user moderation.",
        "Admin Support": "Admin support ticket resolution and customer service.",
        "Admin Notifications": "Admin broadcast notifications and system alerts.",
        "Admin Products": "Admin product moderation, feature flags, and approval.",
        "Admin Team": "Admin invitation, role management, and access controls.",
        "Payments": "Payment processing (Razorpay, mock payments, webhooks).",
        "Reports": "Financial reports, platform earnings, and sales analytics.",
        "Support": "Customer support ticket creation and tracking.",
        "Contact": "Public contact form submission.",
        "Refund Requests": "Refund request submissions and admin approvals.",
        "Webhooks": "Third-party payment gateway webhooks (RazorpayX).",
        "Settings": "Public marketplace configuration settings.",
    }

    openapi_tags = []
    for tag in sorted(all_tags):
        openapi_tags.append({
            "name": tag,
            "description": tag_descriptions.get(tag, f"{tag} module endpoints."),
        })
    openapi_schema["tags"] = openapi_tags

    return openapi_schema


def convert_openapi_to_postman(openapi: Dict[str, Any]) -> Dict[str, Any]:
    """Converts OpenAPI 3.0 dictionary to Postman Collection v2.1.0 format."""
    collection_name = openapi.get("info", {}).get("title", "Lumora API Collection")
    collection_desc = openapi.get("info", {}).get("description", "")

    items_by_tag: Dict[str, List[Dict[str, Any]]] = {}
    default_tag = "General"

    paths = openapi.get("paths", {})
    schemas = openapi.get("components", {}).get("schemas", {})

    def resolve_schema_sample(schema_obj: Dict[str, Any]) -> Any:
        """Generates a dummy sample object from OpenAPI schema."""
        if not schema_obj:
            return {}
        if "$ref" in schema_obj:
            ref_name = schema_obj["$ref"].split("/")[-1]
            return resolve_schema_sample(schemas.get(ref_name, {}))

        schema_type = schema_obj.get("type", "object")
        if schema_type == "object":
            sample = {}
            props = schema_obj.get("properties", {})
            for prop_name, prop_spec in props.items():
                if "$ref" in prop_spec:
                    ref_name = prop_spec["$ref"].split("/")[-1]
                    sample[prop_name] = resolve_schema_sample(schemas.get(ref_name, {}))
                else:
                    p_type = prop_spec.get("type", "string")
                    if p_type == "string":
                        sample[prop_name] = prop_spec.get("example", "string")
                    elif p_type in ["integer", "number"]:
                        sample[prop_name] = prop_spec.get("example", 0)
                    elif p_type == "boolean":
                        sample[prop_name] = prop_spec.get("example", True)
                    elif p_type == "array":
                        sample[prop_name] = []
                    else:
                        sample[prop_name] = "value"
            return sample
        elif schema_type == "array":
            items = schema_obj.get("items", {})
            return [resolve_schema_sample(items)]
        return {}

    for path, methods in paths.items():
        for method, operation in methods.items():
            if method.lower() not in ["get", "post", "put", "delete", "patch"]:
                continue

            tags = operation.get("tags", [default_tag])
            primary_tag = tags[0] if tags else default_tag
            if primary_tag not in items_by_tag:
                items_by_tag[primary_tag] = []

            # Request Name
            summary = operation.get("summary") or operation.get("operationId") or f"{method.upper()} {path}"

            # Headers
            headers = []

            # Query Parameters & Path Variables
            query_params = []
            path_variables = []

            for param in operation.get("parameters", []):
                p_in = param.get("in")
                p_name = param.get("name")
                p_desc = param.get("description", "")

                if p_in == "query":
                    query_params.append({
                        "key": p_name,
                        "value": str(param.get("schema", {}).get("default", "")),
                        "description": p_desc,
                        "disabled": not param.get("required", False)
                    })
                elif p_in == "path":
                    path_variables.append({
                        "key": p_name,
                        "value": f":{p_name}",
                        "description": p_desc
                    })

            # Format URL path for Postman (e.g., /api/products/{id} -> {{baseUrl}}/api/products/:id)
            pm_path = path
            for pv in path_variables:
                pm_path = pm_path.replace(f"{{{pv['key']}}}", f":{pv['key']}")

            path_segments = [seg for seg in pm_path.strip("/").split("/") if seg]

            url_obj = {
                "raw": "{{baseUrl}}" + pm_path,
                "host": ["{{baseUrl}}"],
                "path": path_segments,
                "query": query_params
            }
            if path_variables:
                url_obj["variable"] = path_variables

            # Request Body
            body_obj = None
            req_body = operation.get("requestBody", {})
            content = req_body.get("content", {})
            if "application/json" in content:
                headers.append({"key": "Content-Type", "value": "application/json"})
                schema_ref = content["application/json"].get("schema", {})
                sample_data = resolve_schema_sample(schema_ref)
                body_obj = {
                    "mode": "raw",
                    "raw": json.dumps(sample_data, indent=2) if sample_data else "{\n}",
                    "options": {
                        "raw": {
                            "language": "json"
                        }
                    }
                }

            request_item = {
                "name": summary,
                "request": {
                    "method": method.upper(),
                    "header": headers,
                    "url": url_obj,
                    "description": operation.get("description", summary)
                },
                "response": []
            }

            if body_obj:
                request_item["request"]["body"] = body_obj

            items_by_tag[primary_tag].append(request_item)

    # Build Postman Folder Structure
    postman_folders = []
    for tag in sorted(items_by_tag.keys()):
        postman_folders.append({
            "name": tag,
            "description": f"Endpoints under {tag} module.",
            "item": items_by_tag[tag]
        })

    postman_collection = {
        "info": {
            "_postman_id": "lumora-api-collection-v1",
            "name": collection_name,
            "description": collection_desc,
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": postman_folders,
        "auth": {
            "type": "bearer",
            "bearer": [
                {
                    "key": "token",
                    "value": "{{bearerToken}}",
                    "type": "string"
                }
            ]
        },
        "variable": [
            {
                "key": "baseUrl",
                "value": "http://localhost:8000",
                "type": "string"
            },
            {
                "key": "bearerToken",
                "value": "",
                "type": "string"
            }
        ]
    }

    return postman_collection


def main():
    print("==================================================================")
    print("Lumora Digital Marketplace - Production API Exporter")
    print("==================================================================")

    # 1. Generate OpenAPI Spec
    print("[1/3] Generating OpenAPI 3.0.3 Specification from FastAPI...")
    openapi_dict = generate_openapi_spec()

    # Define output directories (both lumora/docs and root workspace docs/)
    docs_dirs = [ROOT_DIR / "docs", ROOT_DIR.parent / "docs"]
    for d in docs_dirs:
        d.mkdir(exist_ok=True)

    for d in docs_dirs:
        openapi_file = d / "lumora_openapi.json"
        with open(openapi_file, "w", encoding="utf-8") as f:
            json.dump(openapi_dict, f, indent=2, ensure_ascii=False, sort_keys=True)

    # Count statistics
    paths = openapi_dict.get("paths", {})
    total_routes = sum(
        1 for p, m in paths.items()
        for method in m.keys()
        if method.lower() in ["get", "post", "put", "delete", "patch"]
    )
    total_tags = len(openapi_dict.get("tags", []))

    print(f"      OK -> Exported OpenAPI JSON to docs/lumora_openapi.json")

    # 2. Generate Postman Collection
    print("[2/3] Converting OpenAPI Spec to Postman v2.1.0 Collection...")
    postman_dict = convert_openapi_to_postman(openapi_dict)

    for d in docs_dirs:
        postman_file = d / "lumora_postman_collection.json"
        with open(postman_file, "w", encoding="utf-8") as f:
            json.dump(postman_dict, f, indent=2, ensure_ascii=False, sort_keys=True)

    print(f"      OK -> Exported Postman Collection to docs/lumora_postman_collection.json")

    # 3. Summary & Deliverables Metrics
    print("------------------------------------------------------------------")
    print("EXPORT SUMMARY & DELIVERABLES:")
    print(f"  • Total Routes Exported:    {total_routes}")
    print(f"  • Total Module Tags:        {total_tags}")
    print(f"  • Postman Collection:      docs/lumora_postman_collection.json")
    print(f"  • OpenAPI Spec Location:   docs/lumora_openapi.json")
    print(f"  • Security Scheme:         BearerAuth (JWT Bearer Token)")
    print(f"  • Server Environments:     http://localhost:8000 & https://lumora-api.onrender.com")
    print("==================================================================")


if __name__ == "__main__":
    main()
