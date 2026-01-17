# 🚀 DEPLOYMENT INSTRUCTIONS - Refund System & Financial Fixes

## ⚠️ IMPORTANT: Follow these steps in order

---

## Step 1: Apply SQL Migration (Create RPC Functions)

### Option A: Run via Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** (in left sidebar)
3. Click: **New Query**
4. Copy and paste the following SQL:

```sql
-- Drop existing functions if they exist (handles conflicts)
DROP FUNCTION IF EXISTS increment_registered_count(text, integer);
DROP FUNCTION IF EXISTS increment_registered_count(uuid, integer);
DROP FUNCTION IF EXISTS increment_registered_count(text, int);
DROP FUNCTION IF EXISTS increment_registered_count(uuid, int);

DROP FUNCTION IF EXISTS decrement_registered_count(text, integer);
DROP FUNCTION IF EXISTS decrement_registered_count(uuid, integer);
DROP FUNCTION IF EXISTS decrement_registered_count(text, int);
DROP FUNCTION IF EXISTS decrement_registered_count(uuid, int);

-- Create increment function (used when payment succeeds)
CREATE OR REPLACE FUNCTION increment_registered_count(p_event_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE events
    SET registered_count = COALESCE(registered_count, 0) + p_count
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create decrement function (used when refund occurs)
CREATE OR REPLACE FUNCTION decrement_registered_count(p_event_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE events
    SET registered_count = GREATEST(0, COALESCE(registered_count, 0) - p_count)
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_registered_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_registered_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_registered_count(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION decrement_registered_count(UUID, INTEGER) TO anon;

-- Add documentation
COMMENT ON FUNCTION increment_registered_count(UUID, INTEGER) IS 'Safely increments event registered count when payment succeeds';
COMMENT ON FUNCTION decrement_registered_count(UUID, INTEGER) IS 'Safely decrements event registered count when refund/cancellation occurs. Never goes below 0.';
```

5. Click: **Run** (bottom right)
6. **Verify Success:** You should see "Success. No rows returned"

### Option B: Use the migration file
The complete SQL is also available at:
```
/app/backend/migrations/create_registered_count_functions_v2.sql
```

---

## Step 2: Run Data Fix Script (Recalculate Counts)

This script fixes all existing events with incorrect guest counts.

### Run via Terminal:

```bash
cd /app/backend
node scripts/fix_registered_counts.js
```

### Expected Output:
```
🔧 Starting registered_count recalculation...

Found 25 events to process

✅ Fixed: "TYLERS MUSICAL APPEARAMCE" - 10 → 8 (-2)
✓ OK: "Summer Concert" - 50 tickets (no change needed)
...

============================================================
📊 RECALCULATION COMPLETE
============================================================
Total events processed: 25
✅ Fixed: 8
✓ Already correct: 17
❌ Errors: 0
============================================================
```

**What this does:**
- Loops through ALL events
- Counts actual non-refunded tickets
- Updates `registered_count` to match reality
- Safe to run multiple times (idempotent)

---

## Step 3: Test Refund Flows

### Test 1: Single Ticket Refund ✅

**Steps:**
1. Go to: Event "TYLERS MUSICAL APPEARAMCE"
2. Click: **Attendee List**
3. Find a paid ticket
4. Click: **⋮ (More Actions)** → **Refund**
5. Select: **"This Ticket Only"**
6. Enter reason: "Test refund"
7. Click: **Confirm Refund**

**Expected Results:**
- ✅ Success message shows Stripe refund ID (e.g., `re_1A2B3C...`)
- ✅ Guest count decrements by 1
- ✅ Ticket status changes to "Refunded"
- ✅ Financial totals update

**OR if Stripe fails:**
- ⚠️ Warning message: "Registration marked as refunded, but Stripe refund failed..."
- ⚠️ Explains what happened

---

### Test 2: Full Order Refund ✅

**Steps:**
1. Find a guest with multiple tickets
2. Click: **⋮** → **Refund**
3. Select: **"Full Order"**
4. Enter reason: "Customer requested full refund"
5. Click: **Confirm Refund**

**Expected Results:**
- ✅ All tickets in order marked as refunded
- ✅ Guest count decrements by total ticket quantity
- ✅ Stripe refund ID shown
- ✅ Full amount refunded

---

### Test 3: Bulk Refund ✅

**Steps:**
1. In Attendee List, use checkboxes to select 3-5 tickets
2. Click: **Refund Selected** (top toolbar)
3. Confirm in dialog
4. Wait for processing

**Expected Results:**
- ✅ Message shows: "Successfully refunded X item(s)!"
- ✅ If any fail: "⚠️ Partial success: 3 refunded, 2 failed. Check console for details."
- ✅ Console logs show specific errors for failed items
- ✅ Guest count decrements by successful refund count

---

## Step 4: Verify Guest Count Accuracy

**Check Dashboard:**
1. Go to: **Manage Event** page
2. Look at: **Attendee List** card (top right)
3. **Verify:** Number matches actual non-refunded tickets

**Compare with:**
- Event Financials page
- Analytics dashboard
- Raw database count

**All should match now!**

---

## 🔍 Troubleshooting

### Issue: SQL migration fails with "function not unique"
**Solution:** 
- The function already exists
- Use the DROP statements at the top of the SQL
- They will safely remove old versions

### Issue: Data fix script shows errors
**Likely Cause:** Database connection issue
**Solution:**
- Check `.env` file has correct `SUPABASE_URL` and `SUPABASE_KEY`
- Verify backend can connect to Supabase

### Issue: Refunds show success but Stripe doesn't process
**Check:**
1. Backend logs: `tail -n 50 /var/log/supervisor/backend.*.log`
2. Look for: `[Refund] Stripe API error:`
3. Common issues:
   - Stripe key not configured
   - Payment intent not found
   - Already refunded in Stripe

### Issue: Guest count still wrong after fix script
**Solution:**
- Re-run the fix script: `node scripts/fix_registered_counts.js`
- Check if refunds are being processed correctly going forward
- May need to manually verify some registrations

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] SQL migration ran successfully
- [ ] Data fix script completed without errors
- [ ] Single ticket refund shows Stripe ID
- [ ] Full order refund works correctly
- [ ] Bulk refund tracks successes/failures
- [ ] Guest counts decrement on refund
- [ ] Guest counts match across all views
- [ ] Stripe errors are visible to user
- [ ] No false success messages

---

## 📞 If You Need Help

**Check Logs:**
```bash
# Backend logs
tail -n 100 /var/log/supervisor/backend.*.log

# Look for refund operations
grep -i "refund" /var/log/supervisor/backend.*.log | tail -50
```

**Database Verification:**
```sql
-- Check if RPC functions exist
SELECT proname, pg_get_function_identity_arguments(oid) 
FROM pg_proc 
WHERE proname LIKE '%registered_count%';

-- Check event counts
SELECT title, registered_count 
FROM events 
WHERE title LIKE '%TYLER%';
```

**Frontend Console:**
- Open browser DevTools (F12)
- Watch for refund responses
- Errors will be logged with details

---

## 🎯 What's Next?

After testing, you can:
1. **Mark as complete** if everything works
2. **Request additional features** (multi-select, pending tickets display, etc.)
3. **Report any issues** found during testing

---

**File Locations for Reference:**
- SQL Migration: `/app/backend/migrations/create_registered_count_functions_v2.sql`
- Data Fix Script: `/app/backend/scripts/fix_registered_counts.js`
- Audit Documentation: `/app/FINANCIAL_AUDIT.md`
- Refund Fix Plan: `/app/REFUND_SYSTEM_FIX.md`
