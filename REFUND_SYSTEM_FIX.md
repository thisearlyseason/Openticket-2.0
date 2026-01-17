# Refund System Fix - Implementation Plan

## Issues Identified

### 1. **Individual Ticket Refund Selection** ❌
- **Problem**: UI shows refund button but doesn't properly select individual tickets
- **Location**: AttendeeManager.tsx dropdown menu
- **Impact**: Users can't refund single tickets, only full orders

### 2. **Fake "Bulk Refunds Processed" Message** ❌ CRITICAL
- **Problem**: Line 315 shows success toast WITHOUT waiting for Stripe confirmation
- **Location**: `handleBulkRefund` function
- **Impact**: False positive - user thinks refund succeeded when it might have failed

### 3. **Single Ticket Refund - Same Issue** ❌ CRITICAL
- **Problem**: Line 584 shows "Refund processed successfully!" before backend confirms
- **Location**: `processRefund` function  
- **Impact**: No validation that Stripe actually processed the refund

### 4. **No Stripe Confirmation Tracking** ❌
- **Problem**: Frontend doesn't check backend response for Stripe refund ID
- **Impact**: Can't verify if Stripe refund actually succeeded

### 5. **No Error Display from Backend** ❌
- **Problem**: Backend returns `stripeError` and `warning` but frontend ignores them
- **Location**: processRefund & handleBulkRefund functions
- **Impact**: Users don't see why refunds fail

### 6. **Refund Amount Not Calculated from Actual Ticket Price** ⚠️
- **Problem**: Line 530 uses tier price, not actual paid amount
- **Location**: `handleOpenRefundModal`
- **Impact**: Refund amount may be wrong if ticket had discount/promo

### 7. **No Multi-Select for Tickets** ❌
- **Problem**: Can't select multiple individual tickets to refund together
- **Impact**: Must refund one-by-one or do full order

### 8. **Pending Tickets Not Displayed** ❌
- **Problem**: No visibility into why tickets are pending
- **Impact**: Can't diagnose payment issues

## Implementation Plan

### Phase 1: Backend Response Handling (HIGH PRIORITY)

**File**: `/app/components/AttendeeManager.tsx`

#### Fix 1.1: Update `processRefund` to validate Stripe response
```typescript
const processRefund = async () => {
    // ... existing validation ...
    
    try {
        let response;
        
        if (item.itemType === 'addon') {
            response = await StorageService.refundAddon(reg.id, item.ticketIndex, refundReason);
        } else if (refundMode === 'order') {
            response = await StorageService.refundRegistration(reg.id, [], refundReason);
        } else {
            // ... ticket logic ...
            response = await StorageService.refundRegistration(reg.id, updatedTickets, refundReason);
        }
        
        // CHECK RESPONSE
        if (response.stripeError) {
            showToast(`⚠️ ${response.warning || response.stripeError}`, "error");
        } else if (response.stripeRefundId) {
            showToast(`✅ Refund processed! Stripe Refund ID: ${response.stripeRefundId}`, "success");
        } else {
            showToast("✅ Refund marked in system (no Stripe payment)", "success");
        }
        
        setShowRefundModal(null);
        loadData();
    } catch (e: any) {
        showToast("❌ Refund failed: " + e.message, "error");
    }
};
```

#### Fix 1.2: Update `handleBulkRefund` to track successes/failures
```typescript
const handleBulkRefund = async () => {
    try {
        let successCount = 0;
        let failCount = 0;
        let errors: string[] = [];
        
        for (const regId of Object.keys(groups)) {
            try {
                // ... existing logic ...
                const response = await StorageService.refundRegistration(...);
                
                if (response.stripeError) {
                    failCount++;
                    errors.push(`${regId}: ${response.stripeError}`);
                } else {
                    successCount++;
                }
            } catch (e: any) {
                failCount++;
                errors.push(`${regId}: ${e.message}`);
            }
        }
        
        if (failCount === 0) {
            showToast(`✅ ${successCount} refund(s) processed successfully!`, "success");
        } else {
            showToast(`⚠️ ${successCount} succeeded, ${failCount} failed. Check console for details.`, "warning");
            console.error('Bulk refund errors:', errors);
        }
        
        await loadData();
        setSelectedIds(new Set());
    } catch (e: any) {
        showToast("❌ Bulk refund failed: " + e.message, "error");
    }
};
```

### Phase 2: Refund Amount Accuracy

#### Fix 2.1: Calculate refund amount from actual registration data
```typescript
const handleOpenRefundModal = (item: AttendeeItem) => {
    if (item.status === 'refunded') return window.alert("This ticket is already refunded.");
    
    // Get actual paid price from registration
    const regList = await StorageService.getRegistrations(event.id);
    const reg = regList.find(r => r.id === item.regId);
    
    let actualPrice = item.price; // Use the price stored in AttendeeItem
    
    if (reg && reg.tickets && reg.tickets[item.ticketIndex]) {
        actualPrice = reg.tickets[item.ticketIndex].pricePerTicket || actualPrice;
    }
    
    setRefundAmount(actualPrice);
    setRefundReason('Requested by attendee');
    setRefundMode('ticket');
    setShowRefundModal(item);
};
```

### Phase 3: Pending Tickets Display

#### Fix 3.1: Add Pending Tickets Section
```typescript
// In AttendeeManager, add new section to display pending tickets
const pendingRegistrations = allRegistrations.filter(r => r.paymentStatus === 'pending');

// Display section with:
// - Registration ID
// - Attendee name/email
// - Stripe payment intent status (call backend to check)
// - Time since creation
// - Action buttons: Check Status, Cancel, Convert to Paid
```

### Phase 4: Delete Reliability

#### Fix 4.1: Improve delete handling
```typescript
const handleDeleteGuest = async (item: AttendeeItem) => {
    if (item.status === 'paid') {
        showToast("Cannot delete paid ticket. Please refund first.", "error");
        return;
    }
    
    showConfirm({
        title: "Delete Guest?",
        message: `Delete ${item.name}? This cannot be undone.`,
        confirmText: "Delete",
        variant: "danger",
        onConfirm: async () => {
            try {
                const response = await StorageService.deleteAttendee(item.regId, item.ticketIndex);
                
                if (response.success) {
                    await loadData();
                    showToast(`${item.name} deleted successfully`, "success");
                } else {
                    throw new Error(response.error || 'Unknown error');
                }
            } catch (e: any) {
                showToast("Failed to delete: " + e.message, "error");
            }
        }
    });
};
```

## Storage Service Updates

**File**: `/app/services/storageService.ts`

### Update refund functions to return response
```typescript
refundRegistration: async (id: string, updatedTickets: PurchasedTicket[], reason: string) => {
    if (isOffline) return { success: false, error: 'Offline mode' };
    const response = await postSupabase(`/registrations/${id}/refund`, 'POST', { tickets: updatedTickets, reason });
    clearCache('regs');
    return response; // Return full response with stripeRefundId, stripeError, etc.
},

refundAddon: async (id: string, addonIndex: number, reason: string) => {
    if (isOffline) return { success: false, error: 'Offline mode' };
    const response = await postSupabase(`/registrations/${id}/refund-addon`, 'POST', { addonIndex, reason });
    clearCache('regs');
    return response;
},
```

## Success Criteria Checklist

- [ ] ✅ Single ticket refunds work via Stripe
- [ ] ✅ Full order refunds work via Stripe
- [ ] ✅ Bulk refunds process each item through Stripe
- [ ] ✅ No success message without Stripe confirmation
- [ ] ✅ Stripe refund ID displayed in success message
- [ ] ✅ Stripe errors surfaced to user
- [ ] ✅ Refund amount matches actual paid price
- [ ] ✅ Pending tickets section shows payment status
- [ ] ✅ Delete prevented for paid tickets
- [ ] ✅ Delete errors surfaced clearly

