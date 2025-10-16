# FlowForge MVP Features

**Version:** 1.0 MVP
**Status:** In Progress
**Target Completion:** TBD

---

## Overview

FlowForge MVP is an **Enterprise Data Platform (EDP)** focused on implementing the **Medallion Architecture** (Bronze → Silver → Gold) for data ingestion, transformation, and analytics. The MVP enables self-service file-based data ingestion with AI-assisted configuration and comprehensive execution monitoring.

---

## ✅ MVP Feature Set

### 1. File Upload & AI-Assisted Configuration

#### 1.1 Manual File Upload (All Supported Formats)
- **Status:** ✅ **COMPLETE**
- **Supported File Types:**
  - CSV (`.csv`, `.txt`, `.tsv`)
  - JSON (`.json`, `.jsonl`, `.ndjson`)
  - Parquet (`.parquet`)
  - Excel (`.xlsx`, `.xls`)
- **Features:**
  - **Auto-Format Detection** - File format automatically detected from extension
  - **Drag-and-drop** file upload interface
  - **File size validation** (configurable max size)
  - **Accepts all formats** in single upload component
  - **Landing zone storage** - Files stored in MinIO S3 `landing/` folder

#### 1.2 AI-Powered CSV Validation (3-Stage Pipeline)
- **Status:** ✅ **COMPLETE**
- **Stage 1: Basic Validation (30%)**
  - Row count detection
  - Column count detection
  - File size validation
  - Encoding detection
- **Stage 2: Header Detection (70%)**
  - AI determines if file has headers
  - Confidence score (0-100%)
  - Reasoning provided
- **Stage 3: Schema Generation (100%)**
  - **With Headers:** Uses existing column names
  - **Without Headers:** AI generates intelligent column names
    - Suggested names based on data patterns
    - Data type inference
    - Confidence scores per column
    - Reasoning for each suggestion
  - **Column Mapping Editor** - User can accept/modify AI suggestions

#### 1.3 Upload Modes
- **Status:** ⚠️ **PARTIAL** (Single file complete, pattern/directory pending)
- **Single File Upload:** ✅ Complete
  - Upload one file at a time
  - Immediate processing
- **Pattern Matching:** ⏳ Pending
  - Upload sample file for schema detection
  - Define file pattern (e.g., `customer_*.csv`)
  - System scans landing zone for matches
  - Process multiple matching files
- **Directory Upload:** ⏳ Pending
  - Watch entire directory
  - Auto-process new files

---

### 2. Medallion Architecture Configuration

#### 2.1 Bronze Layer Configuration
- **Status:** ✅ **COMPLETE**
- **Load Strategy:**
  - Append (add new records)
  - Full Refresh (truncate and reload)
  - Incremental (delta loads with watermark)
- **Audit Columns:**
  - `_ingested_at` (timestamp)
  - `_source_file` (filename)
  - `_batch_id` (UUID)
  - `_row_number` (sequence)
  - `_source_system` (system identifier)
  - `_file_modified_at` (file timestamp)
- **Advanced Options:**
  - Watermark column selection
  - Watermark type (timestamp/integer/date)
  - Lookback window (hours)
  - Partition strategy (hive/delta/iceberg)
  - Schema evolution (strict/add_new_columns/ignore_extra)
- **Storage:**
  - Parquet format
  - Human-readable file naming: `bronze/{workflow_slug}/{job_slug}/{date}/{workflow}_{job}_{runId}_v001.parquet`
  - MinIO/S3 storage

#### 2.2 Silver Layer Configuration
- **Status:** ✅ **COMPLETE**
- **Merge Strategy:**
  - **Merge/Upsert** - Update existing, insert new (based on primary key)
  - **Full Refresh** - Truncate and reload
  - **Append** - Add all records
  - **SCD Type 2** - Slowly Changing Dimension tracking (config ready, execution pending)
- **Primary Key Selection:**
  - Single column primary key
  - Composite primary keys (multiple columns)
  - AI-assisted primary key detection with confidence scores
- **Surrogate Key Strategy:**
  - Auto-increment (sequential IDs)
  - UUID (unique identifiers)
  - Hash (deterministic based on natural key)
  - Use existing column
- **Deduplication:**
  - Conflict resolution: source_wins | target_wins | most_recent
  - Update strategy: update_all | update_changed | custom
- **Storage:**
  - Parquet format
  - Human-readable naming: `silver/{workflow_slug}/{job_slug}/{date}/{workflow}_{job}_{runId}_v001.parquet`
  - MinIO/S3 storage

#### 2.3 Gold Layer Configuration
- **Status:** ✅ **COMPLETE**
- **Build Strategy:**
  - **Full Rebuild** - Recreate entire table
  - **Incremental** - Update changed records only
  - **Snapshot** - Point-in-time snapshot
- **Aggregation:**
  - Group by columns
  - Time-based aggregation (daily/weekly/monthly/yearly)
- **Features:**
  - Compression options (snappy/gzip/zstd/none)
  - Materialization type (table/view/materialized_view)
  - Export enabled (to external systems)
  - Export targets (S3, Snowflake, BigQuery, etc.)
- **Storage:**
  - Parquet format
  - Human-readable naming: `gold/{workflow_slug}/{job_slug}/{date}/{workflow}_{job}_{runId}_v001.parquet`
  - MinIO/S3 storage

---

### 3. Workflow Management

#### 3.1 Create Workflows
- **Status:** ✅ **COMPLETE**
- **Basic Information:**
  - Workflow name (required)
  - Description (required)
  - Removed redundant "Source Application" field (agnostic workflows)
- **Ownership:**
  - Business unit (10 options)
  - Owning team (8 team options)
- **Configuration:**
  - Workflow trigger type: Manual (Scheduled/Event-driven coming soon)
  - Environment (dev/qa/prod)
  - Data classification (public/internal/confidential/PII)
  - Priority/SLA (critical/high/medium/low)
- **Additional Settings:**
  - Notification email(s)
  - Tags (for categorization)
  - Data retention (30/60/90/180/365/730 days)
- **Auto-Navigation:** After creation, automatically navigate to workflow detail page

#### 3.2 View Workflows
- **Status:** ✅ **COMPLETE**
- **Features:**
  - List all workflows
  - Last execution status indicator
  - Last run timestamp
  - Quick filters
  - Search functionality

#### 3.3 Workflow Details Page
- **Status:** ✅ **COMPLETE**
- **Features:**
  - Workflow metadata display
  - List of jobs in workflow (with order)
  - Job status indicators
  - Recent execution history
  - Execute workflow button
  - Add job button
  - Edit workflow metadata

---

### 4. Job Management

#### 4.1 Create Jobs
- **Status:** ✅ **COMPLETE**
- **Job Configuration:**
  - Job name and description
  - Job type: File-based (Database/NoSQL/API coming soon)
  - Execution order
- **Source Configuration:**
  - File source location selector
  - Upload mode (single/pattern/directory)
  - File upload with AI validation
  - Column mapping editor
- **Destination Configuration:**
  - Bronze, Silver, Gold layer settings
  - All medallion configuration options (see section 2)
- **Landing Files Viewer:**
  - View uploaded files in workflow landing zone
  - File metadata (name, size, upload time)
  - Delete files from landing zone

#### 4.2 Edit Jobs
- **Status:** ✅ **COMPLETE**
- Modify existing job configuration
- Update source/destination settings
- Change execution order

#### 4.3 Clone Jobs
- **Status:** ✅ **COMPLETE**
- Duplicate job configuration
- Auto-generate new job name with `_copy` suffix
- Modify cloned job independently

#### 4.4 Delete Jobs
- **Status:** ✅ **COMPLETE**
- Remove jobs from workflow
- Confirmation dialog

#### 4.5 View Job Details
- **Status:** ✅ **COMPLETE**
- Comprehensive modal showing:
  - Source configuration
  - Bronze/Silver/Gold settings
  - Column mappings
  - Primary keys
  - Surrogate key strategy
  - All configuration options

---

### 5. Manual Workflow Execution

#### 5.1 Trigger Execution
- **Status:** ✅ **COMPLETE**
- **Features:**
  - "Run Workflow" button on workflow detail page
  - Prefect flow orchestration
  - Sequential job execution
  - Bronze → Silver → Gold pipeline
- **Execution Flow:**
  1. Create workflow execution record
  2. For each job in order:
     - Create job execution record
     - Trigger Prefect medallion flow
     - Pass job configuration (source, destination, mappings)
     - Execute Bronze → Silver → Gold tasks sequentially
  3. Update execution status
  4. Navigate to Execution Monitor

#### 5.2 Execution Monitoring
- **Status:** ✅ **COMPLETE**
- **Features:**
  - Real-time execution status tracking
  - Expandable execution cards
  - Job-level status indicators
  - Bronze/Silver/Gold record counts
  - Execution logs display
  - Error messages and stack traces
  - Duration tracking
  - Timestamp display

#### 5.3 Orchestration Overview Dashboard
- **Status:** ✅ **COMPLETE**
- **Metrics:**
  - Active workflows count
  - Running executions count
  - Success rate percentage
  - Failed executions count
- **Recent Activity:**
  - Last 10 executions
  - Status, workflow name, start time
  - Click-through navigation to execution details

#### 5.4 Execution Monitor Page
- **Status:** ✅ **COMPLETE**
- **Features:**
  - Time range filter (24h/7d/30d/all time)
  - Execution status filter
  - Hierarchical view:
    - Workflow execution → Job executions → Stage results
  - Expand/collapse execution cards
  - Detailed logs per stage
  - Record count metrics
  - Error details

---

### 6. Data Assets Explorer

#### 6.1 Browse Assets
- **Status:** ✅ **COMPLETE**
- **Three-Panel Layout:**
  - **Left Panel:** Filters
  - **Middle Panel:** Asset list
  - **Right Panel:** Asset details
- **Filters:**
  - Environment selector (dev/qa/uat/prod)
  - Medallion layer (bronze/silver/gold)
  - Workflow filter
  - Quality status filter
  - Search bar
  - Clear all filters button
- **Asset List:**
  - Asset cards with metadata
  - Layer badge
  - Row count
  - File size
  - Last updated timestamp
  - Click to select

#### 6.2 Asset Details (Tabbed View)
- **Status:** ⚠️ **PARTIAL**

**✅ Overview Tab (COMPLETE):**
- Description
- Owner
- Environment badge
- Created/Updated timestamps
- Statistics (row count, columns, file size)
- File path with copy button
- Tags display

**✅ Schema Tab (COMPLETE):**
- Column list with:
  - Column name
  - Data type (actual Polars types)
  - Nullable indicator
- Export schema button

**⏳ Sample Data Tab (PENDING - Phase 2):**
- Interactive data grid
- First 100 rows preview
- Column sorting/filtering

**⏳ Quality Tab (PENDING):**
- Overall quality score (0-100%)
- Quality rules table
- Rule execution results
- Pass/fail counts

**⏳ Lineage Tab (PENDING):**
- Mini lineage preview
- Source → Current → Target visualization
- "View Full Lineage" button
- Interactive lineage graph (Phase 2)

**⏳ Jobs Tab (PENDING):**
- Producing workflow/job
- Recent executions
- Click-through to workflow
- Execution history

#### 6.3 Metadata Catalog Integration
- **Status:** ✅ **COMPLETE**
- **Features:**
  - Auto-population from Prefect flows
  - Schema tracking with actual Polars data types
  - Row count tracking
  - File size tracking
  - File path storage
  - Environment tagging
  - Parent table lineage (JSON array)
  - Created/Updated timestamps

---

## 🔧 Technical Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Custom component library
- **State Management:** React hooks
- **Data Fetching:** Native fetch with API routes

### Backend
- **API:** Next.js API Routes
- **Database:** SQLite (with WAL mode)
- **ORM:** better-sqlite3 (direct SQL)
- **Migrations:** Custom migration system

### Orchestration
- **Engine:** Prefect 2.14+
- **Worker Pool:** `flowforge-local`
- **Deployment:** Local development mode
- **Server:** Prefect UI at `http://localhost:4200`

### Data Processing
- **Library:** Polars (fast DataFrame operations)
- **File Formats:** CSV, JSON, Parquet, Excel
- **Handlers:** Pluggable file handler framework

### Storage
- **Object Storage:** MinIO (S3-compatible)
- **Endpoint:** `http://localhost:9000`
- **Bucket:** `flowforge-data`
- **Structure:**
  - `landing/` - Uploaded source files
  - `bronze/` - Raw ingested data
  - `silver/` - Cleaned/transformed data
  - `gold/` - Analytics-ready data

### AI Integration
- **Provider:** Anthropic Claude (via API)
- **Use Cases:**
  - CSV header detection
  - Column naming for headerless files
  - Schema inference
  - Primary key detection

---

## 📊 MVP Completion Status

| Feature Category | Completion | Notes |
|-----------------|-----------|-------|
| File Upload & AI Validation | 95% | Single file complete, pattern/directory pending |
| Bronze Layer | 100% | Fully functional |
| Silver Layer | 95% | SCD Type 2 config ready, execution pending |
| Gold Layer | 100% | Fully functional |
| Workflow Management | 100% | Create, view, execute complete |
| Job Management | 100% | CRUD operations complete |
| Manual Execution | 100% | Prefect integration working |
| Execution Monitoring | 100% | Real-time tracking complete |
| Data Assets Explorer | 75% | Browse/Filter/Overview/Schema complete, Sample/Quality/Lineage/Jobs pending |
| Metadata Catalog | 100% | Auto-population working |

**Overall MVP Completion: ~92%**

---

## 🎯 Remaining MVP Work

### High Priority (Must-Have for MVP)
1. **Pattern Matching Upload** - Implement file pattern scanning and multi-file processing
2. **Data Assets Sample Tab** - Display first 100 rows in interactive grid
3. **Data Assets Quality Tab** - Show quality rules and scores (if rules configured)
4. **Data Assets Lineage Tab** - Display parent tables from metadata
5. **Data Assets Jobs Tab** - Show producing workflow and recent executions
6. **SCD Type 2 Execution** - Implement Silver layer SCD Type 2 processing logic

### Medium Priority (Nice-to-Have for MVP)
1. **Directory Upload Mode** - Watch directory for new files
2. **Workflow Editing** - Edit workflow metadata after creation
3. **Job Reordering** - Drag-and-drop job order changes
4. **Bulk Job Operations** - Enable/disable multiple jobs at once

### Low Priority (Post-MVP)
1. **Export Functionality** - Export schema, download data
2. **Advanced Filters** - Date range, custom queries
3. **Bulk Asset Operations** - Tag multiple assets, bulk delete

---

## 🚀 Post-MVP Enhancements

See `FEATURES-COMING-SOON.md` for detailed roadmap of:
- Scheduled workflows (cron-based)
- Event-driven workflows (file arrival, webhooks)
- Database source jobs (SQL Server, PostgreSQL, Oracle, MySQL)
- NoSQL source jobs (MongoDB, Cassandra, DocumentDB)
- API source jobs (REST/GraphQL)
- Gold Analytics jobs (multi-table aggregation with joins)
- Quality module (automated data quality rules)
- Reconciliation module (source-to-target validation)
- Integrations (Cloud storage, SFTP, Data warehouse exports)
- Advanced observability (alerts, incidents, metrics)
- User management and RBAC
- Interactive lineage graph

---

## 📝 Notes

- **Manual Trigger Only:** MVP focuses on on-demand execution. Scheduling is post-MVP.
- **File-Based Only:** MVP supports file uploads. Database/API sources are post-MVP.
- **Local Development:** MVP targets local development environment. Production deployment is post-MVP.
- **Single User:** MVP assumes single-user operation. Multi-user auth/RBAC is post-MVP.
- **MinIO S3:** MVP uses local MinIO. AWS S3 integration is post-MVP.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Status:** Living Document - Updates as MVP progresses
