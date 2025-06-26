# InternHQ Codebase Documentation

## Architecture Overview

InternHQ is a Next.js application for managing intern time tracking and administration.

### Directory Structure

```
app/                    # Next.js App Router
├── api/               # API routes
│   ├── auth/          # Authentication endpoints
│   ├── time-logs/     # Time tracking endpoints
│   ├── admin/         # Admin management endpoints
│   └── profile/       # User profile endpoints
├── globals.css        # Global styles
├── layout.tsx         # Root layout
└── page.tsx          # Home page

components/            # Reusable UI components
├── ui/               # shadcn/ui components
├── admin/            # Admin-specific components
├── intern/           # Intern-specific components
├── daily-time-record.tsx
├── regular-time-tracking.tsx
├── overtime-tracking.tsx
└── this-week-logs.tsx

lib/                  # Utility libraries
├── api-middleware.ts # Consolidated API middleware
├── auth.ts          # Authentication utilities
├── database.ts      # Database types and connection
├── data-access.ts   # Database operations
├── time-utils.ts    # Time calculation utilities
├── ui-utils.ts      # UI component utilities
└── utils.ts         # General utilities

contexts/            # React contexts
└── auth-context.tsx # Authentication context
```

## Key Utilities

### API Middleware (`lib/api-middleware.ts`)
- `withAuth()` - Authenticate requests with role-based access
- `withAdminOrSelfAccess()` - Admin or self-access control
- `handleApiError()` - Consistent error handling

### Time Utilities (`lib/time-utils.ts`)
- `calculateTimeWorked()` - Core time calculation with truncation
- `calculateInternshipProgress()` - Progress tracking
- `getTruncatedDecimalHours()` - Precise decimal hours
- Date and time formatting utilities

### UI Utilities (`lib/ui-utils.ts`)
- `TimeLogDisplay` - Unified time log interface
- `useAsyncAction()` - Loading state management
- `groupLogsByDate()` - Log grouping for tables
- `getTimeBadgeConfig()` - Consistent badge styling
- `fetchWithErrorHandling()` - Wrapped fetch with error handling

## Data Flow

### Authentication
1. User logs in via `/api/auth/login`
2. JWT-like token stored in httpOnly cookie
3. `withAuth()` middleware validates requests
4. `AuthContext` manages client-side state

### Time Tracking
1. Clock in/out via `/api/time-logs/clock-in|clock-out`
2. Data stored in PostgreSQL with status tracking
3. Real-time calculations using `time-utils`
4. UI updates via React state management

### Admin Operations
1. Admin routes use `withAuth(request, "admin")`
2. Intern management via `/api/admin/interns`
3. Project assignments via `/api/admin/projects`
4. Statistics via `/api/admin/stats`

## Database Schema

### Core Tables
- `users` - User accounts (interns/admins)
- `time_logs` - Time tracking entries
- `user_profiles` - Extended user information
- `internship_programs` - Intern program details
- `schools` - Educational institutions
- `departments` - Organizational departments
- `projects` - Work projects
- `intern_project_assignments` - Project assignments

### Key Features
- Automatic timestamp updates via triggers
- UUID primary keys where appropriate
- Foreign key constraints for data integrity
- Indexes for query performance

## Component Architecture

### Consolidated Patterns
- **Time Calculations**: All use `time-utils.ts` functions
- **API Calls**: Use `fetchWithErrorHandling()` wrapper
- **Loading States**: Use `useAsyncAction()` hook
- **Time Display**: Use `TimeLogDisplay` interface
- **Badge Styling**: Use `getTimeBadgeConfig()` utility

### Reusable Components
- `DailyTimeRecord` - Time log table with filtering
- `RegularTimeTracking` - Regular hours tracking
- `OvertimeTracking` - Overtime hours tracking
- `ThisWeekLogs` - Weekly summary display

## Best Practices Implemented

### Time Calculations
- **Truncation over rounding** for precise hours
- **Centralized calculations** to prevent inconsistencies
- **UTC handling** with local date utilities

### API Security
- **Consistent authentication** via middleware
- **Role-based access control** 
- **Input validation** on all endpoints
- **Error handling** without information leakage

### Database Operations
- **Prepared statements** via postgres library
- **Transaction support** for complex operations
- **Connection pooling** for performance
- **Type safety** with TypeScript interfaces

### UI Consistency
- **Unified interfaces** for data structures
- **Consistent styling** via utility functions
- **Loading states** with proper UX feedback
- **Error boundaries** for graceful failures

## Development Guidelines

### Adding New Features
1. Define TypeScript interfaces in `lib/database.ts`
2. Create data access functions in `lib/data-access.ts`
3. Add API routes with proper middleware
4. Create UI components using existing utilities
5. Add comprehensive error handling

### Time-Related Changes
- Always use functions from `time-utils.ts`
- Test with different timezones
- Verify truncation vs rounding behavior
- Update type definitions if needed

### Database Changes
1. Update schema in `scripts/001-schema.sql`
2. Add new interfaces to `lib/database.ts`
3. Create migration scripts if needed
4. Update data access functions
5. Test with sample data

## Maintenance Notes

### Regular Tasks
- Monitor log file sizes and rotate as needed
- Review and optimize database queries
- Update dependencies and security patches
- Backup database regularly

### Known Considerations
- Time calculations use truncation for precision
- Authentication tokens expire after 24 hours
- Database connections are pooled for performance
- All times stored in UTC, displayed in local time

## Testing Strategy

### Recommended Test Areas
1. **Time Calculations** - Various scenarios and edge cases
2. **Authentication** - Token validation and expiration
3. **Database Operations** - CRUD operations and constraints
4. **API Endpoints** - Request/response validation
5. **UI Components** - User interactions and state management

### Test Data
- Use consistent test users with known data
- Test with various time zones
- Include edge cases (midnight, DST changes)
- Test with different user roles and permissions
