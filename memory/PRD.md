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

### 2026-01-26 - UI Color Contrast & Analytics/Financials Fix (COMPLETED)
**Changes:**
- Fixed all UI color contrast violations - yellow (#E0FF20) backgrounds now have black text
- Updated Badge component colors: purple, primary, orange, yellow all use proper text colors
- Updated Button accent variant to use `text-accent-fg` CSS variable
- Fixed Home.tsx price tag sticker to use proper foreground colors
- Added "How Refunds Work" description section to EventRefunds page
- Fixed EventFinance to show accurate ticket counts:
  - Paid tickets (excluding refunded)
  - Pending tickets (pay-at-door)
  - Refunded tickets (full + partial)
- Added 'enterprise' tier to EventAnalytics Deep Dive gating

### 2026-01-26 - Email Template Sign-up Reminder (COMPLETED)
**Changes:**
- Added account reminder message to purchase confirmation emails
- Reminds users to sign up/log in with the email they used to purchase tickets

### 2026-01-25 - Global Color Contrast Fix (COMPLETED)
**Changes:**
- Implemented dynamic theming system with CSS variables
- Changed default primary color from `#E0FF20` to teal `#00c9cc`
- CSS variables `--color-primary`, `--color-primary-fg`, `--color-accent`, `--color-accent-fg` set properly

### 2026-01-25 - Check-In 500 Error Fix (COMPLETED)
**Root Cause:**
- Backend was trying to UPDATE columns that don't exist in production
- Fixed via schema fallback in registrationController.js and kioskController.js

---

## Current Status

### ✅ COMPLETED
- [x] Mobile Scanner check-in working
- [x] Kiosk mode check-in working
- [x] Payment for unpaid tickets at door (Stripe modal)
- [x] Persistent scan history in scanners
- [x] Global color contrast (all yellow backgrounds have black text)
- [x] Email template sign-up reminder
- [x] Logo handling via Supabase Storage
- [x] EventRefunds page description added
- [x] EventFinance ticket counts (paid/pending/refunded)
- [x] EventAnalytics Deep Dive gating for Pro/Premium/Enterprise

### 🔄 PENDING USER VERIFICATION
- [ ] Email templates - User confirmed migration was run, but needs to be verified with a test purchase

## P1 - High Priority
- [ ] Verify email templates are working post-migration
- [ ] Firebase `addEventListener` null error - External SDK issue (non-blocking)

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines → smaller components)
- [ ] Consolidate check-in data model (multiple fields for check-in status)
- [ ] Implement PDF ticket attachments for emails (if user requires)

---

## CSS Theme Variables
```css
:root {
  --color-primary: #00c9cc;      /* Teal */
  --color-primary-fg: #000000;   /* Black text on primary */
  --color-accent: #E0FF20;       /* Bright yellow */
  --color-accent-fg: #000000;    /* Black text on accent */
  --color-secondary: #60a5fa;    /* Blue */
  --color-secondary-fg: #1e3a5f; /* Dark blue text */
}
```

## Key Files Modified This Session
- `/app/components/UI.tsx` - Badge and Button accent variants use CSS variables
- `/app/components/Home.tsx` - Price tag sticker uses proper foreground colors
- `/app/components/EventRefunds.tsx` - Added refund instructions section
- `/app/components/EventFinance.tsx` - Added ticket count calculations
- `/app/components/EventAnalytics.tsx` - Added 'enterprise' to plan check
- `/app/backend/services/emailTemplates.js` - Added sign-up reminder

## 3rd Party Integrations
- **Supabase**: PostgreSQL Database, Auth, Storage
- **Firebase**: Authentication (UI)
- **Stripe**: Payment Processing & Webhooks
- **Resend**: Transactional Emails
- **Vercel**: Deployment platform
- **Google Generative AI**: For AI features
