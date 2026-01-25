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

### 2026-01-25 - Check-In 500 Error Fix (COMPLETED)

**Root Cause Identified:**
The backend was trying to UPDATE columns that don't exist in production:
- `check_in_statuses`, `checked_in`, `checked_in_at`, `checked_in_method`, `checked_in_device`
- Supabase returns error code `42703` when updating non-existent columns

**Fixes Applied:**
1. ✅ Added schema fallback in `checkInTicket` (registrationController.js) - detects missing columns and falls back to updating only `tickets` array
2. ✅ Added schema fallback in `checkInGuest` (kioskController.js) - same fallback logic
3. ✅ Fixed `getEventStats` endpoint - only queries guaranteed columns
4. ✅ Created migration script (`fix_checkin_schema.sql`)
5. ✅ Fixed infinite scan loop in MobileCheckInScanner
6. ✅ Fixed API URL paths in MobileCheckInScanner

**Pending:**
- Deploy code changes to Vercel
- (Optional) Run database migration for full schema support

---

## P0 - Critical Issues
- [x] Fix 500 errors on check-in endpoints (schema fallback added)
- [x] Fix infinite scan loop in MobileCheckInScanner
- [ ] Deploy code changes to production

## P1 - High Priority
- [ ] Run database migration to add missing columns (optional with fallback)
- [ ] Firebase `addEventListener` null error - External SDK issue (non-blocking)

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines → smaller components)
- [ ] Consolidate check-in data model

## Key Files Modified This Session
- `/app/backend/controllers/registrationController.js` - Added schema fallback
- `/app/backend/controllers/kioskController.js` - Added schema fallback  
- `/app/backend/controllers/eventController.js` - Fixed stats query
- `/app/components/MobileCheckInScanner.tsx` - Fixed scan loop & API URLs
- `/app/backend/migrations/fix_checkin_schema.sql` - New migration

## Database Schema Notes
The `registrations` table may be missing these columns in production:
- `check_in_statuses` (JSONB) - Per-ticket check-in tracking
- `checked_in` (BOOLEAN) - Registration-level check-in flag
- `checked_in_at` (TIMESTAMPTZ) - First check-in timestamp

The code now handles this gracefully via fallback logic.
