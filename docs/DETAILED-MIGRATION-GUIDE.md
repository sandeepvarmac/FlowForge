# FlowForge - Complete Migration Guide for New Laptop

This guide provides detailed, step-by-step instructions to migrate and set up FlowForge on your new laptop.

**Estimated Time:** 45-60 minutes

---

## 📋 Table of Contents

1. [Prerequisites - Software Installation](#step-1-prerequisites---software-installation)
2. [Backup Critical Files from Old Laptop](#step-2-backup-critical-files-from-old-laptop)
3. [Clone Repository on New Laptop](#step-3-clone-repository-on-new-laptop)
4. [Install Node.js Dependencies](#step-4-install-nodejs-dependencies)
5. [Set Up Python Environment](#step-5-set-up-python-environment)
6. [Configure Environment Variables](#step-6-configure-environment-variables)
7. [Set Up Docker Services](#step-7-set-up-docker-services)
8. [Restore Database](#step-8-restore-database)
9. [Start the Application](#step-9-start-the-application)
10. [Verification & Testing](#step-10-verification--testing)
11. [Troubleshooting](#troubleshooting)

---

## Step 1: Prerequisites - Software Installation

### 1.1 Install Node.js and npm

**Required Version:** Node.js v24.6.0 (or v24.x LTS)

1. Go to https://nodejs.org/
2. Download the **LTS version** (v24.x or later)
3. Run the installer and follow the wizard
4. **Important:** Check "Automatically install necessary tools" during installation

**Verify installation:**
```bash
node --version
# Expected output: v24.6.0 or higher

npm --version
# Expected output: 11.5.1 or higher
```

---

### 1.2 Install Python

**Required Version:** Python 3.11.9 (or Python 3.11.x)

1. Go to https://www.python.org/downloads/
2. Download **Python 3.11.9** (or latest 3.11.x)
3. Run the installer
4. **CRITICAL:** Check "Add Python to PATH" during installation
5. Click "Install Now"

**Verify installation:**
```bash
python --version
# Expected output: Python 3.11.9

pip --version
# Expected output: pip 24.x or higher
```

---

### 1.3 Install Docker Desktop

**Required for:** MinIO (S3 storage) and PostgreSQL database

1. Go to https://www.docker.com/products/docker-desktop/
2. Download Docker Desktop for Windows
3. Run the installer
4. **After installation:** Restart your computer
5. Launch Docker Desktop and complete the setup wizard
6. **Important:** Enable WSL 2 if prompted

**Verify installation:**
```bash
docker --version
# Expected output: Docker version 24.x or higher

docker-compose --version
# Expected output: Docker Compose version v2.x or higher
```

---

### 1.4 Install Git

1. Go to https://git-scm.com/downloads
2. Download Git for Windows
3. Run the installer with default settings
4. **Recommended:** Choose "Visual Studio Code" as default editor if available

**Verify installation:**
```bash
git --version
# Expected output: git version 2.x or higher
```

---

### 1.5 Install VS Code (Recommended)

1. Go to https://code.visualstudio.com/
2. Download and install VS Code
3. **Recommended Extensions:**
   - ESLint
   - Prettier
   - Python
   - Docker

---

## Step 2: Backup Critical Files from Old Laptop

Before leaving your old laptop, you need to backup files that are NOT in git.

### 2.1 Backup Environment Variables

**Location:** `C:\Dev\FlowForge\apps\web\.env.local`

1. Open File Explorer on your old laptop
2. Navigate to: `C:\Dev\FlowForge\apps\web\`
3. Look for a file named `.env.local` (it might be hidden)
   - **To show hidden files:** View → Show → Hidden items
4. Copy this file to a USB drive or cloud storage (OneDrive, Google Drive)
5. **IMPORTANT:** This file contains API keys and secrets - keep it secure!

**If you don't have `.env.local`:** That's okay, you'll create a new one in Step 6.

---

### 2.2 Backup Database (Optional but Recommended)

**Location:** `C:\Dev\FlowForge\apps\web\data\flowforge.db`

1. Navigate to: `C:\Dev\FlowForge\apps\web\data\`
2. Copy the file `flowforge.db` to USB drive or cloud storage
3. This contains your workflows, data sources, and configurations

**If you want to start fresh:** Skip this step - a new database will be created automatically.

---

### 2.3 Verify GitHub Backup

On your old laptop, verify everything is pushed to GitHub:

```bash
cd C:\Dev\FlowForge
git status
```

**Expected output:** "nothing to commit, working tree clean"

**If you see uncommitted changes:**
```bash
git add .
git commit -m "chore: final backup before migration"
git push origin main
```

---

## Step 3: Clone Repository on New Laptop

### 3.1 Open Terminal/PowerShell

1. Press `Windows + X`
2. Select "Terminal" or "PowerShell"

---

### 3.2 Navigate to Desired Location

```bash
# Create Dev folder if it doesn't exist
mkdir C:\Dev
cd C:\Dev
```

**Note:** You can use any location you prefer, but this guide assumes `C:\Dev`

---

### 3.3 Clone the Repository

```bash
git clone https://github.com/sandeepvarmac/FlowForge.git
```

**Expected output:**
```
Cloning into 'FlowForge'...
remote: Enumerating objects: ...
remote: Counting objects: 100% ...
Receiving objects: 100% ...
Resolving deltas: 100% ...
```

---

### 3.4 Navigate into Project

```bash
cd FlowForge
```

---

### 3.5 Verify Clone Success

```bash
dir
```

**Expected output:** You should see folders like:
- `apps/`
- `docs/`
- `prefect-flows/`
- `docker-compose.yml`
- `package.json` (if exists)
- etc.

---

## Step 4: Install Node.js Dependencies

### 4.1 Navigate to Web App

```bash
cd apps\web
```

---

### 4.2 Install Dependencies

```bash
npm install
```

**This will take 5-10 minutes.** You'll see:
```
added 500+ packages in 5m
```

**Common issues:**
- If you see `ERESOLVE` warnings, that's normal - ignore them
- If you see errors about Python or node-gyp, ensure Python is in PATH

---

### 4.3 Verify Installation

```bash
dir node_modules
```

**Expected:** You should see hundreds of folders (dependencies)

---

### 4.4 Return to Root

```bash
cd ..\..
```

**Current location:** `C:\Dev\FlowForge`

---

## Step 5: Set Up Python Environment

### 5.1 Navigate to Prefect Flows

```bash
cd prefect-flows
```

---

### 5.2 Create Virtual Environment

```bash
python -m venv venv
```

**This creates a folder called `venv`**

---

### 5.3 Activate Virtual Environment

**On Windows:**
```bash
venv\Scripts\activate
```

**Expected output:** Your prompt should now start with `(venv)`

Example:
```
(venv) C:\Dev\FlowForge\prefect-flows>
```

---

### 5.4 Update pip

```bash
python -m pip install --upgrade pip
```

---

### 5.5 Install Python Dependencies

```bash
pip install -r requirements.txt
```

**This will take 5-10 minutes.** You'll see packages being installed.

---

### 5.6 Verify Installation

```bash
pip list
```

**Expected output:** List of installed packages including:
- prefect
- polars
- boto3
- psycopg2-binary
- etc.

---

### 5.7 Deactivate Virtual Environment

```bash
deactivate
```

**Expected:** The `(venv)` prefix should disappear from your prompt

---

### 5.8 Return to Root

```bash
cd ..
```

**Current location:** `C:\Dev\FlowForge`

---

## Step 6: Configure Environment Variables

### 6.1 Navigate to Web App

```bash
cd apps\web
```

---

### 6.2 Option A: Restore .env.local from Backup

**If you backed up `.env.local` from your old laptop:**

1. Copy the `.env.local` file from your USB/cloud storage
2. Paste it into: `C:\Dev\FlowForge\apps\web\`
3. Skip to Step 6.3

---

### 6.2 Option B: Create New .env.local

**If you're starting fresh:**

1. Copy the example file:
```bash
copy .env.example .env.local
```

2. Open `.env.local` in a text editor:
```bash
notepad .env.local
```

3. Update the following values:

```env
# OpenAI API Configuration (if you use AI features)
OPENAI_API_KEY=sk-your-actual-openai-api-key-here

# Database Configuration (default - don't change unless needed)
DATABASE_PATH=./data/flowforge.db

# File Storage Configuration (default - don't change)
UPLOAD_DIR=./data/uploads
BRONZE_DIR=./data/bronze
SILVER_DIR=./data/silver
GOLD_DIR=./data/gold

# DuckDB Configuration (default - don't change)
DUCKDB_PATH=./data/analytics.duckdb

# Application Configuration
NODE_ENV=development
```

4. **Get OpenAI API Key (if needed):**
   - Go to https://platform.openai.com/api-keys
   - Create a new secret key
   - Copy and paste it into `.env.local`

5. Save and close the file

---

### 6.3 Verify Environment File

```bash
type .env.local
```

**Expected output:** Your environment variables should be displayed

---

### 6.4 Return to Root

```bash
cd ..\..
```

**Current location:** `C:\Dev\FlowForge`

---

## Step 7: Set Up Docker Services

### 7.1 Ensure Docker Desktop is Running

1. Open Docker Desktop application
2. Wait until you see "Docker Desktop is running" in the system tray

---

### 7.2 Start Docker Services

```bash
docker-compose up -d
```

**Expected output:**
```
[+] Running 3/3
 ✔ Container flowforge-postgres       Started
 ✔ Container flowforge-minio          Started
 ✔ Container flowforge-minio-client   Started
```

**This will take 2-3 minutes on first run** (downloading Docker images)

---

### 7.3 Verify Services are Running

```bash
docker-compose ps
```

**Expected output:**
```
NAME                    STATUS          PORTS
flowforge-minio         Up (healthy)    0.0.0.0:9000-9001->9000-9001/tcp
flowforge-postgres      Up (healthy)    0.0.0.0:5432->5432/tcp
```

**All services should show "Up" or "Up (healthy)"**

---

### 7.4 Wait for Health Checks

```bash
# Wait 30 seconds for services to be fully ready
timeout /t 30
```

---

### 7.5 Test MinIO Access

1. Open browser
2. Go to: http://localhost:9001
3. Login with:
   - **Username:** minioadmin
   - **Password:** minioadmin123
4. You should see the MinIO Console

**If you can't access:** Wait another minute and try again

---

### 7.6 Verify MinIO Bucket

In the MinIO Console:
1. Click "Buckets" in the left menu
2. You should see a bucket named: `flowforge-data`

**If bucket doesn't exist:**
```bash
docker-compose restart minio-client
```

---

## Step 8: Restore Database

### 8.1 Create Data Directory

```bash
mkdir apps\web\data
```

**Note:** If it already exists, you'll see "A subdirectory or file already exists" - that's fine.

---

### 8.2 Option A: Restore Database from Backup

**If you backed up `flowforge.db` from your old laptop:**

1. Copy `flowforge.db` from your USB/cloud storage
2. Paste it into: `C:\Dev\FlowForge\apps\web\data\`
3. Skip to Step 9

---

### 8.2 Option B: Start with Fresh Database

**If you're starting fresh:**

The database will be created automatically when you first run the application in Step 9.

No action needed here - proceed to Step 9.

---

## Step 9: Start the Application

### 9.1 Navigate to Web App

```bash
cd apps\web
```

---

### 9.2 Start Development Server

```bash
npm run dev
```

**Expected output:**
```
  ▲ Next.js 14.2.5
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Ready in 5.2s
```

**First run may take 1-2 minutes** as Next.js builds the application

---

### 9.3 Wait for "Ready"

Do not proceed until you see: `✓ Ready in X.Xs`

---

## Step 10: Verification & Testing

### 10.1 Access the Application

1. Open your web browser
2. Go to: http://localhost:3000
3. You should see the FlowForge application homepage

---

### 10.2 Verify Core Features

#### Test 1: Homepage Loads
- [ ] Homepage displays without errors
- [ ] Navigation menu is visible
- [ ] No error messages in browser console (F12)

#### Test 2: Check Docker Services
Open new terminal (keep app running) and run:
```bash
docker ps
```
- [ ] flowforge-minio shows "Up (healthy)"
- [ ] flowforge-postgres shows "Up (healthy)"

#### Test 3: Database Connection
- [ ] Navigate to different pages in the app
- [ ] No "database connection" errors

#### Test 4: MinIO Storage Access
- [ ] Go to http://localhost:9001
- [ ] Can login successfully
- [ ] Bucket "flowforge-data" exists

---

### 10.3 Test Data Upload (Optional)

1. In FlowForge app, go to Data Sources or File Upload page
2. Try uploading a small CSV or Excel file
3. Verify it uploads successfully

---

### 10.4 Check Application Logs

In the terminal where `npm run dev` is running:
- [ ] No error messages (red text)
- [ ] Only info/ready messages (green/blue text)

**If you see errors:** See Troubleshooting section below

---

## 🎉 Migration Complete!

If all verification steps passed, your FlowForge application is successfully migrated!

---

## Troubleshooting

### Issue 1: "Port 3000 is already in use"

**Solution:**
```bash
# Stop the conflicting process
netstat -ano | findstr :3000
# Note the PID (last column)
taskkill /PID <PID> /F

# Or use a different port:
# Edit package.json and change dev script to: "next dev -p 3001"
```

---

### Issue 2: Docker containers won't start

**Solution:**
```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: Deletes data)
docker-compose down -v

# Start fresh
docker-compose up -d

# Check logs
docker-compose logs
```

---

### Issue 3: "Cannot find module" errors

**Solution:**
```bash
cd apps\web

# Clear cache and reinstall
rd /s /q node_modules
del package-lock.json
npm install

# Try again
npm run dev
```

---

### Issue 4: Python virtual environment issues

**Solution:**
```bash
cd prefect-flows

# Remove and recreate
rd /s /q venv
python -m venv venv
venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

---

### Issue 5: Database permission errors

**Solution:**
```bash
cd apps\web\data

# Check if file is read-only
attrib flowforge.db

# Remove read-only attribute if present
attrib -r flowforge.db
```

---

### Issue 6: MinIO bucket not created

**Solution:**
```bash
# Restart the MinIO client container
docker-compose restart minio-client

# Check logs
docker logs flowforge-minio-client

# Manually create bucket via MinIO Console
# 1. Go to http://localhost:9001
# 2. Login (minioadmin/minioadmin123)
# 3. Click "Create Bucket"
# 4. Name it: flowforge-data
# 5. Click "Create"
```

---

### Issue 7: Environment variables not loading

**Solution:**
```bash
cd apps\web

# Verify file exists
dir .env.local

# Verify file has content
type .env.local

# Restart the dev server
# Press Ctrl+C to stop
npm run dev
```

---

## Quick Reference Commands

### Start Everything (After Initial Setup)

```bash
# Terminal 1 - Start Docker services
cd C:\Dev\FlowForge
docker-compose up -d

# Terminal 2 - Start Web App
cd C:\Dev\FlowForge\apps\web
npm run dev
```

### Stop Everything

```bash
# In terminal where npm run dev is running
Ctrl + C

# Stop Docker services
cd C:\Dev\FlowForge
docker-compose down
```

### Check Status

```bash
# Check Docker services
docker-compose ps

# Check logs
docker-compose logs

# Check specific service logs
docker logs flowforge-minio
docker logs flowforge-postgres
```

---

## Service URLs Reference

| Service | URL | Credentials |
|---------|-----|-------------|
| FlowForge Web App | http://localhost:3000 | N/A |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |
| MinIO API | http://localhost:9000 | minioadmin / minioadmin123 |
| PostgreSQL | localhost:5432 | flowforge / flowforge123 |

---

## Important File Locations

| Item | Location |
|------|----------|
| Web Application | `C:\Dev\FlowForge\apps\web\` |
| Environment Variables | `C:\Dev\FlowForge\apps\web\.env.local` |
| Database | `C:\Dev\FlowForge\apps\web\data\flowforge.db` |
| Python Flows | `C:\Dev\FlowForge\prefect-flows\` |
| Python Virtual Env | `C:\Dev\FlowForge\prefect-flows\venv\` |
| Docker Config | `C:\Dev\FlowForge\docker-compose.yml` |

---

## Daily Workflow

### Starting Work

```bash
# 1. Start Docker Desktop (if not running)

# 2. Start Docker services
cd C:\Dev\FlowForge
docker-compose up -d

# 3. Start development server
cd apps\web
npm run dev

# 4. Open http://localhost:3000 in browser
```

### Stopping Work

```bash
# 1. Stop dev server (Ctrl+C in terminal)

# 2. Stop Docker services (optional - can leave running)
docker-compose down

# 3. Close Docker Desktop (optional)
```

---

## Need More Help?

- Check project documentation: `C:\Dev\FlowForge\docs\`
- Review architecture: `C:\Dev\FlowForge\ARCHITECTURE.md`
- Check feature tracker: `C:\Dev\FlowForge\FEATURE-DEVELOPMENT-TRACKER.md`

---

**Last Updated:** 2025-10-18
**Repository:** https://github.com/sandeepvarmac/FlowForge.git
