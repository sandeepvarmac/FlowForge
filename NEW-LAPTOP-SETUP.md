# FlowForge - New Laptop Setup Guide

This guide will help you set up the FlowForge application on your new laptop from the GitHub backup.

## Prerequisites

Install the following software on your new laptop:

### 1. Node.js and npm
- **Node.js version:** v24.6.0 (or later v24.x)
- **npm version:** 11.5.1 (or later)
- Download from: https://nodejs.org/

### 2. Python
- **Python version:** 3.11.9 (or Python 3.11.x)
- Download from: https://www.python.org/downloads/

### 3. Docker Desktop
- Required for MinIO and PostgreSQL services
- Download from: https://www.docker.com/products/docker-desktop/

### 4. Git
- Download from: https://git-scm.com/downloads

### 5. VS Code (Optional but recommended)
- Download from: https://code.visualstudio.com/

---

## Setup Steps

### Step 1: Clone the Repository

```bash
# Navigate to your desired directory
cd C:\Dev  # or your preferred location

# Clone the repository
git clone https://github.com/sandeepvarmac/FlowForge.git

# Navigate into the project
cd FlowForge
```

### Step 2: Install Node.js Dependencies

```bash
# Navigate to the web app
cd apps/web

# Install dependencies
npm install

# Go back to root
cd ../..
```

### Step 3: Set Up Python Environment (for Prefect flows)

```bash
# Navigate to prefect-flows directory
cd prefect-flows

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate

# Install Python dependencies (if requirements.txt exists)
# pip install -r requirements.txt

# Go back to root
cd ..
```

### Step 4: Configure Environment Variables

Create a `.env.local` file in `apps/web/` directory:

```bash
# Navigate to web app
cd apps/web

# Create .env.local file
# Copy your environment variables from your old laptop
# Important variables may include:
# - Database connections
# - API keys (OpenAI, AWS, etc.)
# - MinIO credentials
# - Any other secrets
```

**IMPORTANT:** Copy the `.env.local` file from your old laptop if you saved it separately.

### Step 5: Start Docker Services

```bash
# From the root directory
docker-compose up -d

# Verify services are running
docker-compose ps

# You should see:
# - flowforge-minio (MinIO storage)
# - flowforge-postgres (PostgreSQL database)
# - flowforge-minio-client (for bucket creation)
```

### Step 6: Initialize the Database

The SQLite database file is located at `apps/web/data/flowforge.db`. This file may need to be:
- Restored from backup if you have important data
- Or will be created automatically when you first run the application

### Step 7: Start the Development Server

```bash
# Navigate to web app
cd apps/web

# Run the development server
npm run dev

# The app should be available at: http://localhost:3000
```

---

## Verification Checklist

After setup, verify everything works:

- [ ] Node.js and npm installed (check with `node --version` and `npm --version`)
- [ ] Python installed (check with `python --version`)
- [ ] Docker running (check with `docker --version`)
- [ ] Repository cloned successfully
- [ ] Node dependencies installed (`node_modules` exists in `apps/web/`)
- [ ] Docker containers running (MinIO and PostgreSQL)
- [ ] Environment variables configured (`.env.local` in `apps/web/`)
- [ ] Development server starts without errors
- [ ] Application accessible at http://localhost:3000
- [ ] MinIO console accessible at http://localhost:9001 (minioadmin/minioadmin123)

---

## Accessing Services

### Web Application
- **URL:** http://localhost:3000
- **Description:** Main FlowForge web interface

### MinIO Console
- **URL:** http://localhost:9001
- **Username:** minioadmin
- **Password:** minioadmin123
- **Description:** S3-compatible object storage UI

### PostgreSQL Database
- **Host:** localhost
- **Port:** 5432
- **Username:** flowforge
- **Password:** flowforge123
- **Database:** flowforge
- **Description:** Database for metadata and Prefect state

---

## Important Files to Backup Separately

These files are NOT in git (by design) but may need to be transferred:

1. **apps/web/.env.local** - Environment variables and secrets
2. **apps/web/data/flowforge.db** - SQLite database (if contains important data)
3. Any custom configuration files you created

---

## Troubleshooting

### Port Conflicts
If ports 3000, 9000, 9001, or 5432 are in use:
- Check what's using the port: `netstat -ano | findstr :3000`
- Stop the conflicting service or modify ports in `docker-compose.yml`

### Docker Services Not Starting
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: This deletes data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Node Module Issues
```bash
# Clear npm cache and reinstall
cd apps/web
rm -rf node_modules package-lock.json
npm install
```

### Python Virtual Environment Issues
```bash
# Remove and recreate venv
cd prefect-flows
rm -rf venv
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

---

## Additional Notes

- The project uses **Next.js 14.2.5** for the web frontend
- **DuckDB** is used for analytics queries
- **MinIO** provides S3-compatible object storage
- **Prefect** is used for workflow orchestration (Python-based)
- The main branch on GitHub is: `main`

---

## Need Help?

Check the following documentation files in the repository:
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [FEATURE-DEVELOPMENT-TRACKER.md](FEATURE-DEVELOPMENT-TRACKER.md) - Feature progress
- [MIGRATION_STATUS.md](MIGRATION_STATUS.md) - Migration status

---

**Repository URL:** https://github.com/sandeepvarmac/FlowForge.git

**Last Updated:** 2025-10-18
