# FlowForge Prefect Flows

Python-based workflow orchestration using Prefect 2.x with MinIO (S3-compatible) storage.

## Quick Start

### 1. Start Infrastructure

```bash
# Start MinIO, PostgreSQL
docker-compose up -d

# Verify services
docker-compose ps

# Access MinIO Console: http://localhost:9001
# User: minioadmin / minioadmin123
```

### 2. Set Up Python Environment

```bash
cd prefect-flows

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your Prefect Cloud credentials (or use local server)
```

### 4. Set Up Prefect

#### Option A: Prefect Cloud (Recommended)
```bash
# Login to Prefect Cloud
prefect cloud login

# Create S3 storage block for MinIO
prefect block register -m prefect_aws.s3

# Your API key will be saved
```

#### Option B: Local Prefect Server
```bash
# Uncomment prefect-server in docker-compose.yml
# Then restart: docker-compose up -d

# Set API URL
prefect config set PREFECT_API_URL=http://localhost:4200/api
```

### 5. Run Test Flow

```bash
# Run the medallion pipeline
python flows/medallion.py
```

## Architecture

```
MinIO (S3)
  └── flowforge-data/
      ├── landing/      # Raw uploads
      ├── bronze/       # Raw Parquet
      ├── silver/       # Cleaned data
      └── gold/         # Analytics

Prefect Flows
  ├── Bronze Task:  CSV → Parquet (with audit columns)
  ├── Silver Task:  Transform + Dedupe
  └── Gold Task:    DuckDB Analytics
```

## Project Structure

```
prefect-flows/
├── flows/
│   └── medallion.py          # Main Bronze→Silver→Gold pipeline
├── tasks/
│   ├── bronze.py             # Bronze layer ingestion
│   ├── silver.py             # Silver layer transformation
│   └── gold.py               # Gold layer analytics
├── utils/
│   ├── s3.py                 # S3/MinIO utilities
│   ├── duckdb_helper.py      # DuckDB operations
│   └── config.py             # Configuration management
├── requirements.txt
├── .env.example
└── README.md
```

## Development

### Test S3 Connection
```python
from utils.s3 import S3Client

s3 = S3Client()
s3.upload_file("test.csv", "landing/test.csv")
files = s3.list_objects("landing/")
print(files)
```

### Run Flow Locally
```bash
python flows/medallion.py
```

### Deploy to Prefect
```bash
# Create deployment
prefect deployment build flows/medallion.py:medallion_pipeline \
  --name "production" \
  --tag "production" \
  --work-queue "default"

# Apply deployment
prefect deployment apply medallion_pipeline-deployment.yaml

# Start worker
prefect worker start --pool default
```

## Migration to AWS

When ready to move to AWS S3:

1. **Update environment variables**:
   ```bash
   S3_ENDPOINT_URL=https://s3.amazonaws.com
   S3_ACCESS_KEY_ID=<AWS_ACCESS_KEY>
   S3_SECRET_ACCESS_KEY=<AWS_SECRET_KEY>
   S3_BUCKET_NAME=flowforge-prod
   S3_REGION=us-east-1
   ```

2. **No code changes needed** - same boto3 API!

3. **Use Terraform** (see `/terraform` directory) to provision:
   - S3 buckets
   - IAM roles
   - Step Functions (optional)

## Troubleshooting

### MinIO not accessible
```bash
docker-compose logs minio
curl http://localhost:9000/minio/health/live
```

### Prefect connection issues
```bash
prefect config view
prefect cloud workspace ls  # For Prefect Cloud
```

### DuckDB errors
```bash
# Check DuckDB can read from S3
python -c "
import duckdb
con = duckdb.connect()
con.execute('INSTALL httpfs; LOAD httpfs;')
con.execute(\"SET s3_endpoint='localhost:9000'\")
df = con.execute(\"SELECT * FROM 's3://flowforge-data/bronze/*/*.parquet'\").df()
print(df)
"
```
