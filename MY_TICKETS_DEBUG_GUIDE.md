# Purchased Tickets Not Appearing - Debugging Guide

## Issue
User purchased tickets but they don't appear on the "My Tickets" page.

## Common Causes & Solutions

### 1. Email Mismatch (Most Common)
**Cause:** Ticket was purchased with a different email than the logged-in account.

**How to Check:**
1. Open browser console (F12) on "My Tickets" page
2. Look for log: `[MyTickets] Loading tickets for email: <email>`
3. Verify this matches the email used during purchase
4. Check the order confirmation email - what email address received it?

**Solution:**
- If emails don't match, the user needs to either:
  a. Login with the email used for purchase, OR
  b. Contact the organizer to update the attendee email

### 2. Payment Status - Pending Payments
**Cause:** Payment is still "pending" (not completed).

**How to Check:**
1. Open browser console on "My Tickets" page
2. Look for: `[MyTickets] Processing registration: <ID> payment: pending`
3. Check if tickets appear in the "Active" tab (they should with "Pending" badge)

**What Pending Means:**
- For Stripe payments: Checkout was started but not completed
- For offline/door payments: Payment to be collected later

**Solution:**
- For Stripe: Complete the checkout process
- For offline: Tickets will show with "Pay at Door" badge

### 3. Payment Status - Expired Payments
**Cause:** Pending payment exceeded the payment time limit set by organizer.

**How to Check:**
1. In console, look for: `isExpired: true`
2. These tickets appear in "Archived" tab, not "Active"

**Solution:**
- User needs to repurchase tickets
- Organizer can delete expired registrations and create new ones

### 4. Hidden Tickets
**Cause:** Organizer manually hid the ticket from attendee view.

**How to Check:**
1. In console: `isRegHidden: true` or `isTicketHidden: true`
2. These only appear in "Archived" tab

**Solution:**
- Contact organizer to unhide the ticket

### 5. Refunded Tickets
**Cause:** Ticket was refunded.

**How to Check:**
1. In console: `isRefunded: true` or `paymentStatus: 'refunded'`
2. Should appear in "Active" tab with "Refunded" badge

**If Refunded Tickets Are Missing:**
- This is expected - refunded tickets show in both Active and Archived views

### 6. Past Event
**Cause:** Event date has passed.

**How to Check:**
1. In console: `isPastEvent: true`
2. Tickets appear in "Past" tab, not "Active"

**Solution:**
- Switch to "Past" tab to see these tickets

## Debugging Steps for User

### Step 1: Verify Email Match
```
1. Login to the account
2. Go to Settings → Check your email address
3. Compare with the email used during ticket purchase (check confirmation email)
```

### Step 2: Check All Tabs
```
1. Go to "My Tickets"
2. Check "Active" tab
3. Check "Past" tab
4. Check "Archived" tab
```

### Step 3: Enable Console Logging
```
1. Press F12 to open browser console
2. Go to "My Tickets" page
3. Look for logs starting with [MyTickets]
4. Share relevant logs with support if issue persists
```

### Step 4: Verify Registration Exists
Ask the organizer to check their Guest List:
```
1. Does the registration appear in the organizer's Guest List?
2. What is the payment status?
3. What email address is on the registration?
```

## Database-Level Check (For Agent/Developer)

If the issue persists, check the backend:

```bash
# Query registrations by email
curl -X GET "https://your-backend.com/api/registrations?email=user@example.com" \
  -H "Authorization: Bearer <token>"

# Check response:
# - Are there any registrations returned?
# - What is the paymentStatus?
# - What is the attendee_email field?
```

## Code Enhancement Ideas (For Future Implementation)

### 1. Add Email Normalization
Ensure email matching is case-insensitive:
```typescript
const normalizedEmail = email.toLowerCase().trim();
```

### 2. Add Clear Cache Button
Allow users to force-refresh their tickets:
```typescript
<Button onClick={() => {
  StorageService.clearCache('regs');
  loadTickets(user.email);
}}>
  Refresh Tickets
</Button>
```

### 3. Show "No Tickets Found" Message
Instead of just an empty list, show helpful guidance:
```typescript
if (eventGroups.length === 0) {
  return <Card>
    <p>No tickets found for {user.email}</p>
    <p>If you purchased tickets with a different email, 
       please login with that email or contact support.</p>
  </Card>
}
```

## Status
📋 **Debugging Guide Created** - User can follow these steps
⏳ **Requires User Testing** - Need specific case details to diagnose further
💡 **Enhancement Ideas** - Can implement better error messages and caching controls
