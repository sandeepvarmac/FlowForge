# CSV File Processing Framework - Implementation Plan

**Created:** 2025-10-13
**Priority:** High - Current Sprint
**Status:** Planning Phase

---

## Executive Summary

This document outlines the plan to build a comprehensive, production-ready CSV file ingestion framework for FlowForge. The framework will handle single files, pattern matching, headerless CSVs, schema validation, error handling, and data quality checks.

---

## Current State Analysis

### What's Already Built ✅

#### 1. **Basic CSV Ingestion (Bronze Layer)**
- **File:** `prefect-flows/tasks/bronze.py`
- **Features:**
  - Download CSV from S3 landing folder
  - Read CSV with/without headers (`has_header` parameter)
  - Apply column mappings for headerless CSVs
  - Add audit columns (`_ingested_at`, `_source_file`, `_row_number`)
  - Convert to Parquet with ZSTD compression
  - Upload to Bronze layer in S3
  - Write metadata to catalog
  - Update job execution metrics

#### 2. **UI Upload & AI Column Naming**
- **File:** `apps/web/src/components/jobs/csv-file-upload.tsx`
- **Features:**
  - Drag-and-drop file upload
  - AI-powered schema detection
  - Headerless CSV detection with AI column naming
  - Schema preview with data types
  - Sample data preview (first 5 rows)
  - Column name editing modal

#### 3. **Job Configuration Modal**
- **File:** `apps/web/src/components/jobs/create-job-modal.tsx`
- **Features:**
  - Upload mode selector (single file / pattern matching / directory)
  - File pattern input (e.g., `customer_*.csv`)
  - Bronze/Silver/Gold layer configuration
  - Load strategies (append / full refresh / incremental)
  - Merge strategies (merge/upsert / full refresh / append)
  - Surrogate key strategy selection
  - Primary key selection for deduplication

#### 4. **Silver Layer Transformation**
- **File:** `prefect-flows/tasks/silver.py`
- **Features:**
  - Read Bronze Parquet files
  - Deduplication (by primary key or all columns)
  - Add surrogate keys (`_sk_id`)
  - Archive previous version before overwriting
  - Write metadata to catalog

#### 5. **Utility Functions**
- **File:** `prefect-flows/utils/parquet_utils.py`
- **Functions:**
  - `read_csv()` - Read CSV with Polars (supports headerless)
  - `write_parquet()` - Write Parquet with compression
  - `read_parquet()` - Read Parquet files
  - `add_audit_columns()` - Add audit metadata
  - `deduplicate()` - Remove duplicate rows
  - `add_surrogate_key()` - Add auto-increment keys

### What's Missing ❌

#### 1. **Pattern Matching Implementation**
- File pattern detection in landing folder (e.g., `customer_*.csv`)
- Multiple file processing in a single job run
- File matching logic and validation

#### 2. **Advanced CSV Features**
- Custom delimiters (semicolon, pipe, tab)
- Custom encoding (UTF-8, Latin-1, Windows-1252)
- Skip rows configuration
- Quote character handling
- Escape character handling
- Null value representation (`NA`, `NULL`, empty string)

#### 3. **Data Quality & Validation**
- Schema validation (column count, data types)
- Required column validation
- Null value checks
- Duplicate detection before ingestion
- Row count validation (min/max thresholds)
- File size validation

#### 4. **Error Handling & Recovery**
- Graceful handling of malformed CSVs
- Quarantine bad files (move to error folder)
- Partial failure handling (some files succeed, some fail)
- Retry logic for transient errors
- Error reporting with context

#### 5. **Performance & Scalability**
- Large file handling (streaming/chunking)
- Parallel processing of multiple files
- Memory optimization
- Progress reporting for long-running jobs

#### 6. **Monitoring & Observability**
- File processing metrics (files processed, rows ingested, duration)
- Error tracking and alerting
- File lineage tracking
- Processing history per file

---

## Architecture Design

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CSV Ingestion Framework                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  File        │  │  Schema      │  │  Data        │      │
│  │  Discovery   │→ │  Validation  │→ │  Quality     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                  ↓                  ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  CSV         │  │  Transform   │  │  Error       │      │
│  │  Parsing     │→ │  & Enrich    │→ │  Handling    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                  ↓                  ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Parquet     │  │  Metadata    │  │  Monitoring  │      │
│  │  Write       │→ │  Catalog     │→ │  & Alerting  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### File Processing Workflow

```
Landing Folder (S3)
    │
    ├─ Single File Mode
    │   └─ customer.csv → Bronze → Silver → Gold
    │
    ├─ Pattern Matching Mode
    │   ├─ customer_jan.csv ┐
    │   ├─ customer_feb.csv ├→ Bronze (merged) → Silver → Gold
    │   └─ customer_mar.csv ┘
    │
    └─ Directory Mode (Future)
        └─ /customers/*.csv → Bronze → Silver → Gold
```

---

## Implementation Plan

### Phase 1: Pattern Matching & Multi-File Support (Immediate)

**Goal:** Enable processing multiple CSV files matching a pattern in a single job run.

#### Tasks

1. **Create File Discovery Utility**
   - **File:** `prefect-flows/utils/file_discovery.py`
   - **Functions:**
     - `list_files_in_landing(workflow_id, job_id, pattern)` - List matching files
     - `match_file_pattern(filename, pattern)` - Glob-style matching
     - `get_file_metadata(s3_key)` - Get size, modified date, etc.

2. **Update Bronze Task for Multi-File**
   - **File:** `prefect-flows/tasks/bronze.py`
   - **Changes:**
     - Detect if `landing_key` is a pattern or single file
     - Loop through matching files
     - Process each file sequentially
     - Merge into single Bronze Parquet or separate files
     - Return list of processed files

3. **Add File Processing Status Tracking**
   - **Database Table:** `file_processing_log`
   - **Columns:**
     - `id` (UUID)
     - `job_execution_id` (FK to job_executions)
     - `file_path` (S3 key)
     - `file_size` (bytes)
     - `status` (pending, processing, completed, failed, quarantined)
     - `rows_processed` (integer)
     - `error_message` (text, nullable)
     - `started_at` (timestamp)
     - `completed_at` (timestamp, nullable)

4. **UI Updates**
   - Show processing status for each file in pattern
   - Display file count and total rows
   - Show failed files with error messages

**Estimated Effort:** 1-2 days

---

### Phase 2: Advanced CSV Configuration (Next)

**Goal:** Support various CSV formats and configurations.

#### Tasks

1. **Extend FileConfig Interface**
   - **File:** `apps/web/src/types/workflow.ts`
   - **New Fields:**
     ```typescript
     interface FileConfig {
       // Existing fields...
       delimiter?: ',' | ';' | '|' | '\t' | string  // CSV delimiter
       encoding?: 'utf-8' | 'latin-1' | 'windows-1252' | string
       quoteChar?: '"' | "'" | string
       escapeChar?: '\\' | string
       skipRows?: number  // Skip N header rows
       nullValues?: string[]  // ['NA', 'NULL', '', 'N/A']
       dateFormat?: string  // e.g., '%Y-%m-%d'
       inferSchemaLength?: number  // Rows to scan for type inference
     }
     ```

2. **Update CSV Reading Logic**
   - **File:** `prefect-flows/utils/parquet_utils.py`
   - **Changes:**
     - Add parameters to `read_csv()` for delimiter, encoding, etc.
     - Pass configuration from job config to Polars `read_csv()`
     - Handle encoding errors gracefully

3. **Add Configuration UI**
   - **File:** `apps/web/src/components/jobs/create-job-modal.tsx`
   - **Add "Advanced CSV Options" Section:**
     - Delimiter dropdown
     - Encoding dropdown
     - Skip rows input
     - Null values (comma-separated)
     - Quote/escape character inputs
     - Collapsible "Advanced" section to keep UI clean

**Estimated Effort:** 1 day

---

### Phase 3: Schema Validation & Data Quality (Critical)

**Goal:** Validate CSV structure and data quality before ingestion.

#### Tasks

1. **Create Schema Validator**
   - **File:** `prefect-flows/utils/schema_validator.py`
   - **Functions:**
     - `validate_column_count(df, expected_count)` - Check column count
     - `validate_column_names(df, expected_names)` - Check column names
     - `validate_data_types(df, expected_types)` - Check data types
     - `validate_required_columns(df, required_cols)` - Check non-null
     - `detect_schema_drift(current_schema, expected_schema)` - Drift detection

2. **Create Data Quality Checker**
   - **File:** `prefect-flows/utils/data_quality.py`
   - **Functions:**
     - `check_null_percentage(df, column, max_percent)` - Null threshold
     - `check_duplicate_rows(df, subset)` - Duplicate detection
     - `check_row_count(df, min_rows, max_rows)` - Row count validation
     - `check_unique_values(df, column)` - Uniqueness check
     - `check_value_range(df, column, min_val, max_val)` - Range validation

3. **Add Validation to Bronze Task**
   - **File:** `prefect-flows/tasks/bronze.py`
   - **Changes:**
     - Run schema validation before processing
     - Run data quality checks
     - Fail job if critical validations fail
     - Log warnings for non-critical issues
     - Store validation results in metadata

4. **Create Validation Rules UI**
   - **File:** `apps/web/src/components/jobs/validation-rules-editor.tsx`
   - **Features:**
     - Add validation rules (required columns, data types, ranges)
     - Configure thresholds (max null %, min/max rows)
     - Toggle rules on/off
     - Set severity (error / warning)

**Estimated Effort:** 2-3 days

---

### Phase 4: Error Handling & Recovery (Production-Ready)

**Goal:** Gracefully handle errors and provide recovery mechanisms.

#### Tasks

1. **Create Error Handler**
   - **File:** `prefect-flows/utils/error_handler.py`
   - **Functions:**
     - `handle_csv_parse_error(file, error)` - Quarantine malformed CSVs
     - `handle_validation_error(file, validation_results)` - Handle validation failures
     - `quarantine_file(s3_key, reason)` - Move file to quarantine folder
     - `create_error_report(files, errors)` - Generate error summary

2. **Implement Quarantine Folder**
   - **S3 Structure:**
     ```
     landing/{workflow}/{job}/quarantine/{yyyymmdd}/{filename}
     ```
   - Store original file + error metadata JSON

3. **Add Retry Logic**
   - **File:** `prefect-flows/tasks/bronze.py`
   - **Changes:**
     - Retry failed file processing (3 attempts)
     - Exponential backoff
     - Log retry attempts
     - Fail job only after all retries exhausted

4. **Create Error Dashboard**
   - **UI Component:** `apps/web/src/components/jobs/error-dashboard.tsx`
   - **Features:**
     - Show quarantined files
     - Display error messages
     - Provide "Retry" button
     - Allow downloading error reports

**Estimated Effort:** 2 days

---

### Phase 5: Performance & Scalability (Optimization)

**Goal:** Handle large files and high-volume ingestion efficiently.

#### Tasks

1. **Implement Streaming CSV Reader**
   - **File:** `prefect-flows/utils/streaming_csv.py`
   - **Features:**
     - Read CSV in chunks (e.g., 100K rows per chunk)
     - Write multiple Parquet files for large CSVs
     - Parallel processing of chunks
     - Memory optimization

2. **Add Parallel File Processing**
   - **File:** `prefect-flows/tasks/bronze.py`
   - **Changes:**
     - Use Prefect's `task.map()` for parallel processing
     - Process multiple files concurrently
     - Merge results into single Bronze table

3. **Optimize Polars Configuration**
   - Tune batch sizes
   - Enable parallel CSV parsing
   - Use projection pushdown for large files

4. **Add Progress Reporting**
   - **File:** `prefect-flows/tasks/bronze.py`
   - **Changes:**
     - Log progress every N rows
     - Update job execution with progress %
     - Stream progress to UI (WebSocket?)

**Estimated Effort:** 2-3 days

---

### Phase 6: Monitoring & Observability (Production Operations)

**Goal:** Provide visibility into CSV processing pipeline.

#### Tasks

1. **Add Processing Metrics**
   - **Database Table:** `ingestion_metrics`
   - **Metrics:**
     - Files processed per day
     - Total rows ingested
     - Average processing time per file
     - Error rate
     - Storage usage (Bronze/Silver/Gold)

2. **Create Ingestion Dashboard**
   - **UI Component:** `apps/web/src/components/monitoring/ingestion-dashboard.tsx`
   - **Widgets:**
     - Files processed today/this week
     - Total rows ingested
     - Success/failure rate
     - Average processing time
     - Top slow files
     - Recent errors

3. **Add Alerting**
   - Email/Slack alerts for:
     - File processing failures
     - Validation failures exceeding threshold
     - Unusually large files
     - Schema drift detected

4. **File Lineage Tracking**
   - Track which Bronze/Silver/Gold files came from which landing files
   - Show lineage graph in UI
   - Enable impact analysis

**Estimated Effort:** 3-4 days

---

## Database Schema Changes

### New Table: `file_processing_log`

```sql
CREATE TABLE file_processing_log (
  id TEXT PRIMARY KEY,
  job_execution_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'quarantined')),
  rows_processed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (job_execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_processing_job_execution ON file_processing_log(job_execution_id);
CREATE INDEX idx_file_processing_status ON file_processing_log(status);
CREATE INDEX idx_file_processing_file_path ON file_processing_log(file_path);
```

### New Table: `ingestion_metrics`

```sql
CREATE TABLE ingestion_metrics (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,  -- YYYY-MM-DD
  files_processed INTEGER DEFAULT 0,
  files_failed INTEGER DEFAULT 0,
  rows_ingested INTEGER DEFAULT 0,
  total_bytes INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_ingestion_metrics_job_date ON ingestion_metrics(job_id, metric_date);
```

### Extend `job_executions` Table

```sql
-- Add new columns for file processing details
ALTER TABLE job_executions ADD COLUMN files_processed INTEGER DEFAULT 0;
ALTER TABLE job_executions ADD COLUMN files_failed INTEGER DEFAULT 0;
ALTER TABLE job_executions ADD COLUMN validation_errors TEXT;  -- JSON array
```

---

## Testing Strategy

### Unit Tests

1. **File Discovery Tests**
   - Pattern matching accuracy
   - Edge cases (no files, single file, many files)

2. **CSV Parsing Tests**
   - Various delimiters
   - Various encodings
   - Headerless CSVs
   - Malformed CSVs

3. **Schema Validation Tests**
   - Column count validation
   - Data type validation
   - Schema drift detection

4. **Data Quality Tests**
   - Null percentage checks
   - Duplicate detection
   - Row count validation

### Integration Tests

1. **End-to-End Workflow Tests**
   - Single file ingestion
   - Pattern matching (multiple files)
   - Error handling (malformed CSV)
   - Recovery (quarantine & retry)

2. **Performance Tests**
   - Large file processing (100MB+)
   - Many small files (100+ files)
   - Parallel processing

### User Acceptance Tests

1. **Manual Upload Workflow**
2. **Pattern Matching Workflow**
3. **Error Handling Workflow**
4. **Monitoring Dashboard**

---

## Success Criteria

### MVP (Minimum Viable Product)

- ✅ Single CSV file upload and ingestion
- ✅ Headerless CSV support with AI column naming
- ✅ Pattern matching for multiple files
- ✅ Basic schema validation
- ✅ Error handling with quarantine
- ✅ Ingestion monitoring dashboard

### Production-Ready

- ✅ Advanced CSV configuration (delimiters, encoding, etc.)
- ✅ Comprehensive data quality checks
- ✅ Retry logic and error recovery
- ✅ Performance optimization for large files
- ✅ File lineage tracking
- ✅ Alerting and notifications

### Future Enhancements

- Incremental CSV ingestion (append only new rows)
- CDC (Change Data Capture) from CSV exports
- CSV file compression support (gzip, zip)
- Excel file support (.xlsx, .xls)
- JSON file support
- Auto-schema evolution (handle new columns)

---

## Risk Assessment

### High Risks

1. **Large File OOM Errors**
   - **Mitigation:** Implement streaming/chunking early
   - **Fallback:** Set file size limits

2. **Schema Drift in Production**
   - **Mitigation:** Strict validation by default
   - **Fallback:** Alert on drift, require manual approval

3. **File Encoding Issues**
   - **Mitigation:** Auto-detect encoding, provide override
   - **Fallback:** Quarantine unreadable files

### Medium Risks

1. **Pattern Matching Edge Cases**
   - **Mitigation:** Comprehensive unit tests
   - **Fallback:** Fail loudly with clear error message

2. **S3 Rate Limiting**
   - **Mitigation:** Implement backoff/retry
   - **Fallback:** Queue files for later processing

---

## Dependencies

### Python Libraries
- `polars` - Fast CSV parsing and data manipulation (already installed)
- `chardet` - Character encoding detection (NEW)
- `python-magic` - File type detection (NEW)

### UI Libraries
- Already using: React, TailwindCSS, Lucide icons

### Infrastructure
- MinIO/S3 for storage (already set up)
- SQLite database (already set up)
- Prefect for orchestration (already set up)

---

## Timeline Estimate

| Phase | Tasks | Effort | Timeline |
|-------|-------|--------|----------|
| Phase 1 | Pattern Matching & Multi-File | 1-2 days | Week 1 |
| Phase 2 | Advanced CSV Configuration | 1 day | Week 1 |
| Phase 3 | Schema Validation & Data Quality | 2-3 days | Week 2 |
| Phase 4 | Error Handling & Recovery | 2 days | Week 2 |
| Phase 5 | Performance & Scalability | 2-3 days | Week 3 |
| Phase 6 | Monitoring & Observability | 3-4 days | Week 3-4 |

**Total Estimated Effort:** 11-15 days (2-3 weeks)

---

## Next Steps

1. ✅ Review and approve this plan
2. Add "streaming" source type card to job creation modal (Coming Soon badge)
3. Start Phase 1: Pattern Matching implementation
4. Create database migration for new tables
5. Set up unit test framework for CSV utilities

---

## References

- **Polars CSV Documentation:** https://pola-rs.github.io/polars/py-polars/html/reference/api/polars.read_csv.html
- **AWS S3 Best Practices:** https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html
- **Prefect Task Mapping:** https://docs.prefect.io/core/concepts/mapping.html
- **dbt Testing:** https://docs.getdbt.com/docs/build/tests

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
**Owner:** FlowForge Engineering Team
