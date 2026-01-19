# 🗄️ Database Migration Instructions for Kiosk Mode

## Quick Migration Steps

### Option 1: Supabase SQL Editor (Recommended - 2 minutes)

1. **Open Supabase SQL Editor:**
   - Click here: https://supabase.com/dashboard/project/dcjdurvgkveblvtinoms/sql
   - Or navigate to: Dashboard → Your Project → SQL Editor

2. **Copy the Migration SQL:**
   - The complete SQL is in `/tmp/run_migration.sql`
   - Or scroll down to see it below

3. **Execute:**
   - Paste the SQL into the editor
   - Click **"Run"** or press `Cmd/Ctrl + Enter`
   - Wait for success message

4. **Verify:**
   - You should see: "✅ Kiosk Mode migration completed successfully!"
   - Tables created: `kiosk_tokens`, `kiosk_logs`
   - View created: `active_kiosk_tokens`

---

## Migration SQL (Copy This)

```sql
-- Kiosk Mode Database Schema Migration
-- Safe to run multiple times (uses IF NOT EXISTS)

-- 1. Create kiosk_tokens table
CREATE TABLE IF NOT EXISTS kiosk_tokens (
    id BIGSERIAL PRIMARY KEY,
    token_id UUID UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'kiosk',
    event_id VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '["scan_ticket", "manual_checkin", "door_payment"]'::jsonb,
    payment_enabled BOOLEAN DEFAULT true,
    pin_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- 2. Create indexes for kiosk_tokens
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kiosk_tokens_event_id') THEN
        CREATE INDEX idx_kiosk_tokens_event_id ON kiosk_tokens(event_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kiosk_tokens_token_id') THEN
        CREATE INDEX idx_kiosk_tokens_token_id ON kiosk_tokens(token_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kiosk_tokens_revoked') THEN
        CREATE INDEX idx_kiosk_tokens_revoked ON kiosk_tokens(revoked);
    END IF;
END $$;

-- 3. Create kiosk_logs table
CREATE TABLE IF NOT EXISTS kiosk_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for kiosk_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kiosk_logs_event_id') THEN
        CREATE INDEX idx_kiosk_logs_event_id ON kiosk_logs(event_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kiosk_logs_timestamp') THEN
        CREATE INDEX idx_kiosk_logs_timestamp ON kiosk_logs(timestamp DESC);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kiosk_logs_action') THEN
        CREATE INDEX idx_kiosk_logs_action ON kiosk_logs(action);
    END IF;
END $$;

-- 5. Add kiosk fields to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS kiosk_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kiosk_token_id UUID;

-- 6. Add kiosk fields to registrations table
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS checked_in_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS checked_in_device VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS kiosk_device_id VARCHAR(255);

-- 7. Create view for active kiosk tokens
CREATE OR REPLACE VIEW active_kiosk_tokens AS
SELECT 
    token_id,
    event_id,
    permissions,
    payment_enabled,
    expires_at,
    created_at,
    last_used_at
FROM kiosk_tokens
WHERE revoked = false 
AND expires_at > NOW();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Kiosk Mode migration completed successfully!';
    RAISE NOTICE 'Created tables: kiosk_tokens, kiosk_logs';
    RAISE NOTICE 'Created view: active_kiosk_tokens';
    RAISE NOTICE 'Added columns to: events, registrations';
END $$;
```

---

## After Running Migration

Reply with "migration done" or "done" and I will:
1. ✅ Verify the tables were created correctly
2. 🧪 Run comprehensive end-to-end tests using the testing subagent
3. 🐛 Fix any issues found
4. ✨ Deliver a fully functional Kiosk Mode feature

---

## Troubleshooting

### Error: "relation already exists"
- ✅ Safe to ignore - means table already exists
- Migration uses `IF NOT EXISTS` so it's idempotent

### Error: "permission denied"
- ❌ Contact Supabase support or check project permissions
- Make sure you're logged in as project owner

### Error: "foreign key constraint"
- ❌ Means `events` table doesn't exist
- Check if you're on the correct database/project

---

## What This Migration Does

### Creates 2 New Tables:
1. **kiosk_tokens** - Stores event-scoped access tokens
   - Each token is tied to one event
   - Has expiration date
   - Can be revoked instantly
   - Tracks permissions (scan, check-in, payment)

2. **kiosk_logs** - Audit trail for all kiosk activity
   - Tracks every scan, check-in, payment
   - Includes device ID and timestamp
   - Useful for analytics and troubleshooting

### Adds Columns to Existing Tables:
- **events**: `kiosk_enabled`, `kiosk_token_id`
- **registrations**: `checked_in_method`, `checked_in_device`, `payment_source`, `kiosk_device_id`

### Creates 1 View:
- **active_kiosk_tokens** - Easy query for valid, non-expired tokens
