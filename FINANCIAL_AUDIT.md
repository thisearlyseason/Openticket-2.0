# Financial & Guest Count Audit Report
## Event: TYLERS MUSICAL APPEARAMCE

### Date: January 17, 2025

---

## 🔍 ISSUES IDENTIFIED

### 1. Guest Count Issues (registered_count)

**Problem:**
- `event.registeredCount` displays on ManageEvent page (line 226 in ManageEvent.tsx)
- Only incremented via `increment_registered_count` RPC when payment succeeds
- **NEVER DECREMENTED** when refunds occur
- Result: Shows inflated count including refunded tickets

**Impact:** ❌ CRITICAL
- Guest list shows wrong numbers
- Capacity calculations incorrect
- Dashboard analytics misleading

**Files Affected:**
- `/app/components/ManageEvent.tsx` (line 226)
- `/app/backend/controllers/stripeController.js` (line 654)
- `/app/backend/controllers/registrationController.js` (refund function doesn't decrement)

---

### 2. Refund Flow Issues

**Problem:** User tried refund but "nothing happened"

**Root Causes Found:**

#### A. Missing registered_count Decrement
- Refund updates registration status to 'refunded'
- Updates tickets array with refunded status
- Processes Stripe refund
- **BUT: Does NOT decrement event.registered_count**
- Result: Event still shows tickets as "sold" even after refund

#### B. Potential Stripe API Issues
- Code at line 292-318 in registrationController.js retrieves session and creates refund
- If session.payment_intent doesn't exist, refund silently fails
- Error is logged but NOT returned to user
- User sees no feedback that refund failed

#### C. Financial Transaction Record Issues
- Refund creates financial_transactions record (line 339-350)
- BUT: Only for non-Stripe registrations
- Stripe refunds rely on webhook (charge.refunded)
- If webhook fails, no financial record created
- Result: Refunds missing from financials

**Files Affected:**
- `/app/backend/controllers/registrationController.js` (lines 214-363)

---

### 3. Event Financials Calculation Issues

**Problems Found:**

#### A. Dual Calculation Methods
- Uses backend API: `/api/admin/events/${eventId}/financials`
- Falls back to registration-based calculation (line 332-445)
- Two different calculation methods can produce different results
- No guarantee they're consistent

#### B. Registration-Based Calculation Flaws (line 349-445)
- Uses `reg.paymentStatus === 'paid' OR has stripePaymentIntentId`
- Doesn't properly handle partial refunds
- Doesn't check ticket-level status
- Doesn't account for refunded add-ons separately

#### C. Refund Amount Calculation
- Line 357-366: Calculates refund from tickets + addons + fees
- Uses `reg.refundedAmount` if available, otherwise calculates total
- **BUT: Doesn't handle partial refunds correctly**
- If only 2 of 5 tickets refunded, still shows full amount

**Files Affected:**
- `/app/components/EventFinance.tsx` (lines 263-445)

---

### 4. Dashboard Payout Consistency Issues

**Problem:** Dashboard "About" card vs Settings payouts don't match

**Root Causes:**

#### A. Multiple Payout Calculation Points
1. **Dashboard.tsx** (line 94-130) - Fetches from `/api/admin/upcoming-payouts`
2. **Billing.tsx** - Calculates from payouts table with status='READY'
3. **EventFinance.tsx** - Shows `summary.netEarnings`

Each uses different data source and calculation method

#### B. Pending vs Ready vs Paid States
- Confusion between:
  - `payout_status` in financial_transactions table (pending/ready/paid)
  - Actual organizer_payouts table records
  - Dashboard display logic

**Files Affected:**
- `/app/components/Dashboard.tsx`
- `/app/components/Billing.tsx`
- `/app/components/EventFinance.tsx`

---

### 5. Rogue/Incorrect Pending Registrations

**Suspected Issues:**

#### A. Payment Status Ambiguity
- Registration can have:
  - `paymentStatus: 'pending'`
  - `paymentStatus: 'paid'`
  - `stripe_checkout_session_id` exists
  - `stripePaymentIntentId` exists
  - Webhook may or may not have fired

#### B. Abandoned Checkouts
- Stripe session created
- User never completed
- Registration stuck in 'pending'
- Shows in financial calculations as "transaction"

#### C. Webhook Failures
- Payment succeeded in Stripe
- Webhook didn't fire or failed
- Registration remains 'pending' in DB
- Money collected but not tracked

**Files to Check:**
- `/app/backend/controllers/stripeController.js`
- `/app/backend/controllers/stripeWebhookController.js`

---

## 🔧 REQUIRED FIXES

### Fix Priority 1: Refund Flow (CRITICAL)

**1.1 Add registered_count Decrement**
Location: `/app/backend/controllers/registrationController.js` line ~320

```javascript
// After updating registration, decrement count
const ticketCount = /* calculate total tickets being refunded */;
await supabase.rpc('decrement_registered_count', {
    p_event_id: reg.event_id,
    p_count: ticketCount
});
```

**1.2 Improve Refund Error Handling**
- Return clear error messages to frontend
- Show user what went wrong
- Log all Stripe API errors with context

**1.3 Create Financial Record Backup**
- Don't rely solely on webhooks
- Create transaction record immediately after Stripe refund
- Mark as 'pending_webhook' and update when webhook arrives

---

### Fix Priority 2: Guest Count Accuracy

**2.1 Recalculate registered_count**
- Create migration/fix script
- Loop through all events
- Count actual non-refunded tickets
- Update registered_count to match reality

**2.2 Ensure Consistency**
- Increment on payment success ✅ (already working)
- **Decrement on refund** ❌ (needs fix)
- **Decrement on cancellation** ❌ (needs implementation)

---

### Fix Priority 3: Financial Consistency

**3.1 Use Single Source of Truth**
- Always use backend API financials
- Remove fallback calculation
- Backend should handle all edge cases

**3.2 Fix Partial Refund Handling**
- Track refunded tickets individually
- Sum only actually refunded amounts
- Don't double-count

**3.3 Separate Calculations for:**
- Gross Sales (total charged)
- Refunds (total refunded)
- Net Revenue (gross - refunds - fees)
- Platform Fees
- Stripe Fees
- Organizer Net Payout

---

### Fix Priority 4: Dashboard Consistency

**4.1 Standardize Payout Display**
- All views use same API endpoint
- Use organizer_payouts table as source of truth
- Status definitions:
  - `pending`: Event hasn't ended
  - `ready`: Event ended, not yet requested
  - `paid`: Payout completed

**4.2 Create Single Payout Service**
- Centralized calculation logic
- Used by Dashboard, Billing, EventFinance
- Consistent everywhere

---

### Fix Priority 5: Clean Up Pending Registrations

**5.1 Identify Rogue Records**
```sql
SELECT * FROM registrations 
WHERE payment_status = 'pending' 
AND stripe_checkout_session_id IS NOT NULL
AND created_at < NOW() - INTERVAL '24 hours';
```

**5.2 Verification Script**
- Check each with Stripe API
- If paid in Stripe, update to 'paid'
- If abandoned/expired, mark 'cancelled'
- Never delete (keep for analytics)

---

## 📊 TESTING PLAN

### Test 1: Full Refund
1. Create test registration
2. Process full refund
3. Verify:
   - ✅ registered_count decrements
   - ✅ Financial transaction created
   - ✅ Dashboard payout updates
   - ✅ Event financials accurate
   - ✅ Analytics reflect refund

### Test 2: Partial Refund
1. Registration with 5 tickets
2. Refund 2 tickets
3. Verify:
   - ✅ registered_count decrements by 2
   - ✅ Only 2 tickets refunded amount
   - ✅ 3 tickets still show as paid

### Test 3: Dashboard Consistency
1. Check Dashboard payout amount
2. Check Settings → Billing payout
3. Check Event Financials net earnings
4. Verify all match

---

## 🎯 SUCCESS METRICS

- [ ] Guest counts accurate across all views
- [ ] Refunds process without errors
- [ ] Refunds update all surfaces
- [ ] Financial totals consistent everywhere
- [ ] No rogue pending registrations
- [ ] Dashboard = Settings = Event Financials

---

## 📝 NEXT STEPS

1. Review this audit with user
2. Prioritize fixes
3. Implement fixes systematically
4. Test with "TYLERS MUSICAL APPEARAMCE" event
5. Run end-to-end validation
6. Deploy fixes

