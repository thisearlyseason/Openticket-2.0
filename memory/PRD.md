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

**Backend Changes:**
- New routes: `/api/presale/:eventId/*`
  - `POST /validate` - Validate presale access
  - `GET /codes` - List presale codes (organizer)
  - `POST /codes` - Create codes manually
  - `POST /codes/generate` - Auto-generate codes
  - `DELETE /codes/:codeId` - Delete a code
  - `POST /codes/:codeId/use` - Increment usage

**Database Migration Required:**
Run `/app/backend/migrations/presale_system.sql` to create:
- `presale_codes` table
- `presale` column on events (JSONB)
- `presale_eligible` column on profiles

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

### 🔴 REQUIRES ACTION
- [ ] **Run Database Migration**: `/app/backend/migrations/presale_system.sql`
- [ ] **Redeploy to Vercel**: New presale endpoints need deployment

## P1 - High Priority
- [ ] Test presale flow end-to-end after migration

## P2 - Technical Debt
- [ ] Refactor `SuperAdminDashboard.tsx` (3000+ lines)

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
