# Transfer Ownership Verification Fix

## Problem
User was unable to transfer tickets they purchased, receiving error:
```
403 - You do not own this ticket
```

## Root Causes

### 1. **Strict User ID Check**
The transfer endpoint was ONLY checking if `registration.user_id === senderUserId`.

**Issues:**
- Guest checkouts don't have `user_id` set
- Older registrations might not have `user_id`
- Email-based registrations weren't matched
- Superadmin purchases might use different user structure

### 2. **New Ticket Structure Not Recognized**
The ticket matching logic didn't check the new `ticketId` field first, causing failures for newly purchased tickets with unique IDs.

---

## Solution

### 1. Enhanced Ownership Verification (`registrationController.js`)

**Old Logic:**
```javascript
if (registration.user_id !== senderUserId) {
    return res.status(403).json({ error: 'You do not own this ticket' });
}
```

**New Logic:**
```javascript
let senderOwnsTicket = false;

// Check 1: user_id match (if available)
if (registration.user_id && registration.user_id === senderUserId) {
    senderOwnsTicket = true;
}

// Check 2: Get user's email and match with registration email
if (!senderOwnsTicket) {
    const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', senderUserId)
        .single();
    
    if (userProfile && userProfile.email === registration.attendee_email) {
        senderOwnsTicket = true;
    }
}

if (!senderOwnsTicket) {
    return res.status(403).json({ error: 'You do not own this ticket' });
}
```

**Benefits:**
- ✅ Supports user_id-based ownership (modern registrations)
- ✅ Supports email-based ownership (guest checkouts, legacy)
- ✅ Works for Superadmin purchases
- ✅ Backward compatible with all registration types

### 2. Enhanced Ticket Matching

**Added Priority Strategy:**
```javascript
// Strategy 0: NEW - Match by unique ticketId (for new ticket structure)
ticketIndex = tickets.findIndex(t => t.ticketId === ticketKey);
```

**Full Strategy Order:**
1. Match by `ticketId` (new unique tickets) ← **NEW**
2. Match by `key` (legacy)
3. Match by `id` (legacy)
4. Match by `tierId` (legacy)
5. Match by `id === tierIdPart` (legacy)
6. Single ticket fallback
7. Quantity-based index matching (legacy)

---

## Testing

### Test Case 1: Fresh Purchase with Unique Tickets
```
User purchases 2 tickets
Each ticket has: ticketId = "TKT-1736789012345-a7f3x9"
User tries to transfer one ticket
Result: ✅ Should work (matched by ticketId)
```

### Test Case 2: Guest Checkout (No user_id)
```
Guest purchases tickets (no login)
Registration has: { attendee_email: "guest@example.com", user_id: null }
User creates account with same email
User tries to transfer ticket
Result: ✅ Should work (matched by email)
```

### Test Case 3: Legacy Tickets
```
Old ticket structure: { key: "tier123-0", quantity: 3 }
User tries to transfer
Result: ✅ Should work (matched by legacy strategies)
```

### Test Case 4: Superadmin
```
Superadmin purchases tickets
Registration has: { attendee_email: "admin@example.com" }
Superadmin profile: { email: "admin@example.com" }
Result: ✅ Should work (matched by email)
```

---

## Backend Logging

The fix includes detailed logging to help debug future issues:

```
[Transfer] Initiating transfer: registration=..., ticket=..., to=...
[Transfer] Ownership verified by user_id
  OR
[Transfer] Ownership verified by email match
  OR
[Transfer] Ownership verification failed: { regUserId, senderUserId, regEmail }

[Transfer] Looking for ticket: { ticketKey }
[Transfer] Available tickets: [...]
[Transfer] Matched by ticketId (new structure)
  OR
[Transfer] Matched by key
  OR
[Transfer] Matched by id
  ... etc
```

---

## Files Modified

1. `/app/backend/controllers/registrationController.js`
   - Enhanced ownership verification (lines ~622-652)
   - Added ticketId matching as first strategy (lines ~654-710)
   - Improved logging throughout

---

## Expected Behavior After Fix

✅ **User-owned tickets**: Can transfer tickets purchased under their account
✅ **Email-matched tickets**: Can transfer tickets where email matches their profile
✅ **Guest purchases**: Can transfer after creating account with same email
✅ **Unique tickets**: New ticket structure properly recognized
✅ **Legacy tickets**: Old ticket structure still works
✅ **Clear errors**: Better logging for debugging ownership issues

---

## Verification Checklist

After deploying this fix:
- [ ] User can transfer tickets they purchased
- [ ] Transfer button appears on owned tickets
- [ ] No 403 errors for valid ownership
- [ ] Check backend logs show "Ownership verified by..." message
- [ ] Transfers work for both new (unique ID) and legacy tickets
- [ ] Superadmin can transfer their purchased tickets
