# InternHQ Codebase Documentation

## Architecture Overview

InternHQ is a Next.js application for intern time tracking and administration.

### Directory Structure

```
app/                    # Next.js App Router
├── api/               # API routes (auth, time-logs, admin, profile, etc.)
├── globals.css        # Global styles
├── layout.tsx         # Root layout
└── page.tsx           # Home page

components/             # Reusable UI components
├── ui/                # shadcn/ui components
├── admin/             # Admin-specific components
├── intern/            # Intern-specific components
├── daily-time-record.tsx
├── time-tracking.tsx
├── overtime-tracking.tsx
├── this-week-logs.tsx
└── document-viewer.tsx

lib/                    # Utility libraries
├── api-middleware.ts  # API middleware (auth, error handling)
├── auth.ts            # Auth utilities
├── database.ts        # DB types/connection
├── data-access.ts     # DB operations
├── time-utils.ts      # Time calculations
├── ui-utils.ts        # UI utilities
└── utils.ts           # General utilities

contexts/               # React contexts
└── auth-context.tsx   # Authentication context
```

## Core Utilities

### API Middleware (`lib/api-middleware.ts`)
- `withAuth()` – Role-based authentication
- `withAdminOrSelfAccess()` – Admin/self-access control
- `handleApiError()` – Consistent error handling

### Time Utilities (`lib/time-utils.ts`)
- `calculateTimeWorked()` – Core time calculation (truncation, not rounding)
- `calculateInternshipProgress()` – Progress tracking
- `getTruncatedDecimalHours()` – Decimal hour precision
- `calculateDurationWithEditRequests()` – Accurate duration with edit request support
- `calculateTimeStatistics()` – Unified time stats (regular, overtime, extended overtime)
- `getContinuousTime()` – Continuous session calculation
- Date/time formatting helpers
- Multi-tier overtime/extended overtime logic

### UI Utilities (`lib/ui-utils.ts`)
- `TimeLogDisplay` – Unified time log interface
- `useAsyncAction()` – Loading state management
- `groupLogsByDate()` – Log grouping for tables
- `getTimeBadgeConfig()` – Badge styling
- `fetchWithErrorHandling()` – Safe fetch wrapper

### Session Utilities (`lib/session-utils.ts`)
- `processTimeLogSessions()` – Group logs into continuous/multi-tier sessions
- `getTimeBadgeProps()` – Consistent badge display for all session types
- `getDurationBadgeProps()` – Duration badge styling
- `processLogsForContinuousEditing()` – Edit dialog session grouping

## Data Flow

### Authentication
1. User logs in via `/api/auth/login`
2. JWT-like token stored in httpOnly cookie
3. `withAuth()` middleware validates requests
4. `AuthContext` manages client-side state

### Time Tracking
1. Clock in/out via `/api/time-logs/clock-in|clock-out`
2. Data stored in PostgreSQL with status tracking
3. Real-time calculations using `time-utils` and `session-utils`
4. UI updates via React state

### Admin Operations
- Admin routes use `withAuth(request, "admin")`
- Intern management: `/api/admin/interns`
- Project assignments: `/api/admin/projects`
- Statistics: `/api/admin/stats`
- Overtime management: `/api/admin/overtime`, `/api/admin/migrate-long-logs`, `/api/admin/check-long-logs`
- Edit log requests: `/api/admin/time-log-edit-requests`

## Database Schema

### Core Tables
- `users` – User accounts (interns/admins)
- `time_logs` – Time tracking entries (regular, overtime, extended overtime)
- `user_profiles` – Extended user info
- `internship_programs` – Program details
- `schools` – Educational institutions
- `departments` – Departments
- `projects` – Work projects
- `intern_project_assignments` – Project assignments

**Features:**  
- Automatic timestamp updates (triggers)  
- UUID primary keys  
- Foreign key constraints  
- Indexes for performance

## Component Patterns

- **Time Calculations:** Use `time-utils.ts`
- **API Calls:** Use `fetchWithErrorHandling()`
- **Loading States:** Use `useAsyncAction()`
- **Time Display:** Use `TimeLogDisplay`
- **Badge Styling:** Use `getTimeBadgeConfig()`
- **Session Grouping:** Use `session-utils.ts` for continuous/multi-tier sessions

### Key Components
- `DailyTimeRecord` – Time log table with filtering and overtime status
- `TimeTracking` – Manual and overtime tracking (regular, overtime, extended overtime)
- `OvertimeTracking` – Overtime/extended overtime management for interns
- `ThisWeekLogs` – Weekly summary display
- `EditTimeLogDialog` – Edit and review time log requests
- `CompletionRequestButton` – Request internship completion
- `DocumentViewer` – View and download documents
- `AdminDashboardContent` – Main admin dashboard
- `ManageOvertimeRequests` – Admin overtime approval, bulk actions, migration
- `ManageEditLogRequests` – Admin review of time log edit requests
- `ManageInterns` – Admin intern management
- `ManageCompletionRequests` – Admin completion request management
- `InternDashboardContent` – Intern dashboard
- `InternDTR` – Intern daily time record
- `InternProfile` – Intern profile view/edit
- `InternshipCompletion` – Intern completion request and status

## Best Practices

- **Time:** Always use `time-utils.ts` (truncation, UTC handling, multi-tier logic)
- **API:** Consistent auth, role-based access, input validation, error handling
- **DB:** Prepared statements, transactions, pooling, type safety
- **UI:** Unified interfaces, consistent styling, loading states, error boundaries
- **Session Logic:** Use `session-utils.ts` for grouping, editing, and admin review

## Development Guidelines

- Define types in `lib/database.ts`
- Add data access in `lib/data-access.ts`
- Use middleware for API routes
- Build UI with existing utilities and patterns
- Ensure comprehensive error handling

**Time-related:**  
- Use `time-utils.ts`  
- Test with various timezones  
- Verify truncation vs rounding and multi-tier splitting

**Database:**  
- Update schema in `scripts/001-schema.sql`  
- Add interfaces to `lib/database.ts`  
- Create migrations as needed  
- Test with sample data

## Maintenance

- Monitor log sizes, rotate as needed
- Optimize queries
- Update dependencies
- Backup database regularly

**Notes:**  
- Time uses truncation for precision and multi-tier overtime logic  
- Auth tokens expire after 24h  
- DB connections are pooled  
- All times stored in UTC, displayed in local time

## Testing

- **Time Calculations:** Edge cases, timezones, multi-tier overtime
- **Authentication:** Token validation/expiration
- **Database:** CRUD, constraints
- **API:** Request/response validation
- **UI:** User interactions, state, overtime/extended overtime flows

**Test Data:**  
- Use known test users  
- Test timezones, edge cases (midnight, DST, >9h, >12h)  
- Test all roles/permissions
