# Production Postman & OpenAPI Guide - Lumora Digital Marketplace

This guide outlines how to import and use the **Lumora API Postman Collection** (`lumora_postman_collection.json`) and **OpenAPI 3.0 Specification** (`lumora_openapi.json`) for testing, team collaboration, and viva demonstrations.

---

## 1. Import Steps into Postman

1. Open **Postman** desktop app or web interface.
2. Click the **Import** button in the top left header menu.
3. Drag and drop or browse to select:
   - `docs/lumora_postman_collection.json` (or `docs/lumora_openapi.json`)
4. Confirm import. Postman will generate a folder tree organized cleanly by API module tags (**Auth**, **Products**, **Orders**, **Admin**, **Vendors**, **Affiliate**, **Payments**, etc.).

---

## 2. Environment Variables Setup

The collection is pre-configured with collection variables. You can also configure a dedicated Postman Environment:

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `baseUrl` | `http://localhost:8000` | Target backend host (`http://localhost:8000` or `https://lumora-api.onrender.com`) |
| `bearerToken` | `YOUR_JWT_TOKEN` | Bearer JWT token returned upon successful login |

### Setting Environment Variables in Postman:
1. Click **Environments** in the left sidebar -> **Create Environment** (e.g., `Lumora Local`).
2. Add variable `baseUrl` with initial value `http://localhost:8000`.
3. Add variable `bearerToken` with initial value left blank (populated after login).
4. Select `Lumora Local` in the active environment dropdown in top right.

---

## 3. Authentication Flow

Most protected endpoints in Lumora (Cart, Checkout, Vendor Dashboard, Admin Console, Wishlist, Refunds) require a Bearer JWT Token.

### Step 1: Obtain a Token
1. Open folder **Auth** -> `POST /api/auth/login`.
2. Send request with valid JSON credentials:
   ```json
   {
     "email": "user@example.com",
     "password": "your_password"
   }
   ```
3. Copy the returned `access_token` string from the JSON response.

### Step 2: Set Token in Postman
1. Edit your Postman Environment or Collection variables.
2. Paste the JWT string into `bearerToken`.
3. All endpoints configured with `Bearer Token {{bearerToken}}` will automatically attach the HTTP header:
   `Authorization: Bearer <your_jwt_token>`

---

## 4. Re-exporting & CI/CD Automation

To update the specification whenever backend routes or schemas change:

```bash
# Run from the root lumora directory
python scripts/export_openapi.py
```

Outputs generated:
- `docs/lumora_openapi.json` (OpenAPI 3.0.3 Spec)
- `docs/lumora_postman_collection.json` (Postman v2.1.0 Collection)
