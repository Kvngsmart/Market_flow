# MarketFlow POS

MarketFlow is the foundation for a multi-tenant Nigerian retail POS and business-management platform.

## Current milestone: Cashier checkout foundation

Implemented in this first pass:

- Next.js App Router + TypeScript application shell.
- Merchant dashboard with responsive navigation, KPI cards, sales trend visualization, quick actions, product table search, and activity feed.
- Platform admin preview at `/admin` with subscription, MRR, business, and registration-growth views.
- Persistent light/dark theme toggle available from both merchant and platform-admin views; light mode preserves the original design.
- Tenant-aware PostgreSQL/Prisma schema covering businesses, memberships, branches, products, multi-barcodes, inventory balances/movements, sales, payments, subscriptions, and audit logs.
- Secure onboarding/login sessions with tenant-aware membership lookups and password hashing.
- Tenant-scoped product search, barcode lookup, and product creation endpoints.
- Inventory management at `/inventory` with catalogue search, barcode counts, low-stock indicators, product creation, stock receiving, manual adjustments, damage/expiry movements, and audit records.
- Cashier checkout at `/pos` with product search, category browsing, cart quantities, cash totals, receipt confirmation, idempotency keys, atomic stock decrements, inventory movements, and audit records.
- `/api/health` service endpoint.
- Seed data for Sunrise Mart and Starter/Business/Enterprise plan records.
- Environment template for database, session, and payment-provider credentials.

## Run locally

Open this folder in VS Code. The included `.vscode/tasks.json` exposes install, infrastructure, migration, and dev-server tasks; `.vscode/launch.json` exposes a `MarketFlow: Next.js` launch target.

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Start PostgreSQL.
3. Install dependencies: `npm install`.
4. Create the database schema: `npm run db:migrate`.
5. Seed foundation records: `npm run db:seed`.
6. Start the app: `npm run dev`.

## Security notes

- Money is represented as integer minor units in the schema; no floating-point accounting is used.
- Sales have idempotency keys for duplicate-submit protection.
- Product barcodes are unique per business, not globally, so tenants remain isolated.
- Payment provider secrets belong only in server-side environment configuration. The UI does not claim electronic payment success; non-cash methods remain disabled until provider verification is integrated.
- Cash checkout computes prices from server-side product records and uses an idempotency key to protect against duplicate submissions.

## Prioritized next milestones

1. Add receipt history, refunds/returns, cash-register opening/closing, and shift reconciliation.
2. Add product editing, bulk import, and multi-branch stock transfers.
3. Add payment-provider adapters and webhook verification for Paystack, Flutterwave, and Monnify.
4. Replace dashboard sample view models with tenant-scoped analytics queries and report exports.
5. Add subscriptions, platform administration, accounting journals, offline sync, and production test/observability infrastructure.
