# Complete Production Readiness Testing Guide

## 🎯 Purpose

This document provides **step-by-step testing procedures** to verify all 14 priority fixes are working correctly and the platform is 100% production ready.

**Testing Duration**: 4-6 hours  
**Required Access**: Super Admin account, Stripe Dashboard, Database access  
**Test Environment**: Use test mode first, then verify in production

---

## 📋 Pre-Testing Checklist

### Required Credentials

- [ ] Super Admin account: `tylerans@gmail.com` / `Jevan2908`
- [ ] Stripe Dashboard access (test mode)
- [ ] Stripe Dashboard access (live mode - for final checks)
- [ ] Database access (Supabase)
- [ ] Backend logs access

### Required Tools

- [ ] Browser (Chrome/Firefox with DevTools)
- [ ] Stripe CLI (optional but recommended)
- [ ] cURL or Postman
- [ ] SQL client (for database verification)

### Environment Setup

```bash
# 1. Check backend is running
sudo supervisorctl status backend
# Expected: RUNNING

# 2. Check Stripe mode
grep STRIPE_SECRET_KEY /app/backend/.env | head -c 20
# Expected: sk_test_... (test mode) or sk_live_... (live mode)

# 3. Test API is responding
curl https://www.openticket.events/api/csrf-token
# Expected: {"csrfToken":"..."}
```

---

## 🧪 PHASE 1: CRITICAL FIXES TESTING (Priority 1)

### Test 1: Stripe Mode Validation

**What We're Testing**: Fix 1 - Test/Live mode separation and validation

**Steps**:

1. **Check Startup Logs**
```bash
# View backend startup logs
tail -n 100 /var/log/supervisor/backend.out.log | grep Stripe

# Expected Output:
# [Stripe] Initialized in TEST mode
# or
# [Stripe] Initialized in LIVE mode

# Should NOT see:
# ⚠️  [Stripe] WARNING: Using TEST mode keys in production environment!
```

2. **Test Invalid Key Rejection**
```bash
# Temporarily set invalid key
export STRIPE_SECRET_KEY="invalid_key"
sudo supervisorctl restart backend

# Check logs
tail -n 50 /var/log/supervisor/backend.err.log

# Expected Error:
# "Stripe Configuration Error: STRIPE_SECRET_KEY format is invalid"

# Restore valid key and restart
sudo supervisorctl restart backend
```

3. **Verify Mode in Application**
```bash
# Make API call
curl https://www.openticket.events/api/stripe/create-order \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test"}'

# Should work (or return validation error, but not Stripe init error)
```

**✅ Pass Criteria**:
- [ ] Logs show correct Stripe mode on startup
- [ ] Invalid keys are rejected with clear error
- [ ] Warnings appear if mode mismatches environment
- [ ] API calls work with valid keys

**❌ Fail Indicators**:
- Backend crashes on startup
- No Stripe mode logged
- Invalid keys silently accepted

---

### Test 2: Stripe Fee Fallback Accuracy

**What We're Testing**: Fix 2 - Improved Stripe fee estimation (3.9% vs 2.9%)

**Steps**:

1. **Create Test Purchase**
```bash
# Go to: https://www.openticket.events
# Create a test event with $100 ticket
# Complete purchase with test card: 4242 4242 4242 4242
```

2. **Check Webhook Logs**
```bash
# View recent webhook processing
tail -n 200 /var/log/supervisor/backend.out.log | grep -A 5 "Retrieved Actual Fee"

# Expected (if balance_transaction available):
# [Stripe] Retrieved Actual Fee: $3.20

# Or (if fallback used):
# [Webhook] Unable to retrieve actual Stripe fee for pi_xxx
# [Webhook] Using estimated fee (international rate): $3.90
```

3. **Verify Database**
```sql
-- Check most recent transaction
SELECT 
  gross_amount,
  platform_fee,
  stripe_fee,
  organizer_net,
  created_at
FROM financial_transactions
ORDER BY created_at DESC
LIMIT 1;

-- Verify stripe_fee is realistic:
-- Domestic card: ~2.9% + $0.30 = $3.20 for $100
-- International card estimate: ~3.9% + $0.30 = $4.20 for $100
-- Should NOT be exactly $3.20 every time if using estimate
```

4. **Test International Card (if available)**
```bash
# Use test international card: 4000 0027 6000 3184
# Complete $100 purchase
# Check if fee is higher than domestic card
```

**✅ Pass Criteria**:
- [ ] Actual Stripe fee retrieved when possible
- [ ] Fallback uses 3.9% (not 2.9%)
- [ ] Logs show when estimate is used
- [ ] Fees are realistic (not underestimated)

**❌ Fail Indicators**:
- All transactions show exactly $3.20 fee (using old 2.9% always)
- No warnings when estimate used
- Fees seem too low

---

### Test 3: Currency Conversion Fee

**What We're Testing**: Fix 3 - Stripe's 1% conversion fee is captured

**Steps**:

1. **Create Multi-Currency Event**
```bash
# Create event priced in USD
# Select EUR as payment currency during checkout
```

2. **Check Application Fee Calculation**
```bash
# In backend logs during checkout session creation:
tail -n 100 /var/log/supervisor/backend.out.log | grep "Currency conversion"

# Expected:
# [Stripe] Currency conversion: USD → EUR
# [Stripe] Currency conversion fee (1%): 0.27 EUR
```

3. **Verify in Stripe Dashboard**
```
1. Go to: Stripe Dashboard → Payments
2. Find the EUR payment
3. Check Application Fee
4. Calculate: Platform fee in USD × conversion rate × 1.01
5. Verify application fee includes the 1% extra
```

4. **Database Verification**
```sql
-- Check transaction in non-USD currency
SELECT 
  currency,
  gross_amount,
  platform_fee,
  metadata
FROM financial_transactions
WHERE currency != 'usd'
ORDER BY created_at DESC
LIMIT 5;

-- Platform fee should be slightly higher than straight conversion
```

**✅ Pass Criteria**:
- [ ] Logs show "Currency conversion fee (1%)" message
- [ ] Application fee in Stripe is higher than base fee
- [ ] Database records show appropriate fees
- [ ] Calculation includes 1% on top of conversion

**❌ Fail Indicators**:
- No conversion fee logged
- Application fee = base fee × conversion rate (missing 1%)
- Revenue lower than expected

---

### Test 4: Webhook Replay Prevention

**What We're Testing**: Fix 4 - Duplicate webhook events are ignored

**Steps**:

1. **Create Test Transaction**
```bash
# Complete a test purchase
# Note the session ID
```

2. **Replay Webhook Event**
```
Method A: Using Stripe Dashboard
1. Go to: Stripe Dashboard → Developers → Webhooks
2. Find your webhook endpoint
3. Click on a recent successful event (checkout.session.completed)
4. Click "Resend event"
5. Wait 5 seconds
6. Click "Resend event" again
```

3. **Check Logs**
```bash
# View webhook processing logs
tail -n 100 /var/log/supervisor/backend.out.log | grep -E "Duplicate event|Received event"

# Expected on first send:
# [Webhook] Received event: checkout.session.completed (evt_xxx)

# Expected on replay:
# [Webhook] Duplicate event detected: evt_xxx. Skipping.
# [Webhook] Cache cleanup: removed X old entries (if cache limit reached)
```

4. **Verify No Duplicates in Database**
```sql
-- Check for duplicate financial transactions
SELECT 
  stripe_payment_intent_id,
  COUNT(*) as count
FROM financial_transactions
WHERE stripe_payment_intent_id IS NOT NULL
GROUP BY stripe_payment_intent_id
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicates)
```

5. **Test Cache Cleanup**
```bash
# Trigger 1000+ webhook events to test cleanup
# Or check logs after prolonged usage

# Expected periodically:
# [Webhook] Cache cleanup: removed 5000 old entries
```

**✅ Pass Criteria**:
- [ ] First webhook event is processed
- [ ] Duplicate events are logged and skipped
- [ ] No duplicate financial records created
- [ ] Cache cleanup happens when limit reached

**❌ Fail Indicators**:
- Duplicate financial_transactions created
- No "Duplicate event detected" logs
- Memory grows indefinitely (no cleanup)

---

### Test 5: Balance Reconciliation

**What We're Testing**: Fix 5 - Financial amounts add up correctly

**Steps**:

1. **Create Test Transaction**
```bash
# Complete $100 purchase
# Note: gross_amount, platform_fee, stripe_fee, organizer_net
```

2. **Manual Calculation**
```javascript
// Example transaction:
gross_amount = 100.00
platform_fee = 5.49
stripe_fee = 3.20
organizer_net = 91.31

// Verify:
calculated_total = 5.49 + 3.20 + 91.31 = 100.00
difference = |100.00 - 100.00| = 0.00

// Pass if difference <= 0.02 (2 cent tolerance)
```

3. **Use Validator Function**
```javascript
// In Node.js or via API:
import { validateFinancialBalance } from './utils/financialValidator.js';

const transaction = {
  gross_amount: 100.00,
  platform_fee: 5.49,
  stripe_fee: 3.20,
  organizer_net: 91.31
};

const result = validateFinancialBalance(transaction);
console.log(result);
// Expected: { isValid: true, error: null, difference: 0.00 }
```

4. **Database-Wide Check**
```sql
-- Check all transactions for balance issues
SELECT 
  id,
  gross_amount,
  platform_fee,
  stripe_fee,
  organizer_net,
  ABS(gross_amount - (platform_fee + stripe_fee + organizer_net)) as difference
FROM financial_transactions
WHERE status = 'succeeded'
  AND ABS(gross_amount - (platform_fee + stripe_fee + organizer_net)) > 0.02
ORDER BY difference DESC;

-- Should return 0 rows (all balanced)
```

**✅ Pass Criteria**:
- [ ] All transactions balance within 2 cents
- [ ] Validator returns isValid: true
- [ ] No balance mismatches in database
- [ ] Rounding errors are minimal

**❌ Fail Indicators**:
- Differences > $0.02
- Many transactions don't add up
- Validator shows errors

---

## 🧪 PHASE 2: IMPORTANT FIXES TESTING (Priority 2)

### Test 6: Subscription Payment Tracking

**What We're Testing**: Fix 6 - Subscription payments recorded in financial_transactions

**Steps**:

1. **Subscribe to Pro Plan**
```
1. Log in as test user
2. Go to: Settings → Subscription
3. Click "Upgrade to Pro" ($29/month)
4. Complete payment with test card: 4242 4242 4242 4242
```

2. **Check Webhook Processing**
```bash
# View webhook logs
tail -n 100 /var/log/supervisor/backend.out.log | grep -A 10 "invoice.paid"

# Expected:
# [Webhook] Processing invoice.paid: in_xxx
# [Webhook] Recorded subscription payment: $29.00 for user email@example.com
```

3. **Verify Database Record**
```sql
-- Check for subscription transaction
SELECT 
  transaction_type,
  type,
  gross_amount,
  platform_fee,
  stripe_fee,
  organizer_net,
  created_at
FROM financial_transactions
WHERE transaction_type IN ('subscription', 'smm_subscription')
ORDER BY created_at DESC
LIMIT 5;

-- Expected fields:
-- transaction_type: 'subscription'
-- type: 'subscription'
-- gross_amount: 29.00 (or plan price)
-- platform_fee: 29.00 (platform keeps 100%)
-- organizer_net: 0
-- stripe_fee: ~1.14
```

4. **Test Recurring Payment**
```
Method A: Trigger manually in Stripe
1. Stripe Dashboard → Billing → Subscriptions
2. Find test subscription
3. Click "..." → "Create invoice"
4. Verify second financial_transaction created

Method B: Wait for next billing cycle (if time permits)
```

5. **Test Failed Payment**
```
1. Stripe Dashboard → use test card that declines
2. Card: 4000 0000 0000 0341 (Attaching this card results in charge_fails)
3. Verify audit log entry created
4. Check no financial_transaction created for failed payment
```

**✅ Pass Criteria**:
- [ ] Subscription payment creates financial_transaction
- [ ] transaction_type = 'subscription', type = 'subscription'
- [ ] platform_fee = gross_amount (platform keeps 100%)
- [ ] organizer_net = 0
- [ ] Recurring payments tracked
- [ ] Failed payments logged but not recorded

**❌ Fail Indicators**:
- No financial_transaction for subscription
- Wrong amounts
- Duplicates created

---

### Test 7: Maximum Transaction Limit

**What We're Testing**: Fix 7 - Transactions above $50,000 are rejected

**Steps**:

1. **Test Maximum Limit**
```bash
# Create event with ticket price $51,000
# Try to purchase

# Expected error in UI:
"Transaction amount ($51,000.00) exceeds maximum allowed ($50,000.00)"
```

2. **Test API Response**
```bash
# Make direct API call
curl -X POST "https://www.openticket.events/api/stripe/create-order" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "eventId": "test-event-id",
    "ticketSelections": { "tier1": 510 },
    "currency": "usd"
  }'

# Expected response (if total > $50,000):
{
  "error": "Transaction amount ($51,000.00) exceeds maximum allowed ($50,000.00)",
  "code": "AMOUNT_TOO_HIGH",
  "maxAmount": 50000
}
```

3. **Test Minimum Limit**
```bash
# Try to purchase $0.25 ticket

# Expected error:
"Transaction amount ($0.25) is below minimum allowed ($0.50)"
```

4. **Test Edge Cases**
```bash
# Test exactly $50,000 - should succeed
# Test exactly $0.50 - should succeed
# Test $49,999.99 - should succeed
# Test $50,000.01 - should fail
```

**✅ Pass Criteria**:
- [ ] Transactions > $50,000 are rejected
- [ ] Transactions < $0.50 are rejected (except $0)
- [ ] Error messages are clear
- [ ] Edge cases work correctly

**❌ Fail Indicators**:
- $51,000 transaction succeeds
- No error message
- Inconsistent behavior at limits

---

### Test 8: Refund Amount Validation

**What We're Testing**: Fix 8 - Refunds can't exceed original transaction

**Steps**:

1. **Create Test Transaction**
```bash
# Purchase $100 ticket
# Note payment_intent ID
```

2. **Test Valid Full Refund**
```
1. Stripe Dashboard → Payments
2. Find $100 payment
3. Click "Refund" → Full refund ($100)
4. Confirm refund
```

3. **Check Webhook Processing**
```bash
# View refund webhook logs
tail -n 100 /var/log/supervisor/backend.out.log | grep -A 5 "Refund validation"

# Expected:
# [Webhook] Refund validation passed: $100.00 of $100.00 (total refunded so far: $0.00)
```

4. **Test Invalid Over-Refund** (Manual Database Test)
```sql
-- This test simulates what would happen if someone tried to refund too much

-- Check existing transaction
SELECT id, gross_amount, stripe_payment_intent_id
FROM financial_transactions
WHERE id = 'transaction_id';

-- Try to manually insert over-refund (for testing)
-- This should be prevented by webhook validation

-- The webhook should skip processing if:
-- refundAmount > originalAmount
-- OR totalRefunds + newRefund > originalAmount
```

5. **Test Partial Refunds**
```
1. Create new $100 purchase
2. Refund $50 (partial)
3. Verify financial_transaction created with -$50
4. Try to refund $60 more
5. Expected: Webhook should skip (total would be $110)
6. Try to refund $50 more
7. Expected: Should succeed (total = $100)
```

6. **Verify Database**
```sql
-- Check refund records
SELECT 
  stripe_payment_intent_id,
  transaction_type,
  gross_amount,
  platform_fee,
  stripe_fee,
  organizer_net
FROM financial_transactions
WHERE transaction_type = 'refund'
ORDER BY created_at DESC
LIMIT 5;

-- Verify:
-- All amounts are negative
-- Proportions match original transaction
-- Total refunds per payment_intent don't exceed original
```

**✅ Pass Criteria**:
- [ ] Full refunds work correctly
- [ ] Partial refunds work correctly
- [ ] Over-refunds are blocked (logged and skipped)
- [ ] Multiple partials don't exceed original
- [ ] Validation logs show checks

**❌ Fail Indicators**:
- Can refund more than original
- No validation logs
- Negative balance possible

---

### Test 9: Payout Status Updates

**What We're Testing**: Fix 10 - Payout status updates to 'paid' after webhook

**Steps**:

1. **Create Pending Transactions**
```bash
# As organizer, create event and sell tickets
# Transactions should have payout_status = 'pending'
```

2. **Request Payout**
```
1. Log in as organizer
2. Go to: Dashboard → Financials
3. Click "Request Payout"
4. Verify payout_status changes to 'requested'
```

3. **Check Database**
```sql
-- Before payout
SELECT 
  id,
  payout_status,
  stripe_payment_intent_id
FROM financial_transactions
WHERE organizer_id = 'organizer_id'
  AND payout_status = 'requested'
ORDER BY created_at DESC;

-- Note the transaction IDs
```

4. **Execute Payout (Simulated)**
```
Method A: Manual in Stripe
1. Stripe Dashboard → Connect → Payouts
2. Create payout to organizer's account
3. Mark as completed

Method B: Trigger webhook manually
1. Stripe Dashboard → Developers → Events
2. Click "Send test webhook"
3. Select: payout.paid
4. Fill in payout details with organizer's connect account ID
5. Send
```

5. **Check Webhook Processing**
```bash
# View payout.paid webhook logs
tail -n 100 /var/log/supervisor/backend.out.log | grep -A 10 "payout.paid"

# Expected:
# [Webhook] Processing payout.paid: po_xxx
# [Webhook] Updated 5 transactions to 'paid' status for organizer xxx
```

6. **Verify Database Update**
```sql
-- After payout webhook
SELECT 
  id,
  payout_status,
  payout_date,
  payout_metadata
FROM financial_transactions
WHERE organizer_id = 'organizer_id'
  AND payout_status = 'paid'
ORDER BY created_at DESC;

-- Verify:
-- payout_status changed to 'paid'
-- payout_date is set
-- payout_metadata contains stripe_payout_id
```

**✅ Pass Criteria**:
- [ ] payout_status updates from 'requested' to 'paid'
- [ ] payout_date is set correctly
- [ ] payout_metadata includes Stripe payout ID
- [ ] Audit trail logged
- [ ] Only relevant transactions updated

**❌ Fail Indicators**:
- Status stays 'requested' after payout
- No payout_date set
- Webhook doesn't trigger updates

---

## 🧪 PHASE 3: ENHANCEMENT TESTING (Priority 3)

### Test 10: Rate Limiting

**What We're Testing**: Fix 11 - API rate limits prevent abuse

**Steps**:

1. **Test Checkout Rate Limit (10/hour)**
```bash
# Make 11 consecutive requests
for i in {1..11}; do
  echo "Request $i"
  curl -X POST "https://www.openticket.events/api/stripe/create-order" \
    -H "Content-Type: application/json" \
    -d '{"eventId":"test"}' \
    -w "\nHTTP Status: %{http_code}\n"
  sleep 1
done

# Expected:
# Requests 1-10: Status 400 (validation error) or 200
# Request 11: Status 429 (rate limited)
```

2. **Check Rate Limit Response**
```bash
# 11th request should return:
curl -i "https://www.openticket.events/api/stripe/create-order" \
  -X POST

# Expected response:
# HTTP/1.1 429 Too Many Requests
# RateLimit-Limit: 10
# RateLimit-Remaining: 0
# RateLimit-Reset: <timestamp>
#
# {
#   "error": "Too many checkout attempts from this IP...",
#   "code": "RATE_LIMIT_EXCEEDED",
#   "retryAfter": 3600
# }
```

3. **Test Rate Limit Headers**
```bash
# Make a request and check headers
curl -i "https://www.openticket.events/api/stripe/create-order" \
  -X POST -H "Content-Type: application/json"

# Check for headers:
# RateLimit-Limit: 10
# RateLimit-Remaining: 9 (or current remaining)
# RateLimit-Reset: <unix timestamp>
```

4. **Test Rate Limit Reset**
```bash
# Wait 1 hour (or change windowMs in rateLimiter.js to 1 minute for testing)
# Try again - should work

# Or restart backend to clear in-memory rate limits
sudo supervisorctl restart backend
```

5. **Check Logs**
```bash
# View rate limit logs
tail -n 100 /var/log/supervisor/backend.out.log | grep RateLimit

# Expected when limit hit:
# [RateLimit] Checkout rate limit exceeded for IP: 1.2.3.4
```

**✅ Pass Criteria**:
- [ ] 10 requests allowed per hour
- [ ] 11th request returns 429
- [ ] Rate limit headers present
- [ ] Error message is clear
- [ ] Limit resets after window

**❌ Fail Indicators**:
- No rate limiting (unlimited requests work)
- Wrong status code
- No headers
- Limit never resets

---

### Test 11: Platform Fee Cap

**What We're Testing**: Fix 12 - Fees capped at $100

**Steps**:

1. **Create High-Value Ticket**
```bash
# Create event with $10,000 ticket (Free plan)
# Expected uncapped fee: ($10,000 × 0.045) + $0.99 = $450.99
# Expected capped fee: $100.00
```

2. **Check Price Calculation**
```bash
# During checkout, check backend logs
tail -n 50 /var/log/supervisor/backend.out.log | grep "Platform fee capped"

# Expected:
# [PriceCalculator] Platform fee capped: $450.99 → $100.00
```

3. **Verify in Checkout**
```
# In checkout UI, verify:
# Platform Fee line item: $100.00 (not $450.99)
# Total includes $100 fee (not $450.99)
```

4. **Verify in Stripe**
```
1. Complete purchase
2. Stripe Dashboard → Payments
3. Check application_fee_amount
4. Expected: $10,000 (100 dollars in cents)
5. NOT: $45,099 (450.99 dollars in cents)
```

5. **Database Verification**
```sql
-- Check high-value transaction
SELECT 
  gross_amount,
  platform_fee,
  stripe_fee,
  organizer_net
FROM financial_transactions
WHERE gross_amount > 5000
ORDER BY created_at DESC
LIMIT 5;

-- Verify platform_fee <= 100.00
```

6. **Test Different Plans**
```bash
# Pro plan ($10,000 ticket):
# Uncapped: ($10,000 × 0.029) + $0.69 = $290.69
# Capped: $100.00

# Premium plan ($10,000 ticket):
# Uncapped: ($10,000 × 0.019) + $0.49 = $190.49
# Capped: $100.00
```

**✅ Pass Criteria**:
- [ ] Fees above $100 are capped
- [ ] Log message shows capping
- [ ] Stripe shows $100 max fee
- [ ] Works for all plan tiers
- [ ] Fees below $100 unchanged

**❌ Fail Indicators**:
- $450 fee charged on $10K ticket
- No capping log
- Inconsistent behavior

---

### Test 12: Transaction Type Standardization

**What We're Testing**: Fix 13 - Consistent transaction_type and type fields

**Steps**:

1. **Check All Transaction Types**
```sql
-- Verify all transactions have both fields
SELECT 
  transaction_type,
  type,
  COUNT(*) as count
FROM financial_transactions
GROUP BY transaction_type, type
ORDER BY count DESC;

-- Verify mappings:
-- ticket_sale → event
-- at_door_payment → event
-- subscription → subscription
-- smm_subscription → subscription
-- refund → refund
```

2. **Test Transaction Creation**
```javascript
// Use the helper functions
import { 
  createEventTransaction,
  createSubscriptionTransaction,
  createRefundTransaction 
} from './constants/transactionTypes.js';

// Test event transaction
const eventTx = createEventTransaction({
  isAtDoor: false,
  grossAmount: 100,
  platformFee: 5.49,
  stripeFee: 3.20,
  organizerNet: 91.31
});

console.log(eventTx);
// Verify:
// transaction_type: 'ticket_sale'
// type: 'event'
// Both fields present

// Test subscription
const subTx = createSubscriptionTransaction({
  isSMM: true,
  grossAmount: 199,
  platformFee: 199,
  stripeFee: 7.71,
  organizerNet: 0
});

console.log(subTx);
// Verify:
// transaction_type: 'smm_subscription'
// type: 'subscription'
```

3. **Check Consistency**
```sql
-- Find any records missing transaction_type or type
SELECT 
  id,
  transaction_type,
  type,
  gross_amount,
  created_at
FROM financial_transactions
WHERE transaction_type IS NULL 
   OR type IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- Should return 0 rows
```

4. **Verify Category Mapping**
```sql
-- Check that categories are correct
SELECT 
  transaction_type,
  type,
  COUNT(*) as count
FROM financial_transactions
GROUP BY transaction_type, type
HAVING type NOT IN ('event', 'subscription', 'platform_fee', 'refund');

-- Should return 0 rows (all categories valid)
```

**✅ Pass Criteria**:
- [ ] All transactions have both fields
- [ ] Mappings are correct
- [ ] Helper functions work
- [ ] No orphaned records
- [ ] Constants used (no magic strings)

**❌ Fail Indicators**:
- Missing transaction_type or type
- Incorrect mappings
- Inconsistent naming

---

### Test 13: Negative Amount Protection

**What We're Testing**: Fix 14 - Negative amounts only for refunds

**Steps**:

1. **Test Validation Function**
```javascript
import { validateTransactionAmount } from './utils/financialValidator.js';

// Test 1: Negative payment (should fail)
let result = validateTransactionAmount(-100, 'ticket_sale');
console.log(result);
// Expected: { isValid: false, error: "Negative amounts only allowed for refunds..." }

// Test 2: Negative refund (should pass)
result = validateTransactionAmount(-50, 'refund');
console.log(result);
// Expected: { isValid: true, error: null }

// Test 3: Positive refund (should fail)
result = validateTransactionAmount(50, 'refund');
console.log(result);
// Expected: { isValid: false, error: "Refund amounts must be negative..." }

// Test 4: Zero payment (should fail)
result = validateTransactionAmount(0, 'ticket_sale');
console.log(result);
// Expected: { isValid: false, error: "Zero amount transactions not allowed..." }

// Test 5: Zero free event (should pass)
result = validateTransactionAmount(0, 'free_event');
console.log(result);
// Expected: { isValid: true, error: null }

// Test 6: Over maximum (should fail)
result = validateTransactionAmount(60000, 'ticket_sale');
console.log(result);
// Expected: { isValid: false, error: "Transaction amount exceeds maximum..." }
```

2. **Database Check**
```sql
-- Find any invalid negative amounts
SELECT 
  id,
  transaction_type,
  type,
  gross_amount,
  created_at
FROM financial_transactions
WHERE gross_amount < 0 
  AND transaction_type != 'refund'
ORDER BY created_at DESC;

-- Should return 0 rows

-- Find any positive refunds
SELECT 
  id,
  transaction_type,
  gross_amount,
  created_at
FROM financial_transactions
WHERE transaction_type = 'refund'
  AND gross_amount > 0
ORDER BY created_at DESC;

-- Should return 0 rows
```

**✅ Pass Criteria**:
- [ ] Negative amounts rejected for non-refunds
- [ ] Refunds must be negative
- [ ] Zero only for free events
- [ ] Maximum enforced
- [ ] Clear error messages

**❌ Fail Indicators**:
- Negative payments in database
- Positive refunds in database
- Validation doesn't catch errors

---

## 🔒 PHASE 4: SECURITY TESTING

### Test 14: Webhook Security

**What We're Testing**: Webhook signature verification

**Steps**:

1. **Test Valid Webhook**
```bash
# Use Stripe CLI to send test webhook
stripe trigger checkout.session.completed

# Check logs
tail -n 50 /var/log/supervisor/backend.out.log | grep Webhook

# Expected:
# [Webhook] Received event: checkout.session.completed
# (Event should be processed)
```

2. **Test Invalid Signature**
```bash
# Send webhook without valid signature
curl -X POST "https://www.openticket.events/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -H "stripe-signature: invalid_signature" \
  -d '{"type":"checkout.session.completed"}'

# Expected response:
# HTTP 400
# "Webhook Error: ..."
```

3. **Test Missing Signature**
```bash
# Send webhook without signature header
curl -X POST "https://www.openticket.events/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed"}'

# Expected response:
# HTTP 400
```

**✅ Pass Criteria**:
- [ ] Valid webhooks are processed
- [ ] Invalid signatures rejected
- [ ] Missing signatures rejected
- [ ] 400 error returned for invalid

**❌ Fail Indicators**:
- Invalid webhooks processed
- No signature verification
- Server crashes on invalid webhook

---

### Test 15: Financial Data Integrity

**What We're Testing**: Overall financial accuracy

**Steps**:

1. **Balance Reconciliation**
```sql
-- Check all transactions balance
SELECT 
  COUNT(*) as total_transactions,
  SUM(CASE 
    WHEN ABS(gross_amount - (platform_fee + stripe_fee + organizer_net)) > 0.02 
    THEN 1 ELSE 0 
  END) as unbalanced_count
FROM financial_transactions
WHERE status = 'succeeded';

-- unbalanced_count should be 0
```

2. **Revenue Consistency**
```sql
-- Check platform revenue matches Stripe
SELECT 
  SUM(platform_fee) as total_platform_fees,
  SUM(CASE WHEN type = 'event' THEN platform_fee ELSE 0 END) as event_fees,
  SUM(CASE WHEN type = 'subscription' THEN platform_fee ELSE 0 END) as subscription_fees
FROM financial_transactions
WHERE status = 'succeeded'
  AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

-- Compare with Stripe Dashboard revenue
```

3. **Refund Accuracy**
```sql
-- Verify refunds don't exceed originals
WITH refund_totals AS (
  SELECT 
    stripe_payment_intent_id,
    SUM(ABS(gross_amount)) as total_refunded
  FROM financial_transactions
  WHERE transaction_type = 'refund'
  GROUP BY stripe_payment_intent_id
)
SELECT 
  ft.stripe_payment_intent_id,
  ft.gross_amount as original_amount,
  rt.total_refunded,
  (rt.total_refunded - ft.gross_amount) as over_refund
FROM financial_transactions ft
JOIN refund_totals rt ON ft.stripe_payment_intent_id = rt.stripe_payment_intent_id
WHERE ft.transaction_type != 'refund'
  AND rt.total_refunded > ft.gross_amount + 0.01;

-- Should return 0 rows
```

4. **Payout Tracking**
```sql
-- Check payout status distribution
SELECT 
  payout_status,
  COUNT(*) as count,
  SUM(organizer_net) as total_net
FROM financial_transactions
WHERE organizer_id IS NOT NULL
GROUP BY payout_status
ORDER BY count DESC;

-- Verify statuses make sense:
-- - 'pending' > 0 (new transactions)
-- - 'requested' >= 0 (pending payouts)
-- - 'paid' > 0 (completed payouts)
```

**✅ Pass Criteria**:
- [ ] All transactions balanced
- [ ] Revenue matches Stripe
- [ ] No over-refunds
- [ ] Payout statuses logical

**❌ Fail Indicators**:
- Many unbalanced transactions
- Revenue doesn't match Stripe
- Over-refunds exist
- Orphaned payout statuses

---

## 🎯 PHASE 5: INTEGRATION TESTING

### Test 16: End-to-End Purchase Flow

**What We're Testing**: Complete purchase flow with all fixes

**Steps**:

1. **Setup**
```
Create test event:
- Title: "Production Test Event"
- Price: $100 (Free plan organizer)
- Currency: USD
```

2. **Execute Purchase**
```
1. Go to event page
2. Click "Buy Tickets"
3. Fill attendee information
4. Use test card: 4242 4242 4242 4242
5. Complete purchase
```

3. **Verify Each Fix**

**Fix 1: Stripe Mode**
```bash
# Check logs showed correct mode
grep "Stripe.*mode" /var/log/supervisor/backend.out.log | tail -1
```

**Fix 2: Stripe Fee**
```bash
# Check fee was retrieved or estimated correctly
grep "Retrieved Actual Fee\|estimated fee" /var/log/supervisor/backend.out.log | tail -1
```

**Fix 4: No Duplicate**
```sql
-- Verify only one record created
SELECT COUNT(*) 
FROM financial_transactions 
WHERE stripe_payment_intent_id = 'pi_xxx';
-- Should be 1
```

**Fix 5: Balanced**
```sql
SELECT 
  gross_amount,
  platform_fee + stripe_fee + organizer_net as calculated
FROM financial_transactions 
WHERE stripe_payment_intent_id = 'pi_xxx';
-- Should match
```

**Fix 6: Subscription** (if applicable)
```sql
-- Check subscription payment recorded
SELECT * FROM financial_transactions 
WHERE transaction_type = 'subscription';
```

**Fix 7: Within Limits**
```
# $100 is within $0.50 - $50,000 range ✓
```

**Fix 11: Rate Limit**
```bash
# Check rate limit headers in response
curl -i [checkout URL]
# Should see RateLimit-* headers
```

**Fix 12: Fee Not Capped**
```
# $100 ticket fee is ~$5.49, under $100 cap ✓
```

**Fix 13: Type Fields**
```sql
SELECT transaction_type, type 
FROM financial_transactions 
WHERE stripe_payment_intent_id = 'pi_xxx';
-- Both should be set
```

**Fix 14: Positive Amount**
```sql
SELECT gross_amount 
FROM financial_transactions 
WHERE stripe_payment_intent_id = 'pi_xxx';
-- Should be positive
```

**✅ Pass Criteria**:
- [ ] Purchase completes successfully
- [ ] All 14 fixes are evident
- [ ] Financial record is correct
- [ ] No errors in logs

---

### Test 17: End-to-End Refund Flow

**What We're Testing**: Complete refund flow with validation

**Steps**:

1. **Create Purchase**
```
# Complete $100 purchase (from Test 16)
```

2. **Issue Refund**
```
1. Stripe Dashboard → Payments
2. Find payment
3. Refund $50 (partial)
```

3. **Verify Refund**

**Fix 8: Validation**
```bash
# Check validation logged
grep "Refund validation" /var/log/supervisor/backend.out.log | tail -1
# Should show: "passed: $50.00 of $100.00"
```

**Fix 5: Balanced**
```sql
-- Check refund transaction balanced
SELECT 
  gross_amount,
  platform_fee + stripe_fee + organizer_net as calculated
FROM financial_transactions 
WHERE transaction_type = 'refund'
ORDER BY created_at DESC LIMIT 1;
-- Should match (both negative)
```

**Fix 14: Negative**
```sql
-- Check all amounts are negative
SELECT gross_amount, platform_fee, stripe_fee, organizer_net
FROM financial_transactions 
WHERE transaction_type = 'refund'
ORDER BY created_at DESC LIMIT 1;
-- All should be negative
```

4. **Test Over-Refund Prevention**
```
1. Try to refund $60 more (total would be $110)
2. Check webhook logs
3. Expected: Validation should fail and skip
```

**✅ Pass Criteria**:
- [ ] Refund processes correctly
- [ ] Validation logs present
- [ ] All amounts negative
- [ ] Over-refund prevented

---

## 📊 PHASE 6: PERFORMANCE & MONITORING

### Test 18: System Performance

**What We're Testing**: System handles load correctly

**Steps**:

1. **Check Service Status**
```bash
sudo supervisorctl status

# All should be RUNNING:
# - backend
# - frontend
# - nginx
```

2. **Check Memory Usage**
```bash
# Check for memory leaks
ps aux | grep node | grep -v grep

# Monitor for 10 minutes
# Memory should be stable (not growing continuously)
```

3. **Check Webhook Event Cache**
```bash
# After many webhooks, check cache size
# Should not grow indefinitely (max 10,000 events)
# Check logs for cleanup messages:
grep "Cache cleanup" /var/log/supervisor/backend.out.log | tail -5
```

4. **Response Time Test**
```bash
# Test API response times
time curl "https://www.openticket.events/api/csrf-token"

# Should be < 200ms
```

**✅ Pass Criteria**:
- [ ] All services running
- [ ] Memory stable
- [ ] Cache cleanup working
- [ ] Response times good

---

## ✅ FINAL PRODUCTION READINESS CHECKLIST

### Pre-Deployment Sign-Off

#### Critical Fixes (Must Pass)
- [ ] Test 1: Stripe mode validation ✓
- [ ] Test 2: Stripe fee accuracy ✓
- [ ] Test 3: Currency conversion ✓
- [ ] Test 4: Webhook replay prevention ✓
- [ ] Test 5: Balance reconciliation ✓

#### Important Fixes (Must Pass)
- [ ] Test 6: Subscription tracking ✓
- [ ] Test 7: Transaction limits ✓
- [ ] Test 8: Refund validation ✓
- [ ] Test 9: Payout status updates ✓

#### Enhancement Fixes (Should Pass)
- [ ] Test 10: Rate limiting ✓
- [ ] Test 11: Platform fee cap ✓
- [ ] Test 12: Transaction types ✓
- [ ] Test 13: Negative amounts ✓

#### Security (Must Pass)
- [ ] Test 14: Webhook security ✓
- [ ] Test 15: Financial integrity ✓

#### Integration (Must Pass)
- [ ] Test 16: E2E purchase flow ✓
- [ ] Test 17: E2E refund flow ✓

#### Performance (Should Pass)
- [ ] Test 18: System performance ✓

---

## 🚀 PRODUCTION DEPLOYMENT APPROVAL

### Sign-Off Criteria

**APPROVED FOR PRODUCTION** if:
- ✅ All "Must Pass" tests passed (14/14)
- ✅ All "Should Pass" tests passed (4/4)
- ✅ No critical errors in logs
- ✅ Financial data integrity verified
- ✅ Stripe integration working correctly

**CONDITIONAL APPROVAL** if:
- ✅ All "Must Pass" tests passed (14/14)
- ⚠️ Some "Should Pass" tests have minor issues
- ⚠️ Non-critical warnings in logs
- ✅ Financial data integrity verified

**NOT APPROVED** if:
- ❌ Any "Must Pass" test failed
- ❌ Critical errors in logs
- ❌ Financial data integrity issues
- ❌ Stripe integration broken

---

## 📋 Test Results Summary Template

```
# Production Readiness Test Results
Date: _______________
Tester: _______________
Environment: TEST / PRODUCTION

## Phase 1: Critical Fixes (5/5)
[ ] Test 1: Stripe Mode Validation - PASS / FAIL
[ ] Test 2: Stripe Fee Accuracy - PASS / FAIL
[ ] Test 3: Currency Conversion - PASS / FAIL
[ ] Test 4: Webhook Replay - PASS / FAIL
[ ] Test 5: Balance Reconciliation - PASS / FAIL

## Phase 2: Important Fixes (4/4)
[ ] Test 6: Subscription Tracking - PASS / FAIL
[ ] Test 7: Transaction Limits - PASS / FAIL
[ ] Test 8: Refund Validation - PASS / FAIL
[ ] Test 9: Payout Status - PASS / FAIL

## Phase 3: Enhancements (4/4)
[ ] Test 10: Rate Limiting - PASS / FAIL
[ ] Test 11: Fee Cap - PASS / FAIL
[ ] Test 12: Transaction Types - PASS / FAIL
[ ] Test 13: Negative Amounts - PASS / FAIL

## Phase 4: Security (2/2)
[ ] Test 14: Webhook Security - PASS / FAIL
[ ] Test 15: Financial Integrity - PASS / FAIL

## Phase 5: Integration (2/2)
[ ] Test 16: E2E Purchase - PASS / FAIL
[ ] Test 17: E2E Refund - PASS / FAIL

## Phase 6: Performance (1/1)
[ ] Test 18: System Performance - PASS / FAIL

## Overall Result
Total Tests: 18
Passed: ___
Failed: ___

Production Ready: YES / NO / CONDITIONAL

## Issues Found:
1. _______________
2. _______________

## Notes:
_______________________________________________
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: Tests fail due to Stripe keys
**Solution**: Ensure `.env` has correct keys, restart backend

**Issue**: Webhook tests don't work
**Solution**: Check STRIPE_WEBHOOK_SECRET is set, verify Stripe Dashboard webhook URL

**Issue**: Database queries return no results
**Solution**: Ensure migration was run, check if test data exists

**Issue**: Rate limiting seems broken
**Solution**: Restart backend to clear in-memory limits, or wait for window to expire

---

**Testing Guide Version**: 1.0  
**Last Updated**: February 21, 2026  
**Estimated Testing Time**: 4-6 hours  
**Complexity**: Advanced  
**Required Skills**: API testing, SQL, Stripe knowledge
