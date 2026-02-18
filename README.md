# InternHQ

InternHQ is a web-based Daily Time Record (DTR) and internship tracking system built with Next.js and PostgreSQL.

## Documentation

- [User Guide](./USER_GUIDE.md)
- [Codebase Documentation](./CODEBASE_DOCUMENTATION.md)
- [Overtime System](./OVERTIME_SYSTEM.md)

## Quick Start

### 1) Clone and install dependencies

```bash
git clone https://github.com/jayelcee/InternHQ.git
cd InternHQ
npm install
```

### 2) Set up environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://<db_user>:<db_password>@localhost:5432/<db_name>
```

### 3) Set up PostgreSQL

Install PostgreSQL if needed, then create your own local database and user credentials.

Example:

```sql
CREATE USER your_db_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE your_db_name OWNER your_db_user;
```

### 4) Run database scripts

From the `scripts` directory:

```bash
psql -U your_db_user -h localhost -d your_db_name -f 001-schema.sql
psql -U your_db_user -h localhost -d your_db_name -f 002-seed-data.sql
```

### 5) Run the app

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Tech Stack

- Next.js
- React
- TypeScript
- PostgreSQL

## Notes

- Do not commit real secrets in `.env`.
- Use environment-specific credentials for local, staging, and production.
