# Fraud Prevention & Security Measures

## Overview
This document describes the fraud prevention and security measures implemented for the ticket transfer system.

## 🛡️ Fraud Prevention Rules

### 1. Rate Limiting (SUSPICIOUS_TRANSFER_RATE)
**Purpose:** Prevent spam and fraudulent transfer attempts

**Implementation:**
- **Limit:** Maximum 5 transfer attempts per ticket within 1 hour
- **Detection:** Checks `ticket_transfers` table for transfers with same `ticket_key` in the last hour
- **Action:** Blocks transfer and logs suspicious activity with severity: `warning`
- **Location:** `/app/backend/controllers/registrationController.js` (lines 760-779)

**Logged Data:**
```json
{
  "action": "SUSPICIOUS_TRANSFER_RATE",
  "entity_type": "ticket",
  "entity_id": "ticket_key",
  "user_id": "sender_user_id",
  "user_email": "sender_email",
  "details": {
    "attempts": 5,
    "recipientEmail": "target@example.com"
  },
  "severity": "warning"
}
```

### 2. Circular Transfer Detection (SUSPICIOUS_CIRCULAR_TRANSFER)
**Purpose:** Prevent A→B→A circular transfer schemes within 24 hours

**Implementation:**
- **Rule:** If ticket is being transferred back to the original owner within 24 hours, block it
- **Detection:** Checks transfer history to see if recipient was previously the sender
- **Action:** Blocks transfer and logs suspicious activity with severity: `warning`
- **Location:** `/app/backend/controllers/registrationController.js` (lines 784-803)

**Logged Data:**
```json
{
  "action": "SUSPICIOUS_CIRCULAR_TRANSFER",
  "entity_type": "ticket",
  "entity_id": "ticket_key",
  "user_id": "sender_user_id",
  "user_email": "sender_email",
  "details": {
    "recipientEmail": "original_owner@example.com",
    "originalOwner": "original_owner@example.com"
  },
  "severity": "warning"
}
```

## 📊 Security Audit Logging

### Database Schema
**Table:** `security_audit_logs`

**Columns:**
- `id` (UUID, primary key)
- `created_at` (timestamp)
- `action` (text) - e.g., 'TRANSFER_INITIATED', 'TRANSFER_COMPLETED', 'SUSPICIOUS_TRANSFER_RATE'
- `entity_type` (text) - 'ticket', 'registration', 'event', 'user'
- `entity_id` (text) - ID of the affected entity
- `user_id` (text) - User who performed the action
- `user_email` (text) - User's email
- `details` (JSONB) - Flexible JSON for action-specific data
- `severity` (text) - 'info', 'warning', 'critical'
- `ip_address` (text, optional)
- `user_agent` (text, optional)

### Logged Actions

1. **TRANSFER_INITIATED**
   - Severity: `info`
   - Triggered when: User initiates a ticket transfer
   - Details: transferId, recipientEmail, registrationId, eventId

2. **TRANSFER_COMPLETED**
   - Severity: `info`
   - Triggered when: Transfer is finalized after undo window expires
   - Details: transferId, recipientEmail, recipientUserId, recipientRegistrationId

3. **TRANSFER_UNDONE**
   - Severity: `info`
   - Triggered when: User cancels transfer within undo window
   - Details: transferId, reason

4. **SUSPICIOUS_TRANSFER_RATE**
   - Severity: `warning`
   - Triggered when: More than 5 transfer attempts in 1 hour
   - Details: attempts, recipientEmail

5. **SUSPICIOUS_CIRCULAR_TRANSFER**
   - Severity: `warning`
   - Triggered when: Ticket being transferred back to original owner within 24 hours
   - Details: recipientEmail, originalOwner

## 🔍 Super Admin Monitoring

### Security Dashboard
**Location:** Super Admin Panel → Security Tab

**Features:**
1. **Summary Cards:**
   - Total Suspicious Events
   - Rate Limit Violations count
   - Circular Transfers count

2. **Activity Table:**
   - Timestamp of each suspicious event
   - Action type with visual indicators
   - Severity badges (Info/Warning/Critical)
   - User information (email, ID)
   - Entity details (type, ID)
   - Expandable JSON details

3. **Filters:**
   - Filter by severity (All/Info/Warning/Critical)
   - Real-time refresh capability

4. **Fraud Detection Rules Display:**
   - Visual explanation of each rule
   - Thresholds and time windows
   - Actions taken when triggered

### API Endpoint
**GET** `/api/admin/security-audit-logs/suspicious`

**Query Parameters:**
- `severity` (optional): 'info', 'warning', or 'critical'

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "created_at": "2026-01-12T...",
      "action": "SUSPICIOUS_TRANSFER_RATE",
      "entity_type": "ticket",
      "entity_id": "TKT-123",
      "user_id": "user_123",
      "user_email": "user@example.com",
      "details": {...},
      "severity": "warning"
    }
  ],
  "count": 5
}
```

## 🚀 Implementation Status

### ✅ Completed
1. Security audit logs table created (`/app/backend/migrations/create_security_audit_logs_table.sql`)
2. All `audit_logs` references updated to `security_audit_logs` in transfer functions
3. Rate limiting fraud detection implemented and logging correctly
4. Circular transfer detection implemented and logging correctly
5. Transfer initiation logging
6. Transfer completion logging
7. Transfer undo logging
8. Super Admin Security tab UI created
9. Backend API endpoint for fetching suspicious activities
10. Severity-based filtering

### 🎯 Future Enhancements
1. IP address tracking for security logs
2. User agent tracking
3. Email notifications to Super Admin when critical events occur
4. Automatic temporary user bans after multiple fraud attempts
5. Machine learning-based anomaly detection
6. Geographic location tracking for suspicious patterns
7. Integration with external fraud detection services

## 📝 Database Migration Required

**File:** `/app/backend/migrations/create_security_audit_logs_table.sql`

**To Apply:** Run this SQL in Supabase SQL Editor

This creates:
- `security_audit_logs` table with proper schema
- Indexes for efficient querying
- Row-level security policies
- Function to get suspicious activity summary

**IMPORTANT:** This migration must be run before the fraud prevention system will work correctly!

## 🧪 Testing Recommendations

### Backend Tests
1. Test rate limiting by attempting 6 transfers in quick succession
2. Test circular transfer detection by transferring A→B→A within 24 hours
3. Verify logs are created in `security_audit_logs` table
4. Test API endpoint with different severity filters

### Frontend Tests
1. Navigate to Super Admin Panel → Security tab
2. Verify summary cards display correct counts
3. Test severity filter dropdown
4. Test refresh button
5. Verify expandable details work correctly

### E2E Tests
1. Perform legitimate transfers and verify they succeed
2. Perform rate-limited transfers and verify blocking
3. Perform circular transfers and verify blocking
4. Check Super Admin UI updates with new suspicious activities

## 🔒 Security Considerations

1. **Row-Level Security (RLS):** Enabled on `security_audit_logs` table
2. **Admin-Only Access:** Only Super Admins can view suspicious activities
3. **Service Role Inserts:** System can insert logs without user authentication
4. **Audit Trail:** All suspicious activities are permanently logged for compliance
5. **Privacy:** User emails are logged but marked as sensitive data

## 📚 Related Files

### Backend
- `/app/backend/controllers/registrationController.js` - Transfer logic with fraud detection
- `/app/backend/routes/adminRoutes.js` - Security audit logs API endpoint
- `/app/backend/migrations/create_security_audit_logs_table.sql` - Database schema

### Frontend
- `/app/components/SuperAdminDashboard.tsx` - Security tab UI
- Lines 198-202: Suspicious activity state
- Lines 252-276: loadSuspiciousActivities function
- Lines 2475-2656: Security tab UI component

## 🎓 Usage Guide for Super Admins

1. **Access Security Tab:**
   - Click your Super Admin button in the navigation
   - Select "Security" tab

2. **Monitor Activity:**
   - Review the summary cards for quick overview
   - Scan the activity table for recent suspicious events
   - Use severity filter to focus on warnings/critical events

3. **Investigate Issues:**
   - Click "View Details" to see full event data
   - Note the user_id and user_email for potential follow-up
   - Check timestamps to identify patterns

4. **Take Action:**
   - Contact users engaging in suspicious behavior
   - Temporarily suspend accounts if needed (via Users tab)
   - Document patterns for future rule improvements

## 📞 Support

For questions or issues related to the fraud prevention system, contact the development team or refer to the main README.
