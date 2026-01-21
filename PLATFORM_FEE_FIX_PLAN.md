# Platform Fee & Financial Tracking - Implementation Plan

## Issues Identified

### 1. Platform Fee Calculation Logic (CRITICAL)
**File:** `/app/backend/utils/priceCalculator.js` lines 188-202

**Current Logic (INCORRECT):**
```javascript
const shouldChargeFee = !event.absorb_fees && 
    event.price_type !== 'free' && 
    event.price_type !== 'donation' && 
    feeBase > 0;
```

**Problems:**
- When `absorb_fees = true`, platform fee is set to $0 ❌
- When `price_type = 'donation'`, platform fee is set to $0 ❌
- This violates the requirement: "Platform fee must still be calculated and recorded"

**Correct Logic:**
```javascript
// ALWAYS calculate platform fee for paid transactions
// Free tickets are the ONLY exception
const isPaidTransaction = event.price_type !== 'free' && feeBase > 0;

if (isPaidTransaction) {
    breakdown.platformFee = calculatePlatformFee(feeBase, organizerPlan);
    breakdown.platformFeeAbsorbedByOrganizer = event.absorb_fees || false;
}
```

### 2. Financial Transaction Records
**Issue:** When organizer absorbs fees, the platform fee is not stored in financial_transactions

**Required Fields:**
- `platform_fee` - Always populated for paid tickets
- `organizer_absorbed_fee` - Boolean flag
- `organizer_net` - Must deduct platform fee if organizer absorbs

### 3. Ticket Uniqueness
**Need to verify:** 
- Each ticket in an order has unique ticket ID
- Each ticket has unique QR code
- Multi-ticket orders create separate ticket records

### 4. Attendee Name Mapping
**Need to verify:**
- Attendee name is stored with each individual ticket
- Refund screen displays attendee name per ticket
- Email confirmations show attendee name per ticket

---

## Implementation Steps

### Step 1: Fix Platform Fee Calculation
```javascript
// Update calculateOrderBreakdown in priceCalculator.js

// ALWAYS calculate platform fee for paid transactions (except free tickets)
const isPaidTransaction = event.price_type !== 'free' && feeBase > 0;

if (isPaidTransaction) {
    breakdown.platformFee = calculatePlatformFee(feeBase, organizerPlan);
    breakdown.platformFeeAbsorbedByOrganizer = event.absorb_fees || false;
}

// If organizer absorbs fees, don't add to attendee's total
if (!event.absorb_fees) {
    breakdown.grandTotal += breakdown.platformFee;
} else {
    // Platform fee is paid by organizer, not attendee
    breakdown.grandTotal = feeBase; // No platform fee added
}
```

### Step 2: Update Stripe Checkout
```javascript
// In stripeController.js createCheckoutSession

// Platform fee calculation:
if (breakdown.platformFeeAbsorbedByOrganizer) {
    // Organizer pays platform fee from their revenue
    // Do NOT add platform fee to line items
    // Still track it in metadata and financial records
} else {
    // Attendee pays platform fee
    // Add as line item (current behavior)
    lineItems.push({
        price_data: {
            currency: currency,
            product_data: { name: 'Service Fee' },
            unit_amount: convertToCents(breakdown.platformFee),
        },
        quantity: 1,
    });
}
```

### Step 3: Update Financial Transaction Creation
```javascript
// In webhook handler and refund logic

await supabase.from('financial_transactions').insert({
    registration_id: id,
    event_id: eventId,
    gross_amount: grandTotal,
    platform_fee: breakdown.platformFee, // ALWAYS populated
    organizer_absorbed_fee: breakdown.platformFeeAbsorbedByOrganizer,
    stripe_fee: stripeFee,
    organizer_net: grossAmount - platformFee - stripeFee,
    // ... other fields
});
```

### Step 4: Update Refund Logic
```javascript
// When refunding, platform fees must be properly tracked

// If organizer absorbed the fee originally:
// - Platform gets full refund of their fee
// - Organizer's net increases (they don't lose the fee)

// If attendee paid the fee originally:
// - Attendee gets full refund including fee
// - Platform loses the fee revenue
```

### Step 5: Verify Ticket Uniqueness
Check in webhook handler that each ticket gets:
- Unique `id` field
- Unique `ticketNumber` or `qrCode`
- Proper `attendeeName` mapping

### Step 6: Update Financial Dashboards
Ensure Event Finance page shows:
- Platform Fees (always shown, even if absorbed)
- Organizer Net (adjusted if fees absorbed)
- Clear indicator when fees are organizer-absorbed

---

## Testing Checklist

### Free Tickets
- [ ] Platform fee = $0
- [ ] No fee shown to attendee
- [ ] No fee recorded in financial_transactions

### Paid Tickets (Attendee Pays Fee)
- [ ] Platform fee calculated correctly
- [ ] Fee shown as line item at checkout
- [ ] Fee included in grand total
- [ ] Fee recorded in financial_transactions
- [ ] Organizer net = gross - platform_fee - stripe_fee

### Paid Tickets (Organizer Absorbs Fee)
- [ ] Platform fee calculated correctly
- [ ] Fee NOT shown to attendee at checkout
- [ ] Fee NOT included in attendee's total
- [ ] Fee still recorded in financial_transactions
- [ ] `organizer_absorbed_fee = true`
- [ ] Organizer net = gross - platform_fee - stripe_fee
- [ ] Finance page shows absorbed fee clearly

### Donation Tickets
- [ ] Platform fee calculated on donation amount
- [ ] Fee behavior follows absorb_fees setting
- [ ] Fee recorded in transactions

### Refunds
- [ ] Platform fee refunded if attendee paid it
- [ ] Platform fee adjustment if organizer absorbed it
- [ ] Financial totals update correctly
- [ ] Transaction history shows refund with fees

### Multi-Ticket Orders
- [ ] Each ticket has unique ID
- [ ] Each ticket has unique QR code
- [ ] Attendee name maps to correct ticket
- [ ] Refund screen shows name per ticket
- [ ] Email shows each ticket separately

---

## SQL Queries for Validation

```sql
-- Find transactions missing platform fees
SELECT * FROM financial_transactions 
WHERE gross_amount > 0 
AND platform_fee = 0 
AND status = 'completed';

-- Find duplicate ticket IDs
SELECT ticket_id, COUNT(*) 
FROM registrations, jsonb_array_elements(tickets) as ticket
WHERE ticket->>'id' IS NOT NULL
GROUP BY ticket->>'id'
HAVING COUNT(*) > 1;

-- Verify platform fee totals
SELECT 
    SUM(platform_fee) as total_platform_fees,
    SUM(CASE WHEN organizer_absorbed_fee THEN platform_fee ELSE 0 END) as absorbed_fees,
    SUM(CASE WHEN NOT organizer_absorbed_fee THEN platform_fee ELSE 0 END) as attendee_paid_fees
FROM financial_transactions
WHERE event_id = '<event_id>';
```
