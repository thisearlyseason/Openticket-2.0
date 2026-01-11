# OpenTicket Deployment Checklist

## Pre-Deployment Fixes Applied ✅

### 1. CORS Configuration Updated
- Added `\.emergent\.host$` and `\.emergentagent\.com$` to allowed origins
- File: `/app/api/server.js`

### 2. Port Configuration Fixed
- Backend now defaults to port 8001 (Emergent standard)
- File: `/app/api/server.js`

### 3. VAPID Keys Added
- Push notification keys configured in `/app/backend/.env`

---

## Required Environment Variables for Production

### Backend Environment Variables (`backend/.env`)

```env
# Supabase Database
SUPABASE_URL=https://dcjdurvgkveblvtinoms.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Firebase Admin SDK
FIREBASE_PROJECT_ID=openticket-4f5bc
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@openticket-4f5bc.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Stripe Payments
STRIPE_SECRET_KEY=sk_live_<your-live-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_<your-publishable-key>

# Push Notifications (VAPID)
VAPID_PUBLIC_KEY=BDN47TY-5-3yPVR5lOzgqU-ZhtaLFQRiC90SODY3RtHdBgZJdm-VHSPPyv-nrTp79jzXdKhXQQ6t2MaCexciLbo
VAPID_PRIVATE_KEY=zA1PAPqI9fCObvGdbzQF5ZRUDNS0Xj9ZGma1b41XVTc
VAPID_SUBJECT=mailto:support@openticket.app

# Email Service (Resend)
RESEND_API_KEY=re_<your-api-key>
SENDER_EMAIL=tickets@openticket.events

# Server
PORT=8001
```

### Frontend Environment Variables (`frontend/.env`)

```env
REACT_APP_BACKEND_URL=https://www.openticket.events

# Firebase (already has fallbacks in code)
VITE_FIREBASE_API_KEY=AIzaSyDtnbTx4gTAC5ufD173Lt9IaiQfpZOQFyA
VITE_FIREBASE_AUTH_DOMAIN=openticket-4f5bc.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=openticket-4f5bc
VITE_FIREBASE_STORAGE_BUCKET=openticket-4f5bc.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=926069496604
VITE_FIREBASE_APP_ID=1:926069496604:web:d898aa1f91b31db38e78d9

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_<your-publishable-key>
```

---

## Post-Deployment Verification

### 1. API Health Check
```bash
curl https://www.openticket.events/api/ping
# Expected: pong

curl https://www.openticket.events/api/health
# Expected: { "status": "healthy", ... }
```

### 2. Push Notifications
```bash
curl https://www.openticket.events/api/push/vapid-key
# Expected: { "publicKey": "...", "enabled": true }
```

### 3. Stripe Webhook
- Ensure webhook endpoint is registered in Stripe Dashboard
- URL: `https://www.openticket.events/api/webhook`
- Events: `checkout.session.completed`, `payment_intent.succeeded`, etc.

### 4. Firebase Auth
- Verify Google Sign-In works
- Check that authorized domains include your production URL

---

## Stripe Configuration for Production

1. **Switch to Live Keys**
   - Replace `sk_test_*` with `sk_live_*` in backend
   - Replace `pk_test_*` with `pk_live_*` in frontend

2. **Update Webhook**
   - Create new webhook in Stripe Dashboard for production URL
   - Get new `whsec_*` secret for production

3. **Connect Account**
   - Update Stripe Connect settings for production payouts

---

## Custom Domain (openticket.events)

If using custom domain:
1. Add domain in Emergent deployment settings
2. Configure DNS records as instructed
3. Update `REACT_APP_BACKEND_URL` to use custom domain
4. Update CORS allowed origins if needed

---

## Monitoring

- Check `/var/log/supervisor/backend.out.log` for backend logs
- Check `/var/log/supervisor/frontend.out.log` for frontend logs
- Monitor Stripe Dashboard for payment issues
- Check Supabase Dashboard for database health
