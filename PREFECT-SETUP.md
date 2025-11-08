# Prefect Setup Guide - FlowForge

## Problem: SQLite Database Locking

When running Prefect with SQLite (the default local setup), concurrent writes from the worker can cause "database is locked" errors. This happens because SQLite doesn't handle concurrent writes well.

## Solution: Use Docker Prefect Server with Postgres

FlowForge includes a Docker-based Prefect Server running on Postgres, which handles concurrency properly.

### Architecture

```
┌─────────────────────────────────────────┐
│  Docker Containers (docker-compose.yml) │
├─────────────────────────────────────────┤
│  • flowforge-prefect-server             │
│    - Image: prefecthq/prefect:2         │
│    - Port: 4200                         │
│    - API: http://localhost:4200/api     │
│                                         │
│  • flowforge-postgres                   │
│    - Image: postgres:15                 │
│    - Database: prefect                  │
└─────────────────────────────────────────┘
           ▲
           │ HTTP API calls
           │
    ┌──────┴──────┐
    │   Worker    │
    │  (Process)  │
    └─────────────┘
```

## Setup Steps

### 1. Start Docker Containers

```powershell
# From the FlowForge root directory
docker-compose up -d
```

Verify containers are running:
```powershell
docker ps
# Should show: flowforge-prefect-server and flowforge-postgres
```

### 2. Configure Prefect Worker

Run the setup script (in your activated .venv):

```powershell
# Activate virtual environment first
.venv\Scripts\Activate.ps1

# Navigate to prefect-flows directory
cd prefect-flows

# Run setup script
.\setup-prefect-worker.ps1
```

The script will:
- Set `PREFECT_API_URL=http://localhost:4200/api`
- Test connection to Prefect Server
- Create the work pool `flowforge-development`
- Verify configuration

### 3. Start Prefect Worker

```powershell
# Make sure you're in activated .venv and prefect-flows directory
prefect worker start --pool flowforge-development --type process --name flowforge-worker
```

## Verification

### Check API Connection

```powershell
# Set environment variable (if not already set)
$env:PREFECT_API_URL = 'http://localhost:4200/api'

# Ping server
prefect server ping
# Should return: true
```

### Check Configuration

```powershell
prefect config view | Select-String PREFECT_API_URL
# Should show: PREFECT_API_URL='http://localhost:4200/api'
```

### Check Health Endpoint

```powershell
curl http://localhost:4200/api/health
# Should return: true
```

### Verify No SQLite References

When connected to the Docker server, error logs should NOT mention:
- `sqlite`
- `aiosqlite`
- `database is locked`

If you see these, the worker is still using local SQLite instead of the Docker server.

## Troubleshooting

### Worker still using SQLite

Make sure the environment variable is set in the same PowerShell session where you start the worker:

```powershell
# Set in current session
$env:PREFECT_API_URL = 'http://localhost:4200/api'

# Verify it's set
echo $env:PREFECT_API_URL

# Start worker in same session
prefect worker start --pool flowforge-development --type process --name flowforge-worker
```

### Docker containers not running

```powershell
# Check status
docker ps -a

# Restart if needed
docker-compose down
docker-compose up -d

# Check logs
docker logs flowforge-prefect-server
docker logs flowforge-postgres
```

### Port 4200 in use

Check what's using the port:
```powershell
netstat -ano | findstr :4200
```

If another process is using it, either stop that process or change the port in `docker-compose.yml`.

## Alternative: Fix SQLite Configuration (Not Recommended)

If you must use SQLite locally, increase the lock timeout:

```powershell
prefect config set PREFECT_API_DATABASE_CONNECTION_URL="sqlite+aiosqlite:///C:/Users/youruser/.prefect/prefect.db?timeout=60&cache=shared"
```

**Important**:
- Stop all Prefect servers first
- Delete any `*.db-wal` and `*.db-shm` files next to the database
- Start only ONE Prefect server instance
- This is not recommended for production use

## Docker Compose Configuration

The `docker-compose.yml` includes:

```yaml
services:
  prefect-server:
    image: prefecthq/prefect:2
    container_name: flowforge-prefect-server
    ports:
      - "4200:4200"
    environment:
      - PREFECT_API_URL=http://0.0.0.0:4200/api
      - PREFECT_API_DATABASE_CONNECTION_URL=postgresql+asyncpg://prefect:prefect@postgres:5432/prefect
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    container_name: flowforge-postgres
    environment:
      - POSTGRES_USER=prefect
      - POSTGRES_PASSWORD=prefect
      - POSTGRES_DB=prefect
```

## Summary

✅ **Use Docker Prefect Server** (Postgres) - Recommended
- No database locking issues
- Handles concurrent writes properly
- Production-ready
- Already configured in `docker-compose.yml`

❌ **Don't use local SQLite** for workers
- Causes "database is locked" errors
- Not suitable for concurrent operations
- Single-threaded writes only
