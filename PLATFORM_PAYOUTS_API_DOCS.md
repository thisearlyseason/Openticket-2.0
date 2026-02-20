# Platform Payouts API Enhancement - Complete Documentation

## Overview

This document describes the enhancements made to the platform payouts endpoint to provide comprehensive revenue tracking with failed payout recovery.

---

## Endpoint: `GET /api/admin/platform-payouts/pending`

**Purpose**: Calculate and return pending platform revenue across all revenue streams.

**Authentication**: Requires admin token

---

## Enhanced Response Structure

```json
{
  "platformFees": {
    "amount": 1250.50,              // Available to payout
    "totalCollected": 2500.00,       // Total since last payout
    "scheduledAmount": 1000.00,      // Currently scheduled
    "failedAmount": 250.50,          // Failed payouts (re-added)
    "transactionCount": 125,
    "periodStart": "2026-01-15T10:00:00Z",
    "periodEnd": "2026-02-20T15:30:00Z"
  },
  "subscriptions": {
    "amount": 3600.00,
    "totalCollected": 4500.00,
    "scheduledAmount": 900.00,
    "failedAmount": 0,
    "transactionCount": 45,
    "periodStart": "2026-01-15T10:00:00Z",
    "periodEnd": "2026-02-20T15:30:00Z"
  },
  "smm": {
    "amount": 1980.00,              // NEW: SMM revenue tracking
    "totalCollected": 2200.00,
    "scheduledAmount": 220.00,
    "failedAmount": 0,
    "transactionCount": 22,
    "periodStart": "2026-01-15T10:00:00Z",
    "periodEnd": "2026-02-20T15:30:00Z"
  },
  "total": 6830.50,                 // Sum of all pending amounts
  "breakdown": {                    // Quick reference
    "platformFees": 1250.50,
    "subscriptions": 3600.00,
    "smm": 1980.00
  }
}
```

---

## Revenue Streams Tracked

### 1. Platform Fees (Event-Based)
**Source**: `financial_transactions` where `type = 'event'`  
**Field**: `platform_fee`  
**Description**: Fees collected from ticket sales and event registrations

**Calculation**:
```
pending = totalCollected - scheduledAmount + failedAmount
```

**Filters**:
- `status = 'succeeded'`
- `type IN ('event')`
- `platform_fee > 0`
- `created_at > last_executed_payout_date`

---

### 2. Subscription Revenue
**Source**: `financial_transactions` where `type = 'subscription'`  
**Field**: `gross_amount`  
**Description**: Pro/Premium subscription payments

**Calculation**:
```
pending = totalCollected - scheduledAmount + failedAmount
```

**Filters**:
- `status = 'succeeded'`
- `type IN ('subscription')`
- `gross_amount > 0`
- `created_at > last_executed_payout_date`

---

### 3. SMM (Social Media Marketing) Revenue ✨ NEW
**Source**: `financial_transactions` where `transaction_type = 'smm_subscription'`  
**Field**: `gross_amount`  
**Description**: Social media marketing service subscriptions

**Calculation**:
```
pending = totalCollected - scheduledAmount + failedAmount
```

**Filters**:
- `status = 'succeeded'`
- `transaction_type = 'smm_subscription'`
- `gross_amount > 0`
- `created_at > last_executed_payout_date`

---

## Key Enhancements

### ✅ Enhancement 1: Failed Payout Recovery

**Problem**: When a payout fails (e.g., bank transfer rejected), the funds remained locked and were never added back to available balance.

**Solution**: Track failed payouts and automatically re-add them to pending balance.

**Implementation**:
```javascript
const { data: failedPayouts } = await supabase
    .from('platform_payouts')
    .select('amount, created_at')
    .eq('status', 'failed')
    .eq('payout_type', 'platform_fees');

const failedAmount = (failedPayouts || [])
    .filter(p => !lastPayout || p.created_at > lastPayout)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
```

**Example Scenario**:
1. Pending balance: $1000
2. Schedule payout: $1000 (pending becomes $0)
3. Payout fails
4. **Before**: Pending stays $0 (funds lost)
5. **After**: Pending becomes $1000 (funds recovered)

---

### ✅ Enhancement 2: SMM Revenue Tracking

**Problem**: SMM subscription revenue was not tracked separately, making it hard to analyze this revenue stream.

**Solution**: Added dedicated SMM revenue calculation with same logic as subscriptions.

**Benefits**:
- Separate payout scheduling for SMM revenue
- Better revenue stream analytics
- Distinct period tracking per revenue type

---

### ✅ Enhancement 3: Cutoff Date Fix

**Changed**: `created_at` → `executed_at` for cutoff date

**Why**: 
- `created_at` = when payout was scheduled
- `executed_at` = when payout actually completed
- Using `created_at` could include already-paid transactions

**Impact**: Prevents double-counting transactions

---

### ✅ Enhancement 4: Transaction Type Filtering

**Added**: Explicit `type` field filtering

**Platform Fees**: Only `type IN ('event')`  
**Subscriptions**: Only `type IN ('subscription')`  
**SMM**: Only `transaction_type = 'smm_subscription'`

**Why**: Prevents mixing revenue types and including refunds

---

## Payout Lifecycle

### Status Flow:
```
pending → scheduled → processing → completed
                              ↓
                           failed (recoverable)
```

### Status Definitions:

**`pending`**: Payout created, not yet scheduled  
**`scheduled`**: Scheduled for future execution  
**`processing`**: Currently being executed  
**`completed`**: Successfully paid out (has `executed_at`)  
**`failed`**: Payment failed (amount re-added to pending)

---

## Testing Guide

### Test 1: Failed Payout Recovery

```bash
# 1. Get pending balance
curl -H "Authorization: Bearer $TOKEN" \
  https://www.openticket.events/api/admin/platform-payouts/pending

# Note the platformFees.amount (e.g., $1000)

# 2. Schedule a payout
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payoutType":"platform_fees","amount":1000}' \
  https://www.openticket.events/api/admin/platform-payouts/schedule

# 3. Get pending balance again (should be $0)

# 4. Manually mark payout as failed in database:
# UPDATE platform_payouts SET status='failed' WHERE id='...'

# 5. Get pending balance again (should be $1000 again)
```

### Test 2: Subscription Revenue Tracking

```bash
# 1. Create a subscription transaction
INSERT INTO financial_transactions (
  transaction_type, type, gross_amount, status, created_at
) VALUES (
  'subscription', 'subscription', 99.00, 'succeeded', NOW()
);

# 2. Query pending payouts
curl -H "Authorization: Bearer $TOKEN" \
  https://www.openticket.events/api/admin/platform-payouts/pending

# 3. Verify subscriptions.amount includes $99.00
```

### Test 3: SMM Revenue Tracking

```bash
# 1. Create an SMM subscription transaction
INSERT INTO financial_transactions (
  transaction_type, gross_amount, status, created_at
) VALUES (
  'smm_subscription', 199.00, 'succeeded', NOW()
);

# 2. Query pending payouts
curl -H "Authorization: Bearer $TOKEN" \
  https://www.openticket.events/api/admin/platform-payouts/pending

# 3. Verify smm.amount includes $199.00
```

### Test 4: Cutoff Date Accuracy

```bash
# 1. Note current pending balance
# 2. Schedule and execute payout (marks executed_at)
# 3. Add new transactions after execution
# 4. Query pending again
# 5. Verify ONLY new transactions are included
```

---

## Migration Notes

### Database Requirements:

✅ `financial_transactions.type` column (added via V1 migration)  
✅ `platform_payouts.executed_at` column (should exist)  
✅ `platform_payouts.status` supports: pending, scheduled, processing, completed, failed

### Backward Compatibility:

- ✅ Existing API consumers will receive new `smm` field (additive change)
- ✅ Response structure remains compatible (added fields, not changed)
- ⚠️ Frontend may need updates to display SMM revenue

---

## Error Handling

### Common Errors:

**`TypeError: Cannot read property 'executed_at' of undefined`**
- Cause: No completed payouts exist yet
- Handled: Code checks `if (lastPayout)` before filtering

**`NaN in calculation`**
- Cause: Invalid amount in database
- Handled: `Number(tx.amount) || 0` fallback

**`Missing type field`**
- Cause: Old transactions before migration
- Impact: Will be excluded from queries
- Solution: Run backfill migration

---

## Performance Considerations

### Query Optimization:

1. **Indexes recommended**:
   ```sql
   CREATE INDEX idx_financial_transactions_type_status 
   ON financial_transactions(type, status, created_at);
   
   CREATE INDEX idx_platform_payouts_type_status 
   ON platform_payouts(payout_type, status, executed_at);
   ```

2. **Query Count**: 9 queries per request
   - 3 for last payouts (one per type)
   - 3 for pending transactions
   - 3 for failed payouts

3. **Expected Response Time**: <500ms

---

## Security Notes

- ✅ Endpoint requires admin authentication
- ✅ No sensitive data exposed (only aggregated amounts)
- ✅ CSRF protection via csrfFetch wrapper
- ✅ SQL injection protected (Supabase parameterized queries)

---

## Future Enhancements

1. **Automatic Failed Payout Retry**: Auto-retry failed payouts after N days
2. **Payout Scheduling**: Automated weekly/monthly payout scheduling
3. **Email Notifications**: Alert on failed payouts
4. **Webhook Integration**: Stripe webhook to auto-update payout status
5. **Multi-Currency Support**: Track pending payouts per currency

---

**Last Updated**: February 20, 2026  
**Version**: 2.0  
**Author**: E1 Agent (Emergent AI)
