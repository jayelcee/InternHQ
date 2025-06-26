# Overtime Management System

## Overview

The overtime management system provides a complete workflow for handling intern overtime hours, including automatic splitting of long logs, admin approval processes, and visual status indicators.

## Key Features

### 1. Automatic Log Splitting
- **Trigger**: When interns clock out after working >9 hours in a day
- **Process**: System automatically splits the log into:
  - Regular time: First 9 hours (automatically approved)
  - Overtime: Remaining hours (requires admin approval)
- **Database**: Creates separate entries in `time_logs` table

### 2. Admin Approval Workflow
- **Location**: Admin Dashboard → Overtime Logs tab
- **Actions**: Approve/Reject pending overtime requests
- **Status Tracking**: Pending → Approved/Rejected with timestamp and approver

### 3. Visual Status Indicators
- **Pending**: Yellow badges (⏳ awaiting approval)
- **Approved**: Purple badges (✅ counts toward progress)
- **Rejected**: Gray badges (❌ doesn't count toward progress)

## Technical Implementation

### Core Files

#### API Endpoints
- `/api/admin/overtime` - Get/Update overtime logs
- `/api/admin/migrate-long-logs` - One-time migration for existing data
- `/api/admin/check-long-logs` - Check if migration is needed

#### Components
- `OvertimeLogsDashboard` - Admin interface for overtime management
- `OvertimeDisplay` - Reusable component for overtime badge display
- DTR components - Show overtime status in daily time records

#### Utilities
- `lib/ui-utils.ts` - Overtime status configuration and helper functions
- `lib/data-access.ts` - Database operations for overtime management
- `lib/time-utils.ts` - Time calculation utilities

### Database Schema

```sql
-- Overtime-related fields in time_logs table
ALTER TABLE time_logs ADD COLUMN log_type VARCHAR(20) DEFAULT 'regular';
ALTER TABLE time_logs ADD COLUMN overtime_status VARCHAR(20);
ALTER TABLE time_logs ADD COLUMN approved_by INTEGER REFERENCES users(id);
ALTER TABLE time_logs ADD COLUMN approved_at TIMESTAMP;
```

### Key Functions

#### Automatic Splitting (`clockOut` in data-access.ts)
```typescript
// Automatically splits logs >9 hours during clock-out
if (totalHours > DAILY_REQUIRED_HOURS) {
  // Create regular entry (9 hours)
  // Create overtime entry (remaining hours)
}
```

#### Migration Utility (`migrateExistingLongLogs`)
```typescript
// One-time function to process historical long logs
// Splits existing >9 hour logs into regular + overtime
```

#### Status Management
```typescript
// Utility functions for consistent overtime handling
getOvertimeBadgeConfig(status) // Badge styling
calculateOvertimeStats(logs)   // Aggregate statistics
calculateOvertimeHours(logs, status) // Hours by status
```

## Usage Guide

### For Admins

1. **Reviewing Overtime**
   - Navigate to Admin Dashboard → Overtime Logs tab
   - View pending requests with intern details and hours
   - Use Approve/Reject buttons for each request

2. **Migration (One-time)**
   - "Split Long Logs" button appears only when needed
   - Processes historical data to split long logs
   - Button disappears after all logs are processed

3. **Monitoring Progress**
   - Only approved overtime counts toward internship progress
   - Rejected overtime is visible but grayed out
   - Pending overtime shows in yellow (awaiting decision)

### For Interns

1. **Automatic Processing**
   - Work hours >9 hours automatically create overtime request
   - No action needed from intern
   - Can view status in DTR (Daily Time Record)

2. **Status Understanding**
   - Yellow: Pending admin approval
   - Purple: Approved (counts toward progress)
   - Gray: Rejected (doesn't count toward progress)

## Configuration

### Constants
```typescript
DAILY_REQUIRED_HOURS = 9 // Maximum regular hours per day
```

### Status Values
```typescript
overtime_status: "pending" | "approved" | "rejected"
log_type: "regular" | "overtime"
```

## Best Practices

### Code Organization
- Use utility functions from `ui-utils.ts` for consistent styling
- Centralize overtime logic in data-access functions
- Keep components focused on display, logic in utilities

### Performance
- Migration button only appears when needed (prevents unnecessary API calls)
- Batch operations for migration (atomic transactions)
- Efficient filtering and aggregation in queries

### User Experience
- Clear visual distinction between status types
- Informative badges with proper color coding
- Responsive design for mobile admin access

## Troubleshooting

### Common Issues

1. **Migration Button Stuck**
   - Check `/api/admin/check-long-logs` endpoint
   - Verify admin permissions
   - Check for database connectivity

2. **Overtime Not Splitting**
   - Verify `DAILY_REQUIRED_HOURS` constant
   - Check `clockOut` function logic
   - Ensure proper time calculations

3. **Status Not Updating**
   - Verify admin role permissions
   - Check API endpoint responses
   - Refresh data after status changes

### Debugging
- Console logs in migration functions
- API response checking in network tab
- Database query verification for edge cases

## Future Enhancements

- Email notifications for overtime approval/rejection
- Bulk approval/rejection for multiple requests
- Overtime analytics and reporting
- Custom overtime policies per department
- Integration with payroll systems
