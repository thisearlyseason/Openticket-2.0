# Development Guide - OpenTicket Platform

## Known Issues & Workarounds

### Module Caching Issue (CRITICAL)

**Problem**: Node.js aggressively caches modules and environment variables. Changes to `.env` files or certain controller/service files may not be reflected even with supervisor's hot-reload enabled.

**Symptoms**:
- Environment variables showing old values
- Code changes in controllers/services not taking effect
- Middleware changes not being applied
- "localhost" appearing in generated URLs despite `.env` being updated

**Solution - Mandatory Restart Protocol**:

#### Backend Changes Requiring Full Restart:
```bash
# After any of these changes, ALWAYS restart:
# - .env file modifications
# - Middleware changes
# - Service file changes (supabase.js, firebase.js, etc.)
# - New npm package installations

sudo supervisorctl restart backend

# Verify restart:
sudo supervisorctl status backend
tail -n 20 /var/log/supervisor/backend.out.log
```

#### Frontend Changes Requiring Cache Clear:
```bash
# After any of these changes:
# - .env file modifications (VITE_ prefixed vars)
# - New npm package installations
# - Service logic changes in API calls

rm -rf /app/frontend/node_modules/.vite
sudo supervisorctl restart frontend

# Hard refresh in browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

#### Quick Restart All Services:
```bash
sudo supervisorctl restart all
```

---

## Environment Variables

### Backend (.env location: `/app/backend/.env`)

**DO NOT HARDCODE** any of these values in code. Always use `process.env.VARIABLE_NAME`.

```bash
# Core Services
SUPABASE_URL=https://dcjdurvgkveblvtinoms.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
FIREBASE_PROJECT_ID=openticket-4f5bc

# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email Service
RESEND_API_KEY=re_...
SENDER_EMAIL=tickets@openticket.events

# URLs (CRITICAL - DO NOT HARDCODE)
FRONTEND_URL=https://www.openticket.events  # Used for generating links, CORS, etc.
PORT=8001

# Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:support@openticket.app
```

### Frontend (.env location: `/app/frontend/.env`)

**IMPORTANT**: All frontend env vars must be prefixed with `VITE_` (not `REACT_APP_`).

```bash
# Backend API URL
VITE_BACKEND_URL=https://www.openticket.events

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Push Notifications
VITE_VAPID_PUBLIC_KEY=...
```

**Access in code**:
```javascript
// ✅ CORRECT
const backendUrl = import.meta.env.VITE_BACKEND_URL;

// ❌ WRONG
const backendUrl = process.env.REACT_APP_BACKEND_URL; // Old React syntax
const backendUrl = "https://www.openticket.events"; // Hardcoded
```

---

## Testing Protocol

### When to Use Testing Subagent:
- After implementing a new feature (3+ endpoints or components)
- After fixing critical bugs
- Before finishing any task/phase
- When user reports recurring issues

### Quick Testing Methods:
```bash
# Backend API Test (use external URL):
API_URL=$(grep VITE_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test+openticket@gmail.com","password":"12345678"}'

# Frontend Screenshot Test:
# Use the screenshot tool with localhost:3000

# Quick Python Validation:
python3 -c "import json; print(json.loads('{\"test\":\"value\"}'))"
```

---

## Kiosk Mode Architecture

### Database Schema:
- `kiosk_tokens`: Stores event-scoped tokens with permissions
- `kiosk_logs`: Tracks all kiosk actions (scans, check-ins, payments)

### Key API Endpoints:
- `POST /api/kiosk/generate` - Generate new token (organizer only)
- `POST /api/kiosk/validate` - Validate token for kiosk device
- `POST /api/kiosk/revoke` - Revoke active token (organizer only)
- `GET /api/kiosk/status/:eventId` - Get active token status
- `POST /api/kiosk/scan` - Scan QR code/ticket
- `GET /api/kiosk/guest-search` - Search guests by name/email
- `POST /api/kiosk/checkin` - Check in a guest
- `POST /api/kiosk/payment` - Process door payment

### Authentication:
- **Organizer routes**: Use Firebase Auth token (from UI login)
- **Kiosk device routes**: Use kiosk token (from URL parameter)
- **Dual Auth System**: Backend maps between Firebase UIDs and Supabase UUIDs

---

## Common Debugging Commands

```bash
# Check service status:
sudo supervisorctl status

# View backend logs:
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/backend.err.log

# View frontend logs:
tail -f /var/log/supervisor/frontend.out.log
tail -f /var/log/supervisor/frontend.err.log

# Check environment variable loading:
cd /app/backend && node -e "require('dotenv').config(); console.log('FRONTEND_URL:', process.env.FRONTEND_URL);"

# Verify API is responding:
curl http://localhost:8001/api/health

# Check MongoDB (if used):
# Note: This app uses Supabase (PostgreSQL), not MongoDB
```

---

## Credentials for Testing

### Test User:
- **Email**: `test+openticket@gmail.com`
- **Password**: `12345678`

### Super Admin:
- **Email**: `tylerans@gmail.com`

### External URLs:
- **Live Site**: `https://www.openticket.events`
- **Preview**: `https://edit-blocker-1.preview.emergentagent.com`

---

## Best Practices

1. **Never hardcode URLs or credentials** - Always use environment variables
2. **Restart services after .env changes** - Hot reload doesn't refresh env vars
3. **Test incrementally** - Don't wait until the end to test
4. **Use parallel tool calls** - When operations are independent
5. **Call troubleshoot_agent early** - After 2 failed attempts at fixing an issue
6. **Verify fixes with the user** - They are the source of truth for what's working
