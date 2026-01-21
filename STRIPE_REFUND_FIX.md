# Stripe Refund Error Display Fix

## Problem
When Stripe refunds fail, the user receives a generic error message:
```
Backend POST error: 400 No status text - Stripe refund failed
```

The actual Stripe error details (error code, type, and diagnostic information) were being lost in transit from backend to frontend.

## Root Cause
The `postSupabase` function in `/app/frontend/services/storageService.ts` was catching non-OK responses and throwing a generic Error, which prevented the frontend from accessing the structured error response containing:
- `stripeError`: The specific Stripe API error message
- `stripeCode`: The Stripe error code (e.g., `charge_already_refunded`)
- `stripeType`: The Stripe error type
- `diagnostics`: Detailed debugging information

## Solution
Modified `postSupabase` to return structured error responses instead of throwing them when the response contains detailed error fields.

**Key Change:**
```typescript
// Before: Always threw an Error for non-OK responses
if (!res.ok) {
    let errorMsg = `Backend POST error: ${res.status}...`;
    throw new Error(errorMsg);
}

// After: Return structured errors for detailed error responses
if (!res.ok) {
    const errorBody = await res.json();
    
    // For structured error responses, return the full error object
    if (errorBody.error || errorBody.stripeError || errorBody.diagnostics) {
        return errorBody;  // Frontend can now access all error fields
    }
    
    // For simple errors, still throw
    throw new Error(errorBody.error || ...);
}
```

## Testing Instructions for User
1. Navigate to an event's "Guest List" page
2. Click "Refund" on a paid ticket
3. Attempt to process the refund
4. If the refund fails, you should now see:
   - The specific Stripe error message
   - The error code (if applicable)
   - Any diagnostic information

**Example of improved error message:**
```
❌ Refund Failed

Stripe refund failed

Stripe Error: This charge has already been fully refunded.

💡 This payment has already been refunded in Stripe.
```

## What to Look For
- Check the browser console for detailed error logs including:
  - `[Refund] Diagnostics:` - Frontend diagnostics
  - `[Refund] ❌ Stripe API error:` - Backend Stripe error details
- The error message should now include the actual Stripe API error, not just a generic message

## Files Modified
- `/app/frontend/services/storageService.ts` - Enhanced error handling in `postSupabase` function

## Status
✅ **Fix Implemented** - Ready for user testing
⏳ **Requires Manual Testing** - User needs to trigger a refund to see the detailed error
