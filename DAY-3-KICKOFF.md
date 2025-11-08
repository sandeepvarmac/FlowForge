# FlowForge Sprint - Day 3 Kickoff
**Date**: 2025-11-08
**Focus**: SQL Server Connector Backend Implementation

---

## Objective: Build Python Backend for SQL Server Ingestion

**Goal**: Create backend components that can connect to SQL Server, read data, and write to Parquet (Bronze layer)

**Success Criteria**:
- ✅ Can connect to BFSI_Test database from Python
- ✅ Can read customers table into memory
- ✅ Can convert to Parquet with audit columns
- ✅ Can handle incremental loads (watermark tracking)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FlowForge Frontend                        │
│  (Next.js - Job Creation Modal - Coming in Day 4)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP POST /api/workflows/{id}/run
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Route                               │
│         (apps/web/src/app/api/workflows/.../run)            │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Trigger Prefect Deployment
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Prefect Orchestrator                       │
│            (prefect-flows/flows/medallion.py)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Call database_bronze task
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            Database Bronze Task (TODAY'S WORK)               │
│        (prefect-flows/tasks/database_bronze.py)              │
│                                                              │
│  1. SQLServerConnector.connect()                            │
│  2. Execute query: SELECT * FROM customers                  │
│  3. Convert to Arrow Table                                  │
│  4. Add audit columns (_batch_id, _ingestion_time, etc.)   │
│  5. Write to Parquet                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Write Parquet file
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    MinIO (S3 Storage)                        │
│      bronze/bronze_customers/batch_001.parquet               │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create Today (Backend)

### 1. Database Connector Module ✅
**File**: `prefect-flows/utils/database_connectors.py`
**Purpose**: Reusable database connection classes

**Classes to Implement**:
```python
class DatabaseConnector:
    """Base class for all database connectors"""
    def test_connection() -> dict
    def execute_query(query: str) -> pyarrow.Table
    def get_schema(table_name: str) -> list
    def list_tables() -> list

class SQLServerConnector(DatabaseConnector):
    """SQL Server specific implementation"""
    def __init__(host, port, database, username, password)
    def connect() -> pymssql.Connection
    def read_table(table_name, batch_size=10000) -> pyarrow.Table
    def read_query(query) -> pyarrow.Table
    def get_incremental(table, delta_column, last_value) -> pyarrow.Table
```

### 2. Database Bronze Task ✅
**File**: `prefect-flows/tasks/database_bronze.py`
**Purpose**: Prefect task for ingesting from databases

**Functions to Implement**:
```python
@task
def ingest_from_database(
    job_id: str,
    source_config: dict,
    destination_config: dict,
    batch_id: str
) -> dict:
    """
    Main task for database ingestion

    Args:
        job_id: FlowForge job ID
        source_config: {
            "type": "sql-server",
            "connection": {...},
            "databaseConfig": {
                "tableName": "customers",
                "isIncremental": true,
                "deltaColumn": "modified_date"
            }
        }
        destination_config: Bronze layer config
        batch_id: Unique batch identifier

    Returns:
        {
            "status": "success",
            "records_processed": 500,
            "bronze_file_path": "s3://..."
        }
    """
```

### 3. Update Medallion Flow
**File**: `prefect-flows/flows/medallion.py` (existing, needs update)
**Purpose**: Route database jobs to database_bronze task

**Changes Needed**:
```python
@flow(name="medallion-pipeline")
def run_medallion_pipeline(workflow_id, jobs, batch_id):
    for job in jobs:
        if job['type'] == 'file-based':
            # Existing file ingestion
            bronze_result = ingest_bronze_from_file(...)
        elif job['type'] == 'database':  # NEW
            # Database ingestion
            bronze_result = ingest_from_database(...)

        # Continue with silver/gold...
```

---

## Implementation Steps (Day 3 Morning)

### Step 1: Install Dependencies (5 min)
```bash
cd prefect-flows
pip install pymssql sqlalchemy pyarrow
```

### Step 2: Create SQLServerConnector (60 min)

**Test Cases to Verify**:
1. ✅ Connection succeeds with valid credentials
2. ✅ Connection fails with invalid credentials
3. ✅ Can list all tables in database
4. ✅ Can get schema for customers table
5. ✅ Can read 10 rows from customers table
6. ✅ Can read full customers table (500 rows)
7. ✅ Can handle NULL values correctly
8. ✅ Can convert SQL Server data types to Arrow types

**Data Type Mapping**:
```
SQL Server          → Arrow Type
--------------------------------
INT                 → int32
BIGINT              → int64
NVARCHAR(n)         → string
VARCHAR(n)          → string
DECIMAL(15,2)       → decimal128(15,2)
DATE                → date32
DATETIME            → timestamp[ms]
BIT                 → bool
```

### Step 3: Create Database Bronze Task (60 min)

**Features to Implement**:
1. ✅ Read from table: `SELECT * FROM customers`
2. ✅ Add audit columns:
   - `_batch_id`: Unique batch identifier
   - `_ingestion_time`: Current timestamp
   - `_source_system`: 'sql-server'
   - `_source_file`: Table name
   - `_file_modified_time`: Current timestamp (for consistency)
3. ✅ Write to Parquet with Snappy compression
4. ✅ Upload to MinIO: `bronze/{table_name}/{batch_id}.parquet`
5. ✅ Return metadata: records processed, file size, file path

**Incremental Load Logic** (if enabled):
```sql
SELECT * FROM customers
WHERE modified_date > '{last_watermark}'
ORDER BY modified_date
```

### Step 4: Test Standalone (30 min)

**Test Script**: `prefect-flows/test_database_connector.py`
```python
from utils.database_connectors import SQLServerConnector
from tasks.database_bronze import ingest_from_database

# Test 1: Connection
connector = SQLServerConnector(
    host='localhost',
    port=1433,
    database='BFSI_Test',
    username='sa',
    password='FlowForge2024!'
)
result = connector.test_connection()
print(f"Connection: {result}")

# Test 2: List tables
tables = connector.list_tables()
print(f"Tables: {tables}")

# Test 3: Read customers
df = connector.read_table('customers', batch_size=100)
print(f"Rows: {len(df)}, Columns: {df.column_names}")

# Test 4: Full ingestion
result = ingest_from_database(
    job_id='test_job',
    source_config={
        'type': 'sql-server',
        'connection': {
            'host': 'localhost',
            'port': 1433,
            'database': 'BFSI_Test',
            'username': 'sa',
            'password': 'FlowForge2024!'
        },
        'databaseConfig': {
            'tableName': 'customers'
        }
    },
    destination_config={
        'bronzeConfig': {
            'tableName': 'bronze_customers',
            'storageFormat': 'parquet'
        }
    },
    batch_id='test_batch_001'
)
print(f"Result: {result}")
```

---

## Expected Output (Day 3 Morning)

By end of morning session:
```
✅ SQL Server connector working
✅ Can read customers table (500 rows)
✅ Bronze Parquet file created in MinIO
✅ Audit columns added correctly
✅ File size: ~50KB
✅ Metadata tracked

Example Bronze File:
s3://flowforge-data/bronze/bronze_customers/batch_001.parquet

Columns:
- customer_id (int32)
- first_name (string)
- last_name (string)
- email (string)
- ... (all original columns)
- _batch_id (string)
- _ingestion_time (timestamp)
- _source_system (string)
- _source_file (string)
- _file_modified_time (timestamp)
```

---

## Day 3 Afternoon Plan

Once backend works, move to frontend:

1. **Update Type Definitions** (30 min)
   - Ensure DatabaseSourceConfig in workflow.ts

2. **Create Database Connection Form** (90 min)
   - Component: DatabaseSourceConfig.tsx
   - Connection fields
   - Test connection button

3. **Create Table Selector** (60 min)
   - Dropdown of tables
   - Schema preview

4. **API Endpoints** (90 min)
   - POST /api/test-connection/database
   - GET /api/database/tables
   - GET /api/database/schema

---

## Risks & Mitigations

### Risk 1: Data Type Conversion Issues
**Mitigation**: Start with simple types (INT, VARCHAR, DATE), add complex types later

### Risk 2: Large Tables Performance
**Mitigation**: Use batch reading (10k rows per batch), progress tracking

### Risk 3: Connection Pooling
**Mitigation**: Single connection per task for MVP, add pooling later

---

**Ready to Start Implementation!** 🚀

Let's begin with Step 1: Installing dependencies.
