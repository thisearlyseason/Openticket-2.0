# OpenTicket PRD - Product Requirements Document

## Original Problem Statement
OpenTicket is a full-stack event ticketing platform that enables organizers to sell tickets online with Stripe Connect integration for payment processing. The user requested:
1. Audit and fix all financial systems (Stripe Connect, payments, refunds, reporting)
2. Proper redirect after Stripe onboarding
3. Complete financial tracking across dashboards
4. Comprehensive audit log system
5. Fix slow payment confirmation process (timeout error)

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
- `profiles`: User data with `stripe_connect_id`, `stripe_onboarding_complete`
- `events`: Event data with pricing, capacity
- `registrations`: Ticket purchases with payment tracking
- `financial_transactions`: Revenue/fee breakdown
- `audit_logs`: Financial audit trail

---

## Implementation Status

### ✅ Completed
- [x] Backend server running on port 8001
- [x] Frontend running on port 3000 with Vite
- [x] Stripe Checkout integration with Connect Express
- [x] `/api/stripe/verify-session` endpoint for fast payment confirmation
- [x] Stripe Connect onboarding flow
- [x] Redirect handling after Stripe Connect success
- [x] Event listing and detail pages
- [x] Ticket purchase form with quantity selection
- [x] Promo code validation
- [x] Financial tracking columns in registrations table
- [x] Audit log service created
- [x] Fixed duplicate "Pricing" link in navigation

### 🔄 Pending (User Action Required)
- [ ] **SQL Migration:** User needs to run `/app/FIX_REGISTRATIONS_TABLE.sql` in Supabase SQL Editor
  - Adds missing columns: `tax_amount`, `service_fee`, `stripe_checkout_session_id`, etc.
  - Instructions provided in the SQL file

### 📋 Future Tasks
- [ ] Verify Organizer Dashboard financial tracking
- [ ] Verify Superadmin Dashboard financials
- [ ] Test end-to-end refund flow
- [ ] Complete at-door payment (currently UI-only mock)
- [ ] Add automated tests for payment flows
- [ ] ESLint TypeScript configuration fix

---

## API Endpoints

### Health & Status
- `GET /api/ping` - Returns "pong"
- `GET /api/health` - Server health check
- `GET /api/debug` - Environment info

### Events
- `GET /api/events/public` - List public events
- `GET /api/events/:id` - Get event details

### Stripe Checkout
- `POST /api/stripe/create-order` - Create Stripe Checkout session
- `POST /api/stripe/verify-session` - Verify payment (NEW - fixes timeout)
- `POST /api/stripe/calculate-order` - Calculate order total

### Stripe Connect
- `POST /api/stripe/connect/create-account` - Create Connect account
- `GET /api/stripe/connect/status` - Get account status
- `POST /api/stripe/connect/create-link` - Get onboarding link
- `POST /api/stripe/connect/dashboard-link` - Get Stripe Dashboard link
- `POST /api/stripe/connect/disconnect` - Disconnect account

---

## Known Issues
1. At-door payment on check-in page is UI-only (MOCKED)
2. ESLint may show false-positive TypeScript parsing errors

---

## Last Updated
January 3, 2026
