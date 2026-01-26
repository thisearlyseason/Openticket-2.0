# OpenTicket - Event Ticketing Platform PRD

## Original Problem Statement
Build a production-ready event ticketing platform with comprehensive features for organizers, attendees, and administrators.

## Core Requirements
1. **Event Management** - Create, edit, publish events with ticket tiers
2. **Ticket Sales** - Stripe payment integration, multiple currencies
3. **Check-In System** - QR scanning via Kiosk mode, Mobile Scanner, and Web Portal
4. **Organizer Dashboard** - Revenue tracking, attendee management, refunds
5. **Admin Features** - SuperAdmin dashboard, user management, platform analytics

## Architecture
- **Frontend**: React/Vite with TypeScript
- **Backend**: Node.js/Express
- **Database**: Supabase (PostgreSQL)
- **Auth**: Firebase + Supabase Auth
- **Payments**: Stripe
- **Email**: Resend
- **Push Notifications**: Web Push API with VAPID
- **Deployment**: Vercel

---

## CHANGELOG

### 2026-01-26 - Push Notifications for Sales (COMPLETED)
**Feature:**
- Organizers receive instant push notifications when tickets are sold
- Notifications include: Attendee name, Event title, Sale amount, Ticket count
- Two notification triggers:
  - `checkout.session.completed` - Regular ticket sales
  - `payment_intent.succeeded` - At-door payments
- Notifications saved to database for in-app notification center
- Enable/disable toggle in Settings page
- Files modified: `backend/controllers/stripeWebhookController.js`, `components/NotificationSettings.tsx`

### 2026-01-26 - Share Your Tickets & Live Revenue Widget (COMPLETED)
**Share Your Tickets:**
- "Share Event" button on My Tickets page (event group cards and detail view)
- Uses native share API on mobile, clipboard fallback on desktop
- Shares event page URL (not ticket QR) for security

**Live Revenue Widget:**
- Real-time dashboard showing today's revenue, tickets, sales velocity
- Feed of 10 most recent sales (24 hours)
- Auto-refreshes every 60 seconds
- **Note:** Requires Vercel redeployment for production

### 2026-01-26 - UI Color Contrast & Analytics/Financials Fix (COMPLETED)
- All yellow (#E0FF20) backgrounds have black text
- EventFinance shows accurate ticket counts
- EventRefunds page has description section
- EventAnalytics gates Deep Dive for Pro/Premium/Enterprise

---

## Current Status

### ✅ COMPLETED
- [x] Mobile Scanner check-in working
- [x] Kiosk mode check-in working
- [x] Payment for unpaid tickets at door
- [x] Persistent scan history in scanners
- [x] Global color contrast fixes
- [x] Email template sign-up reminder
- [x] EventRefunds page description
- [x] EventFinance ticket counts
- [x] EventAnalytics Deep Dive gating
- [x] Share Your Tickets feature
- [x] Live Revenue Dashboard Widget
- [x] **Push Notifications for Sales**

### 🔄 REQUIRES DEPLOYMENT
- [ ] Live Revenue Widget requires Vercel redeployment

### 🔄 PENDING USER VERIFICATION
- [ ] Email templates - needs verification with test purchase

## P1 - High Priority
- [ ] Redeploy to Vercel for new endpoints
- [ ] Verify email templates working

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines)
- [ ] Firebase `addEventListener` null error - External SDK issue

---

## Push Notification System

### Triggers
1. **New Ticket Sale** (`checkout.session.completed`)
   - Title: "🎟️ New Ticket Sale!"
   - Body: "{attendee} purchased {count} ticket(s) for {event} • {currency} {amount}"
   
2. **At-Door Payment** (`payment_intent.succeeded`)
   - Title: "💰 At-Door Payment Received!"
   - Body: "{attendee} paid at the door for {event} • {currency} {amount}"

### Storage
- Push subscriptions: `push_subscriptions` table (or in-memory fallback)
- In-app notifications: `notifications` table

### Configuration
Required environment variables:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

---

## Key Files Modified This Session
- `/app/backend/controllers/stripeWebhookController.js` - Push notifications on sale
- `/app/components/NotificationSettings.tsx` - Updated notification types
- `/app/components/MyTickets.tsx` - Share Event button
- `/app/components/LiveRevenueWidget.tsx` - New component
- `/app/components/Dashboard.tsx` - Live Revenue Widget integration
- `/app/backend/routes/adminRoutes.js` - Live sales endpoint

## 3rd Party Integrations
- **Supabase**: PostgreSQL Database, Auth, Storage
- **Firebase**: Authentication (UI)
- **Stripe**: Payment Processing & Webhooks
- **Resend**: Transactional Emails
- **Web Push**: Browser push notifications (web-push library)
- **Vercel**: Deployment platform
