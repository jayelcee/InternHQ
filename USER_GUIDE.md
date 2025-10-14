# InternHQ User Guide

Welcome to InternHQ! This guide will help you understand how to use the system for intern time tracking, overtime management, and related features. It is designed for both interns and administrators.

---

## Table of Contents
1. Getting Started
2. Logging In
3. Dashboard Overview
4. Time Tracking
   - Clocking In & Out
   - Overtime & Extended Overtime
   - Overtime Confirmation & Discarding
   - Viewing Your Logs
5. Overtime Requests
   - How Overtime is Handled
   - Status Indicators
6. Edit Log Requests
7. Internship Completion
8. Profile Management
9. Admin Features
   - Dashboard
   - Managing Interns
   - Approving Overtime
   - Reviewing Edit Requests
   - Completion Requests
10. Best Practices & Tips
11. FAQ & Troubleshooting

---

## 1. Getting Started
- Access InternHQ via your organization’s provided URL.
- Use your assigned email and password to log in.

## 2. Logging In
- Go to the login page (`/api/auth/login` or the main login screen).
- Enter your credentials. If you forget your password, contact your admin.
- After logging in, you will be redirected to your dashboard.

## 3. Dashboard Overview
### For Interns
- **Dashboard:** Quick summary of your attendance and progress.
- **Daily Time Record:** View and manage your daily logs, including overtime status.
- **Completion:** Request and track internship completion.
- **Profile:** View and update your personal and emergency information.

### For Admins
- **Dashboard:** Overview of intern activity and pending actions.
- **Manage Interns:** Add, edit, or remove interns.
- **Overtime Requests:** Review and approve/reject overtime and extended overtime.
- **Edit Log Requests:** Review and process time log edit requests.
- **Completion Requests:** Review and approve internship completion requests.

## 4. Time Tracking
### Clocking In & Out
- Use the **Time Tracking** section on your dashboard.
- Click **Clock In** at the start of your workday.
- Click **Clock Out** at the end of your workday.
- If you work more than 9 hours, the system will automatically split your log into regular, overtime (9–12h), and extended overtime (>12h) entries.
- All time is tracked in UTC and displayed in your local time.

### Overtime & Extended Overtime
- **Regular Time:** Up to 9 hours per day (auto-approved).
- **Overtime:** 9–12 hours per day (requires admin approval).
- **Extended Overtime:** Over 12 hours per day (requires admin approval).
- Overtime and extended overtime are automatically detected and split by the system—no manual request needed.
- Only approved overtime/extended overtime counts toward your internship progress.

### Overtime Confirmation & Discarding
- When you clock out and overtime or extended overtime is detected, a confirmation dialog will appear.
- You can:
  - **Confirm Overtime:** If you really worked overtime, confirm and provide a note describing your overtime activity. This helps admins review and approve your request.
  - **Discard Overtime:** If you forgot to clock out and did not actually work overtime, you can discard the unintentional overtime. Only your regular hours will be saved.
- This checkpoint helps prevent accidental overtime entries and ensures accurate records.

### Viewing Your Logs
- Go to **Daily Time Record** to see your time entries.
- Overtime and extended overtime entries are clearly labeled with status badges:
  - **Pending (Yellow):** Awaiting admin approval
  - **Approved (Purple):** Counts toward your progress
  - **Rejected (Gray):** Does not count toward your progress

## 5. Overtime Requests
### How Overtime is Handled
- When you work more than 9 hours, the system creates separate entries for regular, overtime, and extended overtime as needed.
- Overtime and extended overtime require admin approval to count toward your internship progress.
- Admins can approve/reject overtime individually or in bulk.
- You can always see the status of your overtime in your DTR.

### Status Indicators
- **Pending:** Yellow badge (⏳ awaiting approval)
- **Approved:** Purple badge (✅ counts toward progress)
- **Rejected:** Gray badge (❌ does not count)

## 6. Edit Log Requests
- If you need to correct a time log, use the **Edit Log Requests** feature.
- Submit an edit request specifying the correction needed (single or multiple logs).
- Admins will review and approve or reject your request.
- You can track the status of your edit requests in your dashboard.

## 7. Internship Completion
- When you have completed your required hours, use the **Completion** section to request completion.
- Admins will review your progress and approve your completion.
- You can view your completion status in the same section.

## 8. Profile Management
- Go to the **Profile** section to view and update your personal and emergency contact information.
- Keep your details up to date for safety and communication.

## 9. Admin Features
### Dashboard
- See an overview of intern activity and pending requests.

### Managing Interns
- View, add, or remove interns from the **Manage Interns** section.
- Edit intern profiles and details.

### Approving Overtime
- Go to **Overtime Requests** to review, approve, or reject overtime/extended overtime entries.
- Use bulk actions for efficient management.
- Run the migration tool if prompted to split legacy long logs (one-time action).

### Reviewing Edit Requests
- Use **Edit Log Requests** to review and process time log edit requests (single or continuous sessions).

### Completion Requests
- Use **Completion Requests** to review and approve internship completion requests from interns.

## 10. Best Practices & Tips
- Always clock in and out at the correct times to ensure accurate records.
- If you forget to clock out, use the overtime confirmation dialog to discard unintentional overtime.
- If you really worked overtime, confirm it and provide a clear note about your overtime activity.
- Overtime is only credited after admin approval—check your DTR for status.
- Keep your profile and emergency contact information up to date.
- For admins: Use bulk actions and migration tools for efficient management.
- All times are stored in UTC and displayed in your local timezone.
- The system uses truncation (not rounding) for time calculations for accuracy.

## 11. FAQ & Troubleshooting
- **Why is my overtime not approved?**
  - Overtime must be reviewed by an admin. Check the status badge for updates.
- **How do I fix a wrong time log?**
  - Submit an edit request via the Edit Log Requests section.
- **Why can’t I clock in?**
  - Ensure you are not already clocked in. If issues persist, contact your admin.
- **What if I forget to clock out?**
  - Use the overtime confirmation dialog to discard unintentional overtime, or contact your admin/submit an edit request to correct your log.
- **How do I know if I’ve completed my internship?**
  - Check your progress and use the Completion section when eligible.
- **Migration button is stuck (admins):**
  - Check the migration status in Overtime Requests, verify permissions, and database connectivity.
- **Overtime not splitting:**
  - Ensure you are clocking out after 9 hours. If issues persist, contact your admin.
- **Status not updating:**
  - Refresh your dashboard or contact your admin if the status remains unchanged after approval.

---

For further assistance, contact your system administrator or refer to the in-app help sections.
