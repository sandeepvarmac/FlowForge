# FlowForge MVP - Prerequisites & Startup Guide

**Last Updated:** October 20, 2025
**Purpose:** Complete checklist of prerequisites and startup procedures for FlowForge MVP

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Required Software](#required-software)
3. [Required Services](#required-services)
4. [Environment Configuration](#environment-configuration)
5. [First-Time Setup](#first-time-setup)
6. [Starting the Application](#starting-the-application)
7. [Verification Steps](#verification-steps)
8. [Troubleshooting](#troubleshooting)

---

## 🖥️ System Requirements

### Hardware
- **CPU:** 4+ cores recommended
- **RAM:** 8GB minimum, 16GB recommended
- **Storage:** 10GB free space minimum
- **OS:** Windows 10/11, macOS, or Linux

### Ports Required (Must be available)
- **3000** - Next.js Web Application
- **4200** - Prefect Server API & UI
- **5432** - PostgreSQL Database
- **9000** - MinIO S3 API
- **9001** - MinIO Web Console

---

## 💿 Required Software

### 1. **Docker Desktop** ✅ CRITICAL
- **Version:** Latest stable (Docker Engine 20.x+)
- **Purpose:** Run Prefect, PostgreSQL, and MinIO containers
- **Download:** https://www.docker.com/products/docker-desktop
- **Verification:**
  ```bash
  docker --version
  docker-compose --version
  ```

### 2. **Node.js** ✅ CRITICAL
- **Version:** 18.x or 20.x (LTS recommended)
- **Purpose:** Run Next.js web application
- **Download:** https://nodejs.org/
- **Verification:**
  ```bash
  node --version  # Should show v18.x or v20.x
  npm --version   # Should show 9.x or 10.x
  ```

### 3. **Python** ✅ CRITICAL
- **Version:** 3.11 or 3.12
- **Purpose:** Run Prefect workflows and data processing
- **Download:** https://www.python.org/downloads/
- **Verification:**
  ```bash
  python --version  # Should show 3.11.x or 3.12.x
  pip --version
  ```

### 4. **Git** (Recommended)
- **Version:** Latest stable
- **Purpose:** Version control
- **Download:** https://git-scm.com/downloads

### 5. **OpenAI API Key** ✅ CRITICAL
- **Purpose:** AI-powered schema detection and column naming
- **Get Key:** https://platform.openai.com/api-keys
- **Cost:** ~$0.01-0.10 per file analysis (GPT-4o)

---

## 🚀 Required Services

### Docker Services (via docker-compose.yml)

#### 1. **MinIO** (S3-Compatible Storage) ✅ REQUIRED
- **Container:** `flowforge-minio`
- **Ports:** 9000 (API), 9001 (Console)
- **Purpose:** Store Bronze/Silver/Gold data layers
- **Credentials:**
  - Username: `minioadmin`
  - Password: `minioadmin123`
- **Web Console:** http://localhost:9001

#### 2. **PostgreSQL** (Database) ✅ REQUIRED
- **Container:** `flowforge-postgres`
- **Port:** 5432
- **Purpose:** Prefect state management
- **Credentials:**
  - Username: `flowforge`
  - Password: `flowforge123`
  - Database: `flowforge`

#### 3. **Prefect Server** (Workflow Orchestration) ✅ REQUIRED
- **Container:** `flowforge-prefect-server`
- **Port:** 4200
- **Purpose:** Orchestrate data pipelines, schedule workflows
- **Web UI:** http://localhost:4200
- **API:** http://localhost:4200/api

#### 4. **MinIO Client** (One-time Setup)
- **Container:** `flowforge-minio-client`
- **Purpose:** Create initial buckets and users
- **Runs:** Once on first startup, then exits

---

## ⚙️ Environment Configuration

### 1. **Web Application (.env.local)**

**Location:** `apps/web/.env.local`

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-YOUR_API_KEY_HERE  # ✅ REQUIRED

# Database Configuration
DATABASE_PATH=./data/flowforge.db

# File Storage Configuration
UPLOAD_DIR=./data/uploads
BRONZE_DIR=./data/bronze
SILVER_DIR=./data/silver
GOLD_DIR=./data/gold

# DuckDB Configuration
DUCKDB_PATH=./data/analytics.duckdb

# Application Configuration
NODE_ENV=development
PREFECT_API_URL=http://127.0.0.1:4200/api
PREFECT_DEPLOYMENT_ID=YOUR_DEPLOYMENT_ID  # Created during setup

# MinIO S3 Configuration
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
S3_BUCKET_NAME=flowforge-data
```

### 2. **Prefect Flows (.env.local)**

**Location:** `prefect-flows/.env.local`

```bash
# MinIO / S3 Configuration
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
S3_BUCKET_NAME=flowforge-data
S3_REGION=us-east-1

# Prefect Configuration (local server)
PREFECT_API_URL=http://localhost:4200/api

# Database Configuration
DATABASE_URL=postgresql://flowforge:flowforge123@localhost:5432/flowforge

# DuckDB Configuration
DUCKDB_PATH=./data/duckdb/analytics.duckdb

# Application Settings
ENVIRONMENT=local
LOG_LEVEL=INFO
```

---

## 🔧 First-Time Setup

### Step 1: Install Docker Services

```bash
# Navigate to project root
cd c:/Dev/FlowForge

# Start all Docker services
docker-compose up -d

# Verify services are running
docker ps
```

**Expected Output:**
```
NAMES                      STATUS                 PORTS
flowforge-prefect-server   Up (healthy)          0.0.0.0:4200->4200/tcp
flowforge-postgres         Up (healthy)          0.0.0.0:5432->5432/tcp
flowforge-minio            Up (healthy)          0.0.0.0:9000-9001->9000-9001/tcp
```

### Step 2: Install Python Dependencies

```bash
cd prefect-flows

# Install dependencies
pip install -r requirements.txt

# Verify installation
python -c "import prefect; print(f'Prefect {prefect.__version__} installed')"
```

### Step 3: Create Prefect Deployment

```bash
cd prefect-flows

# Create the medallion pipeline deployment
python create_deployment.py

# This will output a deployment ID - copy it!
```

**Copy the deployment ID and update `apps/web/.env.local`:**
```bash
PREFECT_DEPLOYMENT_ID=<paste-deployment-id-here>
```

### Step 4: Install Node.js Dependencies

```bash
cd apps/web

# Install dependencies
npm install

# Verify installation
npm list next react prefect
```

### Step 5: Verify MinIO Buckets

Open MinIO Console: http://localhost:9001

**Login:** `minioadmin` / `minioadmin123`

**Required Buckets (auto-created):**
- `flowforge-data`
  - `landing/` - File uploads
  - `bronze/` - Raw ingestion
  - `silver/` - Cleaned data
  - `gold/` - Analytics-ready

---

## ▶️ Starting the Application

### Option 1: Start Everything (Recommended)

```bash
# Terminal 1: Start Docker services (if not already running)
cd c:/Dev/FlowForge
docker-compose up -d

# Terminal 2: Start Web Application
cd c:/Dev/FlowForge/apps/web
npm run dev

# Application will be available at:
# http://localhost:3000
```

### Option 2: Development Mode (with logs)

```bash
# Terminal 1: Docker services with logs
cd c:/Dev/FlowForge
docker-compose up  # Without -d to see logs

# Terminal 2: Web app with hot reload
cd c:/Dev/FlowForge/apps/web
npm run dev

# Terminal 3 (optional): Watch Prefect logs
docker logs -f flowforge-prefect-server
```

---

## ✅ Verification Steps

### 1. Verify Docker Services

```bash
docker ps

# All 3 containers should show "Up" status:
# - flowforge-prefect-server (port 4200)
# - flowforge-postgres (port 5432)
# - flowforge-minio (ports 9000-9001)
```

### 2. Verify Prefect API

```bash
curl http://localhost:4200/api/health
# Should return: true
```

**Or visit:** http://localhost:4200 (Prefect UI)

### 3. Verify MinIO

```bash
curl http://localhost:9000/minio/health/live
# Should return: HTTP 200
```

**Or visit:** http://localhost:9001 (MinIO Console)

### 4. Verify Web Application

**Visit:** http://localhost:3000

You should see:
- ✅ FlowForge Dashboard
- ✅ Navigation menu (Workflows, Jobs, Data Assets, etc.)
- ✅ No connection errors

### 5. Test Workflow Execution

1. **Create a Workflow**
   - Click "Workflows" → "Create Workflow"
   - Name: "Test Pipeline"
   - Click "Create"

2. **Add a Job**
   - Click "Add Job"
   - Upload a sample CSV file
   - Configure Bronze/Silver/Gold layers
   - Click "Save Job"

3. **Run the Workflow**
   - Click "Run Workflow"
   - Monitor execution in real-time
   - Check "Orchestration → Monitor" for status

4. **Verify Results**
   - Go to "Data Assets → Explorer"
   - You should see Bronze/Silver/Gold tables
   - Click to preview data

---

## 🐛 Troubleshooting

### Issue 1: "fetch failed" Error

**Symptom:** Workflow fails immediately with "fetch failed"

**Cause:** Prefect server not running

**Fix:**
```bash
# Check if Prefect is running
docker ps | grep prefect

# If not running, start it
cd c:/Dev/FlowForge
docker-compose up -d prefect-server

# Verify API
curl http://localhost:4200/api/health
```

### Issue 2: "Deployment not found" (404 Error)

**Symptom:** Workflow fails with "Prefect request failed (404): Deployment not found"

**Cause:** Prefect deployment hasn't been created

**Fix:**
```bash
cd c:/Dev/FlowForge/prefect-flows

# Install dependencies if needed
pip install -r requirements.txt

# Create deployment
python create_deployment.py

# Copy the deployment ID output
# Update apps/web/.env.local with the new PREFECT_DEPLOYMENT_ID
```

### Issue 3: OpenAI API Key Invalid

**Symptom:** AI schema detection fails with "Invalid API key"

**Cause:** Missing or incorrect OpenAI API key

**Fix:**
1. Get API key from: https://platform.openai.com/api-keys
2. Update `apps/web/.env.local`:
   ```bash
   OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE
   ```
3. Restart the web app

### Issue 4: Port Already in Use

**Symptom:** "Port 3000/4200/9000 already in use"

**Cause:** Another application is using the port

**Fix:**
```bash
# Find process using port (Windows)
netstat -ano | findstr :3000
netstat -ano | findstr :4200

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F

# Or use different ports in .env.local
```

### Issue 5: MinIO Buckets Not Found

**Symptom:** Workflow fails with "Bucket not found"

**Cause:** MinIO client didn't create buckets

**Fix:**
```bash
# Recreate buckets manually
docker-compose down
docker-compose up -d

# Or create via MinIO console:
# http://localhost:9001 → Create bucket "flowforge-data"
```

### Issue 6: Python Dependencies Missing

**Symptom:** `ModuleNotFoundError: No module named 'prefect'`

**Cause:** Python dependencies not installed

**Fix:**
```bash
cd c:/Dev/FlowForge/prefect-flows

# Install with admin rights (Windows)
pip install -r requirements.txt --user

# Or create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

### Issue 7: Database Connection Failed

**Symptom:** "Connection refused" to PostgreSQL

**Cause:** PostgreSQL container not running

**Fix:**
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Restart if needed
docker-compose restart postgres

# Verify connection
docker exec -it flowforge-postgres psql -U flowforge -d flowforge -c "\dt"
```

---

## 📊 Health Check Checklist

Before running workflows, verify all services are healthy:

- [ ] Docker Desktop is running
- [ ] `docker ps` shows 3 running containers
- [ ] Prefect API returns `true`: `curl http://localhost:4200/api/health`
- [ ] MinIO Console accessible: http://localhost:9001
- [ ] Web app running: http://localhost:3000
- [ ] OpenAI API key configured in `.env.local`
- [ ] Python dependencies installed: `pip list | grep prefect`
- [ ] Node dependencies installed: `npm list`
- [ ] Prefect deployment created and ID in `.env.local`
- [ ] MinIO bucket `flowforge-data` exists

---

## 🎯 Quick Start Commands (Copy-Paste)

```bash
# Start everything from scratch
cd c:/Dev/FlowForge
docker-compose up -d
cd prefect-flows && pip install -r requirements.txt && python create_deployment.py
cd ../apps/web && npm install && npm run dev

# Verify all services
curl http://localhost:4200/api/health  # Should return: true
curl http://localhost:9000/minio/health/live  # Should return: HTTP 200
docker ps  # Should show 3 containers running

# Open application
start http://localhost:3000  # Windows
open http://localhost:3000   # Mac
```

---

## 📞 Support

**Documentation:**
- Feature Tracker: `FEATURE-DEVELOPMENT-TRACKER.md`
- MVP Assessment: `MVP-SALES-READINESS-ASSESSMENT.md`
- Setup Guide (New Laptop): `SETUP-GUIDE-NEW-LAPTOP.md`

**Common Issues:**
- See Troubleshooting section above
- Check Docker logs: `docker logs flowforge-prefect-server`
- Check web app logs in terminal running `npm run dev`

**Environment:**
- Development Mode: `NODE_ENV=development`
- API Endpoints: http://localhost:3000/api/*
- Prefect UI: http://localhost:4200
- MinIO Console: http://localhost:9001

---

**Last Verified:** October 20, 2025
**Application Version:** MVP (95% Production-Ready)
**Prerequisites Status:** All documented and verified ✅
