# Stripe Operational Verification Guide

## Part 4: Comprehensive Audit & Manual Testing Checklist

**Date**: February 20, 2026  
**Purpose**: Financial correctness and payout integrity verification  
**Status**: AUDIT ONLY - No code modifications

---

## 🚨 IDENTIFIED RISKS

### 🔴 CRITICAL RISKS

#### Risk 1: No Test/Live Mode Separation Enforcement
**Severity**: HIGH  
**Location**: All Stripe controller files

**Issue**:
```javascript
// Current implementation
return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
```

**Problem**:
- Single environment variable for Stripe key
- No explicit test vs live mode validation
- Risk of accidentally using live keys in development
- Risk of using test keys in production

**Impact**:
- Real money could be processed in test environment
- Test transactions could be attempted in production
- Webhook confusion between environments

**Evidence**: Lines 15 in `stripeController.js`, 14 in `stripeWebhookController.js`

---

#### Risk 2: Stripe Fee Fallback Calculation
**Severity**: MEDIUM-HIGH  
**Location**: `/app/backend/controllers/stripeWebhookController.js` lines 161-163

**Issue**:
```javascript
if (stripeFee === 0) {
    stripeFee = Number(((grossAmount * 0.029) + 0.30).toFixed(2));
}
```

**Problem**:
- Hardcoded fallback fee calculation (2.9% + $0.30)
- Does NOT account for:
  - International cards (3.9% + $0.30)
  - Currency conversion fees (+1%)
  - Different Stripe pricing tiers
  - Amex/corporate cards (higher fees)
- Could underestimate actual Stripe fees by 35-50%

**Impact**:
- `organizer_net` will be calculated too high
- Organizer receives more than they should
- Platform/organizer loses money when actual fees are higher

**Example**:
```
Real scenario: $100 charge with international card
Actual Stripe fee: $4.20 (3.9% + $0.30)
Fallback calculates: $3.20 (2.9% + $0.30)
Difference: $1.00 error per transaction

If this happens 1000 times = $1,000 revenue loss
```

---

#### Risk 3: Currency Conversion Without Fee Adjustment
**Severity**: MEDIUM-HIGH  
**Location**: `/app/backend/controllers/stripeController.js` lines 159-232

**Issue**:
```javascript
// Platform fee is converted to charge currency
const convertedPlatformFee = breakdown.platformFee * currencyConversionRate;
const applicationFeeAmount = Math.round(convertedPlatformFee * 100);
```

**Problem**:
- Platform fee is converted using exchange rate
- BUT: Stripe charges +1% for currency conversion
- This +1% fee is NOT added to `application_fee_amount`
- Platform loses the currency conversion fee

**Impact**:
```
Example: $100 USD ticket, charged in EUR
- Organizer prices in USD: $5 platform fee
- Converted to EUR at 0.92 rate: €4.60 platform fee
- Stripe's actual conversion: €4.60 + 1% = €4.65
- Missing: €0.05 per transaction

For 10,000 international transactions: €500 lost
```

**Missing Logic**:
```javascript
// Should be:
if (needsConversion) {
    const conversionFee = convertedPlatformFee * 0.01; // Stripe's 1%
    applicationFeeAmount = Math.round((convertedPlatformFee + conversionFee) * 100);
}
```

---

#### Risk 4: No Webhook Replay Attack Prevention
**Severity**: MEDIUM  
**Location**: `/app/backend/controllers/stripeWebhookController.js`

**Issue**:
- Idempotency check only for `payment_status === 'paid'`
- No check for duplicate webhook event IDs
- Stripe can resend webhooks if response is slow

**Problem**:
```javascript
// Current check
if (reg.payment_status === 'paid' || reg.payment_status === 'completed') {
    console.log(`[Webhook] Idempotent Event: Registration ${reg.id} already paid. Skipping.`);
    return;
}
```

**Missing**:
- No tracking of processed webhook event IDs
- Multiple `checkout.session.completed` events could arrive
- Each creates a `financial_transaction` record

**Impact**:
- Duplicate financial records
- Double-counted revenue
- Incorrect financial reports

**Recommendation**: Store processed event IDs in database

---

### 🟡 MEDIUM RISKS

#### Risk 5: No Balance Reconciliation Check
**Severity**: MEDIUM  
**Location**: Throughout financial transaction creation

**Issue**:
- Financial transactions are created but never reconciled
- No check: `gross_amount = platform_fee + stripe_fee + organizer_net`
- Rounding errors can accumulate

**Problem**:
```javascript
const organizerNet = Number((grossAmount - platformFee - stripeFee).toFixed(2));
```

**Missing Validation**:
```javascript
const calculatedTotal = platformFee + stripeFee + organizerNet;
if (Math.abs(calculatedTotal - grossAmount) > 0.01) {
    throw new Error(`Balance mismatch: ${calculatedTotal} != ${grossAmount}`);
}
```

**Impact**:
- Silent rounding errors
- Revenue leaks undetected
- Audit failures

---

#### Risk 6: Subscription Payment Not Tracked in Financials
**Severity**: MEDIUM  
**Location**: `/app/backend/controllers/subscriptionController.js`

**Issue**:
```javascript
// Subscription payments are processed
// But NO financial_transaction record is created
```

**Problem**:
- Platform subscription revenue not tracked in `financial_transactions`
- Cannot reconcile subscription revenue with Stripe
- Subscription revenue missing from financial reports

**Missing**:
After subscription payment succeeds, should create:
```javascript
await supabase.from('financial_transactions').insert({
    transaction_type: 'subscription',
    type: 'subscription',
    gross_amount: subscriptionAmount,
    platform_fee: subscriptionAmount, // Platform keeps 100%
    stripe_fee: stripeProcessingFee,
    organizer_net: 0,
    status: 'succeeded',
    user_id: userId
});
```

---

#### Risk 7: At-Door Payment Stripe Fee Calculation
**Severity**: MEDIUM  
**Location**: `/app/backend/controllers/stripeController.js` line 1391

**Issue**:
```javascript
const platformFee = paymentIntent.application_fee_amount 
    ? paymentIntent.application_fee_amount / 100 
    : 0;
```

**Problem**:
- Uses same fallback Stripe fee calculation
- At-door payments often use different cards
- No actual `balance_transaction` is retrieved

**Impact**:
- Inaccurate at-door payment records
- Organizer net could be wrong

---

### 🟢 LOW RISKS

#### Risk 8: No Minimum Payout Amount
**Severity**: LOW  
**Location**: Payout scheduling logic

**Issue**:
- Platform can schedule payouts of any amount
- Stripe typically has minimum payout thresholds
- Could fail with very small amounts

**Recommendation**: Add minimum payout check (e.g., $1 minimum)

---

#### Risk 9: No Payout Frequency Limit
**Severity**: LOW  

**Issue**:
- No limit on payout scheduling frequency
- Could request multiple payouts in same day
- Stripe may rate-limit or reject

**Recommendation**: Add 24-hour cooldown between payouts

---

## ⚠️ CONFIGURATION MISTAKES

### Mistake 1: Missing Environment Variable Validation
**Location**: All controller files

**Issue**:
```javascript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
```

**Problem**:
- Empty string fallback allows code to run without key
- Silent failures in development
- Unclear error messages

**Should be**:
```javascript
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
}
if (!stripeKey.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY format is invalid');
}
const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
```

---

### Mistake 2: Webhook Secret Not Validated
**Location**: `/app/backend/controllers/stripeWebhookController.js` line 23

**Issue**:
```javascript
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is missing');
    return res.status(500).send('Webhook Error: Secret missing');
}
```

**Problem**:
- Returns 500 error (server error)
- Should return 400 (configuration error)
- Logs to console only (not audit trail)

---

### Mistake 3: No Currency Validation
**Location**: `/app/backend/controllers/stripeController.js` line 167

**Issue**:
```javascript
const supportedCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud'];
```

**Problem**:
- Hardcoded list
- No validation against Stripe's supported currencies
- User could select unsupported currency in database

**Missing**:
- Validate currency exists in Stripe before creating session
- Reject unsupported currencies early

---

### Mistake 4: Platform Fee Not Capped
**Location**: `/app/backend/utils/priceCalculator.js`

**Issue**:
```javascript
export const calculatePlatformFee = (subtotal, plan = 'free') => {
    if (subtotal <= 0) return 0;
    const planFees = PLAN_FEES[plan] || PLAN_FEES.free;
    return Number(((subtotal * planFees.percent) + planFees.fixed).toFixed(2));
};
```

**Problem**:
- No maximum cap on platform fee
- For very high ticket prices (e.g., $10,000), fee could be $450+
- Could exceed Stripe's application fee limits
- Organizersmay be surprised by high fees

**Recommendation**: Add cap (e.g., $50 max platform fee)

---

## 🔍 LOGIC INCONSISTENCIES

### Inconsistency 1: Stripe Fee Calculation Mismatch
**Locations**: Multiple files

**Issue**:
```javascript
// In webhook handler (line 162):
stripeFee = Number(((grossAmount * 0.029) + 0.30).toFixed(2));

// In at-door payment (line 1391-1395):
// Uses actual balance_transaction fee OR no fallback

// In subscription controller:
// No Stripe fee tracked at all
```

**Problem**: Three different approaches to calculating Stripe fees

---

### Inconsistency 2: Currency Handling
**Locations**: Multiple payment flows

**Issue**:
- Checkout sessions: Full currency conversion support
- At-door payments: No currency conversion
- Subscriptions: Always USD
- Refunds: Uses original transaction currency

**Problem**: Inconsistent currency handling across payment types

---

### Inconsistency 3: Transaction Type Naming
**Locations**: Database and code

**Issue**:
```javascript
// Sometimes uses:
transaction_type: 'ticket_sale'
type: 'event'

// Sometimes uses:
transaction_type: 'at_door_payment'
type: 'event'

// Sometimes uses:
transaction_type: 'smm_subscription'
type: undefined
```

**Problem**: 
- Inconsistent use of `transaction_type` vs `type`
- Some transactions have one field but not the other
- Makes querying difficult

---

### Inconsistency 4: Payout Status Tracking
**Locations**: Financial transactions

**Issue**:
```javascript
// Initial: payout_status: 'pending'
// After request: payout_status: 'requested'
// After payout: payout_status: ??? (never updated)
```

**Problem**:
- `payout.paid` webhook doesn't update transaction status
- Transactions stay in 'requested' forever
- Cannot determine what's been paid out

---

## 🛡️ MISSING SAFEGUARDS

### Safeguard 1: No Maximum Transaction Amount
**Risk**: HIGH

**Missing**:
```javascript
// Should validate before creating session
const MAX_TRANSACTION_AMOUNT = 50000; // $50,000
if (totalAmount > MAX_TRANSACTION_AMOUNT) {
    return res.status(400).json({ 
        error: 'Transaction exceeds maximum allowed amount' 
    });
}
```

**Why needed**: Prevent fraud, accidental charges, UI bugs

---

### Safeguard 2: No Rate Limiting on Checkout Creation
**Risk**: MEDIUM

**Missing**:
- No limit on checkout sessions per user
- User could create 1000 sessions in 1 minute
- Stripe API rate limits could be hit

**Recommendation**: Max 10 checkout sessions per user per hour

---

### Safeguard 3: No Refund Amount Validation
**Risk**: MEDIUM  
**Location**: Refund processing

**Missing**:
```javascript
// Should validate refund doesn't exceed original charge
if (refundAmount > transaction.gross_amount) {
    throw new Error('Refund amount exceeds original charge');
}

// Should validate total refunds don't exceed original
const totalRefunds = await getTotalRefunds(transactionId);
if (totalRefunds + refundAmount > transaction.gross_amount) {
    throw new Error('Total refunds would exceed original charge');
}
```

---

### Safeguard 4: No Duplicate Payment Prevention
**Risk**: HIGH

**Missing**:
- User clicks "Pay" button multiple times
- Multiple checkout sessions created for same cart
- User charged multiple times

**Recommendation**: Generate idempotency key per cart:
```javascript
const idempotencyKey = `checkout_${eventId}_${userId}_${Date.now()}`;
// Store in session metadata
// Check before creating new session
```

---

### Safeguard 5: No Financial Transaction Immutability
**Risk**: MEDIUM

**Missing**:
- Financial records can be updated/deleted
- No audit trail of changes
- No soft-delete pattern

**Recommendation**:
```javascript
// Add to financial_transactions table:
deleted_at TIMESTAMP
modified_at TIMESTAMP
modified_by TEXT
original_record_id TEXT (for corrections)
```

---

### Safeguard 6: No Negative Amount Protection
**Risk**: LOW-MEDIUM

**Missing**:
```javascript
// Should validate before ANY financial operation
if (amount < 0 && transactionType !== 'refund') {
    throw new Error('Negative amounts only allowed for refunds');
}
```

---

## 📋 STEP-BY-STEP VERIFICATION CHECKLIST

### Phase 1: Environment Setup Verification

#### ✅ 1.1 Verify Stripe Keys Configuration

**Test Mode**:
```bash
# 1. Check .env file
cat /app/backend/.env | grep STRIPE

# Expected:
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# 2. Verify key format
# Test key should start with: sk_test_
# Live key should start with: sk_live_

# 3. Test key validity
curl https://api.stripe.com/v1/balance \
  -u sk_test_YOUR_KEY:
  
# Expected: Should return balance object
# If error: Key is invalid
```

**Action Items**:
- [ ] Confirm `STRIPE_SECRET_KEY` exists
- [ ] Confirm key starts with `sk_test_` (test) or `sk_live_` (production)
- [ ] Test key with balance API call
- [ ] Confirm `STRIPE_WEBHOOK_SECRET` exists
- [ ] Confirm webhook secret starts with `whsec_`

**Risk if Failed**: Cannot process payments, webhook validation will fail

---

#### ✅ 1.2 Verify Test vs Live Mode Separation

**In Stripe Dashboard**:
```
1. Go to: https://dashboard.stripe.com/test/dashboard
2. Toggle: "View test data" (top right)
3. Verify: Current mode matches your environment
```

**Test in Application**:
```javascript
// Check which mode is active
console.log('Stripe Key Prefix:', process.env.STRIPE_SECRET_KEY?.substring(0, 7));
// Should be: sk_test_ (test mode) or sk_live_ (production)
```

**Create Test Payment**:
```bash
# Use test card: 4242 4242 4242 4242
# Should appear in TEST dashboard only
# Should NOT appear in LIVE dashboard
```

**Action Items**:
- [ ] Confirm application is using correct Stripe mode
- [ ] Create test payment
- [ ] Verify payment appears in correct dashboard
- [ ] Verify payment does NOT appear in other dashboard
- [ ] Check webhook endpoints are configured per mode

**Risk if Failed**: Production payments go to test mode, or vice versa

---

### Phase 2: Balance Verification

#### ✅ 2.1 Check Platform Balance

**Stripe Dashboard Steps**:
```
1. Go to: Balance section
2. Navigate to: "Available balance"
3. Check:
   - Available balance (ready to payout)
   - Pending balance (not yet available)
   - Connect reserved balance (held for Connect accounts)
   
4. Compare with database:
   SELECT 
     SUM(platform_fee) as total_platform_fees,
     SUM(CASE WHEN payout_status='pending' THEN platform_fee ELSE 0 END) as pending_fees
   FROM financial_transactions
   WHERE status='succeeded' AND type='event';
```

**Expected Results**:
```
Stripe Pending Balance = Database Pending Fees (within $1-2)
Small difference is normal due to timing/processing delays
```

**Action Items**:
- [ ] Record Stripe available balance: $_______
- [ ] Record Stripe pending balance: $_______
- [ ] Calculate database total platform fees: $_______
- [ ] Calculate database pending fees: $_______
- [ ] Verify difference is < $5 or explainable
- [ ] Document any discrepancies

**Risk if Failed**: Revenue leakage or double-counting

---

#### ✅ 2.2 Check Organizer Balances (Connect Accounts)

**For Each Organizer**:
```
1. Go to: Stripe Dashboard → Connect → Accounts
2. Select: Test organizer account
3. Check:
   - Available balance
   - Pending balance
   - Payout schedule
   
4. Compare with database:
   SELECT 
     SUM(organizer_net) as total_net,
     SUM(CASE WHEN payout_status='pending' THEN organizer_net ELSE 0 END) as pending_net
   FROM financial_transactions
   WHERE organizer_id='[ORGANIZER_ID]' AND status='succeeded';
```

**Action Items**:
- [ ] Pick 3 test organizers
- [ ] For each, record Stripe balance
- [ ] For each, calculate database balance
- [ ] Verify balances match (within $1-2)
- [ ] Check payout schedule is configured

**Risk if Failed**: Organizers not receiving correct amounts

---

### Phase 3: Purchase Flow Simulation

#### ✅ 3.1 Simulate Event Ticket Purchase

**Test Scenario**: $100 ticket purchase (Free plan organizer)

**Steps**:
```
1. Create test event:
   - Price: $100
   - Organizer: On Free plan (4.5% + $0.99 fee)
   
2. Go to event page as customer
3. Click "Buy Tickets"
4. Fill form with test details:
   - Name: Test Customer
   - Email: test@example.com
   - Card: 4242 4242 4242 4242
   - Expiry: Any future date
   - CVC: Any 3 digits
   
5. Complete purchase
```

**Verification Points**:

✅ **A. Checkout Session Created**
```bash
# Check backend logs:
tail -f /var/log/supervisor/backend*.log | grep "Stripe"

# Expected:
# [Stripe] Creating session with Connect destination: acct_xxx, app_fee: USD 5.49
```

✅ **B. Webhook Received**
```bash
# Check webhook logs:
# Expected events:
# 1. checkout.session.completed
# 2. payment_intent.succeeded (maybe)
```

✅ **C. Database Records Created**
```sql
-- Check registration
SELECT * FROM registrations 
WHERE stripe_checkout_session_id='cs_test_...' 
ORDER BY created_at DESC LIMIT 1;

-- Expected:
-- payment_status: 'paid'
-- tickets: [...] (with unique ticket IDs)

-- Check financial transaction
SELECT * FROM financial_transactions 
WHERE stripe_payment_intent_id='pi_...' 
ORDER BY created_at DESC LIMIT 1;

-- Expected:
-- gross_amount: 100.00
-- platform_fee: 5.49
-- stripe_fee: ~3.20
-- organizer_net: ~91.31
-- type: 'event'
-- status: 'succeeded'
```

✅ **D. Stripe Dashboard Verification**
```
1. Go to: Payments section
2. Find: Recent payment for $100
3. Verify:
   - Status: Succeeded
   - Application fee: $5.49
   - Destination: Organizer's Connect account
   - Net to destination: $91.31
```

✅ **E. Email Sent**
```
- Check test email inbox
- Expected: Ticket confirmation email
```

**Calculate Expected Amounts**:
```javascript
Gross Amount: $100.00
Platform Fee: ($100 * 0.045) + $0.99 = $5.49
Stripe Fee: ($100 * 0.029) + $0.30 = $3.20 (estimated)
Organizer Net: $100 - $5.49 - $3.20 = $91.31
```

**Action Items**:
- [ ] Create test event
- [ ] Complete purchase with test card
- [ ] Verify checkout session created
- [ ] Verify webhook received
- [ ] Verify registration record created
- [ ] Verify financial transaction matches expected amounts
- [ ] Verify amounts in Stripe Dashboard
- [ ] Verify email sent
- [ ] **CRITICAL**: Verify `gross_amount = platform_fee + stripe_fee + organizer_net`

**Red Flags**:
- ❌ Webhook not received within 30 seconds
- ❌ Financial amounts don't add up
- ❌ Platform fee not captured in Stripe
- ❌ Organizer balance not updated

---

#### ✅ 3.2 Simulate International Purchase (Currency Conversion)

**Test Scenario**: €50 ticket (USD organizer)

**Steps**:
```
1. Create test event (prices in USD)
2. As customer, select EUR as payment currency
3. Complete purchase
```

**Verification**:
```sql
SELECT 
  gross_amount,
  platform_fee,
  stripe_fee,
  organizer_net,
  currency
FROM financial_transactions
WHERE id='...' ;

-- Expected:
-- All amounts in EUR (charge currency)
-- Platform fee should be converted from USD fee
```

**Calculate**:
```javascript
Original (USD): $50 ticket, $2.94 platform fee
Conversion rate: 0.92 (USD to EUR)
Expected (EUR): €46 ticket, €2.70 platform fee

Verify in Stripe:
- Charge currency: EUR
- Application fee: €2.70 (approximately)
```

**Action Items**:
- [ ] Create test with currency conversion
- [ ] Verify amounts are in charge currency
- [ ] Verify conversion rate applied correctly
- [ ] Check for 1% currency conversion fee
- [ ] **CRITICAL**: Verify platform doesn't lose currency conversion fee

**Red Flags**:
- ❌ Amounts in wrong currency
- ❌ Missing 1% conversion fee compensation
- ❌ Conversion rate way off market rate

---

### Phase 4: Subscription Payment Simulation

#### ✅ 4.1 Simulate Pro Subscription Purchase

**Test Scenario**: User upgrades to Pro plan ($29/month)

**Steps**:
```
1. Log in as test user
2. Go to: Settings → Subscription
3. Click: "Upgrade to Pro"
4. Complete payment with test card
```

**Verification**:

✅ **A. Subscription Created in Stripe**
```
1. Stripe Dashboard → Billing → Subscriptions
2. Find: Recent subscription
3. Verify:
   - Status: Active
   - Plan: Pro ($29/month)
   - Customer: Test user
```

✅ **B. Database Updated**
```sql
SELECT subscription 
FROM profiles 
WHERE id='test_user_id';

-- Expected:
-- {
--   "plan": "pro",
--   "status": "active",
--   "stripe_subscription_id": "sub_...",
--   "current_period_end": "..."
-- }
```

✅ **C. Financial Transaction Created** ⚠️ **VERIFY THIS EXISTS**
```sql
SELECT * FROM financial_transactions
WHERE transaction_type='subscription'
ORDER BY created_at DESC LIMIT 1;

-- Expected: (if implemented)
-- gross_amount: 29.00
-- platform_fee: 29.00 (platform keeps 100%)
-- stripe_fee: 1.14
-- organizer_net: 0
-- type: 'subscription'
```

**Action Items**:
- [ ] Simulate subscription purchase
- [ ] Verify subscription in Stripe
- [ ] Verify profile updated
- [ ] **CRITICAL**: Check if financial_transaction was created
- [ ] If NOT created, document as missing feature
- [ ] Verify subscription status syncs correctly

**Red Flags**:
- ❌ Subscription created but not tracked in database
- ❌ No financial_transaction for subscription revenue
- ❌ Cannot reconcile subscription revenue

---

#### ✅ 4.2 Verify Recurring Payment

**Test Scenario**: Wait for next billing cycle (or trigger manually)

**Manual Trigger**:
```
1. Stripe Dashboard → Billing → Subscriptions
2. Find test subscription
3. Click: "..." → "Create invoice"
4. Verify payment processes
```

**Verification**:
```sql
-- Check for second financial transaction
SELECT * FROM financial_transactions
WHERE transaction_type='subscription'
AND user_id='test_user_id'
ORDER BY created_at DESC;

-- Expected: 2+ records if recurring
```

**Action Items**:
- [ ] Trigger manual invoice
- [ ] Verify payment succeeds
- [ ] Check for duplicate financial records
- [ ] Verify subscription remains active

---

### Phase 5: Fee Capture Verification

#### ✅ 5.1 Confirm Platform Fee Captured

**Test Multiple Plans**:

**Free Plan Test**:
```
Ticket: $100
Expected Platform Fee: ($100 * 0.045) + $0.99 = $5.49
```

**Pro Plan Test**:
```
Ticket: $100
Expected Platform Fee: ($100 * 0.029) + $0.69 = $3.59
```

**Premium Plan Test**:
```
Ticket: $100
Expected Platform Fee: ($100 * 0.019) + $0.49 = $2.39
```

**Verification in Stripe**:
```
1. For each test transaction
2. Click transaction in Stripe Dashboard
3. Navigate to: "Application fee"
4. Verify amount matches expected fee
```

**Database Check**:
```sql
SELECT 
  organizer_plan,
  gross_amount,
  platform_fee,
  (platform_fee / gross_amount) * 100 as fee_percentage
FROM financial_transactions
JOIN profiles ON profiles.id = financial_transactions.organizer_id
WHERE status='succeeded'
GROUP BY organizer_plan;

-- Verify percentages match plan structure
```

**Action Items**:
- [ ] Test each plan tier
- [ ] Verify fee calculation matches plan
- [ ] Check fees in Stripe Dashboard
- [ ] Verify database records
- [ ] Calculate actual fee percentage
- [ ] Ensure no transactions with $0 platform fee (unless free event)

**Red Flags**:
- ❌ Platform fee = $0 for paid events
- ❌ Fee percentage doesn't match plan
- ❌ Missing platform fee in Stripe

---

#### ✅ 5.2 Verify Stripe Fee Accuracy

**High-Risk Test**: Create payment with international card

**Steps**:
```
1. Use test card: 4000 0027 6000 3184 (international)
2. Complete $100 purchase
3. Check actual Stripe fee
```

**Verification**:
```sql
SELECT 
  gross_amount,
  stripe_fee,
  stripe_payment_intent_id
FROM financial_transactions
WHERE id='latest_test';

-- Compare with Stripe Dashboard
```

**In Stripe Dashboard**:
```
1. Find payment
2. Navigate to: "Balance transaction"
3. Check: "Fee" amount
4. Compare with database stripe_fee
```

**Expected**:
- Domestic card: 2.9% + $0.30
- International card: 3.9% + $0.30
- Currency conversion: Additional 1%

**Action Items**:
- [ ] Test with domestic card
- [ ] Test with international card  
- [ ] Compare database vs actual Stripe fee
- [ ] Document any discrepancies > $0.10
- [ ] Check fallback calculation accuracy

**Red Flags**:
- ❌ Database fee differs from Stripe by > $0.50
- ❌ Fallback calculation used when actual fee available
- ❌ International card fees not higher

---

### Phase 6: Balance Update Verification

#### ✅ 6.1 Verify Organizer Balance Update

**Before Purchase**:
```sql
-- Record current balance
SELECT 
  SUM(organizer_net) as current_balance
FROM financial_transactions
WHERE organizer_id='test_org_id' AND status='succeeded';

-- Result: $_______
```

**After Purchase**:
```sql
-- Check updated balance
SELECT 
  SUM(organizer_net) as new_balance
FROM financial_transactions
WHERE organizer_id='test_org_id' AND status='succeeded';

-- Result: $_______ (should increase)
```

**In Stripe Connect Dashboard**:
```
1. View organizer's Connect account
2. Check: Pending balance
3. Should match: new_balance - payouts_executed
```

**Action Items**:
- [ ] Record balance before test
- [ ] Complete test purchase
- [ ] Verify balance increased by exact organizer_net amount
- [ ] Check Stripe Connect balance
- [ ] Verify balances reconcile

**Red Flags**:
- ❌ Database balance doesn't increase
- ❌ Stripe balance different from database
- ❌ Balance increases but by wrong amount

---

#### ✅ 6.2 Track Payout Status

**Organizer Payout Status Flow**:
```
1. Transaction created: payout_status = 'pending'
2. Payout requested: payout_status = 'requested'
3. Payout scheduled: payout_status = 'scheduled' (maybe)
4. Payout paid: payout_status = 'paid' (MISSING?)
```

**Check Current Implementation**:
```sql
SELECT 
  payout_status,
  COUNT(*) as count
FROM financial_transactions
WHERE organizer_id='test_org_id'
GROUP BY payout_status;

-- Check what statuses exist
```

**Verify Update Logic**:
```sql
-- After payout executes, status should update
-- Check if this is implemented:

SELECT * FROM financial_transactions
WHERE stripe_payment_intent_id IN (
  SELECT stripe_payment_intent_id FROM organizer_payouts
  WHERE status='completed'
);

-- Verify payout_status was updated
```

**Action Items**:
- [ ] Check possible payout_status values
- [ ] Trace payout_status through lifecycle
- [ ] Verify status updates after payout
- [ ] **CRITICAL**: Check if payout.paid webhook updates status
- [ ] Document any missing status transitions

**Red Flags**:
- ❌ Transactions stuck in 'requested' forever
- ❌ No status update after payout
- ❌ Cannot determine what's been paid

---

### Phase 7: Payout Execution Flow

#### ✅ 7.1 Test Organizer Payout Request

**Prerequisite**: Organizer has completed event with pending balance

**Steps**:
```
1. Log in as organizer
2. Go to: Dashboard → Financials
3. Check: "Available for payout" amount
4. Click: "Request Payout"
5. Confirm request
```

**Backend Verification**:
```sql
-- Check payout request created
SELECT * FROM organizer_payouts
WHERE organizer_id='test_org_id'
AND status='pending'
ORDER BY created_at DESC LIMIT 1;

-- Expected fields:
-- amount: (matches available balance)
-- status: 'pending'
-- requested_at: (timestamp)
```

**Financial Transactions Updated**:
```sql
-- Check transactions marked as requested
SELECT COUNT(*) FROM financial_transactions
WHERE organizer_id='test_org_id'
AND payout_status='requested';

-- Should be > 0
```

**Action Items**:
- [ ] Log in as organizer
- [ ] Verify available balance shown
- [ ] Request payout
- [ ] Verify organizer_payouts record created
- [ ] Verify financial_transactions updated
- [ ] Check email notification sent (if any)

**Red Flags**:
- ❌ Payout request fails
- ❌ Amount doesn't match available balance
- ❌ Transactions not marked as 'requested'

---

#### ✅ 7.2 Test Admin Payout Approval

**As Super Admin**:
```
1. Log in to Super Admin dashboard
2. Navigate to: Payouts section
3. Find: Pending payout request
4. Review details
5. Click: "Approve" or "Execute Payout"
```

**Expected Flow**:
```
1. Admin initiates payout in Stripe Dashboard manually
   OR
2. System creates Stripe Transfer/Payout automatically

3. Webhook payout.paid received
4. organizer_payouts status updated to 'completed'
5. financial_transactions status updated (if implemented)
```

**Verification**:
```sql
-- Check payout status
SELECT * FROM organizer_payouts
WHERE id='payout_id';

-- Expected:
-- status: 'completed'
-- executed_at: (timestamp)
-- executed_by: (admin user id)
```

**In Stripe Dashboard**:
```
1. Go to: Connect → Payouts
2. Find: Recent payout to organizer
3. Verify:
   - Status: Paid
   - Amount: Matches database
   - Destination: Organizer's bank account
```

**Action Items**:
- [ ] Approve payout as admin
- [ ] Verify payout executes in Stripe
- [ ] Check organizer_payouts status updated
- [ ] Verify webhook received
- [ ] Check financial_transactions updated (if applicable)
- [ ] Confirm organizer notified

**Red Flags**:
- ❌ Payout doesn't execute
- ❌ Wrong amount sent
- ❌ Status doesn't update to 'completed'
- ❌ Webhook not received

---

#### ✅ 7.3 Verify Platform Payout

**Platform Fee Payout**:
```
1. Accumulate platform fees over time
2. In Super Admin, check platform pending payouts
3. Schedule platform payout
4. Execute payout to platform bank account
```

**API Test**:
```bash
curl -X GET "https://www.openticket.events/api/admin/platform-payouts/pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected response:
{
  "platformFees": {
    "amount": 1234.56,
    "totalCollected": 2500.00,
    "scheduledAmount": 1000.00,
    "transactionCount": 125
  },
  "subscriptions": {
    "amount": 580.00,
    ...
  },
  "total": 1814.56
}
```

**Schedule Payout**:
```bash
curl -X POST "https://www.openticket.events/api/admin/platform-payouts/schedule" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payoutType": "platform_fees",
    "amount": 1234.56,
    "notes": "Monthly platform fee payout"
  }'
```

**Execute in Stripe**:
```
1. Stripe Dashboard → Payouts
2. Create manual payout to platform bank account
3. Amount: Matches scheduled amount
4. Confirm execution
```

**Mark as Completed**:
```bash
curl -X POST "https://www.openticket.events/api/admin/platform-payouts/{id}/execute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stripePayoutId": "po_xxx",
    "destinationAccount": "Platform Bank"
  }'
```

**Action Items**:
- [ ] Check platform pending balance
- [ ] Verify amount matches financial_transactions sum
- [ ] Schedule platform payout
- [ ] Execute payout in Stripe Dashboard
- [ ] Mark payout as completed in system
- [ ] Verify next pending balance is correct
- [ ] Check audit trail logged

**Red Flags**:
- ❌ Pending balance doesn't match Stripe
- ❌ Cannot schedule payout
- ❌ Payout doesn't deduct from pending
- ❌ Next pending balance is wrong

---

### Phase 8: Edge Case Testing

#### ✅ 8.1 Test Refund Flow

**Full Refund Test**:
```
1. Complete a purchase ($100)
2. In Stripe Dashboard, issue full refund
3. Wait for webhook
```

**Verification**:
```sql
-- Check refund transaction created
SELECT * FROM financial_transactions
WHERE stripe_payment_intent_id='pi_xxx'
AND transaction_type='refund';

-- Expected:
-- gross_amount: -100.00 (negative)
-- platform_fee: -5.49 (negative)
-- stripe_fee: -3.20 (negative)
-- organizer_net: -91.31 (negative)
```

**Verify Proportions**:
```javascript
// Refund should maintain same proportions
original_platform_fee / original_gross = refund_platform_fee / refund_gross
```

**Action Items**:
- [ ] Issue full refund
- [ ] Verify negative transaction created
- [ ] Check proportions maintained
- [ ] Verify original transaction status updated
- [ ] Confirm refund email sent

---

#### ✅ 8.2 Test Partial Refund

**Partial Refund Test**:
```
1. Complete a $100 purchase
2. Refund $50 (50%)
```

**Expected**:
```sql
-- Refund transaction:
-- gross_amount: -50.00
-- platform_fee: -2.745 (50% of original)
-- stripe_fee: -1.60 (50% of original)
-- organizer_net: -45.655 (50% of original)
```

**Action Items**:
- [ ] Issue partial refund
- [ ] Verify partial amounts correct
- [ ] Original transaction NOT marked as refunded
- [ ] Can issue second partial refund

---

#### ✅ 8.3 Test Failed Payment

**Steps**:
```
1. Try to purchase with declined card: 4000 0000 0000 0002
2. Verify failure handling
```

**Expected**:
- No registration created
- No financial_transaction created
- User notified of failure
- Can retry

**Action Items**:
- [ ] Test declined card
- [ ] Verify no database records
- [ ] Verify error message shown
- [ ] Can retry payment

---

#### ✅ 8.4 Test Webhook Replay

**Manual Webhook Replay**:
```
1. In Stripe Dashboard → Webhooks
2. Find successful checkout event
3. Click "Resend"
4. Verify idempotency
```

**Expected**:
```bash
# In logs:
[Webhook] Idempotent Event: Registration ${reg.id} already paid. Skipping.
```

**Action Items**:
- [ ] Replay webhook event
- [ ] Verify NOT processed again
- [ ] Verify no duplicate records
- [ ] Verify logs show idempotency message

---

## 📊 FINAL AUDIT SUMMARY

### Critical Issues Found: 4
1. 🔴 No Test/Live Mode Separation Enforcement
2. 🔴 Stripe Fee Fallback Inaccurate
3. 🔴 Currency Conversion Fee Not Captured
4. 🔴 No Webhook Replay Prevention

### Medium Issues Found: 3
1. 🟡 No Balance Reconciliation Check
2. 🟡 Subscription Payments Not Tracked
3. 🟡 At-Door Payment Fee Calculation

### Configuration Mistakes: 4
1. Missing Environment Variable Validation
2. Webhook Secret Not Properly Validated
3. No Currency Validation
4. Platform Fee Not Capped

### Logic Inconsistencies: 4
1. Stripe Fee Calculation Mismatch
2. Currency Handling Inconsistent
3. Transaction Type Naming Inconsistent
4. Payout Status Not Updated

### Missing Safeguards: 6
1. No Maximum Transaction Amount
2. No Rate Limiting
3. No Refund Amount Validation
4. No Duplicate Payment Prevention
5. No Financial Record Immutability
6. No Negative Amount Protection

---

## 🎯 PRIORITY ACTION ITEMS

### Must Fix Before Production:
1. ⚠️ Add test/live mode validation
2. ⚠️ Fix Stripe fee fallback calculation
3. ⚠️ Add currency conversion fee compensation
4. ⚠️ Implement webhook event ID tracking
5. ⚠️ Add balance reconciliation checks

### Should Fix Soon:
6. Add subscription payment tracking
7. Add maximum transaction limits
8. Implement refund validation
9. Add financial record audit trail
10. Update payout status after webhook

### Nice to Have:
11. Add rate limiting
12. Cap platform fees
13. Standardize transaction types
14. Add negative amount protection

---

**Audit Completed**: February 20, 2026  
**Total Checks**: 40+ verification points  
**Estimated Fix Time**: 8-12 hours for critical issues  
**Recommended**: Address critical issues before production launch
