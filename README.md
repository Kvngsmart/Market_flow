# MarketFlow POS

MarketFlow is the foundation for a multi-tenant Nigerian retail POS and business-management platform.

## Current milestone: Multi-branch inventory foundation

Implemented in this first pass:

- Next.js App Router + TypeScript application shell.
- Merchant dashboard with responsive navigation, KPI cards, sales trend visualization, quick actions, product table search, and activity feed.
- Platform admin preview at `/admin` with subscription, MRR, business, and registration-growth views.
- Persistent light/dark theme toggle available from both merchant and platform-admin views; light mode preserves the original design.
- Tenant-aware PostgreSQL/Prisma schema covering businesses, memberships, branches, products, multi-barcodes, inventory balances/movements, sales, payments, subscriptions, and audit logs.
- Secure onboarding/login sessions with tenant-aware membership lookups and password hashing.
- The existing merchant dashboard reads authenticated user, business, branch, and role context while preserving its original preview fallback and layout.
- Tenant-scoped product search, barcode lookup, and product creation endpoints.
- Inventory management at `/inventory` with catalogue search, barcode counts, low-stock indicators, product creation/editing, CSV import, stock receiving, manual adjustments, damage/expiry movements, and audit records.
- Multi-branch workspace at `/branches` with branch creation, active-branch selection, branch-level stock summaries, and atomic stock transfers with paired movements and audit records.
- Cashier checkout at `/pos` with product search, category browsing, cart quantities, cash totals, receipt confirmation, idempotency keys, atomic stock decrements, inventory movements, and audit records.
- Sales and receipts at `/sales` with transaction search/filtering, receipt detail/printing, and owner/manager-controlled refunds that restore stock and write return movements.
- Cash-register control at `/register` with open/close shifts, cash expectations, variance calculation, audit records, and manager override rules.
- Tenant-scoped sales analytics at `/analytics` and `/api/analytics/sales` with revenue, transactions, average order value, gross profit, refunds, trend, payment mix, and top-product metrics.
- Payment-provider boundary at `/settings/payments` with Paystack, Flutterwave, and Monnify readiness indicators plus signed webhook verification at `/api/payments/webhooks/[provider]`; credentials remain server-side.
- Hosted electronic checkout at `/api/payments/checkout` initializes Paystack, Flutterwave, or Monnify from the server; verified webhooks settle the checkout into a sale and decrement stock exactly once.
- Subscription plan chooser at `/plans` with Starter, Business, and Enterprise pricing, annual/monthly display, and onboarding links; registration creates a 14-day trial subscription for the selected plan.
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
- Payment provider secrets belong only in server-side environment configuration. The UI never claims electronic payment success; hosted checkouts remain pending until provider verification settles them.
- Cash checkout computes prices from server-side product records and uses an idempotency key to protect against duplicate submissions.

## Prioritized next milestones

1. Add subscription billing and provider-specific subscription reconciliation.
2. Add analytics filters, report exports, and threshold alerts.
3. Add subscriptions management, platform administration, accounting journals, offline sync, and production test/observability infrastructure.
