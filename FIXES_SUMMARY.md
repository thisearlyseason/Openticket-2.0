# Fixes for Confirmation Screen & Receipt Viewing

## Issue 1: No Confirmation Screen After Payment

### Problem:
After Stripe payment succeeds and redirects back, the confirmation screen doesn't show.

### Root Cause:
The success URL redirect needs proper parameters to trigger the confirmation state.

### Solution:
Check the redirect URL format in EventView.tsx line 946:
```typescript
successUrl: `${window.location.origin}/?stripe_return=true&success=true&event_id=${event.id}`
```

This should redirect to the event page with session_id parameter from Stripe.

**Fix needed**: Update success URL to redirect to the event page itself:
```typescript
successUrl: `${window.location.origin}/#/event/${event.id}?success=true&session_id={CHECKOUT_SESSION_ID}`
```

---

## Issue 2: Can Only View One Receipt

### Problem:
In "My Tickets" page, clicking "View Receipt" only shows the first purchase's receipt, not all purchases separately.

### Root Cause:
Line 627 in MyTickets.tsx:
```typescript
<Button onClick={() => setReceiptModal({ 
    isOpen: true, 
    reg: selectedGroup.tickets[0].reg,  // ← Always shows first ticket only!
    event: selectedGroup.event 
})}>
```

### Solution:
Users should be able to view receipts for each individual purchase/registration.

**Fix**: Add receipt buttons for each unique registration in the group, not just the first one.

---

## Implementation:

### Fix 1: Confirmation Screen
Update the Stripe success URL to include session_id properly.

### Fix 2: Multiple Receipts
Show a receipt button for each unique purchase (registration) in the event group.
