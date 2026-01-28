# OpenTicket - Event Ticketing Platform PRD

## Original Problem Statement
Build a production-ready event ticketing platform with comprehensive features for organizers, attendees, and administrators.

## Core Requirements
1. **Event Management** - Create, edit, publish events with ticket tiers
2. **Ticket Sales** - Stripe payment integration, multiple currencies
3. **Check-In System** - QR scanning via Kiosk mode, Mobile Scanner, and Web Portal
4. **Organizer Dashboard** - Revenue tracking, attendee management, refunds
5. **Admin Features** - SuperAdmin dashboard, user management, platform analytics
6. **Presale System** - Early access for select users before general sale

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

### 2026-01-27 - Presale System (COMPLETED)
**Feature:**
A comprehensive presale system that allows organizers to give early access to select users before general sale.

**Access Methods:**
1. **Presale Codes** - Single-use, multi-use, or unlimited codes
2. **Private Link** - Tokenized URL for presale access
3. **Account Eligibility** - Users with `presale_eligible` flag

**Frontend Changes:**
- EventBuilder Step 7: Presale configuration UI
  - Enable/disable presale toggle
  - Start/end date pickers
  - Access method toggles
  - Private link generator
  - Manual code creation
  - Auto-generate codes (1-100)
  - Code management list

- EventView: Presale blocking UI
  - Shows when presale active and user has no access
  - Presale code input option
  - Join waitlist option
  - General sale countdown

- **EventView: Presale Signup UI (NEW - 2026-01-28)**
  - Shows when presale enabled but NOT yet started
  - Displays event details with icons (date, location)
  - "Artist Presale" section with start date/time
  - Email/name signup form
  - "Public Onsale" section with Set Reminder button
  - Design inspired by go.seated.com

**Backend Changes:**
- New routes: `/api/presale/:eventId/*`
  - `POST /validate` - Validate presale access
  - `GET /codes` - List presale codes (organizer)
  - `POST /codes` - Create codes manually
  - `POST /codes/generate` - Auto-generate codes
  - `DELETE /codes/:codeId` - Delete a code
  - `POST /codes/:codeId/use` - Increment usage
  - `POST /subscribe` - Sign up for presale notifications (NEW - renamed from /signup)
  - `GET /subscribers` - List presale subscribers (organizer) (NEW)
  - `POST /notify-subscribers` - Notify all subscribers (NEW)

**Database Migration Required:**
Run `/app/backend/migrations/presale_system.sql` to create:
- `presale_codes` table
- `presale_signups` table (NEW - for pre-launch email signups)
- `presale` column on events (JSONB)
- `presale_eligible` column on profiles

### 2026-01-28 - Presale Signup Flow (COMPLETED)
**Feature:**
Pre-launch signup page for events with presale enabled but not yet started. Matches go.seated.com design.

**What's New:**
- Frontend: New presale signup UI in EventView.tsx (lines 1419-1550)
- Backend: `/api/presale/:eventId/subscribe` endpoint
- Email: New `presaleSignupConfirmation` template in unifiedEmailTemplates.js
- Design: Clean minimal layout with event image, date icons, and signup form
- **Countdown Timer**: Live countdown showing days/hours/minutes/seconds until presale starts

**Note:** Routes renamed from `/signup` to `/subscribe` to avoid potential WAF/ingress blocking.

### 2026-01-28 - Automatic Presale Notifications (COMPLETED)
**Feature:**
Automatically sends presale access emails to subscribers 15 minutes before presale starts.

**How it works:**
- Cron job runs every 5 minutes checking for presales starting in 15-20 minutes
- Finds all un-notified subscribers for matching events
- Auto-generates a shared presale code for subscribers (if event uses codes)
- Sends `presaleNowOpen` email with:
  - Presale start time
  - Presale code (prominent display)
  - Event details
  - Direct link to event page
- Marks subscribers as notified to prevent duplicate sends

**Files:**
- `cronService.js` - New `sendPresaleNotifications()` function
- `unifiedEmailTemplates.js` - Updated `presaleNowOpen` template
- `emailAuditService.js` - New trigger/email types for presale

### 2026-01-28 - Email Template Unification (COMPLETED)
**Feature:**
Unified all email templates into a single system for consistent branding.

**What Changed:**
- Migrated all imports from `emailTemplates.js` to `unifiedEmailTemplates.js`
- Added new templates: `abandonedCart`, `eventReminderPrimary`, `eventReminderSecondary`, `postEventThankYou`, `approvalConfirmation`
- Files updated: `serverEmail.js`, `cronService.js`, `stripeWebhookController.js`, `registrationController.js`

### 2026-01-28 - SuperAdminDashboard Partial Refactor (IN PROGRESS)
**What's Done:**
- Created `/app/components/admin/tabs/FinanceTab.tsx` component (ready for future use)
- Component is imported but not yet wired up (preserving existing functionality)

**Remaining:**
- Wire up FinanceTab component to replace inline JSX
- Extract AffiliatesTab, NonprofitTab, OnboardingTab, SettingsTab
- Each extraction requires careful state management due to tight coupling

### 2026-01-27 - Email Template Readability Fix (COMPLETED)
- Changed event detail boxes to white background with dark text
- Fixed back button navigation in Email Preview

### 2026-01-26 - Push Notifications for Sales (COMPLETED)
- Organizers receive instant push notifications when tickets are sold

### 2026-01-26 - Share Your Tickets & Live Revenue Widget (COMPLETED)
- "Share Event" button on My Tickets page
- Real-time dashboard showing today's revenue, tickets, sales velocity

---

## Current Status

### ✅ COMPLETED
- [x] Mobile Scanner check-in working
- [x] Kiosk mode check-in working
- [x] Payment for unpaid tickets at door
- [x] Global color contrast fixes
- [x] Email template readability fix
- [x] Share Your Tickets feature
- [x] Live Revenue Dashboard Widget
- [x] Push Notifications for Sales
- [x] **Presale System** (requires DB migration)
- [x] **Presale Signup Flow** with countdown timer (requires DB migration)
- [x] **Email Template Unification** (all emails now use unified templates)

### 🔴 REQUIRES ACTION
- [ ] **Run Database Migration**: `/app/backend/migrations/presale_system.sql`
  - Creates `presale_codes` and `presale_signups` tables
- [ ] **Redeploy to Vercel**: New presale endpoints need deployment

## P1 - High Priority
- [ ] Test presale flow end-to-end after migration
- [ ] Investigate Firebase TypeError (intermittent console error - not reproduced recently)

## P2 - Technical Debt
- [ ] Complete `SuperAdminDashboard.tsx` refactor (FinanceTab created, needs wiring)
- [ ] Extract remaining tabs: AffiliatesTab, NonprofitTab, OnboardingTab, SettingsTab
- [ ] Consolidate check-in data model (multiple redundant fields)

---

## Presale System Details

### Data Model
```typescript
interface PresaleConfig {
  enabled: boolean;
  startDate: string;      // ISO datetime
  endDate: string;        // ISO datetime
  accessMethods: {
    accountFlag: boolean; // Check user's presale_eligible
    codes: boolean;       // Allow presale codes
    privateLink: boolean; // Allow private link access
  };
  privateToken?: string;  // UUID for private link
  generalSaleMessage?: string;
}

interface PresaleCode {
  id: string;
  eventId: string;
  code: string;
  limitType: 'single' | 'multi' | 'unlimited';
  maxUses?: number;
  currentUses: number;
  createdBy: string;
  createdAt: string;
}
```

### Validation Flow
1. Check if presale is enabled for event
2. Check if current time is within presale window
3. If presale active, check access:
   - Private link token → grant access
   - Presale code → validate and grant access
   - Account flag → check `presale_eligible` in profile
4. If no access, show presale blocking UI with waitlist option
5. If presale ended, allow normal purchase

---

## Key Files
- `/app/backend/routes/presaleRoutes.js` - Presale API routes
- `/app/backend/migrations/presale_system.sql` - DB migration
- `/app/components/EventBuilder.tsx` - Step 7 presale config
- `/app/components/EventView.tsx` - Presale blocking UI
- `/app/types.ts` - PresaleConfig, PresaleCode interfaces

## 3rd Party Integrations
- **Supabase**: PostgreSQL Database, Auth, Storage
- **Firebase**: Authentication (UI)
- **Stripe**: Payment Processing & Webhooks
- **Resend**: Transactional Emails
- **Web Push**: Browser push notifications
- **Vercel**: Deployment platform
