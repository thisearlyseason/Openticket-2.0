# Unique Ticket System Documentation

## Overview

The ticket system has been completely refactored to ensure each purchased ticket is uniquely identifiable and independently scannable. This eliminates issues with duplicate QR codes and improves check-in accuracy.

---

## Key Changes

### Before (Old System)
- Tickets stored with `quantity` field (e.g., 3 tickets = 1 record with qty=3)
- QR codes: `TICKET:{registrationId}:{tierId}:{index}`
- Check-in affected all tickets of same tier
- No unique ticket identifiers

### After (New System)
- Each ticket is a separate record with `quantity: 1`
- Each ticket has unique `ticketId` and `ticketNumber`
- QR codes encode only the `ticketId` (e.g., `TKT-1736789012345-a7f3x9`)
- Check-in validates individual tickets only
- Full transfer history preserved

---

## Ticket Structure

```javascript
{
  // === UNIQUE IDENTIFIERS (NEW) ===
  ticketId: "TKT-1736789012345-a7f3x9",      // Unique ID for this ticket
  ticketNumber: "TKT-ABC123",                 // Human-readable ticket number
  qrCodeData: "TKT-1736789012345-a7f3x9",    // QR encodes ticketId only
  
  // === TIER INFORMATION ===
  tierId: "general",
  name: "General Admission",
  price: 25.00,
  quantity: 1,  // Always 1 for unique tickets
  
  // === ATTENDEE INFORMATION ===
  attendeeName: "John Doe",                   // Current owner
  originalAttendeeName: null,                 // Set when transferred
  
  // === STATUS TRACKING ===
  status: "valid",  // valid | refunded | cancelled
  checkedIn: false,
  checkedInAt: null,
  checkedInBy: null,
  
  // === TRANSFER TRACKING ===
  transferStatus: null,  // null | transferred_out | transferred_in
  transferredToEmail: null,
  transferredFromEmail: null,
  transferId: null,
  
  // === METADATA ===
  createdAt: "2026-01-11T20:00:00Z",
  purchaseDate: "2026-01-11T20:05:00Z"
}
```

---

## Purchase Flow

### 1. User Purchases 3 Tickets

**Frontend sends:**
```javascript
{
  event_id: "event-123",
  attendee_name: "Alice Smith",
  attendee_email: "alice@example.com",
  tickets: [
    { tierId: "general", name: "General Admission", quantity: 3, price: 25.00 }
  ]
}
```

**Backend transforms to:**
```javascript
{
  event_id: "event-123",
  attendee_name: "Alice Smith",
  attendee_email: "alice@example.com",
  tickets: [
    {
      ticketId: "TKT-1736789012345-a7f3x9",
      ticketNumber: "TKT-ABC123",
      qrCodeData: "TKT-1736789012345-a7f3x9",
      tierId: "general",
      name: "General Admission",
      quantity: 1,
      attendeeName: "Alice Smith",
      // ... other fields
    },
    {
      ticketId: "TKT-1736789012346-b8g4y0",
      ticketNumber: "TKT-DEF456",
      qrCodeData: "TKT-1736789012346-b8g4y0",
      tierId: "general",
      name: "General Admission",
      quantity: 1,
      attendeeName: "Alice Smith",
      // ... other fields
    },
    {
      ticketId: "TKT-1736789012347-c9h5z1",
      ticketNumber: "TKT-GHI789",
      qrCodeData: "TKT-1736789012347-c9h5z1",
      tierId: "general",
      name: "General Admission",
      quantity: 1,
      attendeeName: "Alice Smith",
      // ... other fields
    }
  ]
}
```

### 2. Payment Confirmation (Stripe Webhook)

When payment succeeds, the webhook ensures all tickets have unique IDs. If tickets were created before payment (pending), they're transformed during confirmation.

---

## Check-In Flow

### New Check-In API

**Endpoint:** `POST /api/registrations/checkin`

**Request:**
```json
{
  "ticketId": "TKT-1736789012345-a7f3x9",
  "eventId": "event-123"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Check-in successful",
  "ticket": {
    "ticketId": "TKT-1736789012345-a7f3x9",
    "ticketNumber": "TKT-ABC123",
    "attendeeName": "Alice Smith",
    "tierName": "General Admission",
    "checkedInAt": "2026-01-11T23:15:00Z"
  }
}
```

**Error Responses:**
```json
// Already checked in
{
  "error": "Already checked in",
  "message": "This ticket was already checked in at 1/11/2026, 11:00 PM",
  "ticket": {
    "ticketNumber": "TKT-ABC123",
    "attendeeName": "Alice Smith",
    "checkedInAt": "2026-01-11T23:00:00Z"
  }
}

// Ticket not found
{
  "error": "Ticket not found",
  "message": "This ticket does not exist in this event or has been invalidated"
}

// Refunded ticket
{
  "error": "Ticket refunded",
  "message": "This ticket has been refunded and is no longer valid"
}
```

### QR Scanner Integration

The CheckInPortal now handles both formats:

```javascript
// NEW FORMAT: Unique ticket ID
if (rawValue.startsWith('TKT-')) {
  // Call /api/registrations/checkin
  // Response shows individual ticket details
}

// LEGACY FORMAT: Old QR codes
if (rawValue.startsWith('TICKET:')) {
  // Parse: TICKET:{regId}:{tierId}:{index}
  // Use old check-in logic
}
```

---

## Transfer Flow with Name History

### Before Transfer
```javascript
{
  ticketId: "TKT-1736789012345-a7f3x9",
  attendeeName: "Alice Smith",
  originalAttendeeName: null,
  transferStatus: null
}
```

### After Transfer to Bob
**Sender's Ticket (Alice):**
```javascript
{
  ticketId: "TKT-1736789012345-a7f3x9",  // ID unchanged
  attendeeName: "Alice Smith",
  transferStatus: "transferred_out",
  transferredToEmail: "bob@example.com"
}
```

**Recipient's Ticket (Bob):**
```javascript
{
  ticketId: "TKT-1736789012345-a7f3x9",  // Same ID!
  ticketNumber: "TKT-ABC123",             // Same number!
  qrCodeData: "TKT-1736789012345-a7f3x9", // Same QR!
  attendeeName: "Bob Jones",
  originalAttendeeName: "Alice Smith",    // History preserved
  transferStatus: "transferred_in",
  transferredFromEmail: "alice@example.com"
}
```

### UI Display for Transferred Tickets
```
Attendee:
  Alice Smith  (struck through, gray text)
  Bob Jones    (current owner, normal text)
```

---

## Backward Compatibility

The system maintains backward compatibility with existing tickets:

### Legacy Ticket Detection
```javascript
const hasUniqueId = ticket.ticketId && ticket.ticketNumber;

if (hasUniqueId) {
  // NEW: Use unique ticket structure
  // Display ticketNumber, use ticketId for QR
} else {
  // LEGACY: Old ticket with quantity field
  // Loop through quantity, generate display keys
  // Use old QR format: TICKET:{regId}:{tierId}:{index}
}
```

### Migration Strategy
- New purchases automatically get unique IDs
- Existing tickets continue to work with legacy format
- Old QR codes still scan correctly
- System handles both formats transparently

---

## Frontend Changes

### MyTickets.tsx

**Ticket Display:**
- Shows unique `ticketNumber` (e.g., "TKT-ABC123")
- Displays individual `attendeeName` per ticket
- Shows transfer history with strikethrough
- QR code uses `ticketId` instead of constructed string

**Key Code Changes:**
```javascript
// NEW: Check for unique ID structure
const hasUniqueId = t.ticketId && t.ticketNumber;

if (hasUniqueId) {
  // Individual ticket - quantity is always 1
  ticketList.push({
    uniqueQrData: t.qrCodeData || t.ticketId,
    ticketIdDisplay: t.ticketNumber,
    attendeeName: t.attendeeName || reg.attendeeName,
    originalAttendeeName: t.originalAttendeeName
  });
} else {
  // Legacy ticket - loop through quantity
  for (let i = 0; i < t.quantity; i++) {
    // ... legacy handling
  }
}
```

### CheckInPortal.tsx

**QR Scanner:**
- Detects new format (`TKT-xxx`)
- Calls new check-in API
- Shows detailed success/error messages
- Falls back to legacy for old codes

---

## Testing Checklist

### ✅ Must Test

1. **Purchase Flow:**
   - [ ] Buy 1 ticket → Verify unique ID generated
   - [ ] Buy 3 tickets → Verify 3 unique IDs/QR codes
   - [ ] View in MyTickets → All tickets show with unique numbers

2. **Check-In:**
   - [ ] Scan ticket #1 → Only ticket #1 checked in
   - [ ] Scan ticket #2 → Only ticket #2 checked in
   - [ ] Re-scan ticket #1 → Shows "Already checked in"
   - [ ] Scan invalid QR → Shows "Ticket not found"

3. **Transfer:**
   - [ ] Transfer ticket from Alice to Bob
   - [ ] Alice: Ticket disappears from active view
   - [ ] Bob: Ticket appears with "Transferred In" badge
   - [ ] Bob's ticket shows: "Alice" (struck) + "Bob" (current)
   - [ ] QR code remains same, still scannable

4. **Name Assignment:**
   - [ ] During checkout, assign names to tickets
   - [ ] Verify each ticket shows correct name
   - [ ] Transfer should preserve assigned name history

5. **Legacy Compatibility:**
   - [ ] Existing tickets still display correctly
   - [ ] Old QR codes still scan
   - [ ] Mixed events (old + new tickets) work

---

## API Reference

### Check-In Endpoint

```
POST /api/registrations/checkin
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "ticketId": "TKT-1736789012345-a7f3x9",
  "eventId": "event-123"
}
```

**Responses:**

| Status | Description | Response |
|--------|-------------|----------|
| 200 | Check-in successful | `{ success: true, ticket: {...} }` |
| 400 | Already checked in | `{ error: "Already checked in", ... }` |
| 400 | Ticket refunded | `{ error: "Ticket refunded", ... }` |
| 403 | Unauthorized | `{ error: "Unauthorized" }` |
| 404 | Ticket not found | `{ error: "Ticket not found", ... }` |

---

## Security Considerations

1. **Unique QR Codes:** Each ticket has cryptographically unique ID
2. **Individual Check-In:** Scanning one ticket doesn't affect others
3. **Transfer Validation:** Can't transfer checked-in tickets
4. **Ownership Verification:** Check-in requires event ownership
5. **Status Tracking:** Prevents re-scanning checked-in tickets

---

## Future Enhancements

1. **Mobile Scanner App:** Dedicated QR scanner with offline support
2. **Batch Check-In:** Check in multiple tickets at once
3. **Analytics:** Track check-in rates, peak times
4. **Export:** Download ticket manifests with all unique IDs
5. **Audit Trail:** Complete history of all ticket actions

---

## Troubleshooting

### Issue: Tickets show old format after purchase
**Solution:** Check Stripe webhook is processing correctly. Webhook transforms tickets during payment confirmation.

### Issue: QR codes not scanning
**Solution:** Ensure QR code encodes `ticketId` not old format. Check `qrCodeData` field in ticket object.

### Issue: Multiple tickets checking in together
**Solution:** Verify check-in API is being used. Old logic may be active if `handleCheckInToggle` is called instead.

### Issue: Transfer doesn't preserve ticket ID
**Solution:** Check finalization logic preserves `ticketId`, `ticketNumber`, and `qrCodeData` fields.

---

## Summary

The new unique ticket system provides:
- ✅ Individual ticket identification
- ✅ Unique QR codes per ticket
- ✅ Independent check-in validation
- ✅ Full transfer history
- ✅ Backward compatibility
- ✅ Fraud prevention

This ensures each ticket is uniquely trackable throughout its lifecycle, from purchase through transfer to check-in.
