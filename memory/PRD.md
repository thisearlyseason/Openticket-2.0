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

### Financial System (Current Session - Feb 2026)
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
- ✅ Post-payment confirmation screen: unblocked (verify-session endpoint now works)

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


