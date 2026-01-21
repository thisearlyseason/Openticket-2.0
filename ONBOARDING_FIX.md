# Onboarding Form Fix for New Organizer Accounts

## Problem
New organizer accounts were not seeing the onboarding form or not having their onboarding data properly saved, resulting in incomplete profiles.

## Root Causes Identified

### Issue 1: Google OAuth Signup Bypass
When users sign up as organizers via Google OAuth, they completely bypass the multi-step onboarding form that collects:
- Business/Organization Name
- Business Type (nonprofit, education, corporate, etc.)
- Event Types

**Impact:** Google OAuth signups had no way to provide this essential organizer information.

### Issue 2: Missing Fields in Email/Password Signup
Even for email/password signups that showed the onboarding form, the collected data wasn't being fully synced to the backend:
- `businessType` and `eventTypes` fields were not included in the signup payload
- Only `businessName` was being sent to the backend

### Issue 3: No Post-Login Onboarding Check
After login, organizers without complete onboarding data were directly sent to the dashboard with no prompt to complete their profile.

## Solutions Implemented

### Fix 1: Redirect Incomplete Profiles to Settings
**File:** `/app/frontend/components/Auth.tsx`

Added a check in `handlePostAuthRedirect` to detect organizers without complete onboarding:
```typescript
if (user.role === 'organizer') {
    const needsOnboarding = !user.businessName || !user.businessType;
    if (needsOnboarding) {
        navigate('/settings?onboarding=true');
    } else {
        navigate('/dashboard');
    }
}
```

### Fix 2: Include Onboarding Fields in Signup
**File:** `/app/frontend/services/storageService.ts`

Modified the signup function to include all onboarding fields in the sync payload:
```typescript
// Include onboarding fields (stored in subscription.settings JSONB)
if (cleanData.businessType) payload.business_type = cleanData.businessType;
if (cleanData.eventTypes) payload.event_types = cleanData.eventTypes;
```

### Fix 3: Onboarding Banner in Settings
**File:** `/app/frontend/components/Settings.tsx`

Added a prominent banner on the Settings page for organizers with incomplete profiles:
- Shows a welcoming message
- Displays checklist of missing information
- Provides a direct action button to complete profile
- Auto-scrolls and focuses on the business name field

The banner appears when:
- User is an organizer AND
- Missing `businessName` OR `businessType`

## User Experience Flow

### For Email/Password Signup (Already Working)
1. Select "Organizer" role
2. Enter credentials
3. **See onboarding form** ← Was appearing but data not saved
4. Fill business details
5. Complete signup ← **Now saves all fields**

### For Google OAuth Signup (New Flow)
1. Click "Sign in with Google" and select "Organizer" role
2. Complete Google authentication
3. **Redirected to Settings with onboarding banner** ← New
4. Complete profile in Settings
5. Start creating events

### For Existing Users (New Flow)
1. Login as organizer
2. If profile incomplete: **Redirected to Settings with onboarding banner** ← New
3. Complete missing information
4. Proceed to dashboard

## Testing Instructions for User

### Test 1: New Google OAuth Signup
1. Go to Login page
2. Switch to "Sign Up" mode
3. Select "Organizer" role
4. Click "Sign in with Google"
5. After authentication, verify:
   - ✅ Redirected to Settings page
   - ✅ See onboarding banner with checklist
   - ✅ Can fill in Business Name and Business Type
   - ✅ After saving, banner disappears

### Test 2: New Email/Password Signup
1. Go to Login page
2. Switch to "Sign Up" mode
3. Select "Organizer" role
4. Fill credentials and continue
5. Fill onboarding form (step 2)
6. Complete signup
7. Check profile in Settings:
   - ✅ Business Name is saved
   - ✅ Business Type is saved
   - ✅ Event Types is saved (if provided)

### Test 3: Existing Organizer with Incomplete Profile
1. Login as an organizer who skipped onboarding
2. Verify:
   - ✅ Redirected to Settings (not Dashboard)
   - ✅ See onboarding banner
   - ✅ Banner lists missing fields
   - ✅ Clicking button scrolls to business name field

## Files Modified
1. `/app/frontend/components/Auth.tsx` - Added onboarding check in post-auth redirect
2. `/app/frontend/services/storageService.ts` - Include onboarding fields in signup
3. `/app/frontend/components/Settings.tsx` - Added onboarding banner

## Status
✅ **All Fixes Implemented** - Ready for user testing
⏳ **Requires Testing** - User should test both OAuth and email signup flows
