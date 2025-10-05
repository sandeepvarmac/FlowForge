# FlowForge Architecture

## Current Architecture (Local Development)

### Tech Stack
- **Frontend/Backend**: Next.js 14 (App Router)
- **Database**: SQLite (workflow metadata, job execution history)
- **Storage**: Local filesystem (`data/` directory)
- **Analytics**: DuckDB (Gold layer analytics)
- **Data Format**: Parquet (Apache Arrow)

### Medallion Architecture
```
Bronze Layer (Raw Data)
  ├── Location: data/bronze/{workflowId}/{jobId}/{tableName}/
  ├── Strategy: Timestamp versioning (run_YYYYMMDD_HHMMSS_tableName.parquet)
  ├── Content: Raw CSV → Parquet with audit columns (_ingested_at, _source_file, _row_number)

Silver Layer (Cleaned Data)
  ├── Location: data/silver/{workflowId}/{jobId}/{tableName}/
  ├── Strategy: Current + Archive (current.parquet, archive/snapshot_TIMESTAMP.parquet)
  ├── Content: Deduplicated, transformed data with surrogate keys

Gold Layer (Business Ready)
  ├── Location: data/gold/{workflowId}/{jobId}/
  ├── Strategy: Full rebuild with ZSTD compression
  ├── Content: DuckDB Snowflake Schema (dim_*, fact_*)
```

### Current Workflow Execution
1. **Job Creation**: UI → SQLite (workflows, jobs tables)
2. **Execution Trigger**: API POST `/api/workflows/{id}/run`
3. **Processing Pipeline**:
   - Read CSV from `sample-data/`
   - Write Bronze Parquet (with pattern matching support)
   - Transform → Write Silver Parquet (merge/upsert)
   - Load to DuckDB → Write Gold Parquet
4. **Tracking**: SQLite (executions, job_executions tables)

### Current Issues
- ❌ Parquet-wasm WASM bundling issues in Next.js API routes
- ❌ Local filesystem not cloud-ready
- ❌ No distributed workflow orchestration
- ❌ Limited scalability

---

## Target Architecture (Production Ready)

### Tech Stack Migration
- **Storage**: MinIO (S3-compatible) → Easy migration to AWS S3/Azure Blob
- **Orchestration**: Prefect (DAG-based workflows)
- **Analytics**: DuckDB (unchanged - works with S3)
- **IaC**: Terraform (multi-cloud ready)
- **Frontend**: Next.js (unchanged - UI only)

### New Storage Layout (S3/MinIO)
```
s3://flowforge-data/
  ├── landing/          # Raw uploads
  ├── bronze/           # Raw Parquet with audit columns
  ├── silver/           # Cleaned, deduplicated data
  └── gold/             # Business-ready analytics
```

### Prefect Workflow Architecture
```python
@flow(name="medallion_pipeline")
def medallion_pipeline(workflow_id: str):
    # Bronze Layer
    bronze_files = bronze_ingest.submit(workflow_id)

    # Silver Layer (depends on Bronze)
    silver_files = silver_transform.submit(bronze_files)

    # Gold Layer (depends on Silver)
    gold_files = gold_analytics.submit(silver_files)

    return {"bronze": bronze_files, "silver": silver_files, "gold": gold_files}
```

### Migration Benefits
✅ **Cloud Native**: MinIO → S3/Azure Blob (same API)
✅ **Scalable**: Prefect distributed execution
✅ **Observable**: Prefect UI, logging, retries
✅ **IaC**: Terraform for reproducible infrastructure
✅ **Multi-cloud**: Provider-agnostic design

---

## Migration Steps

### Phase 1: Local Stack (Docker)
1. Set up MinIO with Docker Compose
2. Set up Prefect server (local or cloud)
3. Create Python Prefect flows for Bronze/Silver/Gold
4. Test end-to-end with MinIO

### Phase 2: Storage Migration
1. Replace filesystem storage with S3 SDK (boto3)
2. Update file paths to S3 URIs
3. Configure DuckDB to read from S3

### Phase 3: Orchestration Migration
1. Convert Next.js workflow execution to Prefect triggers
2. Move job logic from TypeScript to Python Prefect tasks
3. Set up Prefect deployments

### Phase 4: Production Ready
1. Terraform modules for MinIO/S3
2. CI/CD for Prefect deployments
3. Monitoring and alerting
4. Swap MinIO → AWS S3 or Azure Blob

---

## File Structure

### Current
```
apps/web/
  ├── src/
  │   ├── app/api/workflows/[workflowId]/run/  # Execution API
  │   ├── lib/
  │   │   ├── processing/
  │   │   │   ├── job-executor.ts              # Bronze/Silver/Gold logic
  │   │   │   └── parquet-writer.ts            # Parquet utilities
  │   │   ├── storage/
  │   │   │   └── index.ts                     # File storage layer
  │   │   └── duckdb/
  │   │       └── index.ts                     # DuckDB helpers
  │   └── types/workflow.ts
  └── data/
      ├── flowforge.db                         # SQLite
      ├── bronze/
      ├── silver/
      └── gold/

sample-data/
  └── Customers.csv
```

### Target (with Prefect)
```
flowforge/
  ├── web/                  # Next.js UI (unchanged)
  ├── prefect-flows/        # Python Prefect workflows
  │   ├── flows/
  │   │   └── medallion.py
  │   ├── tasks/
  │   │   ├── bronze.py
  │   │   ├── silver.py
  │   │   └── gold.py
  │   └── utils/
  │       ├── s3.py
  │       └── duckdb.py
  ├── terraform/            # IaC
  │   ├── modules/
  │   │   ├── minio/
  │   │   ├── s3/
  │   │   └── prefect/
  │   └── environments/
  │       ├── local/
  │       ├── dev/
  │       └── prod/
  └── docker-compose.yml    # Local dev stack
```

---

## Next Steps

1. **Answer Migration Questions**:
   - Preferred orchestration language: Python or Node?
   - MinIO hosting: Local Docker or cloud service?
   - File size/frequency estimates?
   - Any compliance requirements (PII, GDPR)?

2. **Create Docker Compose Stack**:
   - MinIO + Console
   - Prefect Server + UI
   - PostgreSQL (Prefect metadata)
   - DuckDB integration

3. **Build Prefect Flows**:
   - Port TypeScript job-executor logic to Python
   - Use polars/pandas for CSV → Parquet
   - Use boto3 for S3 operations
   - Use duckdb-python for analytics

4. **Infrastructure as Code**:
   - Terraform modules for MinIO → S3 migration path
   - Reusable across AWS/Azure/GCP
