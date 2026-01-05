# OpenTicket PRD - Product Requirements Document

## Original Problem Statement
OpenTicket is a full-stack event ticketing platform that enables organizers to sell tickets online with Stripe Connect integration for payment processing. The user requested:
1. Audit and fix all financial systems (Stripe Connect, payments, refunds, reporting)
2. Proper redirect after Stripe onboarding
3. Complete financial tracking across dashboards
4. Comprehensive audit log system
5. Fix slow payment confirmation process (timeout error)
6. Super Admin dashboard data integrity and financial tracking
7. Affiliate tracking, revenue attribution, and payout logic
8. **Super Admin button-triggered panel** for single super admin access

## Tech Stack
- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express.js
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Firebase Auth
- **Payments:** Stripe (Connect Express, Checkout)
- **Deployment:** Vercel-compatible structure

## Architecture
```
/app/
├── api/server.js              # Express.js main server (port 8001)
├── backend/
│   ├── controllers/           # Business logic
│   │   ├── stripeController.js       # Checkout, verify-session
│   │   ├── stripeConnectController.js # Connect onboarding
│   │   └── stripeWebhookController.js # Webhook handling
│   ├── routes/               # API routes
│   ├── services/             # Supabase, audit logging
│   └── utils/                # Price calculator
├── components/               # React components
├── services/                 # Frontend services
└── .env                      # Environment variables
```

## Key Database Tables
- `profiles`: User data with `stripe_connect_id`, `stripe_onboarding_complete`, `affiliate_code`, `affiliate_clicks`, `total_paid_out`, `is_admin`
- `events`: Event data with pricing, capacity
- `registrations`: Ticket purchases with payment tracking
- `financial_transactions`: Revenue/fee breakdown with `affiliate_code`, `affiliate_commission`
- `audit_logs`: Financial audit trail
- `promo_codes`: Discount codes for subscriptions and tickets
- `affiliate_payouts`: Audit trail for all affiliate payouts

---

## Implementation Status

### ✅ Completed (January 5, 2026)

#### Subscription Upgrade Flow (LATEST)
- [x] Backend `/api/subscription/create-checkout` - Creates Stripe Checkout session for paid plans, direct update for free plan
- [x] Backend `/api/subscription/verify` - Verifies Stripe session and activates subscription
- [x] Backend `/api/subscription/status/:userId` - Returns subscription status (auto-returns premium for admins)
- [x] Frontend `/subscription-success` route added to App.tsx
- [x] `SubscriptionSuccess.tsx` component handles post-payment verification
- [x] Fixed bug: `StorageService.Stripe.verifySubscription` call path corrected

#### Super Admin Premium Auto-Assignment (LATEST)
- [x] Modified `profileController.js` - `getProfileById` automatically assigns premium subscription to admin users
- [x] Modified `profileController.js` - `getProfile` (/me) also auto-assigns premium to admins
- [x] Database updated when admin detected without premium plan
- [x] Response always returns premium subscription for admin users

### ✅ Completed (January 4, 2026)

#### Affiliate Click Tracking & Analytics
- [x] `POST /api/admin/affiliate/track-click` - Public endpoint to track affiliate link clicks
- [x] `GET /api/admin/affiliate/analytics` - Admin endpoint for comprehensive affiliate analytics
- [x] `GET /api/admin/affiliate/:affiliateId` - Detailed affiliate info with transactions and payouts
- [x] Frontend `StorageService.trackAffiliateClick()` method implemented
- [x] `affiliate_clicks` table added to MASTER_MIGRATION.sql for detailed click tracking
- [x] Clicks increment on profile's `affiliate_clicks` field

#### Affiliate Performance Dashboards (LATEST)
- [x] Conversion funnel visualization: Total Clicks → Conversions → Commission Earned
- [x] Overall conversion rate progress bar
- [x] Top performers section: Top 3 by clicks, conversions, and earnings
- [x] Enhanced SuperAdminDashboard affiliates tab with full analytics
- [x] AffiliateDashboard updated to show click stats and conversion rate

#### At-Door Payment Implementation (LATEST)
- [x] `POST /api/stripe/record-at-door-payment` - Records at-door payments in financial_transactions
- [x] Supports cash, card (external terminal), and transfer payment methods
- [x] Creates proper financial transaction records with platform fees calculated
- [x] Creates audit log entries for all at-door payments
- [x] Check-in portal UI updated with improved payment confirmation flow
- [x] Payment method icons and better UX for cash/card/transfer selection

#### Critical Backend Fix (Previous Session)
- [x] Fixed backend server startup - was configured for Python/uvicorn but app uses Node.js/Express
- [x] Updated supervisor config: `/etc/supervisor/conf.d/supervisord.conf`
- [x] Backend now runs via `node /app/api/server.js` on port 8001
- [x] All Stripe endpoints now functional: `/api/stripe/verify-session`, `/api/stripe/connect/*`
- [x] Fixed Vite fs.allow issue by adding `/app` and `/app/frontend` to allowed paths

#### Super Admin Button Feature
- [x] Added "Super Admin" button in navbar for admin users (user.isAdmin === true)
- [x] Clicking button opens fullscreen overlay panel with Super Admin dashboard
- [x] Close button (X) to dismiss the panel
- [x] SuperAdminDashboard accepts `embedded` prop for modal use
- [x] Fixed Shield and X icon imports in App.tsx
- [x] Fixed Vite black screen issue with fs.allow configuration

#### Financial Systems
- [x] Backend server running on port 8001
- [x] Frontend running on port 3000 with Vite
- [x] Stripe Checkout integration with Connect Express
- [x] `/api/stripe/verify-session` endpoint for fast payment confirmation
- [x] Stripe Connect onboarding flow
- [x] Redirect handling after Stripe Connect success
- [x] Financial tracking columns in registrations table
- [x] Audit log service created

#### Super Admin Dashboard
- [x] Users Tab - Shows all users with Organization, Account Type, Business Type
- [x] Events Tab - Shows all events with Organizer association
- [x] Registrations Tab - Shows all registrations with Organizer association
- [x] Finance Tab - Platform fees, Stripe fees, Organizer breakdown, CSV export
- [x] Broadcast Tab - Target by All/Organizers/Affiliates
- [x] Promo Codes Tab - Create/manage discount codes
- [x] Settings Tab - Platform Stripe configuration

#### Affiliate System
- [x] Affiliates Tab in Super Admin - List all affiliates with stats
- [x] Clicks, Conversions, Conversion Rate tracking
- [x] Revenue attribution per affiliate
- [x] Commission calculation and tracking
- [x] Payout management (Stripe and Offline/Manual)
- [x] Payout history with full audit trail
- [x] Individual affiliate detail modal
- [x] CSV export for affiliate data

### 🔄 Pending SQL Migrations (User Action Required)
Run **ONE** consolidated script in Supabase SQL Editor:
- `/app/MASTER_MIGRATION.sql` - Contains ALL tables and functions needed

Legacy scripts (no longer needed, use MASTER_MIGRATION.sql instead):
- `/app/COMPLETE_FINANCIAL_FIX_v3.sql`
- `/app/CREATE_PROMO_CODES_TABLE.sql`
- `/app/CREATE_AFFILIATE_PAYOUTS_TABLE.sql`

### 📋 Future Tasks
- [ ] Subscription attribution to affiliate (track which subscriptions came from affiliates)
- [ ] Add automated e2e tests for full payment flows
- [ ] Stripe Elements integration for in-app card processing at check-in (currently uses external terminal)

---

## API Endpoints

### Health & Status
- `GET /api/ping` - Returns "pong"
- `GET /api/health` - Server health check

### Events
- `GET /api/events/public` - List public events
- `GET /api/events/:id` - Get event details

### Stripe Checkout
- `POST /api/stripe/create-order` - Create Stripe Checkout session
- `POST /api/stripe/verify-session` - Verify payment with full financial processing
- `POST /api/stripe/record-at-door-payment` - Record at-door payment (cash/card/transfer)

### Stripe Connect
- `POST /api/stripe/connect/create-account` - Create Connect account
- `GET /api/stripe/connect/status` - Get account status

### Admin
- `GET /api/admin/financials` - Platform-wide financial summary
- `GET /api/admin/events/:id/financials` - Event-specific financials
- `GET /api/admin/organizer/financial-summary` - Organizer financial summary
- `GET /api/admin/promo-codes` - List promo codes
- `POST /api/admin/promo-codes` - Create promo code
- `GET /api/admin/affiliate-payouts` - List affiliate payouts
- `POST /api/admin/affiliate-payouts` - Record affiliate payout
- `POST /api/admin/affiliate-payouts/stripe` - Initiate Stripe transfer to affiliate

### Affiliate Tracking (NEW)
- `POST /api/admin/affiliate/track-click` - Track affiliate link click (public, no auth)
- `GET /api/admin/affiliate/analytics` - Get comprehensive affiliate analytics (admin only)
- `GET /api/admin/affiliate/:affiliateId` - Get detailed affiliate info with transactions/payouts

---

## Known Issues
1. ~~At-door payment on check-in page is UI-only (MOCKED)~~ ✅ RESOLVED - Now records financial transactions
2. ~~Affiliate clicks need manual tracking endpoint~~ ✅ RESOLVED - Endpoint implemented

---

## Last Updated
January 4, 2026
