# Admin API Reference — Lumora Platform

This document references all endpoints introduced or modified by the Admin Control Layer.

---

## 1. Vendor Status Control

### `PUT /api/admin/vendors/{uid}/status`
- **Description**: Enable, disable, suspend, or resume a vendor's registry account.
- **Access**: Admin JWT required.
- **Request Body**:
```json
{
  "status": "active" // active | suspended | disabled | restricted
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Vendor status updated to active."
}
```
- **Firestore Writes**: Updates `users/{uid}` and `vendors/{uid}` collections.
- **SQLite Writes**: Synchronizes user `is_active` flag.
- **Error Handling**: Returns `403 Forbidden` if called by a non-admin.

---

## 2. Affiliate Status Control

### `PUT /api/admin/affiliates/{uid}/status`
- **Description**: Enable, disable, suspend, or resume an affiliate's network account.
- **Access**: Admin JWT required.
- **Request Body**:
```json
{
  "status": "active" // active | suspended | disabled | restricted
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Affiliate status updated to active."
}
```
- **Firestore Writes**: Updates `users/{uid}` and `affiliates/{uid}` collections.
- **SQLite Writes**: Synchronizes user `is_active` and `affiliate_profile.is_active` flags.
- **Error Handling**: Returns `403 Forbidden` if called by a non-admin.

---

## 3. Platform Settings (Global Pause)

### `POST /api/admin/settings/pause`
- **Description**: Activate platform-wide pause mode. Disables all Vendor and Affiliate dashboard writes. Customer storefront remains functional.
- **Access**: Admin JWT required.
- **Request Body (Optional)**:
```json
{
  "message": "Lumora is temporarily paused for system configuration."
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Platform paused successfully."
}
```
- **Firestore Writes**: Updates `platformSettings/global` document.

---

### `POST /api/admin/settings/resume`
- **Description**: Deactivate platform-wide pause mode. Resumes all Vendor and Affiliate dashboard writes.
- **Access**: Admin JWT required.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Platform resumed successfully."
}
```
- **Firestore Writes**: Updates `platformSettings/global` document.

---

## 4. Product Management

### `POST /api/admin/products/`
- **Description**: Create a new product listing as Admin.
- **Access**: Admin JWT required.
- **Request Body**: Product creation fields (Pydantic schema).
- **Response (201 Created)**: Mapped product response schema.
- **Firestore Sync**: Auto-inserts the new document into the `products` collection.

---

### `PUT /api/admin/products/{product_id}`
- **Description**: Update an existing product.
- **Access**: Admin JWT required.
- **Response (200 OK)**: Mapped product update schema.
- **Firestore Sync**: Propagates fields directly to `products/{product_id}` in real time.

---

### `DELETE /api/admin/products/{product_id}`
- **Description**: Delete a product permanently.
- **Access**: Admin JWT required.
- **Response (204 No Content)**: Returns empty response.
- **Firestore Sync**: Removes document `products/{product_id}`.
