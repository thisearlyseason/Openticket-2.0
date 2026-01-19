# Kiosk Mode Testing Guide

## Prerequisites
✅ Database migration MUST be run first (see KIOSK_MODE_SETUP.md)

## Backend API Testing

### 1. Test User Login & Get Token
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Login to get auth token
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test+openticket@gmail.com","password":"12345678"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('token', ''))")

echo "Auth Token: $TOKEN"
```

### 2. Get User's Events
```bash
# Get events list to find an event ID
curl -s -X GET "$API_URL/api/events" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### 3. Generate Kiosk Token
```bash
# Replace EVENT_ID with actual event ID from step 2
EVENT_ID="your-event-id-here"

curl -s -X POST "$API_URL/api/kiosk/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"eventId\": \"$EVENT_ID\",
    \"paymentEnabled\": true,
    \"pinCode\": \"1234\"
  }" | python3 -m json.tool
```

Expected Response:
```json
{
  "success": true,
  "token": "uuid-token-here",
  "expiresAt": "2025-01-20T12:00:00.000Z",
  "kioskUrl": "https://.../#/kiosk/EVENT_ID?token=TOKEN_ID"
}
```

### 4. Validate Kiosk Token
```bash
KIOSK_TOKEN="token-from-step-3"

curl -s -X POST "$API_URL/api/kiosk/validate" \
  -H "Content-Type: application/json" \
  -d "{
    \"tokenId\": \"$KIOSK_TOKEN\",
    \"eventId\": \"$EVENT_ID\"
  }" | python3 -m json.tool
```

### 5. Get Kiosk Status
```bash
curl -s -X GET "$API_URL/api/kiosk/status/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### 6. Search Guests
```bash
curl -s -X GET "$API_URL/api/kiosk/guest-search?query=test&tokenId=$KIOSK_TOKEN&eventId=$EVENT_ID" | python3 -m json.tool
```

### 7. Revoke Token
```bash
curl -s -X POST "$API_URL/api/kiosk/revoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"tokenId\": \"$KIOSK_TOKEN\",
    \"eventId\": \"$EVENT_ID\"
  }" | python3 -m json.tool
```

---

## Frontend Testing

### Test 1: Homepage Loads
```bash
✅ Already verified - homepage loads correctly
```

### Test 2: Login & Navigate to Event Management
1. Go to http://localhost:3000
2. Click "Sign In"
3. Login with: test+openticket@gmail.com / 12345678
4. Navigate to Dashboard
5. Select an event
6. Verify "Kiosk Mode" card is visible in the management grid

### Test 3: Kiosk Settings Page
1. Click on "Kiosk Mode" card
2. Verify KioskSettings component loads
3. Check for:
   - "Activate Kiosk Mode" button (if no token)
   - Payment enabled checkbox
   - PIN code option
4. Click "Activate Kiosk Mode"
5. Verify:
   - QR code displays
   - Kiosk URL is shown
   - "Disable Kiosk" button appears

### Test 4: Kiosk Device Flow
1. Copy the kiosk URL from settings
2. Open URL in new incognito window
3. Verify:
   - KioskHome loads
   - Token validation succeeds
   - Event info displays
4. Test navigation:
   - Scan ticket button works
   - Search guest button works
   - Payment button works (if enabled)

### Test 5: QR Code Scanning
1. From kiosk device, click "Scan Ticket"
2. Test scanning a valid ticket QR
3. Verify check-in flow:
   - Guest info displays
   - Check-in button works
   - Success screen shows

---

## Error Cases to Test

### Backend
- [ ] Invalid token ID returns 404
- [ ] Expired token returns 403
- [ ] Revoked token returns 403
- [ ] Unauthorized event access returns 403
- [ ] Duplicate check-in returns 400
- [ ] Payment required before check-in returns 400

### Frontend
- [ ] Invalid kiosk URL shows error
- [ ] Expired token shows error message
- [ ] Network error handling
- [ ] Empty search results handled
- [ ] QR scan failure handled

---

## Performance Tests
- [ ] Multiple kiosk devices simultaneously
- [ ] 100+ guest search results
- [ ] QR scan speed (<2 seconds)
- [ ] Token validation speed (<1 second)

---

## Security Tests
- [ ] Cannot access admin routes from kiosk mode
- [ ] Token scoped to correct event only
- [ ] PIN exit requirement works
- [ ] Token revocation immediate
- [ ] Expired token auto-blocks

---

## Integration Tests
- [ ] Check-in updates registration record
- [ ] Payment updates payment status
- [ ] Logs are created for all actions
- [ ] Multiple check-ins prevented
- [ ] Door payment creates new registration

---

## Known Issues / Limitations

1. **Database Not Migrated**: Tables don't exist yet - migration required
2. **QR Scanner UI**: Camera integration needs real device testing
3. **Offline Mode**: Not yet implemented
4. **Token Refresh**: No auto-refresh before expiration

---

## Test Credentials

- **Email**: test+openticket@gmail.com
- **Password**: 12345678
- **Super Admin**: tylerans@gmail.com

---

## Next Testing Phase

After database migration:
1. Run full backend API tests
2. Test frontend E2E with testing subagent
3. Test on real tablet device
4. User acceptance testing
