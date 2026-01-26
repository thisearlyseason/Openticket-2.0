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

### 2026-01-26 - Email Template Sign-up Reminder (COMPLETED)
**Changes:**
- Added account reminder message to purchase confirmation emails
- Reminds users to sign up/log in with the email they used to purchase tickets
- Updated `purchaseConfirmation` function to accept `attendeeEmail` parameter
- Updated `serverEmail.js` and `registrationController.js` to pass the email parameter

### 2026-01-25 - Global Color Contrast Fix (COMPLETED)
**Changes:**
- Implemented dynamic theming system with `isColorBright()` and `getContrastingFg()` helpers
- Changed default primary color from `#E0FF20` to teal `#00c9cc`
- CSS variables `--color-primary` and `--color-primary-fg` are set dynamically
- Bright backgrounds automatically get black text for accessibility
- Verified on home page and pricing page - buttons with bright backgrounds have black text ✅

### 2026-01-25 - Check-In 500 Error Fix (COMPLETED)
**Root Cause Identified:**
The backend was trying to UPDATE columns that don't exist in production:
- `check_in_statuses`, `checked_in`, `checked_in_at`, `checked_in_method`, `checked_in_device`
- Supabase returns error code `42703` when updating non-existent columns

**Fixes Applied:**
1. ✅ Added schema fallback in `checkInTicket` (registrationController.js)
2. ✅ Added schema fallback in `checkInGuest` (kioskController.js)
3. ✅ Fixed `getEventStats` endpoint
4. ✅ Created migration script (`fix_checkin_schema.sql`)
5. ✅ Fixed infinite scan loop in MobileCheckInScanner
6. ✅ Fixed API URL paths in MobileCheckInScanner

---

## Current Status

### ✅ COMPLETED
- [x] Mobile Scanner check-in working
- [x] Kiosk mode check-in working
- [x] Payment for unpaid tickets at door (Stripe modal)
- [x] Persistent scan history in scanners
- [x] Global color contrast (dynamic theming)
- [x] Email template sign-up reminder
- [x] Logo handling via Supabase Storage

### 🔄 PENDING USER VERIFICATION
- [ ] Email templates - User confirmed migration was run, but needs to be verified with a test purchase
- [ ] Checkout button layout on event page

### ❌ BLOCKED
- **Email Template Design Selection**: Requires `ticket_design` column in `events` table
  - Migration script: `/app/backend/migrations/fix_checkin_schema.sql`
  - User claims migration was run - needs verification

## P1 - High Priority
- [ ] Verify email templates are working post-migration
- [ ] Firebase `addEventListener` null error - External SDK issue (non-blocking)

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines → smaller components)
- [ ] Consolidate check-in data model (multiple fields for check-in status)
- [ ] Implement PDF ticket attachments for emails (if user requires)

---

## Key Files Modified This Session
- `/app/backend/services/emailTemplates.js` - Added sign-up reminder, attendeeEmail param
- `/app/backend/services/serverEmail.js` - Pass attendeeEmail to template
- `/app/backend/controllers/registrationController.js` - Pass attendeeEmail to template
- `/app/components/Settings.tsx` - Dynamic theming, default teal color
- `/app/components/EventView.tsx` - Dynamic theming

## Database Schema Notes
The `registrations` table may be missing these columns in production:
- `check_in_statuses` (JSONB) - Per-ticket check-in tracking
- `checked_in` (BOOLEAN) - Registration-level check-in flag
- `checked_in_at` (TIMESTAMPTZ) - First check-in timestamp

The code handles this gracefully via fallback logic.

## 3rd Party Integrations
- **Supabase**: PostgreSQL Database, Auth, Storage
- **Firebase**: Authentication (UI)
- **Stripe**: Payment Processing & Webhooks
- **Resend**: Transactional Emails
- **Vercel**: Deployment platform
- **Google Generative AI**: For AI features
