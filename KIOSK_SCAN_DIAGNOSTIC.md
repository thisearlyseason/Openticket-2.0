# Kiosk QR Scan Diagnostic Guide

## 🔍 Diagnosing "Ticket Does Not Exist" Error

### Step 1: Verify You're Using Fresh Data

**CRITICAL**: The fix was deployed on 2026-01-20. Any tickets or kiosk tokens created BEFORE this time may have issues.

#### Generate Fresh Test Data:
1. Go to Kiosk Settings for your event
2. **Disable Kiosk** (if active)
3. **Enable Kiosk** again (generates new token)
4. Copy the NEW kiosk URL

5. Purchase NEW tickets AFTER deployment:
   - Go to event page
   - Buy 2 tickets
   - Check email - verify each has different Ticket ID
   - Open ticket view page - each should have different QR code

### Step 2: Test the Scan

1. Open the NEW kiosk URL
2. Click "Scan QR Code"
3. Scan ONE of the NEW tickets
4. **Check backend logs for debugging info**

### Step 3: Check Backend Logs (Production)

The scan endpoint logs detailed information. To view:

```bash
# If you have access to production logs
tail -f /var/log/supervisor/backend.out.log | grep "Kiosk Scan"
```

Look for these log lines:
```
[Kiosk Scan] Looking for QR code: tix-xxx-0-abc
[Kiosk Scan] Found X registrations for event
[Kiosk Scan] ✅ Found matching ticket: tix-xxx-0-abc
```

OR error:
```
[Kiosk Scan] ❌ Ticket not found. QR code: tix-xxx-0-abc
```

### Step 4: Verify QR Code Contents

The QR code should contain the ticket's `id` field:
- Format: `tix-TIMESTAMP-INDEX-RANDOM`
- Example: `tix-1768925067215-0-fkhz`

**NOT**:
- Registration ID
- Order ID  
- Old format: `TICKET:regId:tierId:index`

### Step 5: Common Issues & Fixes

#### Issue: "Invalid or expired token"
**Fix**: Generate a new kiosk token in settings

#### Issue: "Ticket not found" with correct QR format
**Possible causes**:
1. Ticket was purchased on different event
2. Ticket was refunded
3. Database mismatch between dev/production

**Debug**:
```sql
-- Check if ticket exists in production database
SELECT id, tickets FROM registrations 
WHERE event_id = 'YOUR_EVENT_ID' 
AND tickets::text LIKE '%tix-xxx%';
```

#### Issue: QR code contains wrong format
**Fix**: The ticket was created before the fix. Purchase a NEW ticket.

### Step 6: Manual Test via API

Test the scan endpoint directly:

```bash
API_URL="https://www.openticket.events"
EVENT_ID="your-event-id"
TOKEN_ID="your-kiosk-token-id"
TICKET_ID="tix-1768925067215-0-fkhz"

curl -X POST "$API_URL/api/kiosk/scan" \
  -H "Content-Type: application/json" \
  -d "{
    \"qrCode\": \"$TICKET_ID\",
    \"tokenId\": \"$TOKEN_ID\",
    \"eventId\": \"$EVENT_ID\",
    \"deviceId\": \"test-device\"
  }"
```

Expected response:
```json
{
  "success": true,
  "status": "valid",
  "message": "Valid ticket",
  "attendeeName": "John Doe",
  "ticketType": "General Admission"
}
```

### Step 7: Verify Ticket Structure in Database

The tickets array should look like:
```json
[
  {
    "id": "tix-1768925067215-0-fkhz",
    "name": "General Admission",
    "attendeeName": "John",
    "attendeeEmail": "john@example.com",
    "pricePerTicket": 20,
    "status": "valid",
    "purchaseDate": "2026-01-20T..."
  },
  {
    "id": "tix-1768925067215-1-1apy",
    "name": "General Admission", 
    "attendeeName": "Jane",
    "attendeeEmail": "jane@example.com",
    "pricePerTicket": 20,
    "status": "valid",
    "purchaseDate": "2026-01-20T..."
  }
]
```

**NOT** the old format with `quantity` field.

### Step 8: Test Local vs Production

If scan works locally but not in production:

1. **Check production environment variables**:
   - `FRONTEND_URL` must be set
   - `SUPABASE_URL` must match
   - `SUPABASE_SERVICE_ROLE_KEY` must be correct

2. **Verify production build**:
   - Frontend must be rebuilt after changes
   - Check `dist/` folder has latest build
   - Verify Vercel deployment completed

3. **Check production database**:
   - Tickets must exist in production Supabase
   - Event ID must match
   - Tokens must not be revoked

### Success Checklist

✅ Kiosk token generated AFTER deployment  
✅ Tickets purchased AFTER deployment  
✅ Each ticket has unique ID (tix-xxx format)  
✅ QR codes are different for each ticket  
✅ Backend logs show ticket search  
✅ Scan returns "Valid ticket" or appropriate status  

---

## 🆘 Still Not Working?

If you've completed all steps and scanning still fails:

1. **Share these details**:
   - Kiosk URL (with token)
   - Sample ticket ID from QR code
   - Backend log output for scan attempt
   - Screenshot of error

2. **Check for these edge cases**:
   - Are you testing on the same event?
   - Is the event ID in the kiosk URL correct?
   - Are the tickets for the same event?
   - Has the kiosk token expired?

3. **Last resort - Data migration**:
   If old tickets must work, we can run a script to regenerate ticket IDs for existing registrations.
