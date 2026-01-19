# Kiosk Mode Setup Guide

## ✅ Status Overview

### Completed (Phase 1 & 2)
- ✅ Frontend blocker fixed - `KioskSettings.tsx` created
- ✅ Frontend compiles successfully
- ✅ Backend controller fully implemented with all endpoints
- ✅ Backend routes configured
- ✅ Frontend services complete with all methods
- ✅ All Kiosk UI components created
- ✅ QR code library installed

### Pending (Phase 3)
- ⏳ **Database migration needs to be run**
- ⏳ End-to-end testing
- ⏳ Integration with existing event management UI

---

## 🗄️ REQUIRED: Database Migration

**IMPORTANT:** Before testing, you must run the database migration to create the required tables.

### Steps to Run Migration:

1. Log into your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project: `dcjdurvgkveblvtinoms`
3. Go to **SQL Editor**
4. Copy and paste the contents of `/app/backend/migrations/kiosk_mode_schema.sql`
5. Click **Run** to execute the migration

### What the Migration Creates:
- `kiosk_tokens` table - Stores event-scoped access tokens
- `kiosk_logs` table - Audit log for all kiosk activities
- Indexes for performance optimization
- New fields in `events` table: `kiosk_enabled`, `kiosk_token_id`
- New fields in `registrations` table: `checked_in_method`, `checked_in_device`, `payment_source`, `kiosk_device_id`
- View: `active_kiosk_tokens` - For easy querying of valid tokens

---

## 🔗 API Endpoints (Backend)

### Organizer Endpoints (Require Authentication)
```
POST   /api/kiosk/generate          - Generate a new kiosk token
POST   /api/kiosk/revoke            - Revoke an active token
GET    /api/kiosk/status/:eventId   - Get current kiosk status
GET    /api/kiosk/token/:eventId    - Get token details
GET    /api/kiosk/logs/:eventId     - Get activity logs
```

### Kiosk Endpoints (Token-based, No User Auth)
```
POST   /api/kiosk/validate          - Validate kiosk token
POST   /api/kiosk/scan              - Scan QR code
GET    /api/kiosk/guest-search      - Search for guests
POST   /api/kiosk/checkin           - Check in a guest
POST   /api/kiosk/payment           - Process door payment
```

---

## 🎨 Frontend Components

### Organizer-Facing Components
- **KioskSettingsPage.tsx** - Page wrapper with navigation
- **KioskSettings.tsx** - Main control panel for managing kiosk mode
  - Generate/revoke tokens
  - QR code display and download
  - Security settings (PIN, payment enable/disable)

### Kiosk Device Components
- **KioskHome.tsx** - Entry point for kiosk devices
  - Token validation
  - Navigation to scan/search/payment
- **KioskCheckIn.tsx** - QR scanning and guest lookup
  - Camera-based scanning
  - Manual search functionality
- **KioskPayment.tsx** - Door payment processing
  - Cash payment tracking
  - Card payment integration (Stripe)
- **KioskSuccess.tsx** - Check-in confirmation screen

---

## 🔐 Security Features

1. **Event-Scoped Tokens**: Each token is tied to a specific event
2. **Automatic Expiration**: Tokens expire 8 hours after event end
3. **Revocable Access**: Organizers can immediately disable all kiosk devices
4. **PIN Protection**: Optional PIN code to exit kiosk mode
5. **Audit Logging**: All actions logged with device ID and timestamp
6. **Permission System**: Granular control (scan_ticket, manual_checkin, door_payment)
7. **No Admin Access**: Kiosk mode is locked to check-in functions only

---

## 📱 User Flow

### Organizer Setup Flow
1. Navigate to event management page
2. Click "Kiosk Settings" (or similar link - needs to be added to ManageEvent.tsx)
3. Enable kiosk mode with desired settings
4. Download QR code or copy kiosk URL
5. Open URL on tablet/device or scan QR code
6. Device enters locked kiosk mode

### Kiosk Device Flow
1. Open kiosk URL with token parameter
2. Token validated on load
3. Staff can:
   - Scan QR codes from tickets
   - Search guests manually by name/email
   - Process door payments (if enabled)
   - Check in attendees
4. All actions logged in real-time
5. Exit requires PIN (if configured)

---

## 🧪 Testing Checklist

### Backend API Tests
- [ ] Generate token endpoint
- [ ] Validate token endpoint
- [ ] Revoke token endpoint
- [ ] Scan ticket endpoint (valid ticket)
- [ ] Scan ticket endpoint (invalid ticket)
- [ ] Scan ticket endpoint (already checked in)
- [ ] Guest search endpoint
- [ ] Check-in endpoint
- [ ] Payment endpoint (cash)
- [ ] Payment endpoint (card)
- [ ] Get kiosk status endpoint

### Frontend Tests
- [ ] Kiosk settings page loads
- [ ] Generate token flow works
- [ ] QR code displays correctly
- [ ] QR code download works
- [ ] Copy URL to clipboard works
- [ ] Revoke token flow works
- [ ] Kiosk home page initializes
- [ ] QR scanning works
- [ ] Guest search works
- [ ] Check-in confirmation displays
- [ ] Payment flow works
- [ ] Success screen shows correct data

### Integration Tests
- [ ] Full check-in flow (scan -> confirm -> success)
- [ ] Full door payment flow (scan -> payment -> check-in)
- [ ] Multiple kiosk devices simultaneously
- [ ] Token expiration handling
- [ ] Token revocation in real-time
- [ ] Offline handling (if applicable)

---

## 🔧 Integration Points

### Needs to be Added to Existing UI
1. **ManageEvent.tsx** - Add link/button to access Kiosk Settings
   - Suggested location: Settings tab or main event management menu
   - Button text: "Kiosk Mode" or "Check-in Kiosk"
   - Icon: `<Lock />` or `<QrCode />`

2. **Event Dashboard** - Show kiosk status indicator
   - Display if kiosk mode is active
   - Show number of kiosk check-ins vs. regular check-ins

---

## 📊 Database Schema

### kiosk_tokens
```sql
token_id            UUID (Primary Key)
type                VARCHAR (default: 'kiosk')
event_id            VARCHAR (Foreign Key -> events.id)
permissions         JSONB
payment_enabled     BOOLEAN
pin_code            VARCHAR (nullable)
expires_at          TIMESTAMP
revoked             BOOLEAN
revoked_at          TIMESTAMP (nullable)
created_by          VARCHAR
created_at          TIMESTAMP
last_used_at        TIMESTAMP (nullable)
```

### kiosk_logs
```sql
id                  UUID (Primary Key)
token_id            UUID (Foreign Key -> kiosk_tokens.token_id)
event_id            VARCHAR (Foreign Key -> events.id)
action              VARCHAR (scan_success, scan_failed, checkin, payment, etc.)
details             JSONB
timestamp           TIMESTAMP
```

---

## 🚀 Next Steps

1. **Run Database Migration** (Required before any testing)
2. **Add UI Integration** - Link from ManageEvent.tsx to KioskSettingsPage
3. **Comprehensive Testing** - Use testing subagent for full E2E tests
4. **User Acceptance Testing** - Test on actual tablet device
5. **Documentation** - Create user-facing guide for event organizers

---

## 💡 Future Enhancements

- Offline mode support (service worker caching)
- Multiple simultaneous tokens per event
- Analytics dashboard for kiosk activity
- Custom branding per event
- Multi-language support
- Badge printing integration
- Photo capture on check-in
