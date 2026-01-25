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

### 2026-01-25 - Check-In System Bug Fixes

**Issues Fixed:**
1. ✅ **Infinite scan loop in MobileCheckInScanner** - Added debouncing, scanner now closes immediately on scan detection
2. ✅ **Missing `/api/events/:eventId/stats` endpoint** - Added to eventController.js and eventRoutes.js
3. ✅ **API URL paths in MobileCheckInScanner** - Now uses proper `API_URL` prefix
4. ✅ **Improved error logging in kioskController** - Now logs full error details

**Root Cause Identified:**
- Production database missing `events.ticket_design` column causing 500 errors
- Migration script created at `/app/backend/migrations/add_ticket_design_column.sql`

**Pending User Action:**
- Run database migration: `ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_design JSONB;`
- Deploy code changes to production

**Non-Blocking Issues (Not Fixed - External):**
- Firebase `functions.js:1107` addEventListener error - External Firebase SDK issue, non-blocking

---

## P0 - Critical Issues (Current Sprint)
- [x] Fix infinite scan loop in MobileCheckInScanner
- [x] Add missing stats endpoint
- [ ] Run `ticket_design` column migration (USER ACTION)
- [ ] Deploy code changes to production
- [ ] Verify check-in works post-deployment

## P1 - High Priority
- [ ] Firebase `addEventListener` null error - External SDK issue, monitor for updates

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines → smaller components)
- [ ] Consolidate check-in data model (3 fields → single source of truth)

## Key Files Reference
- `/app/backend/controllers/kioskController.js` - Kiosk check-in logic
- `/app/backend/controllers/registrationController.js` - Manual check-in logic
- `/app/backend/controllers/eventController.js` - Event stats endpoint
- `/app/components/MobileCheckInScanner.tsx` - Mobile scanner UI (FIXED)
- `/app/components/KioskCheckIn.tsx` - Kiosk UI
- `/app/services/kioskService.ts` - Kiosk API service
- `/app/services/paymentUtils.ts` - Payment status utilities

## Database Schema Notes
- `events` table: Missing `ticket_design` column (migration created)
- `registrations.tickets` (JSONB): Contains individual ticket data
- `registrations.check_in_statuses` (JSONB): Check-in tracking
- `registrations.payment_status`: Must filter `refunded` from metrics
