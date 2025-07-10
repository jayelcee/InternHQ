# InternHQ Setup Guide

## 🚀 Clone the Repository

```bash
git clone git@git.cybersoftbpo.com:mis/cybersoft-dtr.git
cd cybersoft-dtr
```

---

## 🟢 Node.js Environment Setup (with NVM)

**NVM** (Node Version Manager) makes it easy to manage Node.js versions.

### 1. Install NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

Reload your shell:

```bash
source ~/.bashrc
```

Verify NVM installation:

```bash
command -v nvm
```

### 2. Install Latest LTS Node.js

```bash
nvm install --lts
nvm use --lts
nvm alias default lts/*
```

Check versions:

```bash
node -v
npm -v
```

### 3. Install Project Dependencies

```bash
npm install
```

---

## 🗄️ PostgreSQL Setup

### 1. Install PostgreSQL (Ubuntu)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

Start PostgreSQL service:

```bash
sudo service postgresql start
```

### 2. Create PostgreSQL User & Database

Access PostgreSQL prompt as `postgres` superuser:

```bash
sudo -u postgres psql
```

Create user and database:

```sql
CREATE USER intern_admin WITH PASSWORD '2smg-w5FOo';
CREATE DATABASE ims_db OWNER intern_admin;
\q
```

### 3. Configure Environment Variables

Create a `.env` file in your project root:

```bash
touch .env
```

Add your PostgreSQL connection string:

```
DATABASE_URL=postgresql://intern_admin:2smg-w5FOo@localhost:5432/ims_db
```

### 4. Run SQL Scripts (Schema & Seed Data)

From the `scripts` directory:

```bash
psql -U intern_admin -h localhost -d ims_db -f 001-schema.sql
psql -U intern_admin -h localhost -d ims_db -f 002-seed-data.sql
```

---

## 🏃‍♂️ Run the Application

```bash
npm run dev
```

---

## 🛠️ Development Tips

### Safely Drop Database with Active Connections

From within the `psql` prompt:

```sql
-- Terminate all connections to the database EXCEPT your own
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'ims_db' AND pid <> pg_backend_pid();
```

Then drop and recreate the database:

```sql
DROP DATABASE ims_db;
CREATE DATABASE ims_db OWNER intern_admin;
```

### Connect to ims_db with Password Prompt

```bash
psql -U postgres -d ims_db -h localhost
```
