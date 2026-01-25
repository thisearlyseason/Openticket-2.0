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

### 2026-01-25 - Check-In System Bug Fixes (In Progress)
**Root Causes Identified & Fixed:**
1. ✅ Created migration script for missing `events.ticket_design` column
2. ✅ Fixed Mobile Scanner API URL paths (was using relative `/api/...` instead of full URL)
3. ✅ Added missing `/api/events/:eventId/stats` endpoint

**Pending User Action:**
- Run database migration: `ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_design JSONB;`

**Still In Progress:**
- Full testing of Kiosk and Mobile Scanner check-in flows

---

## P0 - Critical Issues (Current Sprint)
- [ ] Run `ticket_design` column migration (USER ACTION)
- [ ] Verify Kiosk check-in works post-migration
- [ ] Verify Mobile Scanner check-in completes

## P1 - High Priority
- [ ] Fix Firebase `addEventListener` null error in scanner components
- [ ] Verify Dashboard excludes refunded tickets from all metrics

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines → smaller components)
- [ ] Consolidate check-in data model (3 fields → single source of truth)
- [ ] Review and clean up event controller/routes

## Key Files Reference
- `/app/backend/controllers/kioskController.js` - Kiosk check-in logic
- `/app/backend/controllers/registrationController.js` - Manual check-in logic
- `/app/backend/controllers/eventController.js` - Event stats endpoint
- `/app/components/MobileCheckInScanner.tsx` - Mobile scanner UI
- `/app/components/KioskCheckIn.tsx` - Kiosk UI
- `/app/services/kioskService.ts` - Kiosk API service
- `/app/services/paymentUtils.ts` - Payment status utilities

## Database Schema Notes
- `events` table: Missing `ticket_design` column (migration created)
- `registrations.tickets` (JSONB): Contains individual ticket data
- `registrations.check_in_statuses` (JSONB): Check-in tracking
- `registrations.payment_status`: Must filter `refunded` from metrics
