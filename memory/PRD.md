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
- **Deployment**: Vercel

---

## CHANGELOG

### 2026-01-26 - Share Your Tickets & Live Revenue Widget (COMPLETED)
**Share Your Tickets Feature:**
- Added "Share Event" button to My Tickets page (event group cards)
- Added "Share Event" button to individual ticket detail view
- Uses native share API on mobile, clipboard fallback on desktop
- Shares event page URL (not ticket QR) for security
- Files: `components/MyTickets.tsx`

**Live Revenue Dashboard Widget:**
- New `LiveRevenueWidget` component showing real-time sales data
- Displays: Today's revenue, tickets sold, sales velocity (per hour)
- Shows feed of 10 most recent sales from last 24 hours
- Auto-refreshes every 60 seconds
- Files: `components/LiveRevenueWidget.tsx`, `components/Dashboard.tsx`
- Backend: New `/api/admin/organizer/live-sales` endpoint in `adminRoutes.js`

**Note:** New backend endpoint works locally but requires Vercel redeployment to work on production.

### 2026-01-26 - UI Color Contrast & Analytics/Financials Fix (COMPLETED)
- Fixed all UI color contrast violations - yellow (#E0FF20) backgrounds have black text
- EventFinance now shows accurate ticket counts (paid, pending, refunded)
- Added "How Refunds Work" description to EventRefunds page
- Added 'enterprise' tier to EventAnalytics Deep Dive gating

### 2026-01-26 - Email Template Sign-up Reminder (COMPLETED)
- Added account reminder message to purchase confirmation emails

### 2026-01-25 - Check-In 500 Error Fix (COMPLETED)
- Fixed backend schema fallback for missing columns

---

## Current Status

### ✅ COMPLETED
- [x] Mobile Scanner check-in working
- [x] Kiosk mode check-in working
- [x] Payment for unpaid tickets at door (Stripe modal)
- [x] Persistent scan history in scanners
- [x] Global color contrast (all yellow backgrounds have black text)
- [x] Email template sign-up reminder
- [x] EventRefunds page description
- [x] EventFinance ticket counts (paid/pending/refunded)
- [x] EventAnalytics Deep Dive gating for Pro/Premium/Enterprise
- [x] **Share Your Tickets feature**
- [x] **Live Revenue Dashboard Widget**

### 🔄 REQUIRES DEPLOYMENT
- [ ] Live Revenue Widget requires Vercel redeployment to work on production

### 🔄 PENDING USER VERIFICATION
- [ ] Email templates - needs verification with test purchase

## P1 - High Priority
- [ ] Redeploy to Vercel for new live-sales endpoint
- [ ] Verify email templates working post-migration

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines → smaller components)
- [ ] Firebase `addEventListener` null error - External SDK issue
- [ ] PDF ticket attachments for emails (if user requires)

---

## New Components Created This Session
- `/app/components/LiveRevenueWidget.tsx` - Real-time sales dashboard widget

## Key Files Modified This Session
- `/app/components/MyTickets.tsx` - Share Event button
- `/app/components/Dashboard.tsx` - Live Revenue Widget integration
- `/app/backend/routes/adminRoutes.js` - New /organizer/live-sales endpoint

## New API Endpoints
- `GET /api/admin/organizer/live-sales` - Returns live sales data:
  - `recentSales[]` - Last 10 sales (24 hours)
  - `todayRevenue` - Total revenue today
  - `todayTickets` - Tickets sold today
  - `salesVelocity` - Sales per hour (last hour)

## 3rd Party Integrations
- **Supabase**: PostgreSQL Database, Auth, Storage
- **Firebase**: Authentication (UI)
- **Stripe**: Payment Processing & Webhooks
- **Resend**: Transactional Emails
- **Vercel**: Deployment platform
- **Google Generative AI**: For AI features
