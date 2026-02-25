# OpenTicket Platform - Product Requirements Document

## Original Problem Statement
Make the event ticketing platform production-ready.

## Application Architecture
- **Frontend**: React + TypeScript (Vite) at `/app/frontend/`
- **Backend**: Express.js (Node.js ESM) at `/app/api/server.js` + `/app/backend/`
- **Database**: Supabase (PostgreSQL)
- **Auth**: Firebase + Supabase Auth
- **Payments**: Stripe
- **Email**: Resend
- **Deployment**: Vercel

## Core Requirements (User Explicit)
1. Event visibility/presale flows, presale signup emails, universal email layouts, event duplication
2. Updated app logo (light/dark mode versions)
3. Full security, functional, and UX audits
4. Monetization and paywall security audit (prevent revenue leakage)
5. Fix all UI/UX visibility and contrast issues in light mode
6. Change primary brand color from yellow → medium teal
7. Fix persistent auto-reloading on preview page
8. Fix super admin payout system and Stripe credential saving
9. Achieve "100/100" product readiness - fix all data integrity and financial logic issues

## What's Been Implemented

### Security (Previous Sessions)
- CSRF Protection: Full-stack implementation with `csurf` backend middleware + frontend token fetch
- Monetization Security: `enforcePlanLimits.js` middleware prevents free-plan users exceeding limits
- Helmet.js, express-rate-limit, express-validator security stack

### UI/Theme (Previous Sessions)
- Primary brand color changed from yellow → medium teal (`--primary` CSS variable)
- Light-mode visibility fixes across LandingPage, Dashboard, SuperAdminDashboard
- Fixed button contrast issues in multiple components

### Bug Fixes & Features (Current Session - Feb 23, 2026)
- **owner_id undefined bug FIXED**: `eventController.js` `updateEvent()` was referencing undefined variable `owner_id` (should be `userId`). Fixed on lines 209 and 220. Event save/publish now works.
- **Rate Limiter Fix**: `paymentLimiter` (10 req/15min) was being applied to ALL `/api/stripe` routes including `calculate-order`. Fixed by adding `skip` function so `calculate-order`, `verify-session`, and `exchange-rates` bypass the strict payment limiter. Now uses its own 120 req/min limiter.
- **Fee Absorbed Badge**: Added "No Service Fees — Covered by Organizer" badge in ticket selection area when `event.absorbFees=true`. Added "Fees covered by organizer" note in Order Summary.
- **Fee Breakdown Tooltip**: Added ⓘ info icons with hover tooltips next to "Platform Fee" (→ "Helps keep OpenTicket running") and "Payment Processing" (→ "Standard Stripe fee (2.9% + $0.30)") in Order Summary.
- **Check-in data model refactor**: Removed redundant `check_in_statuses` writes from `registrationController.js` and `kioskController.js`. `ticket.checkedIn` is now the single source of truth. `checked_in` / `checked_in_at` kept for SQL-level queries.
- **Backend hot-reload fixed**: Added `fs.watch` watcher to `api/server.js` — server auto-restarts when backend files change (supervisor `autorestart=true` handles the fresh start). No more manual `supervisorctl restart backend` needed for code changes.
- **Fee display confirmed working**: Platform Fee and Payment Processing show correctly in Order Summary when tickets are selected for paid events.


- **Pending Balance Fix**: `GET /api/admin/platform-payouts/pending` now subtracts in-flight (scheduled/pending) payouts from available balance. Shows `totalCollected`, `scheduledAmount`, and `amount` (available) breakdown.
- **at-door Payment Transaction Fix**: Fixed critical bug in `stripeController.js confirmAtDoorPayment()` - was using wrong column names (`type: 'sale'`, `net_amount`, `payment_method`, `payment_source`, `status: 'completed'`). Now uses correct schema: `transaction_type: 'at_door_payment'`, `gross_amount`, `platform_fee`, `stripe_fee`, `organizer_net`, `status: 'succeeded'`.
- **Data Clarity**: Confirmed `financial_transactions` uses `transaction_type` (not `type`) column. All inserts now use correct schema.

### Platform Settings (Current Session - Feb 2026)
- **New DB-backed Platform Settings**: `platformSettingsRoutes.js` completely rewritten to store Stripe keys in `platform_settings` Supabase table instead of flawed `.env` file approach.
- **Fallback to Env Vars**: When `platform_settings` table doesn't exist or has no data, falls back to environment variables. `tableExists` flag in response tells frontend about setup status.
- **Startup Loader**: `api/server.js` loads Stripe settings from DB at startup, overriding env vars.
- **SuperAdmin Form Fixed**: State variable inconsistency fixed. Form now correctly uses `platformStripePublishableKey`, `platformStripeSecretKey`, `platformStripeWebhookSecret`. Settings auto-load when opening Settings tab.
- **Webhook Secret Support**: Added webhook secret field to the Stripe settings form.

### Database Migrations (Current Session - Feb 2026)
- New migration: `backfill_transaction_types` - handles missing `type` column gracefully, returns SQL to run in Supabase SQL Editor
- SQL file created: `/app/database/migrations/add_type_to_financial_transactions.sql` - adds `type` column + `platform_settings` table
- Migration UI: "Transaction Type Backfill" button in Admin panel shows SQL copy button when column doesn't exist

## Important Database Notes
- `financial_transactions.type` column does NOT exist yet - requires manual SQL migration in Supabase
- `platform_settings` table does NOT exist yet - requires manual SQL migration in Supabase
- Run `/app/database/migrations/add_type_to_financial_transactions.sql` in Supabase SQL Editor to enable these features

## Key Files
- `/app/backend/routes/platformSettingsRoutes.js` - DB-backed platform settings
- `/app/backend/routes/adminRoutes.js` - Payout logic + migrations
- `/app/backend/controllers/stripeController.js` - Stripe payments (at-door fix applied)
- `/app/backend/controllers/stripeWebhookController.js` - Webhook handler
- `/app/backend/migrations/migrate_transaction_types.js` - Type backfill migration
- `/app/database/migrations/add_type_to_financial_transactions.sql` - SQL migration to run in Supabase
- `/app/frontend/components/SuperAdminDashboard.tsx` - 3700+ line admin dashboard
- `/app/frontend/styles/globals.css` - CSS variables (teal primary color)
- `/app/api/server.js` - Main Express server (platform settings startup loader)

## Pending Items (Prioritized)

### P0 - Critical (Resolved Feb 2026)
- ✅ Run SQL migration in Supabase SQL Editor (file: `/app/database/migrations/add_type_to_financial_transactions.sql`)
- ✅ Fixed Stripe key loading order: root `.env` has invalid `rk_live_` key; now `backend/.env` takes priority via `override:true` in `api/server.js`
- ✅ Fixed CSRF blocking `/api/stripe/verify-session` endpoint
- ✅ Re-enabled price validation in checkout (removed `VALIDATION_DISABLED` flag)
- ✅ Stripe webhook endpoint working correctly
- ✅ Post-payment confirmation screen: unblocked (verify-session now returns chargedCurrency/chargedAmount even on early-return path)
- ✅ Confirmation emails: now sent via Resend after verify-session processes payment
- ✅ Currency display in receipts: charged_currency now saved by both webhook handler and verify-session; normalizeRegistration maps it correctly
- ✅ Webhook handler now saves charged_currency/charged_amount in both RPC and fallback paths
- ✅ Removed duplicate session_id template from EventView successUrl
- ✅ EventView normalization now maps chargedCurrency from reg.charged_currency (snake_case fallback)
- ✅ **[Feb 23 2026] Fee Transparency & DB Reconciliation**:
  - `priceCalculator.js`: Added `stripeFee` (2.9% + $0.30) to breakdown, included in `grandTotal`. Added as Stripe line item in `buildStripeLineItems`.
  - `stripeController.js` createOrder: Added `subtotal`, `stripe_fee`, `custom_fees_amount` to `registrationPayload`. Added reconciliation validation (aborts write if sum ≠ total). Added `stripe_fee` to `applicationFeeAmount` for Connect accounts.
  - `EventView.tsx`: Replaced ALL inline fee calculations in Charge Summary with `orderBreakdown`-only display. Shows: Subtotal, Platform Fee, Payment Processing, Tax, Additional Fees, Total.
  - `EventView.tsx` Confirmation Page: Shows Platform Fee, Payment Processing, Additional Fees as separate rows.
  - `UI.tsx` ReceiptModal: Fee breakdown shows Platform Fee, Payment Processing, Additional Fees separately.
  - `normalization`: Fixed `customFeesAmount` to read from `reg.custom_fees_amount || reg.answers?._metadata?.custom_fees_amount`.
  - Migration: `/app/migrations/add_fee_transparency_columns.sql` adds `subtotal`, `stripe_fee`, `custom_fees_amount` columns.
  - Rate limiter: `calculate-order` now has 120 req/min (was sharing 10 req/15min with payment creation).

- ✅ **[Feb 23 2026] Payout 404 FIXED**: Added `POST /api/stripe/request-payout` endpoint to `stripeController.js` and `stripeRoutes.js`. Added CSRF exception for this endpoint in `api/server.js`.
- ✅ **[Feb 23 2026] Platform fees unified, Stripe processing fees corrected, refund processing repaired, Stripe keys corrected, price validation re-enabled, webhook secret fixed, CSRF tuned**
- ✅ **[Feb 24 2026] Dashboard UI/UX Overhaul (5 sub-tasks)**:
  - Added 30/60/90/All Time period filter tabs above stats row, stats update dynamically based on selected period
  - Fixed "No Data Available" bar in LiveRevenueWidget — replaced red-bordered error card with clean empty state (TrendingUp icon + "No sales data yet" message)
  - SMM Signup Card and Advanced Analytics button now on same row (grid-cols-2 desktop layout)
  - "Getting Started" card now uses framer-motion AnimatePresence for smooth exit animation when dismissed; X button uses React state (no page reload)
  - Fixed poor text contrast in KioskCheckIn: "already_checked_in" yellow background now shows black text (text-black) instead of white
- ✅ **[Feb 24 2026] Live Sales Widget Fix + More Contrast Fixes**:
  - Live Sales API query: added 'succeeded' to payment_status filter (covers all Stripe status variants); extended window from 24h → 48h
  - Refresh interval: reduced from 60s to 30s for faster live updates
  - Error state: now distinguishes between "API error" vs "no data yet" with different messages
  - Fixed `ConfirmContext.tsx` warning button: `bg-amber-500 text-white` → `text-black`
  - Fixed `EventView.tsx` approval success circle: `bg-amber-500 text-white` → `text-black`
  - Fixed `KioskCheckIn.tsx` fullscreen warning banner: `bg-amber-600 text-white` → `bg-amber-500 text-black`

- ✅ **[Feb 25 2026] Live Sales Widget + Bug Investigation**:
  - Dashboard.tsx: Added periodic refresh (30s setInterval + visibilitychange handler) so Live Sales Widget updates after new purchases. Used userIdRef to avoid stale closure problem.
  - CONFIRMED: Tax calculation is proportional (5% of subtotal, not fixed $5). The "$5 tax" the user saw was 5% of $100 tickets.
  - CONFIRMED: Purchase flow is working. 54 paid registrations in DB including 4 from Feb 25, 2026. No data loss.
  - CONFIRMED: Fee calculations correct. grandTotal = subtotal + tax + platformFee + stripeFee ✓

### P1 - High Priority
- User should re-test full purchase flow end-to-end to confirm confirmation emails and receipt screen

### P2 - Medium Priority
- Firebase TypeError console error: wrap Firebase UI init in useEffect
- SuperAdminDashboard.tsx refactor: 3700+ lines → modular components

### P3 - Backlog
- Remaining UX audit fixes: confusing search placeholder, inconsistent button styling, mobile checkout friction
- Check-in data model refactor: consolidate redundant status fields
- Backend module caching issue (recurring - use supervisor restart workaround)
- Cosmetic Stripe key warning in console


