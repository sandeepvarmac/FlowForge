# FlowForge

**A Modern Data Pipeline Platform with AI-Powered Schema Detection**

FlowForge is a full-stack data engineering platform that enables building, orchestrating, and monitoring data pipelines using a medallion architecture (Bronze → Silver → Gold). It features AI-powered schema detection, data quality validation, and seamless workflow orchestration.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup Guide](#detailed-setup-guide)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Features](#features)
- [Troubleshooting](#troubleshooting)
- [Development Notes](#development-notes)

---

## Architecture Overview

FlowForge is a **monorepo** with a hybrid architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FlowForge Platform                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Next.js App    │    │  Prefect Server  │                   │
│  │   (Port 3000)    │◄──►│   (Port 4200)    │                   │
│  │                  │    │                  │                   │
│  │  - React UI      │    │  - Orchestration │                   │
│  │  - API Routes    │    │  - Scheduling    │                   │
│  │  - SQLite DB     │    │  - Monitoring    │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌──────────────────────────────────────────┐                   │
│  │              Data Storage                 │                   │
│  │  ┌────────┐  ┌────────┐  ┌────────────┐  │                   │
│  │  │ Bronze │─►│ Silver │─►│    Gold    │  │                   │
│  │  │ (Raw)  │  │(Clean) │  │(Analytics) │  │                   │
│  │  └────────┘  └────────┘  └────────────┘  │                   │
│  │         MinIO S3 / Local Filesystem       │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
│  ┌──────────────────────────────────────────┐                   │
│  │           External Services               │                   │
│  │  • Anthropic Claude (Primary AI)          │                   │
│  │  • OpenAI GPT-4 (Fallback AI)            │                   │
│  │  • PostgreSQL (Prefect metadata)          │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Medallion Architecture

- **Bronze Layer**: Raw data ingestion (CSV, database extracts) stored as Parquet files
- **Silver Layer**: Cleaned, deduplicated, and transformed data
- **Gold Layer**: Business-ready analytics with dimensional modeling (DuckDB)

---

## Tech Stack

### Frontend & Backend (Next.js)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.5 | Full-stack React framework |
| React | 18.3.1 | UI library |
| TypeScript | 5.5.4 | Type safety |
| Tailwind CSS | 3.4.10 | Styling |
| Radix UI | Latest | Accessible components |
| Recharts | 3.2.0 | Data visualization |

### Database & Storage

| Technology | Purpose |
|------------|---------|
| SQLite (better-sqlite3) | Workflow metadata storage |
| DuckDB | Analytics queries on Parquet |
| Apache Parquet | Columnar data format |
| MinIO | S3-compatible object storage |

### AI Integration

| Service | Model | Purpose |
|---------|-------|---------|
| Anthropic | claude-sonnet-4-5-20250929 | Primary AI (schema analysis, config) |
| OpenAI | gpt-4o-mini | Fallback AI |

### Orchestration (Python)

| Technology | Version | Purpose |
|------------|---------|---------|
| Prefect | 2.20.23 | Workflow orchestration |
| Polars | 0.20.0+ | Fast DataFrame operations |
| SQLAlchemy | 2.0.23+ | Database connectors |

---

## Prerequisites

Before starting, ensure you have:

| Requirement | Version | Installation |
|-------------|---------|--------------|
| **Node.js** | 22.x LTS | [Download](https://nodejs.org/) |
| **Python** | 3.11+ | [Download](https://python.org/) |
| **Docker Desktop** | Latest | [Download](https://docker.com/products/docker-desktop) |
| **Git** | Latest | [Download](https://git-scm.com/) |

### Required Ports

Ensure these ports are available:

| Port | Service |
|------|---------|
| 3000 | Next.js Web App |
| 4200 | Prefect Server UI & API |
| 5432 | PostgreSQL |
| 9000 | MinIO API |
| 9001 | MinIO Console |

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd FlowForge

# 2. Start infrastructure (MinIO, PostgreSQL, Prefect)
docker-compose up -d

# 3. Verify containers are running
docker ps
# You should see: minio, postgres, prefect-server, prefect-worker

# 4. Setup Python environment
cd prefect-flows
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # Mac/Linux
pip install -r requirements.txt
cd ..

# 5. Setup Node.js
cd apps/web
npm install

# 6. Configure environment (see Environment Variables section)
# Create .env.local with your API keys

# 7. Start development server
npm run dev

# 8. Open browser
# Web App: http://localhost:3000
# Prefect UI: http://localhost:4200
# MinIO Console: http://localhost:9001
```

---

## Detailed Setup Guide

### Step 1: Start Docker Services

```bash
# From project root
docker-compose up -d

# Verify all services are healthy
docker-compose ps

# Expected output:
# NAME                STATUS
# flowforge-minio     running (healthy)
# flowforge-postgres  running (healthy)
# prefect-server      running
# prefect-worker      running
```

### Step 2: Setup Python Environment

```bash
cd prefect-flows

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env.local for Prefect
cp .env.example .env.local
# Edit .env.local with your settings
```

### Step 3: Create Prefect Deployment (Optional)

If you need to run scheduled workflows via Prefect:

```bash
cd prefect-flows

# Activate virtual environment if not already
.\venv\Scripts\activate

# Create deployment
python create_deployment.py

# Note the deployment ID printed - you'll need it for .env.local
```

### Step 4: Setup Node.js Application

```bash
cd apps/web

# Install dependencies
npm install

# Create environment file
# Windows:
copy .env.example .env.local
# Mac/Linux:
cp .env.example .env.local

# Edit .env.local with your API keys and settings
```

### Step 5: Initialize Database

The SQLite database is automatically created on first run. If you need to reset it:

```bash
# Delete existing database
rm apps/web/data/flowforge.db

# Restart the application - it will recreate the schema
npm run dev
```

### Step 6: Verify Installation

1. **Web Application**: http://localhost:3000
   - Should show the FlowForge dashboard

2. **Prefect UI**: http://localhost:4200
   - Should show the Prefect dashboard

3. **MinIO Console**: http://localhost:9001
   - Login: `minioadmin` / `minioadmin123`
   - Should show the `flowforge-data` bucket

---

## Environment Variables

### Web Application (`apps/web/.env.local`)

```bash
# ============================================
# AI Configuration (Required for AI features)
# ============================================
ANTHROPIC_API_KEY=sk-ant-api03-...           # Get from console.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

OPENAI_API_KEY=sk-proj-...                   # Get from platform.openai.com
OPENAI_MODEL=gpt-4o-mini

# ============================================
# Database Configuration
# ============================================
DATABASE_PATH=./data/flowforge.db
DUCKDB_PATH=./data/analytics.duckdb

# ============================================
# File Storage Paths
# ============================================
UPLOAD_DIR=./data/uploads
BRONZE_DIR=./data/bronze
SILVER_DIR=./data/silver
GOLD_DIR=./data/gold

# ============================================
# Application Settings
# ============================================
NODE_ENV=development
ENVIRONMENT=development

# ============================================
# Prefect Orchestration
# ============================================
PREFECT_API_URL=http://127.0.0.1:4200/api
PREFECT_DEPLOYMENT_ID=                        # From create_deployment.py output

# ============================================
# MinIO / S3 Configuration
# ============================================
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
S3_BUCKET_NAME=flowforge-data

# ============================================
# SQLite Configuration
# ============================================
SQLITE_JOURNAL_MODE=DELETE                    # Required for Docker volumes
```

### Prefect Flows (`prefect-flows/.env.local`)

```bash
# ============================================
# MinIO / S3 Configuration
# ============================================
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=prefect
S3_SECRET_ACCESS_KEY=prefect123
S3_BUCKET_NAME=flowforge-data
S3_REGION=us-east-1

# ============================================
# Prefect Configuration
# ============================================
PREFECT_API_URL=http://localhost:4200/api

# ============================================
# PostgreSQL (Prefect Backend)
# ============================================
DATABASE_URL=postgresql://flowforge:flowforge123@localhost:5432/flowforge

# ============================================
# DuckDB Analytics
# ============================================
DUCKDB_PATH=./data/duckdb/analytics.duckdb

# ============================================
# Environment
# ============================================
ENVIRONMENT=local
LOG_LEVEL=INFO

# ============================================
# AI Configuration (For Python flows)
# ============================================
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

---

## Project Structure

```
FlowForge/
├── apps/
│   └── web/                              # Next.js application
│       ├── src/
│       │   ├── app/
│       │   │   ├── (routes)/            # Page routes
│       │   │   │   ├── workflows/       # Workflow management
│       │   │   │   ├── jobs/            # Job configuration
│       │   │   │   ├── data-assets/     # Data catalog & explorer
│       │   │   │   ├── integrations/    # Source connections
│       │   │   │   └── executions/      # Execution history
│       │   │   ├── api/                 # 52 API routes
│       │   │   ├── layout.tsx           # Root layout
│       │   │   └── page.tsx             # Homepage
│       │   ├── components/              # React components
│       │   │   ├── ai/                  # AI suggestion cards
│       │   │   ├── dashboard/           # Dashboard widgets
│       │   │   ├── data-assets/         # Data explorer UI
│       │   │   ├── database/            # DB connection modals
│       │   │   ├── jobs/                # Job management UI
│       │   │   ├── workflows/           # Workflow UI
│       │   │   └── ui/                  # Shared UI components
│       │   ├── lib/
│       │   │   ├── ai/                  # AI client wrappers
│       │   │   ├── db/                  # SQLite database layer
│       │   │   │   ├── index.ts         # DB initialization
│       │   │   │   └── schema.ts        # Table definitions
│       │   │   ├── storage/             # File storage utilities
│       │   │   └── services/            # Business logic
│       │   └── types/                   # TypeScript definitions
│       ├── data/                        # Local data storage
│       │   ├── flowforge.db            # SQLite database
│       │   ├── bronze/                  # Raw data layer
│       │   ├── silver/                  # Cleaned data layer
│       │   └── gold/                    # Analytics layer
│       ├── public/                      # Static assets
│       ├── package.json                 # Node dependencies
│       ├── next.config.mjs              # Next.js config
│       ├── tailwind.config.ts           # Tailwind config
│       └── tsconfig.json                # TypeScript config
│
├── prefect-flows/                        # Python orchestration
│   ├── flows/
│   │   └── medallion.py                 # Main data pipeline
│   ├── tasks/
│   │   ├── bronze.py                    # Data ingestion
│   │   ├── silver.py                    # Transformation
│   │   ├── gold.py                      # Analytics
│   │   └── database_bronze.py           # DB source handling
│   ├── utils/
│   │   ├── s3.py                        # MinIO/S3 operations
│   │   ├── duckdb_helper.py             # DuckDB utilities
│   │   ├── database_connectors.py       # SQL connectors
│   │   └── ai_*.py                      # AI integrations
│   ├── scripts/                         # Setup scripts
│   ├── services/                        # Deployment management
│   ├── requirements.txt                 # Python dependencies
│   └── .env.example                     # Environment template
│
├── sample-data/                          # Test CSV files
├── docs/                                 # Additional documentation
├── docker-compose.yml                    # Infrastructure setup
├── ARCHITECTURE.md                       # Architecture decisions
├── PREREQUISITES.md                      # Setup prerequisites
└── README.md                             # This file
```

---

## Available Scripts

### Web Application (`apps/web/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (http://localhost:3000) |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suite |
| `npm run test:ui` | Run Vitest with interactive UI |

### Prefect Flows (`prefect-flows/`)

```bash
# Activate virtual environment first
.\venv\Scripts\activate

# Run flows locally
python flows/medallion.py

# Create deployment
python create_deployment.py

# Start Prefect worker
prefect worker start --pool default
```

### Docker Services

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start all services |
| `docker-compose down` | Stop all services |
| `docker-compose ps` | Check service status |
| `docker-compose logs -f <service>` | View service logs |
| `docker-compose restart <service>` | Restart a service |

---

## Database Schema

The SQLite database (`data/flowforge.db`) contains 15 main tables:

### Core Tables

| Table | Purpose |
|-------|---------|
| `database_connections` | Reusable database source configurations |
| `workflows` | Workflow definitions (name, owner, status, type) |
| `workflow_triggers` | Scheduling (cron), dependencies, events |
| `jobs` | Individual data processing job configurations |
| `executions` | Workflow execution history |
| `job_executions` | Individual job execution details |

### Data Quality Tables

| Table | Purpose |
|-------|---------|
| `dq_rules` | Data quality validation rules |
| `dq_rule_executions` | Quality check results |
| `dq_quarantine` | Failed records requiring review |
| `reconciliation_rules` | Cross-layer reconciliation rules |
| `reconciliation_executions` | Reconciliation results |

### Metadata & Audit Tables

| Table | Purpose |
|-------|---------|
| `metadata_catalog` | Data asset metadata (bronze/silver/gold) |
| `ai_schema_analysis` | AI analysis cache |
| `audit_log` | System audit trail |

---

## API Routes

The application exposes 52 API routes. Key categories:

### Workflows

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows` | GET | List all workflows |
| `/api/workflows` | POST | Create workflow |
| `/api/workflows/[id]` | GET | Get workflow details |
| `/api/workflows/[id]/run` | POST | Execute workflow |

### Jobs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs/[jobId]` | GET | Get job details |
| `/api/jobs/[jobId]/execute` | POST | Execute single job |

### Data Assets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data-assets/list` | GET | List all data assets |
| `/api/data-assets/[id]/schema` | GET | Get asset schema |
| `/api/data-assets/[id]/sample` | GET | Preview asset data |
| `/api/data-assets/lineage` | GET | Data lineage graph |

### Database Connections

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/database-connections` | GET | List connections |
| `/api/database-connections` | POST | Create connection |
| `/api/database-connections/[id]/test` | POST | Test connection |
| `/api/database-connections/[id]/tables` | GET | List tables |

### AI Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/config/full` | POST | Full AI analysis |

---

## Features

### Implemented Features

1. **Workflow Orchestration**
   - Create, schedule, and execute data pipelines
   - Cron-based scheduling
   - Dependency management

2. **Data Sources**
   - CSV file uploads
   - Database connections (SQL Server, PostgreSQL, MySQL, Oracle)
   - Schema auto-detection

3. **Medallion Architecture**
   - Bronze: Raw data ingestion as Parquet
   - Silver: Cleaned and deduplicated data
   - Gold: Analytics-ready dimensional models

4. **Data Quality**
   - Rule-based validation
   - Quarantine for failed records
   - Cross-layer reconciliation

5. **AI Integration**
   - Schema analysis and column naming
   - Data profiling suggestions
   - Configuration assistance

6. **Metadata Catalog**
   - Data asset discovery
   - Lineage visualization
   - Schema documentation

7. **Monitoring**
   - Execution tracking
   - Performance metrics
   - Error logging

---

## Troubleshooting

### Common Issues

#### Docker containers not starting

```bash
# Check for port conflicts
netstat -an | findstr "3000 4200 5432 9000 9001"

# Reset Docker services
docker-compose down -v
docker-compose up -d
```

#### SQLite database locked

```bash
# Ensure SQLITE_JOURNAL_MODE is set
# In .env.local:
SQLITE_JOURNAL_MODE=DELETE

# Or delete the database and restart
rm apps/web/data/flowforge.db
npm run dev
```

#### Prefect worker not executing flows

```bash
# Check Prefect server is running
curl http://localhost:4200/api/health

# Restart Prefect services
docker-compose restart prefect-server prefect-worker

# Check worker logs
docker-compose logs -f prefect-worker
```

#### MinIO connection refused

```bash
# Verify MinIO is running
docker-compose ps | grep minio

# Check MinIO health
curl http://localhost:9000/minio/health/live

# Access MinIO console
# URL: http://localhost:9001
# Credentials: minioadmin / minioadmin123
```

#### AI features not working

1. Verify API keys are set in `.env.local`
2. Check API key validity at provider dashboards
3. Review console for specific error messages

---

## Development Notes

### Adding New API Routes

1. Create route file in `apps/web/src/app/api/`
2. Export `GET`, `POST`, `PUT`, `DELETE` functions
3. Use `NextResponse` for responses

### Adding Database Tables

1. Update schema in `apps/web/src/lib/db/schema.ts`
2. Add migration in `apps/web/src/lib/db/index.ts`
3. Create type definitions in `apps/web/src/types/`

### Running Tests

```bash
cd apps/web

# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/components/__tests__/MyComponent.test.tsx
```

### Production Deployment

For production deployment, consider:

1. **Storage**: Replace MinIO with AWS S3 or Azure Blob
2. **Orchestration**: Use Prefect Cloud or managed Prefect
3. **Database**: Consider PostgreSQL for metadata
4. **Hosting**: Vercel (Next.js) or containerized deployment

---

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Web Application | http://localhost:3000 | - |
| Prefect UI | http://localhost:4200 | - |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |
| MinIO API | http://localhost:9000 | - |
| PostgreSQL | localhost:5432 | flowforge / flowforge123 |

---

## Support & Contributing

For issues and feature requests, please open an issue in the repository.

---

## License

[Add your license information here]
