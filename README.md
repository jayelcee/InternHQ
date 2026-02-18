# InternHQ - Intern Management System

[![Next.js](https://img.shields.io/badge/Next.js-16.1.4-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue?logo=postgresql)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19.0-blue?logo=react)](https://reactjs.org/)

## 📖 About

InternHQ is a comprehensive web-based internship management system designed to streamline time tracking, attendance management, and progress monitoring for interns and administrators. Built with modern web technologies, it provides an intuitive interface for managing intern programs, tracking work hours, handling overtime requests, and monitoring internship completion.

The system automates time calculations, supports multi-tier overtime tracking, and includes role-based access control for secure management of intern data.

## ✨ Key Features

- **⏰ Real-Time Clock In/Out**: Accurate time tracking with automatic session management
- **📊 Daily Time Records**: Comprehensive view of attendance logs with filtering and search
- **⚡ Automated Overtime Management**: Smart splitting of regular, overtime, and extended overtime hours
- **✅ Admin Approval Workflow**: Streamlined review and approval process for overtime requests
- **📝 Time Log Editing**: Request and manage corrections to time entries
- **📈 Progress Tracking**: Visual monitoring of internship completion status
- **👥 Role-Based Access**: Separate interfaces for interns and administrators
- **🔒 Secure Authentication**: JWT-based authentication with httpOnly cookies
- **📱 Responsive Design**: Optimized for desktop and mobile devices
- **🌐 Timezone Support**: UTC storage with local timezone display

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library
- **Lucide React** - Icon system

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **PostgreSQL** - Relational database
- **Node.js** - Runtime environment

### Additional Libraries
- **date-fns** - Date manipulation
- **html2canvas & jsPDF** - Document generation
- **class-variance-authority** - Component variants

## 📚 Documentation

This project includes comprehensive documentation to help you understand and work with the system:

- **[User Guide](./USER_GUIDE.md)** - Complete guide for interns and administrators on how to use the system
- **[Codebase Documentation](./CODEBASE_DOCUMENTATION.md)** - Technical architecture, file structure, and development guidelines
- **[Overtime System](./OVERTIME_SYSTEM.md)** - Detailed documentation on the overtime management workflow and features

## 🚀 Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- PostgreSQL 12 or higher
- npm or yarn package manager

### Installation

1. **Clone the Repository**

```bash
git clone https://github.com/jayelcee/InternHQ.git
cd InternHQ
```

2. **Install Node.js (using NVM - recommended)**

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install and use Node.js LTS
nvm install --lts
nvm use --lts
nvm alias default lts/*
```

3. **Install Dependencies**

```bash
npm install
```

4. **Setup PostgreSQL**

Install PostgreSQL (Ubuntu):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

Access PostgreSQL:
```bash
sudo -u postgres psql
```

Create database and user:
```sql
CREATE USER intern_admin WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE ims_db OWNER intern_admin;
\q
```

5. **Configure Environment Variables**

Create a `.env` file in the project root:

```bash
touch .env
```

Add your configuration:
```env
DATABASE_URL=postgresql://intern_admin:your_secure_password_here@localhost:5432/ims_db
```

**⚠️ Security Note**: Never commit your `.env` file to version control. Use strong, unique passwords for production environments.

6. **Initialize Database Schema**

Run the SQL migration scripts from the `scripts` directory:

```bash
psql -U intern_admin -h localhost -d ims_db -f scripts/001-schema.sql
psql -U intern_admin -h localhost -d ims_db -f scripts/002-seed-data.sql
```

7. **Start Development Server**

```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## 📝 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality

## 🏗️ Project Structure

```
InternHQ/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints (auth, time-logs, admin, etc.)
│   ├── admin/             # Admin dashboard pages
│   ├── intern/            # Intern dashboard pages
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── admin/            # Admin-specific components
│   └── intern/           # Intern-specific components
├── lib/                   # Utility libraries
│   ├── auth.ts           # Authentication utilities
│   ├── database.ts       # Database types and connection
│   ├── data-access.ts    # Database operations
│   └── time-utils.ts     # Time calculation utilities
├── contexts/              # React context providers
├── hooks/                 # Custom React hooks
├── public/               # Static assets
└── scripts/              # Database migration scripts
```

## 🔒 Security Best Practices

- All passwords should be strong and unique
- Environment variables must be stored in `.env` (never committed to Git)
- Use HTTPS in production environments
- Regularly update dependencies to patch vulnerabilities
- Review and audit user access permissions

## 🤝 Contributing

Contributions are welcome! Please ensure your code follows the existing patterns and includes appropriate documentation.

## 📄 License

This project is private and proprietary.

## 👨‍💻 Developer

Developed by [jayelcee](https://github.com/jayelcee)

---

## 🛠️ Development Tips

### Database Management

**Safely Drop Database with Active Connections:**

```sql
-- From within psql prompt
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'ims_db' AND pid <> pg_backend_pid();

DROP DATABASE ims_db;
CREATE DATABASE ims_db OWNER intern_admin;
```

**Connect to Database:**
```bash
psql -U intern_admin -h localhost -d ims_db
```

### Troubleshooting

- Ensure PostgreSQL service is running: `sudo service postgresql status`
- Check Node.js version: `node -v` (should be LTS version)
- Verify environment variables are properly configured
- Review logs for detailed error messages

For additional help, refer to the [User Guide](./USER_GUIDE.md) or [Codebase Documentation](./CODEBASE_DOCUMENTATION.md).
