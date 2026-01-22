# Database Migration Guide

This guide provides step-by-step instructions for running the pending database migrations for OpenTicket.

## 📋 Pending Migrations Overview

### 1. ✅ Security Audit Logs Table (P2 - Required for security monitoring)
**File:** `create_security_audit_logs_table.sql`
**Purpose:** Creates a table to log suspicious ticket transfer activities and fraud detection
**Status:** Consolidated and ready to run

### 2. ✅ Abandoned Cart Email Column (P2 - Required for abandoned cart emails)
**File:** `add_abandoned_email_sent_column.sql`
**Purpose:** Adds a column to track when abandoned cart emails are sent
**Status:** Ready to run (fixes recurring cron error)

### 3. ✅ Materialized Views for Analytics (P1 - Performance optimization)
**File:** `create_materialized_views.sql`
**Purpose:** Creates optimized views for scan analytics dashboard performance
**Status:** Fixed with unique indexes, ready to run

---

## 🚀 How to Run Migrations

### Option 1: Run All Migrations Together (Recommended)

1. **Open Supabase SQL Editor**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Navigate to your project: `OpenTicket`
   - Click on **SQL Editor** in the left sidebar

2. **Create a new query** and paste the following:

```sql
-- ========================================
-- MIGRATION 1: Abandoned Cart Email Column
-- ========================================
-- Add abandoned_email_sent column to registrations table

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'registrations' 
        AND column_name = 'abandoned_email_sent'
    ) THEN
        ALTER TABLE public.registrations 
        ADD COLUMN abandoned_email_sent TIMESTAMPTZ DEFAULT NULL;
        
        RAISE NOTICE '✅ Column abandoned_email_sent added to registrations table';
    ELSE
        RAISE NOTICE 'ℹ️  Column abandoned_email_sent already exists';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registrations_abandoned_cart 
ON public.registrations(payment_status, created_at, abandoned_email_sent)
WHERE abandoned_email_sent IS NULL;

COMMENT ON COLUMN public.registrations.abandoned_email_sent IS 'Timestamp when abandoned cart reminder email was sent';

RAISE NOTICE '✅ Migration 1 complete: Abandoned cart email column';

-- ========================================
-- MIGRATION 2: Security Audit Logs Table
-- ========================================
-- Copy the entire contents of create_security_audit_logs_table.sql here
-- ... (see file for full content)

-- ========================================
-- MIGRATION 3: Materialized Views
-- ========================================
-- Copy the entire contents of create_materialized_views.sql here
-- ... (see file for full content)
```

3. **Click "Run"** to execute the migrations

---

### Option 2: Run Migrations One by One

#### Migration 1: Abandoned Cart Email Column (Quick - ~5 seconds)

1. Open the file: `/app/backend/migrations/add_abandoned_email_sent_column.sql`
2. Copy its entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**
5. ✅ You should see: `✅ Abandoned cart email column migration complete!`

#### Migration 2: Security Audit Logs Table (Medium - ~10 seconds)

1. Open the file: `/app/backend/migrations/create_security_audit_logs_table.sql`
2. Copy its entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**
5. ✅ You should see: `✅ Security audit logs table created successfully!`

#### Migration 3: Materialized Views (Long - ~30-60 seconds)

⚠️ **Note:** This migration may take longer if you have a lot of scan analytics data.

1. Open the file: `/app/backend/migrations/create_materialized_views.sql`
2. Copy its entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**
5. ✅ You should see: `✅ All materialized views refreshed successfully`

---

## ✅ Verification

After running the migrations, verify they worked correctly:

### Check 1: Abandoned Cart Column
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'registrations' 
AND column_name = 'abandoned_email_sent';
```
**Expected:** Should return 1 row showing `abandoned_email_sent | timestamp with time zone`

### Check 2: Security Audit Logs Table
```sql
SELECT COUNT(*) as table_exists 
FROM information_schema.tables 
WHERE table_name = 'security_audit_logs';
```
**Expected:** Should return `table_exists: 1`

### Check 3: Materialized Views
```sql
SELECT matviewname 
FROM pg_matviews 
WHERE schemaname = 'public';
```
**Expected:** Should return 4 views:
- `mv_event_scan_summary`
- `mv_scans_by_hour`
- `mv_scan_errors`
- `mv_daily_scan_trends`

---

## 🔍 Troubleshooting

### Error: "relation already exists"
**Solution:** This is normal if you've run the migration before. The migrations use `IF NOT EXISTS` checks, so they're safe to re-run.

### Error: "permission denied"
**Solution:** Make sure you're using the service role key or logged in as the database owner in Supabase.

### Error: "cannot refresh materialized view concurrently"
**Solution:** This has been fixed in the new version. Make sure you're using `/app/backend/migrations/create_materialized_views.sql` (not the old version).

---

## 📊 Expected Outcomes

### After Migration 1 (Abandoned Cart Column):
- ✅ Cron job error will disappear from backend logs
- ✅ Abandoned cart emails will start working
- ✅ Users will receive reminders for incomplete purchases

### After Migration 2 (Security Audit Logs):
- ✅ Security tab in Super Admin dashboard will work
- ✅ Suspicious transfer activities will be logged
- ✅ Fraud detection system will be operational

### After Migration 3 (Materialized Views):
- ✅ Admin analytics dashboard will load much faster
- ✅ Scan analytics queries will be 10-100x faster
- ✅ Real-time dashboard performance will improve

---

## 🆘 Need Help?

If you encounter any issues:
1. Check the **Supabase logs** for error details
2. Verify your **database permissions**
3. Ensure you're running the **correct file version**
4. Try running migrations **one at a time** instead of all at once

---

## 📝 Migration Status Tracking

- [x] Files consolidated and cleaned up
- [ ] Migration 1: Abandoned cart column - **Ready to run**
- [ ] Migration 2: Security audit logs - **Ready to run**
- [ ] Migration 3: Materialized views - **Ready to run**

After running each migration successfully, mark it as complete with a checkmark! ✅

---

### 4. ✅ Missing Schema Columns (P3 - Currency conversion support)
**File:** `add_missing_columns.sql`
**Purpose:** Adds columns that the codebase expects but may be missing in production:
- `events.currency` - Default currency for event pricing
- `events.email_settings` - JSONB for email configuration
- `events.organizer_absorbed_fee` - Boolean for fee absorption setting
- `registrations.charged_currency` - Actual currency user was charged in
- `registrations.charged_amount` - Actual amount charged
**Status:** Created January 22, 2026 - Ready to run

**Important:** This migration includes data migration from `answers._metadata` to the dedicated columns. The codebase has backwards compatibility to read from either location, so this migration can be run at any time without breaking functionality.

To run:
1. Open Supabase SQL Editor
2. Copy contents of `add_missing_columns.sql`
3. Execute the SQL
4. Verify with the included verification query at the bottom of the file
