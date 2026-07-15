# Requirements Document

## Introduction

This feature adds a "Features & Specs" section to the existing Admin Product Management form (both New Product and Edit Product workflows). The section exposes four structured sub-fields — Key Features, What's Included, System Requirements, and Installation Guide — that already exist in the product data model and Firestore sync layer but are not yet surfaced in the Admin UI.

The backend data model (`Product`), schemas (`ProductCreate`, `ProductUpdate`, `ProductResponse`), API routes (`backend/admin/routes/products.py`), and Firestore sync (`admin_firestore.py`) already contain these fields. This feature is purely a **UI addition** to the existing `ProductFormModal` component in `frontend/src/pages/admin/ProductsManagement.jsx`, with a corresponding update to the `mapAdminProductToApi` mapper to pass the new fields through to the API.

**Repository Analysis Summary:**
- `ProductsManagement.jsx` — renders both the Product Management page and the `ProductFormModal` (used for both New Product and Edit Product). No separate edit page exists.
- `ProductFormModal` — a slide-in panel with 4 existing sections. A new "Features & Specs" section (Section 5) will be added.
- `mapAdminProductToApi` — module-scoped mapper; must be extended to forward the four new fields.
- `backend/admin/routes/products.py` — `POST /` and `PUT /{id}` already accept and persist all four fields via the existing schemas.
- `backend/app/models/product.py` — `features`, `what_you_get`, `system_requirements`, `installation_guide` columns already exist.
- `backend/app/schemas/schemas.py` — all four fields already present in `ProductCreate`, `ProductUpdate`, `ProductResponse`.
- `backend/admin/firestore/admin_firestore.py` — `sync_product_to_firestore` already syncs all four fields.
- **No backend changes are required.** No database migration is needed.

---

## Glossary

- **Admin**: An authenticated platform administrator operating the Admin Dashboard.
- **Product_Form_Modal**: The existing slide-in panel component (`ProductFormModal`) in `ProductsManagement.jsx` used for both creating and editing products.
- **Features_Specs_Section**: The new Section 5 added to `Product_Form_Modal`, containing four sub-fields.
- **Key_Features**: An ordered list of short bullet-point strings describing the product's main selling points (`features` field in the data model).
- **Whats_Included**: An ordered list of item strings describing deliverables bundled with the product (`what_you_get` field in the data model).
- **System_Requirements**: A structured list of strings describing the minimum or recommended environment to run the product (`system_requirements` field in the data model).
- **Installation_Guide**: A free-text or markdown string providing setup and installation instructions (`installation_guide` field in the data model).
- **API_Mapper**: The `mapAdminProductToApi` function in `ProductsManagement.jsx` that translates UI form state to the FastAPI schema before submission.
- **SQLite**: The primary relational database backed by SQLAlchemy, acting as the canonical source of truth for product data.
- **Firestore**: The Firebase Firestore database used as the real-time sync layer consumed by all frontend pages.
- **ProductCreate_Schema**: The Pydantic schema `ProductCreate` in `backend/app/schemas/schemas.py`.
- **ProductUpdate_Schema**: The Pydantic schema `ProductUpdate` in `backend/app/schemas/schemas.py`.
- **ProductResponse_Schema**: The Pydantic schema `ProductResponse` in `backend/app/schemas/schemas.py`.

---

## Requirements

### Requirement 1: Features & Specs Section Presence in Product Form

**User Story:** As an Admin, I want the New Product and Edit Product forms to include a "Features & Specs" section, so that I can document structured product details without leaving the existing form.

#### Acceptance Criteria

1. THE `Product_Form_Modal` SHALL render a "Features & Specs" section as the fifth section within the existing form, after the existing four sections (Identity Parameters, Commercial Valuation, Visual Preview Assets, Global Distribution & SEO).
2. WHEN the Admin opens the New Product form, THE `Product_Form_Modal` SHALL display the `Features_Specs_Section` with all four sub-fields initialised to their empty defaults: `Key_Features` as an empty array `[]`, `Whats_Included` as an empty array `[]`, `System_Requirements` as an empty array `[]`, and `Installation_Guide` as an empty string `""`.
3. WHEN the Admin opens the Edit Product form for a product that has existing `Key_Features`, `Whats_Included`, `System_Requirements`, or `Installation_Guide` data, THE `Product_Form_Modal` SHALL pre-populate those sub-fields with the previously saved values.
4. THE `Features_Specs_Section` SHALL follow the same visual style (heading typography, border separators, label styling, input styling) as the existing four sections within `Product_Form_Modal`.

---

### Requirement 2: Key Features Sub-Field

**User Story:** As an Admin, I want to add, reorder, and remove individual bullet-point entries for Key Features, so that I can precisely describe what makes the product valuable.

#### Acceptance Criteria

1. THE `Product_Form_Modal` SHALL render a dynamic list editor for `Key_Features` that allows the Admin to add new entries one at a time.
2. WHEN the Admin types a non-empty string into the `Key_Features` input field and clicks "Add", THE `Product_Form_Modal` SHALL append the entry to the `Key_Features` list.
3. WHEN the Admin clicks the remove control next to an existing `Key_Features` entry, THE `Product_Form_Modal` SHALL remove that entry from the list.
4. THE `Key_Features` list editor SHALL display all current entries with individual removal controls visible for each entry.
5. IF the Admin attempts to add an empty string to `Key_Features`, THEN THE `Product_Form_Modal` SHALL ignore the add action and leave the list unchanged.

---

### Requirement 3: What's Included Sub-Field

**User Story:** As an Admin, I want to specify the list of items included with the product, so that customers know exactly what they are receiving.

#### Acceptance Criteria

1. THE `Product_Form_Modal` SHALL render a dynamic list editor for `Whats_Included` that allows the Admin to add new entries one at a time.
2. WHEN the Admin types a non-empty string into the `Whats_Included` input field and clicks "Add", THE `Product_Form_Modal` SHALL append the entry to the `Whats_Included` list.
3. WHEN the Admin clicks the remove control next to an existing `Whats_Included` entry, THE `Product_Form_Modal` SHALL remove that entry from the list.
4. THE `Whats_Included` list editor SHALL display all current entries with individual removal controls visible for each entry.
5. IF the Admin attempts to add an empty string to `Whats_Included`, THEN THE `Product_Form_Modal` SHALL ignore the add action and leave the list unchanged.

---

### Requirement 4: System Requirements Sub-Field

**User Story:** As an Admin, I want to enter structured system requirement entries for the product, so that customers understand what environment is needed to use the product.

#### Acceptance Criteria

1. THE `Product_Form_Modal` SHALL render a dynamic list editor for `System_Requirements` that allows the Admin to add new entries one at a time.
2. WHEN the Admin types a non-empty string into the `System_Requirements` input field and clicks "Add", THE `Product_Form_Modal` SHALL append the entry to the `System_Requirements` list.
3. WHEN the Admin clicks the remove control next to an existing `System_Requirements` entry, THE `Product_Form_Modal` SHALL remove that entry from the list.
4. THE `System_Requirements` list editor SHALL display all current entries with individual removal controls visible for each entry.
5. IF the Admin attempts to add an empty string to `System_Requirements`, THEN THE `Product_Form_Modal` SHALL ignore the add action and leave the list unchanged.

---

### Requirement 5: Installation Guide Sub-Field

**User Story:** As an Admin, I want to write a rich-text or markdown installation guide for the product, so that customers can follow clear step-by-step setup instructions after purchase.

#### Acceptance Criteria

1. THE `Product_Form_Modal` SHALL render a multi-line textarea input for `Installation_Guide`.
2. WHEN the Admin types into the `Installation_Guide` textarea, THE `Product_Form_Modal` SHALL reflect the current input value in real time via controlled state.
3. WHEN the Admin opens the Edit Product form for a product that has an existing `Installation_Guide`, THE `Product_Form_Modal` SHALL pre-populate the textarea with the previously saved value.
4. THE `Installation_Guide` textarea SHALL accept plain text and markdown syntax without modification or sanitisation on the frontend.

---

### Requirement 6: Data Mapping and API Submission

**User Story:** As an Admin, I want the Features & Specs data to be included in the product save request, so that it is persisted to SQLite and synced to Firestore alongside all other product fields.

#### Acceptance Criteria

1. WHEN the Admin submits the Product Form (create or update), THE `API_Mapper` SHALL include `features`, `what_you_get`, `system_requirements`, and `installation_guide` in the API payload passed to the backend.
2. THE `API_Mapper` SHALL map `Key_Features` list → `features` (array), `Whats_Included` list → `what_you_get` (array), `System_Requirements` list → `system_requirements` (array), and `Installation_Guide` string → `installation_guide` (string). WHEN the Admin submits a New Product form with no entries added to the list fields and no text in the Installation Guide, THE `API_Mapper` SHALL send `features: []`, `what_you_get: []`, `system_requirements: []`, and `installation_guide: ""` — never `null` or `undefined`.
3. WHEN the backend receives the create or update request, THE backend route SHALL persist `features`, `what_you_get`, `system_requirements`, and `installation_guide` to `SQLite` using the existing `ProductCreate_Schema` or `ProductUpdate_Schema` without modification.
4. AFTER the backend persists the product, THE `sync_product_to_firestore` function SHALL include `features`, `whatYouGet`, `systemRequirements`, and `installationGuide` in the Firestore document without modification to the existing sync function.
5. WHEN the Admin opens the Edit Product form, THE `Product_Form_Modal` SHALL correctly initialise the `Key_Features`, `Whats_Included`, `System_Requirements` lists and `Installation_Guide` textarea from the product data returned by the Firestore `onSnapshot` subscription.

---

### Requirement 7: Edit Product Pre-Population Round-Trip

**User Story:** As an Admin, I want edited Features & Specs values to be saved and re-loaded correctly, so that data integrity is preserved across create, save, and edit cycles.

#### Acceptance Criteria

1. WHEN an Admin creates a product with non-empty `Key_Features`, `Whats_Included`, `System_Requirements`, and `Installation_Guide`, and then opens that product for editing, THE `Product_Form_Modal` SHALL display the exact list entries and text previously submitted, as loaded from the Firestore snapshot.
2. WHEN an Admin edits and re-saves a product's `Features_Specs_Section`, THE backend route SHALL update the corresponding `SQLite` columns and re-sync the Firestore document.
3. FOR ALL products with valid `features`, `what_you_get`, `system_requirements`, and `installation_guide` values, submitting the Edit Product form with unchanged values SHALL produce an equivalent payload on the next edit load (round-trip property: read → display → submit → read produces the same data).

---

### Requirement 8: Protected Modules Isolation

**User Story:** As a platform operator, I want the Features & Specs enhancement to be isolated to Admin Product Management, so that no other dashboard or module is affected.

#### Acceptance Criteria

1. THE implementation SHALL only modify `frontend/src/pages/admin/ProductsManagement.jsx` in the frontend.
2. THE implementation SHALL NOT modify any file outside the Admin Product Management flow: Vendor Dashboard, Affiliate Dashboard, Customer Dashboard, Marketplace UI, Checkout, Cart, Payments, Orders, Analytics, Reports, Authentication, Authorization, Downloads, or Referral System files SHALL remain unchanged.
3. WHILE the backend schemas (`ProductCreate_Schema`, `ProductUpdate_Schema`, `ProductResponse_Schema`), model (`product.py`), route (`backend/admin/routes/products.py`), and Firestore sync (`admin_firestore.py`) already contain all four fields, THE implementation SHALL NOT alter these files because no backend changes are needed.
4. THE implementation SHALL NOT introduce new database migrations, new API routes, new backend services, or new dependencies.
