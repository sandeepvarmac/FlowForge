# Migration Status: Local → MinIO/Prefect

## ✅ Completed

### 1. Architecture Documentation
- [x] Current architecture documented (ARCHITECTURE.md)
- [x] Migration plan created
- [x] Benefits and phases outlined

### 2. Infrastructure Setup
- [x] Docker Compose with MinIO + PostgreSQL
- [x] MinIO configured (ports 9000/9001)
- [x] Auto-bucket creation (`flowforge-data`)
- [x] Prefect user created in MinIO

### 3. Python Project Structure
- [x] `prefect-flows/` directory created
- [x] `requirements.txt` with dependencies
  - Prefect 2.14.0
  - boto3 (S3 client)
  - polars (data processing)
  - duckdb (analytics)
  - pyarrow (Parquet)
- [x] `.env.example` configuration template
- [x] README.md with setup instructions

### 4. Core Utilities
- [x] `utils/config.py` - Settings management (Pydantic)
- [x] `utils/s3.py` - S3/MinIO client wrapper
  - upload_file()
  - download_file()
  - list_objects()
  - get_s3_uri() with FlowForge conventions

---

## 🚧 Next Steps

### Phase 1: Complete Python Utilities (30 min)
1. **DuckDB Helper** (`utils/duckdb_helper.py`)
   - S3-enabled DuckDB connection
   - Snowflake schema creation
   - Read from S3 Parquet files

2. **Parquet Utilities** (`utils/parquet_utils.py`)
   - CSV → Parquet conversion (polars)
   - Schema inference
   - Audit column injection

### Phase 2: Prefect Tasks (1-2 hours)
1. **Bronze Task** (`tasks/bronze.py`)
   - Read CSV from landing/
   - Add audit columns (_ingested_at, _source_file, _row_number)
   - Write Parquet to bronze/ with timestamp

2. **Silver Task** (`tasks/silver.py`)
   - Read Bronze Parquet from S3
   - Apply transformations
   - Deduplicate with surrogate keys
   - Write to silver/ as current.parquet

3. **Gold Task** (`tasks/gold.py`)
   - Read Silver Parquet from S3
   - Load to DuckDB Snowflake Schema
   - Export dimension/fact tables
   - Write analytics Parquet to gold/

### Phase 3: Prefect Flows (30 min)
1. **Medallion Flow** (`flows/medallion.py`)
   ```python
   @flow
   def medallion_pipeline(workflow_id, job_id, csv_file):
       bronze = bronze_task(csv_file, workflow_id, job_id)
       silver = silver_task(bronze, workflow_id, job_id)
       gold = gold_task(silver, workflow_id, job_id)
       return {"bronze": bronze, "silver": silver, "gold": gold}
   ```

### Phase 4: Integration (1 hour)
1. **Next.js API Integration**
   - Update workflow run API to trigger Prefect flows
   - Use Prefect Cloud API or local server
   - Store deployment ID in SQLite

2. **Testing**
   - Run full pipeline: CSV → Bronze → Silver → Gold
   - Verify Parquet files in MinIO
   - Check DuckDB analytics tables

### Phase 5: Terraform IaC (Optional - 2 hours)
1. **MinIO Module** (`terraform/modules/minio/`)
2. **S3 Module** (`terraform/modules/s3/`)
3. **Prefect Module** (`terraform/modules/prefect/`)
4. **Environment Configs** (local, dev, prod)

---

## 📋 Quick Start Guide

### 1. Start Infrastructure
```bash
# Start MinIO + PostgreSQL
docker-compose up -d

# Verify services
docker-compose ps

# Access MinIO Console
open http://localhost:9001
# Login: minioadmin / minioadmin123
```

### 2. Set Up Python Environment
```bash
cd prefect-flows

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Prefect
```bash
# Option A: Prefect Cloud (recommended)
prefect cloud login
# Follow prompts to authenticate

# Option B: Local server (uncomment in docker-compose.yml)
prefect config set PREFECT_API_URL=http://localhost:4200/api
```

### 4. Set Environment Variables
```bash
# Copy example env
cp .env.example .env

# Edit .env with your Prefect Cloud credentials
```

---

## 🎯 Current Configuration

### Default Settings (Confirmed)
- **Language**: Python 3.11+
- **Orchestration**: Prefect 2.x with Prefect Cloud
- **Storage**: MinIO (local Docker) → AWS S3 (production)
- **Data Processing**: Polars (DataFrames) + PyArrow (Parquet)
- **Analytics**: DuckDB with S3 support
- **File Size**: Small-Medium (KB to MB)
- **Frequency**: On-demand (API-triggered)
- **Compliance**: None initially (dev/test data)

### S3 Bucket Structure
```
s3://flowforge-data/
  ├── landing/{workflow_id}/{job_id}/       # Raw CSV uploads
  ├── bronze/{workflow_id}/{job_id}/        # Parquet with audit columns
  ├── silver/{workflow_id}/{job_id}/        # Cleaned, deduplicated
  └── gold/{workflow_id}/{job_id}/          # Analytics (DuckDB exports)
```

---

## 📊 Migration Benefits

### Immediate Benefits
✅ **No WASM Issues**: Pure Python, no browser bundling
✅ **S3-Compatible**: MinIO → AWS S3 (same API, just change endpoint)
✅ **Observable**: Prefect Cloud UI for monitoring
✅ **Scalable**: Prefect distributed workers

### Future Benefits
✅ **Multi-Cloud**: Terraform modules for AWS/Azure/GCP
✅ **Production-Ready**: S3, Step Functions, Data Factory
✅ **Team Collaboration**: Prefect Cloud shared workspace
✅ **Cost-Effective**: S3 Intelligent-Tiering, Glacier for archives

---

## 🔗 Resources

- **MinIO Console**: http://localhost:9001
- **Prefect Docs**: https://docs.prefect.io/
- **Polars Docs**: https://pola-rs.github.io/polars/
- **DuckDB S3**: https://duckdb.org/docs/guides/import/s3_import.html

---

## ⏭️ Immediate Next Action

**Create the Bronze task** to test the full stack:

```bash
cd prefect-flows

# Create utils/__init__.py
# Create tasks/bronze.py
# Test: python tasks/bronze.py
```

This will validate:
- MinIO connection ✓
- CSV → Parquet conversion ✓
- S3 upload ✓
- End-to-end Bronze layer ✓
