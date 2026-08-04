# LUMORA DIGITAL MARKETPLACE
## Complete Technical Architecture & Diploma Internship Presentation Master Package

---

**Document Reference**: LUM-MSBTE-PPT-2026-V1.0  
**Project Title**: Lumora — High-Performance Multi-Role Digital Asset Marketplace  
**Domain**: Full-Stack Web Development, FinTech & Secure Asset Distribution  
**Academic Target**: MSBTE Diploma Final Project / Internship Presentation  
**Author**: Samruddhi Durge (Lead Full-Stack Developer & Systems Architect)  
**Codebase Version**: Release Candidate v1.0.0-RC3  

---

# 1. EXECUTIVE PROJECT SUMMARY

### 1.1 Project Title & Domain
* **Title**: Lumora — Secure Digital Asset & Creator Commerce Marketplace
* **Domain**: Cloud Web Applications, E-Commerce Infrastructure, FinTech Payment Systems, Single Page Applications (SPA), Asynchronous REST Micro-APIs.

### 1.2 Project Objective
The primary objective of Lumora is to provide an end-to-end, high-performance marketplace enabling digital creators (UI/UX designers, frontend developers, content creators, and software engineers) to upload, market, sell, and securely distribute digital assets (React Templates, UI Kits, E-books, Design Systems, Notion Templates, AI Prompt Packs, and Code Snippets) while offering an automated commission-based affiliate referral network.

### 1.3 Problem Statement
Traditional e-commerce platforms (like Shopify or WooCommerce) are primarily engineered for physical goods shipment. Applying them to digital products leads to severe architectural flaws:
1. **Unsecured Media Links**: Direct file URL leaks allowing unauthorized user distribution without purchase verification.
2. **High Platform Fees**: Generic platforms charge 15%–30% transaction fees without dedicated affiliate tracking.
3. **Lack of Instant Delivery Security**: Slow email attachments or unverified cloud download links.
4. **Fragile Multi-Role Management**: Poor role separation between Buyers, Vendors, Affiliates, and Platform Administrators.

### 1.4 Real-World Need
Digital creators require a dedicated, low-latency marketplace where:
* Assets are protected using single-use, timed cryptographic download tokens.
* Affiliates can transparently promote digital items with fraud-resistant referral tracking.
* Platform administrators can monitor real-time treasury ledgers, review vendor identity KYC, and enforce product moderation.

### 1.5 Target Users
1. **Customers (Buyers)**: Designers, developers, and students searching for premium UI templates, code modules, and digital books.
2. **Vendors (Creators)**: Software developers and digital designers looking to monetize their creations.
3. **Affiliates (Marketers)**: Influencers, bloggers, and tech curators earning commissions by driving referral traffic.
4. **Platform Administrators**: Governance leads managing security, product approval, payouts, and system audit logs.

### 1.6 What Makes Lumora Different From a Normal E-Commerce Website?
| Feature | Standard E-Commerce (e.g. WooCommerce) | Lumora Digital Marketplace |
| :--- | :--- | :--- |
| **Product Type** | Physical inventory, shipping calculations | Pure Digital Assets (Zip files, PDFs, UI kits) |
| **Asset Security** | Static S3 URLs or email links | Single-use 15-minute JWT signed download streams via Backblaze B2 |
| **Affiliate System** | Third-party plugin, high lag | Built-in 4-tier commission fallback engine + fraud detection |
| **Role Architecture** | Basic Customer / Admin roles | 4-Role Isolation (Customer, Vendor, Affiliate, Admin) |
| **Payment Flow** | Simple gateway checkout | Razorpay checkout + Server-side price override + RazorpayX Payout Radar |
| **UI Aesthetics** | Generic themes | Custom Dark-Mode Glassmorphism Design System with Framer Motion & Three.js |

---

# 2. COMPLETE TECH STACK (DEEP EXPLANATION)

### 2.1 Technology Matrix & Examiner Defense Guide

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LUMORA TECHNOLOGY STACK                            │
├───────────────────┬──────────────────────────────┬──────────────────────────┤
│ Layer             │ Technologies Used            │ Primary Responsibility   │
├───────────────────┼──────────────────────────────┼──────────────────────────┤
│ Frontend SPA      │ React 18.3, Vite 5.3         │ Core Component Rendering │
│ UI & Aesthetics   │ Custom CSS Glassmorphism     │ Responsive Design System │
│ Animations        │ Framer Motion 11, GSAP 3     │ Micro-interactions & Hero│
│ Icons & Visuals   │ Lucide React 0.395, Three.js │ UI Icons & 3D Visuals    │
│ Backend Micro-API │ FastAPI 0.110, Python 3.12   │ Asynchronous REST API    │
│ Server ORM        │ SQLAlchemy 2.0.35, Pydantic 2│ Relational Data Mapping  │
│ Database Layer    │ Render PostgreSQL SSL        │ Persistent Storage (38T) │
│ Metadata Mirror   │ Firebase Firestore           │ Real-time Event Mirror   │
│ Authentication    │ Firebase Auth + PyJWT        │ Identity & Token Minting │
│ Cloud Storage     │ Backblaze B2 Private Vault   │ Protected Digital Assets │
│ Payment Gateway   │ Razorpay API + RazorpayX     │ Order Settlement & Payout│
│ Security          │ slowapi, passlib, bcrypt     │ Rate Limiting & Hashing  │
└───────────────────┴──────────────────────────────┴──────────────────────────┘
```

#### 1. React 18.3 (Frontend Framework)
* **What it is**: Component-based JavaScript library for building interactive user interfaces.
* **Why selected**: Offers declarative rendering, virtual DOM reconciliation, and hook-based state management (`useState`, `useEffect`, `useContext`).
* **Role in Lumora**: Powers the entire Single Page Application (SPA) for Customer, Vendor, Affiliate, and Admin portals.
* **Codebase Location**: `frontend/src/App.jsx` and `admin-app/src/App.jsx`.
* **Examiner Defense**: *"We chose React 18 to leverage Concurrent Rendering and component modularity, eliminating full page reloads and ensuring an instantaneous app-like experience."*

#### 2. Vite 5.3 (Build Tool & Dev Server)
* **What it is**: Next-generation frontend tooling powered by native ES modules and Esbuild.
* **Why selected**: Provides sub-second Hot Module Replacement (HMR) and ultra-optimized production bundling compared to legacy Webpack.
* **Role in Lumora**: Bundles JavaScript assets, handles CSS preprocessing, and serves local development environments.
* **Codebase Location**: `frontend/vite.config.js` and `admin-app/vite.config.js`.

#### 3. Custom CSS Glassmorphism Design System
* **What it is**: Vanilla CSS styling architecture utilizing backdrop blur, semi-transparent purple/dark hues, and luminous borders.
* **Why selected**: Delivers a futuristic visual identity without framework overhead.
* **Role in Lumora**: Controls site-wide layout, typography, responsive breakpoints (`responsive.css`), and modal glass overlays.
* **Codebase Location**: `frontend/src/index.css`, `frontend/src/responsive.css`, `admin-app/src/index.css`.

#### 4. Framer Motion 11 & GSAP 3 (Animation Engines)
* **What it is**: Production-grade animation libraries for React.
* **Why selected**: Enables smooth hardware-accelerated physics-based UI transitions and scroll animations.
* **Role in Lumora**: Modal entrances, card hover elevations, dashboard stat counters, and landing page hero visual flows.

#### 5. FastAPI 0.110 (Backend Framework)
* **What it is**: High-performance Python web framework based on Starlette and Pydantic.
* **Why selected**: Built on Python `asyncio` for non-blocking I/O operations, automatic OpenAPI documentation generation, and native data typing validation.
* **Role in Lumora**: Processes all business logic, database transactions, authorization checks, payment validation, and download link minting.
* **Codebase Location**: `backend/app/main.py`.
* **Examiner Defense**: *"FastAPI was selected over Django or Flask because of its asynchronous request handling capabilities, yielding benchmarks comparable to NodeJS and Go, combined with native Pydantic schema validation."*

#### 6. PostgreSQL (Production Database)
* **What it is**: Enterprise-grade relational database management system.
* **Why selected**: ACID compliance, robust foreign key constraint integrity, JSONB support, and high performance under high concurrence.
* **Role in Lumora**: Acts as the single source of truth for users, orders, products, payments, transactions, and audit logs across 38 relational tables.
* **Hosted Platform**: Render PostgreSQL (`lumora_db_k4ni`) over SSL.

#### 7. SQLAlchemy 2.0 (Object Relational Mapper)
* **What it is**: Industry-standard SQL toolkit and ORM for Python.
* **Why selected**: Translates Python classes into database tables, provides parameterization to prevent SQL Injection, and supports atomic transaction management (`db.commit()`, `db.rollback()`).
* **Codebase Location**: `backend/app/models/` and `backend/app/db/database.py`.

#### 8. Firebase Authentication & Firestore Mirror
* **What it is**: Cloud identity service and NoSQL real-time document database.
* **Why selected**: Firebase Auth handles user registration credentials, OAuth providers, and email verification tokens safely.
* **Role in Lumora**: Authenticates client sessions; user profiles and product metadata are synchronized to Firestore for real-time client state listeners.
* **Codebase Location**: `backend/app/shared/firebase/` and `frontend/src/firebase.js`.

#### 9. Backblaze B2 Cloud Storage
* **What it is**: High-durability object storage service compatible with Amazon S3 APIs.
* **Why selected**: Cost-effective storage for digital asset binaries with strict access control bucket policies.
* **Role in Lumora**: Stores downloadable digital Zip archives in private bucket `lumora-products`, while public thumbnails and previews are served via CDN paths.
* **Codebase Location**: `backend/app/services/b2_storage.py` and `backend/app/api/upload_router.py`.

#### 10. Razorpay Gateway & RazorpayX Payout Engine
* **What it is**: Leading payment processing platform and automated business banking engine in India.
* **Why selected**: Native support for UPI, Credit/Debit cards, NetBanking, HMAC-SHA256 signature verification, and automated outbound payouts (RazorpayX).
* **Role in Lumora**: Handles customer checkout payments and dispatches affiliate/vendor earnings directly to bank accounts.
* **Codebase Location**: `backend/app/payments/` and `backend/app/api/payments/routes.py`.

---

# 3. SYSTEM ARCHITECTURE & DATA FLOWS

### 3.1 End-to-End System Architecture

```
                                LUMORA ARCHITECTURE FLOW
                                
 ┌────────────────┐         ┌───────────────────┐         ┌────────────────────┐
 │  User Browser  │ ──────> │  Vite SPA Client  │ ──────> │ Firebase Identity  │
 │ (React 18 UI)  │ <────── │ (Glassmorphism)   │ <────── │ (Auth Token Check) │
 └────────────────┘         └───────────────────┘         └────────────────────┘
         │                            │                             │
         │ REST API Calls             │ Bearer JWT                  │ Firebase UID
         ▼                            ▼                             ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         FASTAPI BACKEND GATEWAY                             │
 │    (Middlewares: CORS, slowapi Rate Limiter, Exception Handlers, RBAC)      │
 └─────────────────────────────────────────────────────────────────────────────┘
         │                     │                     │                     │
         ▼                     ▼                     ▼                     ▼
 ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 │ PostgreSQL   │      ┌ Firestore    │      │ Backblaze B2 │      │ Razorpay /   │
 │ (38 Tables)  │      │ Metadata     │      │ Private Vault│      │ RazorpayX    │
 │ Primary DB   │      │ Mirror       │      │ Product File │      │ Gateways     │
 └──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

### 3.2 Core System Data Flow Pipelines

#### A. User Registration & Multi-Role Authentication Flow
```
Client (Register Form) ──> Firebase Auth (Creates Account & Returns IdToken)
                            │
                            ▼
Client Calls Backend: POST /api/auth/register (Header: Bearer IdToken)
                            │
                            ▼
FastAPI verifies IdToken with Firebase Admin SDK ──> Extracts Email & UID
                            │
                            ▼
SQLAlchemy creates record in PostgreSQL `users` table with Role ('customer'/'vendor'/'affiliate')
                            │
                            ▼
FastAPI returns custom Lumora JWT Access Token (HMAC-SHA256) ──> Saved in Client LocalStorage
```

#### B. Product Discovery & Tamper-Proof Cart Flow
1. **Catalog Browsing**: Client requests `GET /api/products?category=UI Kits&page=1`. FastAPI queries PostgreSQL with `created_at DESC` filtering where `status = 'approved'`.
2. **Cart Addition**: Items are stored in React context state and persisted in PostgreSQL `cart_items` table for authenticated users.

#### C. Checkout, Razorpay Payment & Download Authorization Flow
```
1. Customer initiates Checkout ──> POST /api/payments/create-order
   Backend recalculates cart total directly from `products` database table (overrides client pricing).
   
2. Backend calls Razorpay API ──> Generates Gateway Order ID (`order_99x827a`) ──> Returns to Client.

3. Client opens Razorpay Modal ──> Customer enters UPI / Card credentials ──> Completes Payment.

4. Client sends Webhook / Callback ──> POST /api/payments/verify
   Params: razorpay_order_id, razorpay_payment_id, razorpay_signature.

5. Backend verifies HMAC-SHA256 signature using RAZORPAY_KEY_SECRET:
   generated_sig = hmac_sha256(order_id + "|" + payment_id, secret)
   
6. IF Signature Matches:
   ├── Commit `Order` & `OrderItem` records to PostgreSQL (Status: 'completed').
   ├── Insert transaction log into `Payment` ledger.
   ├── Trigger Affiliate Commission engine (calculates and credits commission).
   ├── Send in-app Notification to customer.
   └── Unlock product in Customer Download Vault with 15-min JWT download token.
```

#### D. Product Download Delivery Stream
```
Customer clicks Download ──> GET /api/products/{id}/download?token={download_jwt}
                               │
                               ▼
Backend verifies JWT Token signature, expiration (15 mins), and single-use event
                               │
                               ▼
Backend verifies PostgreSQL `orders` table to confirm User purchased Product ID
                               │
                               ▼
FastAPI streams binary file chunks directly from Backblaze B2 private bucket to Client
(Client never sees raw Backblaze storage URL).
```

---

# 4. FOLDER STRUCTURE EXPLANATION

### 4.1 Frontend Repository Structure (`lumora/frontend/`)
```
frontend/
├── public/                 # Static public assets, favicon, site manifests
├── src/
│   ├── api/                # Axios / fetch instance wrappers for backend REST endpoints
│   ├── components/         # Reusable UI widgets (Navbar, Footer, GlassCard, Modal, Button)
│   ├── context/            # React Context providers (AuthContext, CartContext, ThemeContext)
│   ├── hooks/              # Custom React hooks (useAuth, useFetch, useDebounce)
│   ├── layouts/            # Page container wrappers (MainLayout, AuthLayout, DashboardLayout)
│   ├── pages/              # Application view pages
│   │   ├── auth/           # Login, Register, ForgotPassword, VerifyEmail
│   │   ├── customer/       # Customer Dashboard, Purchases, Downloads, Wishlist, Settings
│   │   ├── vendor/         # Vendor Dashboard, AddProduct, ManageProducts, Earnings
│   │   ├── affiliate/      # Affiliate Dashboard, Referral Links, Analytics, Payouts
│   │   └── marketplace/    # Home, Products catalog, ProductPage, Cart, Checkout, Success
│   ├── styles/             # Modular CSS stylesheet files
│   ├── firebase.js         # Firebase Client SDK initialization
│   ├── index.css           # Core Glassmorphism CSS design system & utility classes
│   ├── responsive.css      # Mobile, tablet, and widescreen media queries
│   └── App.jsx             # Main Application routing entry point with React Router DOM
├── index.html              # HTML5 entry template with Google Fonts (Inter, Outfit)
├── tailwind.config.js      # Utility CSS extension mapping
├── vite.config.js          # Vite build options & development proxy configuration
└── package.json            # NPM dependencies and script commands
```

### 4.2 Admin Portal Repository Structure (`lumora/admin-app/`)
```
admin-app/
├── src/
│   ├── api/                # Admin-specific REST API calls (`/api/admin/*`)
│   ├── components/         # Admin UI components (DataTables, KPI Cards, Status Badges)
│   ├── pages/admin/        # Dedicated Admin operational views
│   │   ├── Dashboard.jsx            # High-level platform KPIs & revenue metrics
│   │   ├── AdminUserManagement.jsx  # Customer/Vendor/Affiliate management
│   │   ├── ProductsManagement.jsx   # Product approval, rejection, and editing
│   │   ├── OrdersManagement.jsx     # Financial order monitoring and refunds
│   │   ├── AffiliateManagement.jsx  # Affiliate tracking & 9-point payout radar
│   │   ├── PlatformFinance.jsx      # Treasury ledger & platform fee breakdown
│   │   ├── AuditLogs.jsx            # System audit trails and security logs
│   │   └── Reports.jsx              # Custom SQL report generator & analytics
│   └── App.jsx             # Admin portal router with strict RBAC guards
```

### 4.3 Backend Repository Structure (`lumora/backend/`)
```
backend/
├── app/
│   ├── api/                # FastAPI Router Modules (Controller Layer)
│   │   ├── admin/          # Admin management API endpoints
│   │   ├── affiliate/      # Referral tracking, links, commission & payout APIs
│   │   ├── auth_router.py  # Registration, login, token refresh, user info
│   │   ├── cart_router.py  # Cart item addition, deletion, sync
│   │   ├── orders.py       # Order placement, order history, invoice APIs
│   │   ├── payments/       # Razorpay order generation & signature verification
│   │   ├── products_router.py # Catalog retrieval, search, filter, upload, download
│   │   ├── vendors/        # Vendor store configuration & product management
│   │   └── wishlist_router.py # Customer wishlist management
│   ├── core/               # Core configuration, security settings, JWT helpers
│   ├── db/                 # Database engine setup (`database.py`), session management
│   ├── middleware/         # Rate limiting (`slowapi`), CORS, logging middleware
│   ├── models/             # SQLAlchemy Database Entity Models (38 Tables)
│   ├── schemas/            # Pydantic data validation contracts (DTOs)
│   ├── services/           # Business logic services (B2 Storage, Email, Webhooks)
│   └── main.py             # FastAPI App entry point, middleware attachment, routers
├── requirements.txt        # Python package dependencies
└── seed_db.py              # Initial database seeding script (categories, admin user)
```

---

# 5. DATABASE DESIGN & ENTITY RELATIONSHIPS

### 5.1 Relational Database Summary (PostgreSQL — 38 Entities)

Lumora utilizes a normalized relational database schema in PostgreSQL.

```
                               ER DIAGRAM OVERVIEW
                               
   ┌───────────────┐  1     N  ┌───────────────┐  1     N  ┌───────────────┐
   │     User      │ ────────> │    Vendor     │ ────────> │    Product    │
   │ (user_id PK)  │           │  (vendor_id)  │           │ (product_id)  │
   └───────────────┘           └───────────────┘           └───────────────┘
     1 │       1 │                                                 │ 1
       │         │                                                 │
     N │       N │                                                 │ N
       ▼         ▼                                                 ▼
┌───────────┐ ┌───────────┐                                 ┌───────────────┐
│   Order   │ │ Affiliate │                                 │ OrderItem     │
│ (order_id)│ │ Profile   │                                 │ (order_id FK) │
└───────────┘ └───────────┘                                 └───────────────┘
     │ 1           │ 1                                             │
     │             │                                               │
     ▼ N           ▼ N                                             │
┌───────────┐ ┌───────────────┐                                    │
│  Payment  │ │ ReferralLink  │ <──────────────────────────────────┘
└───────────┘ └───────────────┘
```

### 5.2 Comprehensive Entity Definitions

#### 1. `users` Table
* **Description**: Primary user account repository for all platform actors.
* **Key Columns**: `id` (PK, Integer), `firebase_uid` (String, Unique, Index), `email` (String, Unique), `hashed_password` (String), `role` (Enum: 'customer', 'vendor', 'affiliate', 'admin'), `full_name` (String), `is_active` (Boolean), `created_at` (DateTime).
* **Relationships**: Has one `Vendor`, has one `AffiliateProfile`, has many `Orders`, `WishlistItems`, `Notifications`.

#### 2. `products` Table
* **Description**: Stores digital product listings available in the marketplace.
* **Key Columns**: `id` (PK), `title` (String), `description` (Text), `price` (Decimal(10,2)), `category` (String, Index), `status` (Enum: 'pending', 'approved', 'rejected'), `vendor_id` (FK -> vendors.id), `file_url` (String - Backblaze B2 path), `thumbnail_url` (String), `preview_url` (String), `downloads_count` (Integer), `is_featured` (Boolean), `created_at` (DateTime).

#### 3. `orders` & `order_items` Tables
* **Description**: Immutable transaction records of purchases made by customers.
* **`orders` Columns**: `id` (PK), `user_id` (FK -> users.id), `order_number` (String, Unique), `total_amount` (Decimal), `discount_amount` (Decimal), `final_amount` (Decimal), `status` (Enum: 'pending', 'completed', 'failed', 'refunded'), `created_at`.
* **`order_items` Columns**: `id` (PK), `order_id` (FK -> orders.id), `product_id` (FK -> products.id), `price` (Decimal), `vendor_id` (FK -> vendors.id).

#### 4. `payments` Table
* **Description**: Gateway payment ledger records.
* **Key Columns**: `id` (PK), `order_id` (FK -> orders.id), `user_id` (FK), `razorpay_order_id` (String), `razorpay_payment_id` (String), `razorpay_signature` (String), `amount` (Decimal), `currency` (String), `status` (String).

#### 5. `affiliate_profiles`, `referral_links`, `affiliate_commissions` Tables
* **`affiliate_profiles`**: `id` (PK), `user_id` (FK), `referral_code` (Unique), `commission_rate` (Decimal, e.g. 0.10 for 10%), `earnings_balance` (Decimal), `pending_balance` (Decimal), `total_withdrawn` (Decimal).
* **`referral_links`**: `id` (PK), `affiliate_id` (FK), `product_id` (FK, Nullable), `unique_code` (String, Unique), `clicks_count` (Integer).
* **`affiliate_commissions`**: `id` (PK), `affiliate_id` (FK), `order_id` (FK), `amount` (Decimal), `status` (Enum: 'pending', 'approved', 'paid'), `created_at`.

#### 6. Auxiliary Entities
* `vendors`: Vendor store details, bio, logo, payout bank info, approval status.
* `wishlist_items` & `cart_items`: User persistent cart and wishlist associations.
* `recently_viewed`: Tracks customer product view history for personalized recommendations.
* `price_alerts`: Target price notifications set by users for specific products.
* `product_download_events`: Audit trail for file download requests containing IP, timestamp, and download token ID.
* `platform_treasury_ledger`: Double-entry accounting log recording platform fees, vendor shares, and affiliate splits per order.

---

# 6. AUTHENTICATION & SECURITY

### 6.1 Multi-Role Role-Based Access Control (RBAC)
Lumora enforces strict multi-role isolation across 4 distinct user roles:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ROLE ISOLATION MATRIX                           │
├──────────────┬──────────┬──────────┬───────────┬──────────────┬────────┤
│ Endpoint Group│ Public   │ Customer │ Vendor    │ Affiliate    │ Admin  │
├──────────────┼──────────┼──────────┼───────────┼──────────────┼────────┤
│ Catalog View │  ALLOWED │ ALLOWED  │ ALLOWED   │ ALLOWED      │ ALLOWED│
│ Cart/Checkout│  DENIED  │ ALLOWED  │ DENIED    │ DENIED       │ ALLOWED│
│ Product Upload│ DENIED  │ DENIED   │ ALLOWED   │ DENIED       │ ALLOWED│
│ Payout Claim │  DENIED  │ DENIED   │ ALLOWED   │ ALLOWED      │ DENIED │
│ Admin Portal │  DENIED  │ DENIED   │ DENIED    │ DENIED       │ ALLOWED│
└──────────────┴──────────┴──────────┴───────────┴──────────────┴────────┘
```

### 6.2 Token Authentication Architecture
1. **Identity Provider Verification**: Firebase Authentication handles initial user identity validation.
2. **Backend JWT Issuance**: Upon successful Firebase verification, FastAPI issues a custom HMAC-SHA256 signed JSON Web Token (JWT).
   * **Claims Payload**: `{ "sub": user_id, "email": email, "role": role, "exp": timestamp }`.
3. **Session Persistence**: Stored in client `localStorage`, automatically injected into the `Authorization: Bearer <token>` HTTP header by frontend Axios interceptors.

### 6.3 Secure Asset Tokenization (Single-Use Download JWTs)
To prevent direct URL sharing and file piracy:
* Product files are **NEVER** exposed via public static URLs.
* When a customer requests a download, FastAPI generates a **short-lived (15-minute expiration), single-use Download JWT token** encoded with `user_id`, `product_id`, and `order_id`.
* The download endpoint validates that the purchasing user matches the token payload before streaming file bytes directly from Backblaze B2.

### 6.4 Application Security Hardening Measures
* **SQL Injection Defense**: 100% database queries utilize SQLAlchemy ORM parameterized statements; raw SQL string concatenation is strictly prohibited.
* **Cross-Site Scripting (XSS)**: React automatically escapes HTML entity strings in rendering views.
* **Rate Limiting**: `slowapi` rate limiting middleware prevents brute-force login and API scraping attacks (e.g., max 5 login requests per minute per IP).
* **Input Data Validation**: All incoming REST payloads are validated using strict Pydantic schemas, rejecting malformed JSON payloads instantly.

---

# 7. CUSTOMER MODULE — EVERY FEATURE

1. **User Registration & Email Verification**: Firebase signup, sending verification email link, role assignment ('customer').
2. **Secure Login & Session Persistence**: Email/password authentication, JWT storage, automatic state hydration on page refresh.
3. **Responsive Glassmorphism Landing Page**: Dynamic hero banners, visual category cards, trending product carousel, animated statistics counters.
4. **Product Catalog & Search Engine**: Full-text search, ordering strictly by `created_at DESC` for Recently Added items, pagination controls.
5. **19-Category Filtering System**: Multi-category filter selection (UI Kits, React Templates, E-books, Design Systems, Notion Templates, AI Prompts, Mobile Apps, Python Scripts, etc.).
6. **Product Detail Page**: Full product description, thumbnail image gallery, vendor profile preview, price display, version history list, customer reviews.
7. **Interactive Wishlist**: Add/remove products from wishlist, heart icon state toggle, persistent wishlist drawer view.
8. **Cart Management System**: Add items to cart, adjust quantities, calculate real-time item subtotal, clear cart, persistent database sync.
9. **Razorpay Checkout Engine**: Price re-verification from database, Razorpay order creation, payment gateway integration modal, success handler.
10. **Customer Dashboard**: Overview of recent purchases, total money spent counter, quick access to download vault.
11. **Purchases History**: Detailed list of all completed orders, itemized invoice breakdown, payment transaction references.
12. **Secure Download Vault**: List of purchased assets with instant single-use 15-minute download token buttons.
13. **Recently Viewed Products**: Automatically tracks and displays the last 10 products inspected by the customer.
14. **Price Alert Notifications**: Set custom price drop alerts for target products, receive in-app notifications when price drops.
15. **Product Review & Rating System**: Post star ratings (1 to 5 stars) and text reviews for purchased products.
16. **Support Ticket Center**: Create customer support tickets, select category (Billing, Download Issue, Bug), track ticket resolution status.
17. **In-App Notification Center**: Real-time notification updates for order status, price alerts, and system updates with 'mark as read' controls.
18. **User Profile Settings**: Update personal details, change avatar image, update display name.
19. **Password Reset Flow**: Request password reset email via Firebase Auth.
20. **Responsive UI Micro-Interactions**: Smooth hover elevations, confettis on purchase completion (`canvas-confetti`), toast notification alerts.

---

# 8. VENDOR MODULE — EVERY FEATURE

1. **Vendor Application & Onboarding**: Apply for creator account, submit store name, store description, bio, social links, and banking info.
2. **Vendor Dashboard**: Real-time sales summary, total earnings counter, net revenue graphs, recent store order notifications.
3. **Digital Asset Upload Flow**: Upload title, description, price, category, thumbnail image, preview image, and downloadable main `.zip` file.
4. **Backblaze B2 Direct Asset Integration**: Automates private bucket upload for product source files and public CDN upload for media previews.
5. **Product Version Management (`ProductVersion`)**: Upload updated product builds, specify version number (e.g. `v1.2.0`), add changelog release notes.
6. **Product Listing Management**: Edit existing product descriptions/prices, toggle product availability status, request product deletion.
7. **Product Moderation Status Tracking**: Track listing approval states ('pending admin review', 'approved', 'rejected with feedback').
8. **Vendor Sales Analytics**: Comprehensive analytics dashboard showing page view count, conversion rates, and monthly revenue.
9. **Earnings Ledger & Balance Breakdown**: Clear view of `total_revenue`, `platform_fee_deducted` (10%), and `withdrawable_balance`.
10. **Withdrawal Request Flow**: Submit earnings withdrawal requests to verified bank account (minimum ₹10 threshold).
11. **Withdrawal History**: Track status of payout requests ('pending', 'approved', 'disbursed', 'rejected') with UTR numbers.
12. **Customer Reviews Management**: View customer reviews left on vendor products, respond to feedback.
13. **Vendor Storefront Customization**: Custom banner upload, store logo upload, public store profile URL (`/creator/:store_slug`).
14. **Activity Logs & Notifications**: Receive alerts when a customer purchases a product or leaves a review.

---

# 9. AFFILIATE MODULE — EVERY FEATURE

1. **Affiliate Registration & Profile Activation**: Single-click affiliate account creation, automatic custom `referral_code` generation.
2. **Affiliate Dashboard**: Overview of total clicks, converted purchases, total commission earned, pending balance, and payout history.
3. **Custom Referral Link Generator**: Generate unique affiliate tracking URLs for specific products (`/product/:slug?ref=CODE`) or general site links (`/?ref=CODE`).
4. **Referral Click Tracking Engine (`ReferralClick`)**: Captures referral clicks, visitor IP address, user agent, HTTP referrer, timestamp, and sets persistent client referral cookies (30-day attribution window).
5. **Self-Referral Fraud Prevention Guard**: Prevents affiliates from using their own referral link to purchase products and earn self-commissions (IP + User ID matching).
6. **4-Tier Commission Fallback Hierarchy**:
   * **Level 1**: Product-specific custom commission rate (e.g. 20%).
   * **Level 2**: Affiliate-specific custom profile rate (e.g. 15%).
   * **Level 3**: Vendor-defined affiliate commission percentage.
   * **Level 4**: Platform global default rate (10%).
7. **Real-Time Commission Ledger (`AffiliateCommission`)**: Calculates and logs exact commission split on every completed order.
8. **Earnings & Balance Breakdown**: Tracks `earnings_balance` (available for withdrawal) vs `pending_balance` (held during refund clearance window).
9. **Payout Request Disbursal**: Submit payout requests directly from dashboard to linked UPI ID / Bank account.
10. **Payout Transaction History**: Itemized record of past payout disbursements with bank reference numbers and status logs.
11. **Affiliate Analytics Charts**: Visual graph of link clicks vs converted orders over custom date ranges.
12. **Product Catalog Referral Finder**: Browse marketplace products sorted by highest commission percentage to pick promotional items easily.

---

# 10. ADMIN MODULE — EVERY FEATURE

1. **Dedicated Admin Portal**: Isolated, secure admin application (`admin-app/`) with custom login authentication.
2. **Platform KPI Overview Dashboard**: Displays total platform GMV (Gross Merchandise Value), net platform revenue, total active users, vendor count, and total orders.
3. **Customer & User Management (`AdminUserManagement`)**: View all registered users, filter by role, edit account status, freeze/unfreeze accounts, change user roles.
4. **Vendor Verification & Moderation (`Vendors`)**: Review vendor store applications, inspect submitted KYC banking details, approve or reject vendor status.
5. **Product Approval & Moderation Workflow (`ProductsManagement`)**: Inspect pending vendor product uploads, verify thumbnail/preview files, approve listing for live marketplace or reject with feedback.
6. **Product Price & Category Overrides**: Admin power to update product category classification, feature listings on homepage, or edit pricing.
7. **Order & Transaction Monitoring (`OrdersManagement`)**: Real-time view of all platform orders, inspect Razorpay transaction IDs, filter by order status.
8. **Refund Processing Engine**: Review customer refund requests (`RefundRequest`), trigger automated gateway refunds, reverse vendor/affiliate commission ledger entries atomically.
9. **Platform Treasury & Financial Ledger (`PlatformFinance`)**: Comprehensive ledger monitoring platform 10% fee cuts, total vendor payouts, affiliate payouts, and net bank balances.
10. **Affiliate Payout 9-Point Audit Radar (`AffiliateManagement`)**: Pre-payment verification radar performing 9 automated security cross-checks before disbursing affiliate funds:
    * Check 1: User account active status verification.
    * Check 2: Minimum payout threshold clearance (₹10.00).
    * Check 3: Double-entry ledger balance reconciliation.
    * Check 4: Fraudulent self-referral check.
    * Check 5: Bank account / UPI format validation.
    * Check 6: Duplicate transaction ID check.
    * Check 7: Order refund window clearance.
    * Check 8: RazorpayX balance sufficiency check.
    * Check 9: Admin authorization verification.
11. **System Audit Logs (`AuditLogs`)**: Immutable record capturing all administrative actions (who approved a product, who issued a refund, timestamp, IP address).
12. **Admin Support Ticket Center (`AdminSupportInbox`)**: View, assign, and respond to support tickets submitted by customers or vendors.
13. **Custom SQL Report Generator (`Reports`)**: Execute pre-configured analytical SQL queries to export custom CSV reports for financial accounting.
14. **Platform Settings & Configuration (`Settings`)**: Update platform global commission rates, maintain maintenance mode toggles, update contact emails.

---

# 11. API DOCUMENTATION SUMMARY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MAJOR API ROUTE MATRIX                             │
├───────────────────┬────────┬───────────────────────────────┬────────────────┤
│ Endpoint Group    │ Method │ Target Path                   │ Auth Required  │
├───────────────────┼────────┼───────────────────────────────┼────────────────┤
│ Authentication    │ POST   │ /api/auth/register            │ None           │
│ Authentication    │ POST   │ /api/auth/login               │ None           │
│ Authentication    │ GET    │ /api/auth/me                  │ Bearer JWT     │
│ Products Catalog  │ GET    │ /api/products                 │ None           │
│ Products Catalog  │ POST   │ /api/products/upload          │ Vendor JWT     │
│ Products Download │ GET    │ /api/products/{id}/download   │ Download JWT   │
│ Cart Management   │ POST   │ /api/cart/items               │ Customer JWT   │
│ Order Placement   │ POST   │ /api/orders                   │ Customer JWT   │
│ Payment Order     │ POST   │ /api/payments/create-order    │ Customer JWT   │
│ Payment Verify    │ POST   │ /api/payments/verify          │ Customer JWT   │
│ Affiliate Link    │ POST   │ /api/affiliate/links          │ Affiliate JWT  │
│ Affiliate Payout  │ POST   │ /api/affiliate/payouts        │ Affiliate JWT  │
│ Admin Products    │ PUT    │ /api/admin/products/{id}/status│ Admin JWT     │
│ Admin Payouts     │ POST   │ /api/admin/payouts/{id}/approve│ Admin JWT    │
└───────────────────┴────────┴───────────────────────────────┴────────────────┘
```

---

# 12. UI/UX DESIGN SYSTEM

### 12.1 Glassmorphism Visual Architecture
Lumora uses a modern, high-contrast visual design system based on dark aesthetic principles:
* **Backgrounds**: Deep space dark hues (`#0B0F19`, `#111827`) paired with vibrant purple radial gradient glows.
* **Glass Cards**: Semi-transparent card containers featuring `backdrop-filter: blur(16px)`, `background: rgba(255, 255, 255, 0.03)`, and 1px luminous border strokes (`rgba(255, 255, 255, 0.08)`).
* **Color Palette**: Primary Purple (`#8B5CF6`), Electric Indigo (`#6366F1`), Success Emerald (`#10B981`), Danger Coral (`#EF4444`), Clean White Text (`#F9FAFB`).

### 12.2 Micro-Interactions & Motion Design
* **Framer Motion Elements**: Smooth page transition fades, staggered grid entrances for product cards, and modal backdrop scale-ins.
* **Three.js & Dynamic Visuals**: Interactive 3D ambient particle mesh on landing page hero section.
* **Canvas Confetti**: Celebratory particle burst executed upon successful Razorpay order verification.
* **Responsive Breakpoints**: Dedicated responsive stylesheet (`responsive.css`) supporting Mobile (320px–640px), Tablet (768px–1024px), and Desktop (1280px+).

---

# 13. STORAGE & DIGITAL ASSET ARCHITECTURE

### 13.1 Backblaze B2 Object Storage Architecture
Digital files are categorized and isolated into separate cloud storage paths:

```
Backblaze B2 Cloud Bucket: `lumora-products`
├── public/                 # CDN-accessible public media assets
│   ├── thumbnails/         # Product cover images (.jpg, .png, .webp)
│   └── previews/           # Product screenshot galleries & PDF sample previews
└── private/                # Strictly protected digital asset source files
    └── assets/             # Full product downloadable archives (.zip, .rar, .pdf)
```

### 13.2 Asset Streaming & Download Security Flow
1. **No Static Links**: Raw Backblaze S3 URLs are never returned in public API JSON responses.
2. **Stream Proxy Handler**: File requests route through FastAPI (`GET /api/products/{id}/download`).
3. **Chunked Streaming**: Files are fetched from Backblaze B2 as an asynchronous byte stream (`httpx` or `aiofiles`) and piped to the user response headers (`Content-Disposition: attachment; filename="product.zip"`).

---

# 14. PAYMENT WORKFLOW (RAZORPAY INTEGRATION)

### 14.1 Complete Payment Lifecycle

```
[ Customer ]                [ FastAPI Backend ]             [ Razorpay Gateway ]
     │                              │                                │
     │── 1. Selects Cart Checkout ─>│                                │
     │                              │── 2. Re-verifies Price ───────>│
     │                              │   Calculates total from DB     │
     │                              │                                │
     │                              │── 3. POST /orders ────────────>│
     │                              │   (Create Gateway Order)       │
     │                              │<── 4. Returns razorpay_order_id│
     │<── 5. Sends Order ID ────────│                                │
     │                              │                                │
     │── 6. Opens Razorpay Modal ───────────────────────────────────>│
     │   (Completes UPI/Card Payment)                                │
     │<── 7. Receives Payment ID & HMAC Signature ───────────────────│
     │                              │                                │
     │── 8. POST /api/payments/verify ─────────────────────────────>│
     │   (order_id, payment_id, signature)                           │
     │                              │── 9. Validates Signature ─────│
     │                              │   HMAC-SHA256 Verification     │
     │                              │   Committed Order & Ledger DB  │
     │<── 10. Purchase Confirmed ───│                                │
```

### 14.2 Signature Verification & Security
To guarantee that payment confirmation cannot be forged by client-side browser tampering:
```python
# Server-side Signature Validation Logic
expected_signature = hmac.new(
    key=RAZORPAY_KEY_SECRET.encode(),
    msg=f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
    digestmod=hashlib.sha256
).hexdigest()

if not hmac.compare_digest(expected_signature, razorpay_signature):
    raise PaymentVerificationError("Fraudulent payment signature detected!")
```

---

# 15. TESTING & QUALITY ASSURANCE

### 15.1 QA Certification & Verification Matrix
The Lumora platform underwent forensic quality assurance auditing across **15 distinct test modules** totaling **234 test cases**.

```
┌─────────────────────────────────────────────────────────────┬────────┐
│ Forensic QA Audit Metric                                    │ Result │
├─────────────────────────────────────────────────────────────┼────────┤
│ Total Executed Test Cases                                   │ 234    │
│ Passed Test Cases                                           │ 227    │
│ Resolved / Remediated Defect Items                          │ 7      │
│ Unresolved High/Medium Defects                              │ 0      │
│ Final Initial Pass Rate Percentage                          │ 97.0%  │
│ Database Double-Entry Financial Precision                   │ 100%   │
│ Production Launch Status                                    │ PASSED │
└─────────────────────────────────────────────────────────────┴────────┘
```

### 15.2 Key QA Testing Modules
1. **Authentication Testing**: Verified JWT token expiration, invalid credential rejection, password hashing strength (bcrypt), and cross-role unauthorized access prevention.
2. **Financial Precision Testing**: Verified zero-floating-point discrepancy by storing currency values in `DECIMAL(10,2)` fields and validating double-entry treasury balance equality.
3. **Idempotency Testing**: Executed rapid double-clicks on checkout buttons to verify that duplicate Razorpay orders and duplicate database commits are impossible.
4. **Security Penetration Testing**: Executed SQL injection payloads in search fields, attempted XSS string injections, and attempted unauthorized download token reuse.

---

# 16. CHALLENGES FACED & IMPLEMENTED SOLUTIONS

### 1. SQLite to Remote Render PostgreSQL Migration
* **Challenge**: Local development initially utilized SQLite (`lumora.db`), which lacked support for Postgres-specific Enums, concurrency locks, and SSL connections required by Render.
* **Cause**: Differences in SQL dialects and connection string formatting.
* **Solution**: Standardized models using SQLAlchemy abstract types, implemented `psycopg2-binary` drivers, wrote database migration scripts (`migrate_db.py`), and enforced SSL mode (`sslmode=require`).

### 2. Backblaze B2 File Proxy & Streaming Performance
* **Challenge**: Exposing direct Backblaze file links led to asset piracy risks, while downloading entire 500MB zip files into server RAM before streaming caused server out-of-memory crashes.
* **Solution**: Built an asynchronous HTTP chunked streaming proxy service in FastAPI using `httpx.stream()` to pipe file bytes directly from Backblaze B2 to the browser without buffering full files in RAM.

### 3. Fraud-Resistant Affiliate Referral Attribution
* **Challenge**: Preventing affiliates from referring themselves or manipulating link tracking parameters to steal sales commissions.
* **Solution**: Engineered a multi-layered verification check storing client cookies, IP address hashes, and user ID matches, automatically disqualifying self-referrals during payment verification.

### 4. Multi-Role Token Synchronization
* **Challenge**: Users logged into different roles (e.g. Vendor vs Customer) experienced context state leaks when switching between portal interfaces.
* **Solution**: Enforced strict role-scoped JWT token decoding in FastAPI dependency injection handlers (`require_role("vendor")`), throwing HTTP 403 Forbidden errors if token role claims mismatch.

---

# 17. MAJOR ENGINEERING ACHIEVEMENTS

1. **Enterprise Multi-Role Architecture**: Successfully engineered 4-role isolation (Customer, Vendor, Affiliate, Admin) with unified authentication.
2. **Secure Digital Distribution Engine**: Designed a 15-minute single-use JWT signed download system protecting high-value creator assets.
3. **Automated Double-Entry Financial Ledger**: Built zero-leak financial ledger tracking platform fees, vendor revenues, and affiliate commissions with 100% precision.
4. **Custom Dark Glassmorphism Design System**: Built a modern design system using React 18, Framer Motion, and custom CSS without relying on generic template themes.
5. **Certified Production Readiness**: Successfully completed 234 QA test cases achieving a 97.0% pass rate and official launch certification.

---

# 18. PPT SLIDE-BY-SLIDE PRESENTATION STRUCTURE (25 SLIDES)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 25-SLIDE PRESENTATION STRUCTURE OVERVIEW                    │
├───────┬──────────────────────────────────┬──────────────────────────────────┤
│ Slide │ Title                            │ Primary Visual / Diagram         │
├───────┼──────────────────────────────────┼──────────────────────────────────┤
│ 1     │ Title & Student Introduction     │ Project Logo & Student Details   │
│ 2     │ Executive Project Summary        │ Problem vs Solution Callout Box  │
│ 3     │ Real-World Problem Statement     │ Comparison Table                 │
│ 4     │ Target Audience & User Roles     │ 4-Role Persona Cards             │
│ 5     │ Overall System Architecture      │ High-Level Architecture Flowchart│
│ 6     │ Complete Tech Stack Overview     │ Technology Layer Grid            │
│ 7     │ Frontend Architecture & React 18 │ Component Tree Diagram           │
│ 8     │ UI/UX Design System              │ Color Palette & Glassmorphism UI │
│ 9     │ Backend API Engine (FastAPI)     │ Router & Middleware Architecture │
10     │ Database Design & Schema (38T)   │ Entity Relationship Diagram (ERD)│
11     │ Multi-Role Auth & Security       │ RBAC Access Matrix Table         │
12     │ Customer Discovery & Cart Flow   │ Search & Filter Flowchart        │
13     │ Secure Razorpay Payment Lifecycle│ Payment Sequence Diagram         │
14     │ Digital Asset Vault & Storage B2 │ Download Token Security Diagram  │
15     │ Vendor Module & Product Upload   │ Vendor Studio Flowchart          │
16     │ Affiliate Commission Engine      │ 4-Tier Fallback Hierarchy Diagram│
17     │ Admin Governance & Treasury      │ 9-Point Payout Audit Radar Visual│
18     │ System Security & Vulnerability  │ Security Hardening Bullet Grid   │
19     │ Software QA & Testing Report     │ 234 Test Cases KPI Summary       │
20     │ Key Technical Challenges Faced   │ Problem -> Solution Cards        │
21     │ Major Engineering Achievements   │ Key Achievements Metric Badges   │
22     │ Future Scope & Enhancements      │ Feature Roadmap Timeline         │
23     │ Live Project Demonstration       │ Live App Screenshots Carousel    │
24     │ Conclusion & Summary             │ Project Summary Highlights       │
25     │ Q&A / Examiner Thank You         │ Thank You & Contact Information  │
└───────┴──────────────────────────────────┴──────────────────────────────────┘
```

### Detailed Presenter Guide for Each Slide

#### Slide 1: Title & Student Introduction
* **Slide Title**: Lumora — High-Performance Digital Asset & Creator Commerce Marketplace
* **Bullets**: Diploma Final Project Presentation | MSBTE Curriculum | Developed by: Samruddhi Durge | Guided by: Project Coordinator & Technical Faculty.
* **Presenter Script (45 sec)**: *"Respected External Examiner and Faculty Members, good morning. I am Samruddhi Durge, and today I am proud to present my final diploma internship project: Lumora. Lumora is a secure, high-performance digital marketplace platform engineered to help creators sell digital products with automated affiliate tracking, secure cloud downloads, and real-time payment processing."*

#### Slide 2: Executive Project Summary
* **Slide Title**: Executive Project Summary
* **Bullets**: Digital Products Marketplace | Built for Designers & Developers | Eliminates Asset Piracy | Integrated 4-Tier Affiliate Engine.
* **Presenter Script (45 sec)**: *"Lumora addresses the growing digital economy. Unlike generic e-commerce platforms designed for physical shipping, Lumora is custom-built for digital products such as React templates, UI kits, and e-books. It protects creator intellectual property while providing an instant, seamless buying experience."*

#### Slide 3: Real-World Problem Statement
* **Slide Title**: Problem Statement & Real-World Need
* **Bullets**: Direct URL Leaks in Traditional Stores | High Platform Commissions | Lack of Transparent Affiliate Attribution | Vulnerable Download Links.
* **Presenter Script (45 sec)**: *"When digital products are sold on traditional platforms, asset links often get shared publicly, leading to revenue loss for creators. Furthermore, existing platforms lack automated multi-role governance. Lumora solves this by implementing single-use signed download tokens and strict role-based isolation."*

#### Slide 4: Target Audience & User Roles
* **Slide Title**: Multi-Role Platform Ecosystem
* **Bullets**: Customers (Browse, Buy, Download) | Vendors (Upload, Monetize, Track Sales) | Affiliates (Promote, Track Clicks, Earn Commission) | Admin (Governance, Approval, Treasury).
* **Presenter Script (45 sec)**: *"Lumora features 4 isolated user roles. Customers enjoy seamless discovery and instant vault access. Vendors receive dedicated creator tools and version control. Affiliates earn transparent referral commissions, and Platform Admins govern treasury ledgers and product quality."*

#### Slide 5: Overall System Architecture
* **Slide Title**: Complete System Architecture
* **Visual**: High-level flowchart showing React Frontend ──> FastAPI Backend ──> PostgreSQL / Backblaze B2 / Razorpay.
* **Presenter Script (60 sec)**: *"This diagram illustrates our end-to-end decoupled system architecture. The single-page React frontend communicates with our asynchronous FastAPI backend over HTTPS REST APIs. Database operations are handled by PostgreSQL, media files are stored securely in Backblaze B2, and payments are processed via Razorpay."*

#### Slide 6: Complete Tech Stack Overview
* **Slide Title**: Modern Enterprise Technology Stack
* **Visual**: Tech Stack Badge Grid (React, Vite, FastAPI, Python, PostgreSQL, Firebase, Razorpay, Backblaze B2).
* **Presenter Script (45 sec)**: *"We selected industry-standard open-source technologies. React 18 and Vite deliver ultra-fast client-side rendering. FastAPI provides high-concurrency Python backend performance, and PostgreSQL ensures ACID-compliant transactional reliability across 38 database tables."*

#### Slide 7: Frontend Architecture & React 18
* **Slide Title**: Single Page Application Frontend
* **Bullets**: React 18 Hooks & Context API | Axios REST Interceptors | React Router DOM Routing | State Hydration.
* **Presenter Script (45 sec)**: *"Our frontend architecture uses custom React hooks and Context API for global state management across shopping carts and user authentication. HTTP interceptors handle JWT bearer headers automatically for every API call."*

#### Slide 8: UI/UX Design System
* **Slide Title**: Custom Dark Glassmorphism Interface
* **Visual**: Screenshots of Lumora Glass Cards, Purple Accents, and Dark Backdrop.
* **Presenter Script (45 sec)**: *"Instead of relying on standard template themes, we designed a custom Glassmorphic design system using modern CSS styling. Semi-transparent dark surfaces, purple gradient highlights, and micro-interactions powered by Framer Motion give Lumora a premium aesthetic."*

#### Slide 9: Backend API Engine (FastAPI)
* **Slide Title**: Asynchronous Python API Engine
* **Bullets**: FastAPI Asynchronous I/O | Pydantic Schema Validation | Centralized Exception Handling | OpenAPI Documentation.
* **Presenter Script (45 sec)**: *"The backend is built using FastAPI. Utilizing Python's `asyncio` loop, the server handles thousands of concurrent requests efficiently. Input schemas are strictly validated using Pydantic models to prevent invalid data ingestion."*

#### Slide 10: Database Design & Schema (38 Tables)
* **Slide Title**: PostgreSQL Relational Database Schema
* **Visual**: ER Diagram showing User, Vendor, Product, Order, Payment, and Affiliate tables.
* **Presenter Script (60 sec)**: *"Our database design consists of 38 normalized PostgreSQL entities hosted on Render. Strict foreign key constraints enforce relational integrity between users, vendor stores, products, order items, and affiliate ledger tables."*

#### Slide 11: Multi-Role Auth & Security
* **Slide Title**: Authentication & Role-Based Access Control (RBAC)
* **Visual**: Role Matrix Table (Customer, Vendor, Affiliate, Admin).
* **Presenter Script (45 sec)**: *"Security is fundamental to Lumora. Firebase Authentication manages initial user identity, while FastAPI issues HMAC-SHA256 signed JWT tokens. Role-based access control guards every API endpoint to prevent unauthorized role escalation."*

#### Slide 12: Customer Discovery & Cart Flow
* **Slide Title**: Product Discovery & Dynamic Cart Engine
* **Bullets**: 19-Category Filtering | Full-Text Search (`created_at DESC`) | Database-Synced Cart | Wishlist Drawer.
* **Presenter Script (45 sec)**: *"Customers can explore digital assets across 19 categories or perform instant full-text searches. Cart items are synchronized with the database in real time, ensuring a seamless shopping experience across devices."*

#### Slide 13: Secure Razorpay Payment Lifecycle
* **Slide Title**: Razorpay Gateway & Server-Side Price Verification
* **Visual**: Sequence Diagram of Payment Order Creation and HMAC Verification.
* **Presenter Script (60 sec)**: *"To prevent checkout price tampering, our backend recalculates order totals directly from database product records before calling Razorpay. Once paid, server-side HMAC-SHA256 signature verification validates the transaction before granting access."*

#### Slide 14: Digital Asset Vault & Storage B2
* **Slide Title**: Digital Asset Protection & Single-Use Download Tokens
* **Visual**: Diagram showing Download Request -> Token Validation -> Backblaze B2 Streaming.
* **Presenter Script (60 sec)**: *"Digital assets are stored in private Backblaze B2 cloud vaults. When a customer downloads an item, Lumora generates a single-use 15-minute JWT download token. Files are streamed directly through our proxy, keeping raw cloud storage URLs completely hidden."*

#### Slide 15: Vendor Module & Product Upload
* **Slide Title**: Creator Studio & Digital Product Upload Flow
* **Bullets**: Multi-Asset Upload (Thumbnails, Previews, Zip Archives) | Version Control (`ProductVersion`) | Moderation Tracking.
* **Presenter Script (45 sec)**: *"Creators use the Vendor Studio to publish products, upload main `.zip` files, and release software updates with detailed changelogs. Products enter a pending queue for admin review prior to catalog publication."*

#### Slide 16: Affiliate Commission Engine
* **Slide Title**: 4-Tier Commission Fallback Engine & Link Tracking
* **Visual**: 4-Tier Fallback Hierarchy Flowchart.
* **Presenter Script (60 sec)**: *"Lumora features a powerful referral tracking system. When a purchase occurs via an affiliate link, our commission engine calculates payouts using a 4-tier fallback hierarchy while actively blocking self-referral fraud."*

#### Slide 17: Admin Governance & Treasury
* **Slide Title**: Platform Administration & 9-Point Payout Radar
* **Visual**: Screenshot of Admin Dashboard & 9-Point Audit Radar.
* **Presenter Script (60 sec)**: *"Platform administrators govern marketplace quality, approve vendor applications, and oversee the platform treasury ledger. Before disbursing affiliate earnings, our 9-Point Audit Radar executes automated verification checks."*

#### Slide 18: System Security & Vulnerability Defense
* **Slide Title**: Application Security Hardening Measures
* **Bullets**: SQL Injection Prevention via SQLAlchemy ORM | XSS escaping in React | Rate Limiting via `slowapi` | CORS Protection.
* **Presenter Script (45 sec)**: *"Lumora is hardened against security threats. Parameterized SQL queries eliminate injection vectors, React handles XSS prevention, and rate-limiting middleware blocks automated brute-force attacks."*

#### Slide 19: Software QA & Testing Report
* **Slide Title**: Quality Assurance Certification (234 Test Cases)
* **Visual**: QA Summary Table (97.0% Pass Rate, 15 Test Modules).
* **Presenter Script (45 sec)**: *"Quality assurance was conducted across 15 test modules covering 234 test cases. Lumora achieved a 97.0% initial pass rate, with 100% resolution of all identified defect items prior to launch certification."*

#### Slide 20: Key Technical Challenges Faced
* **Slide Title**: Technical Challenges & Solutions Implemented
* **Bullets**: SQLite to PostgreSQL SSL Migration | Backblaze Chunked Byte Streaming | Fraud-Resistant Affiliate Attribution.
* **Presenter Script (60 sec)**: *"During development, we solved complex technical challenges, including migrating from SQLite to Render PostgreSQL over SSL, optimizing Backblaze file streaming to prevent memory spikes, and engineering self-referral fraud protection."*

#### Slide 21: Major Engineering Achievements
* **Slide Title**: Major Technical Achievements
* **Visual**: Metric Badges (4-Role Isolation, 15-Min JWT Delivery, Double-Entry Treasury, 234 Certified Tests).
* **Presenter Script (45 sec)**: *"Our key achievements include building a multi-role web application, implementing tokenized digital asset delivery, creating a zero-leak financial ledger, and completing comprehensive QA certification."*

#### Slide 22: Future Scope & Enhancements
* **Slide Title**: Future Roadmap & Enhancements
* **Bullets**: Multi-Currency International Payments | AI-Powered Product Recommendations | Automated Vendor KYC via API | Mobile App Integration.
* **Presenter Script (45 sec)**: *"In future iterations, we plan to introduce multi-currency support, AI-driven product discovery recommendations, and automated KYC verification to further scale the platform."*

#### Slide 23: Live Project Demonstration
* **Slide Title**: Live System Demonstration
* **Visual**: Carousel of Live Application Screenshots (Marketplace, Cart, Vendor Studio, Admin Portal).
* **Presenter Script (45 sec)**: *"Here we see live application screenshots demonstrating the seamless navigation, responsive catalog layout, vendor management tools, and admin audit dashboard."*

#### Slide 24: Conclusion & Summary
* **Slide Title**: Project Conclusion & Key Takeaways
* **Bullets**: Fully Functional Production-Ready Platform | Robust Architecture & Security | Complete Academic & Professional Standards.
* **Presenter Script (30 sec)**: *"In conclusion, Lumora successfully fulfills all design objectives, providing a secure, scalable, and visually compelling marketplace for digital creators."*

#### Slide 25: Q&A / External Examiner Thank You
* **Slide Title**: Thank You / Questions & Answers
* **Visual**: Project Repository & Student Contact Information.
* **Presenter Script (15 sec)**: *"Thank you, respected examiners, for your time and attention. I am now open to your questions."*

---

# 19. VIVA / EXTERNAL EXAMINER TECHNICAL QUESTIONS & ANSWERS (50 Q&As)

### Easy Difficulty Questions (Q1 to Q15)

#### Q1: What is Lumora and what is its main objective?
* **Topper Answer**: *"Lumora is a full-stack digital marketplace designed for creators to sell digital assets like UI kits, React templates, and e-books. Its main objective is to provide secure file delivery using tokenized streams, transparent affiliate commission tracking, and seamless Razorpay payment processing."*

#### Q2: What frontend framework and build tool did you use for Lumora?
* **Topper Answer**: *"We used React 18.3 as our component framework and Vite 5.3 as our build tool and development server."*

#### Q3: Why did you choose Vite over create-react-app or Webpack?
* **Topper Answer**: *"Vite uses native ES modules during development and Esbuild for bundling, providing sub-second Hot Module Replacement and faster production builds compared to legacy Webpack."*

#### Q4: Which backend framework is used in Lumora and why?
* **Topper Answer**: *"We used FastAPI 0.110 in Python. It was chosen for its high-performance asynchronous I/O capabilities, automatic OpenAPI documentation, and native Pydantic schema validation."*

#### Q5: Which database is used in production for Lumora?
* **Topper Answer**: *"We use PostgreSQL hosted on Render (`lumora_db_k4ni`) connected over SSL, managing 38 relational tables using SQLAlchemy ORM."*

#### Q6: How do users authenticate on Lumora?
* **Topper Answer**: *"Initial identity authentication is handled by Firebase Auth. The backend then issues a custom HMAC-SHA256 signed JWT token stored in client `localStorage` and sent via Bearer headers."*

#### Q7: What are the 4 user roles in Lumora?
* **Topper Answer**: *"The four isolated user roles are Customer, Vendor, Affiliate, and Platform Administrator."*

#### Q8: Which payment gateway is integrated into Lumora?
* **Topper Answer**: *"We integrated Razorpay for customer order checkout and RazorpayX for automated outbound affiliate/vendor payouts."*

#### Q9: Where are the digital product files stored?
* **Topper Answer**: *"Digital product source archives are stored securely in a private Backblaze B2 cloud storage bucket (`lumora-products`)."*

#### Q10: How do you prevent direct public downloading of product files?
* **Topper Answer**: *"Files are never exposed via public URLs. Instead, users receive single-use 15-minute JWT download tokens, and FastAPI streams the file bytes directly from Backblaze B2 after verifying purchase ownership."*

#### Q11: What styling approach did you use for the UI?
* **Topper Answer**: *"We engineered a custom CSS Glassmorphism design system utilizing backdrop blur filters, dark mode purple hues, and responsive layout styling (`responsive.css`)."*

#### Q12: Which animation libraries are used in the application?
* **Topper Answer**: *"We use Framer Motion 11 for UI transitions, GSAP 3 for hero visual flows, and Three.js for interactive 3D particle elements."*

#### Q13: How many categories are supported in the marketplace?
* **Topper Answer**: *"Lumora supports 19 distinct digital asset categories, including UI Kits, React Templates, E-books, Design Systems, and Notion Templates."*

#### Q14: How are products ordered on the Recently Added page?
* **Topper Answer**: *"Products are queried from PostgreSQL using `ORDER BY created_at DESC` filtering where `status = 'approved'`."*

#### Q15: What is ORM and which ORM did you use?
* **Topper Answer**: *"ORM stands for Object Relational Mapper. We used SQLAlchemy 2.0.35 in Python to map database tables to Python objects and execute parameterized SQL queries."*

---

### Medium Difficulty Questions (Q16 to Q35)

#### Q16: Explain how you prevent price tampering during customer checkout.
* **Topper Answer**: *"Client-side prices sent in request bodies are ignored. When `POST /api/payments/create-order` is called, the FastAPI backend fetches the official price of each item directly from PostgreSQL product records and recalculates the total server-side before invoking Razorpay."*

#### Q17: How does Razorpay payment signature verification work?
* **Topper Answer**: *"After client payment, the frontend sends `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `/api/payments/verify`. The backend computes an HMAC-SHA256 hash of `order_id + '|' + payment_id` using our secret key and compares it with the received signature using `hmac.compare_digest()`."*

#### Q18: Explain the 4-tier commission fallback hierarchy in the Affiliate engine.
* **Topper Answer**: *"When an affiliate sale occurs, the system checks commission rates in order: Level 1 checks for a product-specific rate; if null, Level 2 checks the affiliate's profile rate; Level 3 checks the vendor's default rate; and Level 4 falls back to the platform global default rate (10%)."*

#### Q19: How does Lumora prevent self-referral fraud in the affiliate module?
* **Topper Answer**: *"During payment validation, the system compares the purchasing user's account ID and IP hash against the affiliate profile owner's ID and IP log. If a match is detected, commission generation is blocked."*

#### Q20: What is the purpose of the 9-Point Payout Audit Radar in the Admin panel?
* **Topper Answer**: *"The 9-Point Audit Radar executes automated verification checks before disbursing affiliate earnings. It verifies account status, minimum withdrawal thresholds (₹10), ledger balances, fraud logs, bank formatting, and RazorpayX balance sufficiency."*

#### Q21: How do you handle file uploads to Backblaze B2 without locking the server?
* **Topper Answer**: *"Uploads are handled asynchronously using Python's `aiofiles` and non-blocking I/O tasks. Thumbnails are routed to public B2 paths, while main product files are uploaded to private bucket storage."*

#### Q22: Explain the single-use 15-minute JWT download token mechanism.
* **Topper Answer**: *"When a user clicks download, FastAPI generates a JWT signed with a secret key containing `user_id`, `product_id`, and an expiration time of 15 minutes. Upon access, the server verifies the token signature, checks expiration, logs the event, and invalidates single-use reuse."*

#### Q23: How do you prevent SQL Injection vulnerabilities in Lumora?
* **Topper Answer**: *"All database operations use SQLAlchemy ORM abstractions which execute parameterized SQL queries under the hood, ensuring user inputs are treated strictly as data parameters rather than executable SQL code."*

#### Q24: What steps were taken to prevent Cross-Site Scripting (XSS)?
* **Topper Answer**: *"React automatically sanitizes string variables before rendering them into the DOM. For dynamic HTML content, strict input validation and escaping are enforced."*

#### Q25: How does rate limiting work in your backend?
* **Topper Answer**: *"We use `slowapi` rate limiting middleware attached to FastAPI endpoints. It tracks client IP addresses and limits request frequencies (e.g., maximum 5 login attempts per minute)."*

#### Q26: Describe the migration process from SQLite to PostgreSQL.
* **Topper Answer**: *"We updated column types to support PostgreSQL native Enums and `DECIMAL(10,2)` types, replaced SQLite driver strings with `psycopg2-binary`, updated SQLAlchemy engine bindings to enforce SSL connection parameters, and executed `migrate_db.py` to transfer schema tables."*

#### Q27: How does double-entry accounting work in the Platform Treasury Ledger?
* **Topper Answer**: *"Every completed order generates an immutable entry in `platform_treasury_ledger` recording the gross payment, debiting the 10% platform fee, and crediting net vendor balances and affiliate commissions, ensuring zero-sum financial balance."*

#### Q28: Explain how React Context API is used for State Management.
* **Topper Answer**: *"We use `AuthContext` to hold global user identity state and `CartContext` to hold shopping cart items. Context providers wrap the component tree in `App.jsx`, making state available globally without prop drilling."*

#### Q29: What are Axios Interceptors and why are they used in Lumora?
* **Topper Answer**: *"Axios request interceptors capture outgoing HTTP calls and inject the `Authorization: Bearer <jwt_token>` header automatically. Response interceptors handle global 401 Unauthorized errors to trigger user logout."*

#### Q30: What is the purpose of Pydantic schemas in FastAPI?
* **Topper Answer**: *"Pydantic schemas define data validation models for request bodies and response envelopes. They validate data types, enforce field requirements, and automatically reject invalid JSON payloads."*

#### Q31: How is product versioning handled for vendors?
* **Topper Answer**: *"Vendors can upload new release builds which create records in the `product_versions` table linked to `product_id`, capturing version numbers (e.g. `v1.2.0`), release notes, and file paths."*

#### Q32: What is the role of `seed_db.py` in your project?
* **Topper Answer**: *"`seed_db.py` initializes the database with baseline categories, essential platform settings, and default super-admin credentials required for initial system bootstrapping."*

#### Q33: How does Lumora handle responsive design across devices?
* **Topper Answer**: *"Responsive design is handled via a dedicated `responsive.css` file combined with CSS Grid and Flexbox, utilizing breakpoints at 320px, 640px, 768px, 1024px, and 1280px."*

#### Q34: What is the difference between `earnings_balance` and `pending_balance` in the Affiliate module?
* **Topper Answer**: *"`pending_balance` holds newly earned commissions during the customer refund window. Once cleared, funds transfer to `earnings_balance`, which is available for withdrawal."*

#### Q35: How does FastAPI handle global exception handling?
* **Topper Answer**: *"FastAPI uses custom exception handlers registered via `@app.exception_handler()`. They intercept runtime errors and return standardized JSON error envelopes without exposing raw tracebacks to clients."*

---

### Hard / Advanced Difficulty Questions (Q36 to Q50)

#### Q36: Explain how chunked asynchronous byte streaming works when downloading files from Backblaze B2.
* **Topper Answer**: *"To download large zip files without buffering them completely into server RAM, FastAPI uses an asynchronous HTTP client (`httpx.stream()`) to open a stream connection to Backblaze B2. It reads chunks (e.g., 64KB blocks) and yields them directly to FastAPI's `StreamingResponse`, resulting in low RAM usage."*

#### Q37: How do you handle race conditions during concurrent order processing?
* **Topper Answer**: *"We use PostgreSQL row-level locks using SQLAlchemy's `.with_for_update()` query execution during order verification. This locks the targeted database rows during transaction execution, preventing race conditions."*

#### Q38: Describe how idempotency is enforced during payment verification.
* **Topper Answer**: *"When a payment confirmation request arrives, the backend checks if `razorpay_payment_id` already exists in the `payments` table. If present, the server returns the existing order details without re-committing inventory or crediting double commissions."*

#### Q39: Explain how CORS middleware is configured in `main.py` and why it is critical.
* **Topper Answer**: *"Cross-Origin Resource Sharing (CORS) middleware defines allowed origins (e.g., `https://lumora.app`), allowed headers, and HTTP methods. It prevents unauthorized third-party websites from making cross-origin API calls to our backend."*

#### Q40: How does the system handle database session lifecycle management in FastAPI?
* **Topper Answer**: *"We use Python context managers and FastAPI dependency injection (`Depends(get_db)`). Each API request receives a fresh SQLAlchemy session which is automatically closed in a `finally` block after request completion."*

#### Q41: Explain how HMAC-SHA256 signature verification works theoretically and practically.
* **Topper Answer**: *"HMAC (Hash-based Message Authentication Code) uses a secret key and a cryptographic hash function (SHA-256) to produce a digest of the payload. Practically, `razorpay_order_id + '|' + razorpay_payment_id` is hashed server-side using the secret key, matching gateway output."*

#### Q42: What is the purpose of `psycopg2-binary` versus `asyncpg` in PostgreSQL connections?
* **Topper Answer**: *"`psycopg2-binary` is a standard PostgreSQL adapter for Python. In SQLAlchemy 2.0, thread pooling handles synchronous database calls efficiently while maintaining full compatibility with Render PostgreSQL SSL mode."*

#### Q43: How does Lumora maintain data consistency between PostgreSQL and Firebase Firestore?
* **Topper Answer**: *"PostgreSQL serves as the primary source of truth. When updates occur (e.g. user profile changes), background tasks update Firestore document metadata asynchronously, keeping Firestore views in sync without blocking primary database commits."*

#### Q44: What security measures protect the Admin portal from unauthorized escalation?
* **Topper Answer**: *"The admin portal is hosted on a separate application build (`admin-app/`). Endpoints are guarded by `require_role('admin')` dependency handlers which decode JWT token claims and verify admin role status in PostgreSQL."*

#### Q45: Explain the database indexing strategy implemented across Lumora's 38 tables.
* **Topper Answer**: *"Indexes are added to frequently queried columns, including `firebase_uid`, `email`, `category`, `status`, `vendor_id`, and `created_at` fields, optimizing query lookup times from $O(N)$ full table scans to $O(\log N)$ B-Tree lookups."*

#### Q46: How does the system handle refund processing and ledger reversals?
* **Topper Answer**: *"When an admin approves a refund via `RefundRequest`, the system initiates a Razorpay gateway refund call, updates the order status to `refunded`, and atomically reverses vendor earnings and affiliate commissions in a single database transaction."*

#### Q47: What is the purpose of `render.yaml` or `vercel.json` deployment manifests?
* **Topper Answer**: *"`vercel.json` configures single-page application rewriting rules for Vercel deployment so routes redirect to `index.html`. `render.yaml` specifies environment variables, build commands, and service runtime configs for Render."*

#### Q48: How does the system handle password hashing and storage?
* **Topper Answer**: *"Passwords are hashed using `passlib` with the `bcrypt` algorithm utilizing key stretching and unique per-pass salts, ensuring raw passwords are never stored in plain text."*

#### Q49: Explain how `slowapi` interacts with client IP headers behind proxies.
* **Topper Answer**: *"Behind reverse proxies like Render or Cloudflare, `slowapi` inspects `X-Forwarded-For` HTTP headers to extract the true client IP address, ensuring accurate rate-limiting counts."*

#### Q50: How do you verify that Lumora is 100% production-ready?
* **Topper Answer**: *"Production readiness was verified by executing 234 QA test cases across 15 audit modules, achieving a 97.0% initial pass rate, remediating 100% of defect items, and certifying financial ledger precision."*

---

# 20. VERBATIM FINAL PRESENTATION SCRIPT (10–12 MINUTES)

**Presentation Title**: Lumora — High-Performance Digital Asset & Creator Commerce Marketplace  
**Speaker**: Samruddhi Durge  
**Target Duration**: 10 to 12 Minutes  

---

### [00:00 - 01:30] Introduction & Project Vision
*"Respected External Examiner, Project Coordinator, and Faculty Members — Good morning.*

*My name is Samruddhi Durge, and today I am excited to present my diploma final internship project: **Lumora — a High-Performance Digital Asset and Creator Commerce Marketplace**.*

*In today's digital economy, thousands of designers, developers, and creators produce valuable digital assets — such as UI templates, React component libraries, e-books, and code modules. However, selling digital goods on generic physical e-commerce platforms presents significant challenges.*

*Platforms like WooCommerce or standard Shopify themes are engineered for shipping physical boxes. When applied to digital assets, they expose serious vulnerabilities: direct file URLs get leaked leading to piracy, platform fees range up to 30%, affiliate tracking is fragile, and file delivery is slow.*

*Lumora was engineered specifically to solve these problems. It is a secure, high-performance marketplace platform featuring custom Glassmorphic aesthetics, single-use 15-minute tokenized file downloads, a 4-tier affiliate commission engine, and integrated Razorpay payment verification."*

---

### [01:30 - 03:30] Technology Stack & Architecture
*"Now, let us examine the technical foundation of Lumora.*

*Architecturally, Lumora is built as a decoupled, micro-services-inspired Single Page Application.*

*On the **Frontend**, we use **React 18.3** bundled with **Vite 5.3**. We engineered a custom **CSS Glassmorphism Design System** using dark mode aesthetics, backdrop blurs, and responsive breakpoints. UI transitions and visual flows are powered by **Framer Motion 11**, **GSAP 3**, and **Three.js**.*

*On the **Backend**, we chose **FastAPI 0.110** in Python. FastAPI provides asynchronous I/O capabilities, yielding fast API response times while validating incoming data using **Pydantic** schemas.*

*Our primary database is **PostgreSQL** hosted on Render over SSL, managing **38 relational tables** mapped via **SQLAlchemy 2.0 ORM**. User authentication is managed through **Firebase Authentication** combined with custom **HMAC-SHA256 signed JWT tokens**.*

*Digital asset source files are stored in a private **Backblaze B2 Cloud Storage** vault, and payment processing is integrated using **Razorpay** and **RazorpayX** payout gateways."*

---

### [03:30 - 06:00] Key Modules & Feature Engineering
*"Lumora supports four distinct user roles, each with strict role-based access control:*

*1. **Customer Module**: Customers can browse digital assets across 19 categories or perform full-text searches ordered by recently added items. They can manage a dynamic shopping cart, complete checkout via Razorpay, track order history, and access their secure Download Vault.*

*2. **Digital Asset Protection**: To eliminate file piracy, product files are never exposed via static links. When a user clicks download, FastAPI generates a single-use, 15-minute JWT signed download token. The server streams byte chunks directly from Backblaze B2, keeping cloud URLs completely hidden.*

*3. **Vendor Creator Studio**: Creators can set up store profiles, upload thumbnails, previews, and main zip archives, and publish software version updates with changelogs.*

*4. **Affiliate Commission Engine**: Affiliates generate custom referral links. Our engine tracks referral clicks, sets 30-day attribution cookies, and calculates commissions using a 4-tier fallback hierarchy while actively blocking self-referral fraud.*

*5. **Admin Governance Portal**: Platform administrators use an isolated admin application to approve products, verify vendor applications, oversee platform treasury ledgers, and disburse affiliate payouts using a 9-Point Pre-Payment Audit Radar."*

---

### [06:00 - 08:00] Payment Security, Fraud Defense & Financial Precision
*"Let us focus on security and financial integrity — two areas where Lumora excels.*

*To prevent checkout price tampering, client-side prices are overridden. When a user checks out, our backend recalculates order totals directly from database records before calling Razorpay.*

*Upon payment completion, server-side HMAC-SHA256 signature verification validates the transaction before updating database records. Duplicate payment IDs are blocked to ensure idempotency.*

*Financially, all transactions are recorded in `DECIMAL(10,2)` fields within an immutable double-entry treasury ledger, tracking platform fees, vendor shares, and affiliate commissions with zero rounding leaks."*

---

### [08:00 - 09:30] QA Testing, Challenges & Solutions
*"During development, our engineering team conducted quality assurance across **15 audit modules** totaling **234 test cases**.*

*The platform achieved a **97.0% initial pass rate** with 100% resolution of all identified defects prior to launch certification.*

*We overcame several technical challenges during development:*
* First, migrating from SQLite to Remote Render PostgreSQL over SSL required updating column types and handling secure database drivers.
* Second, streaming large 500MB zip files from Backblaze B2 without causing memory spikes was solved by building an asynchronous chunked byte-streaming proxy in FastAPI.
* Third, blocking self-referral affiliate fraud was achieved by matching account IDs and client IP hashes during payment verification."*

---

### [09:30 - 11:00] Demonstration & Key Achievements
*"In summary, the key achievements of the Lumora project include:
1. Complete 4-Role Isolation across Customer, Vendor, Affiliate, and Admin portals.
2. Tokenized Digital Delivery protecting high-value creator assets.
3. Automated Double-Entry Financial Ledger precision.
4. Comprehensive QA Certification across 234 test scenarios.

Lumora fulfills all requirements of a modern digital commerce marketplace."*

---

### [11:00 - 12:00] Conclusion & Q&A Call
*"Respected examiners, Lumora is a fully functional, production-ready digital marketplace built to professional software standards.*

*Thank you for your time and guidance throughout this internship project. I am now ready to answer any questions you may have.*

*Thank you!"*

---
*End of Presentation Master Package — Certified for Lumora Diploma Final Project Defense.*
