# Overtime Management System

## Overview

The overtime management system provides a robust, automated workflow for handling intern overtime hours, including multi-tier log splitting, admin approval, and clear status indicators.

## Key Features

### 1. Automatic Log Splitting
- **Trigger:** When interns clock out after working >9 hours in a day
- **Process:**
  - Regular time: First 9 hours (auto-approved)
  - Overtime: Next 3 hours (9–12, requires admin approval)
  - Extended overtime: >12 hours (requires admin approval)
- **Database:** Creates separate entries in `time_logs` for each tier

### 2. Admin Approval Workflow
- **Location:** Admin Dashboard → Overtime Logs tab
- **Actions:** Approve/Reject overtime and extended overtime requests (individually or in bulk)
- **Status Tracking:** Pending → Approved/Rejected, with timestamp and approver

### 3. Visual Status Indicators
- **Pending:** Yellow badge (⏳ awaiting approval)
- **Approved:** Purple badge (✅ counts toward progress)
- **Rejected:** Gray badge (❌ does not count)

## Technical Implementation

### Core Files
- **API Endpoints:**
  - `/api/admin/overtime` – Get/update overtime logs
  - `/api/admin/migrate-long-logs` – One-time migration for legacy data
  - `/api/admin/check-long-logs` – Check if migration is needed
- **Components:**
  - `OvertimeLogsDashboard` – Admin interface for overtime management
  - `OvertimeDisplay` – Badge/status display for overtime
  - DTR components – Show overtime status in daily records
- **Utilities:**
  - `lib/ui-utils.ts` – Overtime badge config and helpers
  - `lib/data-access.ts` – DB operations for overtime, multi-tier splitting, migration
  - `lib/time-utils.ts` – Time calculations, constants, and formatting
  - `lib/session-utils.ts` – Session grouping, continuous session logic

### Database Schema
```sql
ALTER TABLE time_logs ADD COLUMN log_type VARCHAR(20) DEFAULT 'regular';
ALTER TABLE time_logs ADD COLUMN overtime_status VARCHAR(20);
ALTER TABLE time_logs ADD COLUMN approved_by INTEGER REFERENCES users(id);
ALTER TABLE time_logs ADD COLUMN approved_at TIMESTAMP;
```

## Key Functions & Logic

- **Automatic Splitting (`clockOut` in data-access.ts):**
  - Splits logs >9 hours into regular, overtime (9–12), and extended overtime (>12)
  - Ensures each log is properly categorized and status set
- **Migration Utility (`migrateExistingLongLogs`):**
  - One-time function to process historical logs >9 hours
  - Splits into regular, overtime, and extended overtime as needed
- **Status Management:**
  - `getOvertimeBadgeConfig(status)` – Badge styling
  - `calculateOvertimeStats(logs)` – Aggregate overtime statistics
  - `calculateOvertimeHours(logs, status)` – Hours by status

## Usage Guide

### For Admins
1. **Review Overtime:**
   - Go to Admin Dashboard → Overtime Logs
   - View, filter, and search overtime requests
   - Approve/Reject individually or in bulk
2. **Migration (One-time):**
   - "Split Long Logs" button appears if legacy logs exist
   - Processes all historical logs >9 hours
   - Button disappears after migration
3. **Monitoring Progress:**
   - Only approved overtime/extended overtime counts toward progress
   - Rejected overtime is visible but grayed out
   - Pending overtime shows in yellow

### For Interns
1. **Automatic Processing:**
   - Working >9 hours triggers overtime/extended overtime requests automatically
   - No manual action required
   - Status visible in DTR (Daily Time Record)
2. **Status Indicators:**
   - Yellow: Pending admin approval
   - Purple: Approved (counts toward progress)
   - Gray: Rejected (does not count)

## Configuration

### Constants
```typescript
DAILY_REQUIRED_HOURS = 9 // Max regular hours per day
MAX_OVERTIME_HOURS = 3   // Max standard overtime per day
```

### Status Values
```typescript
overtime_status: "pending" | "approved" | "rejected"
log_type: "regular" | "overtime" | "extended_overtime"
```

## Best Practices
- Use utility functions from `ui-utils.ts` for badge styling
- Centralize overtime logic in `data-access.ts` and `session-utils.ts`
- Keep components focused on display, logic in utilities
- Migration button only appears when needed (prevents unnecessary API calls)
- Batch operations for migration (atomic transactions)
- Efficient filtering and aggregation in queries
- Clear visual distinction between status types
- Responsive design for admin access

## Troubleshooting

### Common Issues
1. **Migration Button Stuck**
   - Check `/api/admin/check-long-logs` endpoint
   - Verify admin permissions
   - Check database connectivity
2. **Overtime Not Splitting**
   - Verify `DAILY_REQUIRED_HOURS` and `MAX_OVERTIME_HOURS` constants
   - Check `clockOut` function logic
   - Ensure proper time calculations
3. **Status Not Updating**
   - Verify admin role permissions
   - Check API endpoint responses
   - Refresh data after status changes

### Debugging
- Console logs in migration functions
- API/network tab for responses
- Database query verification for edge cases

## Future Enhancements
- Email notifications for overtime approval/rejection
- Overtime analytics and reporting
- Custom overtime policies per department
- Integration with payroll systems
