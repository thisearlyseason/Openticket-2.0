# 🗄️ Database Migration Guide - Add Missing Columns

## What This Does

This migration adds **31 missing columns** to your `events` table, unlocking all the advanced features of OpenTicket.

---

## 🎯 What You'll Get After Migration

### ✅ New Features Unlocked:

**Event Details:**
- ✅ Event subtitle
- ✅ Event status (draft/published/cancelled)
- ✅ End date & end time
- ✅ Event duration

**Recurring Events:**
- ✅ Recurring event support
- ✅ Multiple date selection
- ✅ 12h/24h time format

**Location:**
- ✅ Online event URLs (Zoom, Google Meet, etc.)
- ✅ Cover image positioning
- ✅ Event photo gallery
- ✅ Event timeline/schedule

**Ticketing:**
- ✅ Custom ticket names
- ✅ Promo codes
- ✅ Tax rates

**Event Management:**
- ✅ Require approval for registrations
- ✅ Custom confirmation messages
- ✅ Refund policy text
- ✅ Advanced schedule configuration

**Marketing:**
- ✅ Event tags
- ✅ Tracking pixels (Facebook, Google)
- ✅ Remarketing campaigns
- ✅ SEO settings

**Communications:**
- ✅ Email notifications
- ✅ Event reminders
- ✅ Broadcast messages

**Organizer Info:**
- ✅ Organizer name
- ✅ Organizer email
- ✅ Organizer phone
- ✅ Organizer website

**Waitlist:**
- ✅ Waitlist configuration

---

## 📋 How to Run the Migration

### Option 1: Using Supabase Dashboard (EASIEST)

**STEP 1: Open Supabase SQL Editor**
1. Go to: https://dcjdurvgkveblvtinoms.supabase.co
2. Log in to your Supabase account
3. Click **"SQL Editor"** in the left sidebar

**STEP 2: Copy the Migration SQL**
1. Open the file: `/app/backend/migrations/V2__add_missing_event_columns.sql`
2. Copy ALL the SQL code

**STEP 3: Run the Migration**
1. In Supabase SQL Editor, click **"New Query"**
2. Paste the SQL code
3. Click **"Run"** button (bottom right)
4. Wait for "Success" message

**STEP 4: Verify**
1. Click **"Table Editor"** in left sidebar
2. Select **"events"** table
3. Scroll through columns - you should see all the new fields!

---

### Option 2: Using Command Line (Advanced)

If you have `psql` installed:

```bash
# Get your database connection string from Supabase
# Project Settings > Database > Connection String

psql "postgresql://postgres:[PASSWORD]@db.dcjdurvgkveblvtinoms.supabase.co:5432/postgres" < /app/backend/migrations/V2__add_missing_event_columns.sql
```

---

## ✅ After Running Migration

### STEP 1: Update Backend Code

The backend is currently limited to 16 fields. After migration, update it to use all fields:

**File**: `/app/backend/controllers/eventController.js`

**Replace lines 28-42** with:
```javascript
// ✅ All fields now available after migration
const ALLOWED_FIELDS_TO_SAVE = [
    'title', 'subtitle', 'description', 'category', 'event_type',
    'date', 'time', 'end_date', 'end_time', 'duration',
    'is_recurring', 'recurring_dates', 'time_format', 'timeline',
    'location', 'venue_name', 'online_url',
    'image_url', 'cover_image_position', 'gallery',
    'price_type', 'price', 'ticket_name', 'capacity',
    'promo_codes', 'tax_rate', 'absorb_fees',
    'requires_approval', 'confirmation_message', 'refund_policy',
    'schedule_config', 'tags', 'tracking_pixels', 'remarketing', 'seo',
    'notifications', 'reminders', 'broadcasts',
    'organizer', 'organizer_email', 'organizer_phone', 'organizer_website',
    'visibility', 'is_draft', 'status', 'waitlist_config', 'currency'
];

const safeData = {};
ALLOWED_FIELDS_TO_SAVE.forEach(field => {
    if (eventData[field] !== undefined) {
        safeData[field] = eventData[field];
    }
});

// Set defaults
if (safeData.is_draft === undefined) safeData.is_draft = true;
if (!safeData.status) safeData.status = 'draft';
if (!safeData.visibility) safeData.visibility = 'public';
if (!safeData.price_type) safeData.price_type = 'paid';
```

### STEP 2: Restart Backend
```bash
sudo supervisorctl restart backend
```

### STEP 3: Test Event Creation
1. Hard refresh browser (`Ctrl + Shift + R`)
2. Create a new event with advanced features:
   - Add subtitle
   - Set end date/time
   - Add online URL
   - Set organizer info
3. All features should now work!

---

## 🔄 Rollback (If Needed)

If something goes wrong, you can remove the columns:

```sql
-- Only run this if you need to undo the migration
ALTER TABLE events
DROP COLUMN IF EXISTS subtitle,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS end_date,
-- ... (add all other columns)
```

---

## 📊 Summary

**Before Migration:**
- ✅ 16 working fields
- ❌ 31 missing fields
- ❌ Limited functionality

**After Migration:**
- ✅ 47 total fields
- ✅ All advanced features
- ✅ Full OpenTicket functionality

---

## ❓ Need Help?

If you encounter any errors:
1. Screenshot the error from Supabase SQL Editor
2. Share the error message
3. I'll help you troubleshoot

**Estimated Time**: 2-5 minutes  
**Risk Level**: Low (migration only adds columns, doesn't modify existing data)

---

**Ready to unlock all features? Run the migration now!** 🚀
