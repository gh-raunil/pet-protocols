# Pet Protocols — Multi-Tenant Food Ordering Monorepo

Pet Protocols is architected into 4 independently runnable Next.js services:

1. **`backend/` (Port 4000)**: Unified REST API, MongoDB/Mongoose models, NextAuth handler, Razorpay payments, Cloudinary media, and multi-tenant authorization middleware.
2. **`frontend-user/` (Port 3000)**: Customer-facing food ordering storefront, interactive cart drawer, menu catalog, checkout, order tracking, and customer profile.
3. **`frontend-admin/` (Port 3001)**: Dedicated Restaurant Partner & Kitchen Management portal (live order processing, menu/dishes CRUD, kitchen SOPs, branch settings, superadmin broadcast ticker).
4. **`frontend-superadmin/` (Port 3002)**: Platform Governance & Multi-tenant control center (tenant/restaurant lifecycle management, multi-admin staff provisioning, platform revenue/order analytics).

---

## Service Ports Overview

| Service | Port | Description | Default Login |
| :--- | :--- | :--- | :--- |
| **Backend API** | `http://localhost:4000` | Core API, Auth & DB | N/A (Headless) |
| **Customer App** | `http://localhost:3000` | Customer Storefront | `customer@petprotocols.com` / `rounak` |
| **Restaurant Admin** | `http://localhost:3001` | Kitchen & Menu Hub | `admin@flagship.com` / `rounak` |
| **Superadmin Portal** | `http://localhost:3002` | Platform Governance | `superadmin@petprotocols.com` / `rounak` |

---

## Quick Start

### 1. Install Dependencies

Install the monorepo orchestrator and each service:

```bash
# Root
npm install

# Sub-projects
cd backend && npm install
cd ..\frontend-user && npm install
cd ..\frontend-admin && npm install
cd ..\frontend-superadmin && npm install
cd ..
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` in each subfolder:

```bash
copy backend\.env.example backend\.env.local
copy frontend-user\.env.example frontend-user\.env.local
copy frontend-admin\.env.example frontend-admin\.env.local
copy frontend-superadmin\.env.example frontend-superadmin\.env.local
```

Ensure `backend/.env.local` contains your `MONGODB_URI` and `NEXTAUTH_SECRET`. All frontends proxy `/api/*` requests to the backend (`http://127.0.0.1:4000`).

### 3. Database Seeding

You can seed the database from root:

```bash
# Clean slate: creates ONLY the Root Superadmin (superadmin@petprotocols.com / rounak)
npm run seed

# Demo mode: creates Superadmin + Flagship Restaurant + Restaurant Admin + 6 Dishes + Customer
npm run seed:demo
```

### 4. Running Locally

Start all 4 services concurrently in one terminal:

```bash
npm run dev
```

Or run any service individually:

```bash
npm run dev:backend       # Port 4000
npm run dev:user          # Port 3000
npm run dev:admin         # Port 3001
npm run dev:superadmin    # Port 3002
```

---

## Validation & Production Builds

Validate all builds across the entire workspace:

```bash
npm run build:all
```

Or build a specific application:

```bash
npm run build:backend
npm run build:user
npm run build:admin
npm run build:superadmin
```
