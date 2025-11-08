# FlowForge Sprint - Day 2 Action Plan
**Date**: 2025-11-08
**Focus**: Testing Existing Features + SQL Server Docker Setup

---

## ✅ User Preferences Confirmed

- **SQL Server**: Docker container (fastest for testing) ✅
- **BFSI Template**: 4-job template (full customer 360 pipeline) ✅
- **Status**: Ready to start Day 2 testing ✅

---

## Morning Tasks (Priority 1: Validation)

### Task 1: Manual Job Execution Test ⚠️ USER ACTION REQUIRED

**Why Critical**: Must verify Bronze/Silver/Gold pipeline works before building SQL Server connector

**Steps for User**:
1. Open FlowForge: `http://localhost:3000`
2. Navigate to "Workflows" page
3. Click on "Customer Data Pipeline" workflow
4. Find "Ingest Customers" job card
5. Click the **"Run"** button
6. Observe execution progress
7. Wait for completion (may take 30-60 seconds)

**What to Look For**:
- ✅ Job status changes to "Running" (spinning icon)
- ✅ Job status changes to "Completed" (green checkmark)
- ✅ Execution appears in "Recent Executions" section
- ❌ Any error messages in toast notifications

**If Successful**:
- Bronze Parquet file created: `bronze/bronze_customers/*.parquet`
- Silver Parquet file created: `silver/silver_customers/*.parquet`
- Gold Parquet file created: `gold/gold_customers/*.parquet`
- Execution record in database

**If Failed**:
- Note the error message
- Check Prefect UI: `http://localhost:4200`
- Check browser console for errors (F12 → Console tab)

---

### Task 2: SQL Server Docker Setup (Automated)

**Goal**: Install SQL Server 2022 in Docker container with BFSI test database

**Commands to Run**:

```bash
# Pull SQL Server 2022 Developer Edition image
docker pull mcr.microsoft.com/mssql/server:2022-latest

# Run SQL Server container
docker run -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=FlowForge2024!" \
  -p 1433:1433 \
  --name flowforge-sqlserver \
  --hostname sqlserver \
  -d mcr.microsoft.com/mssql/server:2022-latest

# Wait 10 seconds for SQL Server to start
sleep 10

# Verify container is running
docker ps | grep sqlserver

# Test connection
docker exec -it flowforge-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P FlowForge2024! \
  -Q "SELECT @@VERSION"
```

**Success Criteria**:
- ✅ Container running
- ✅ Can connect via sqlcmd
- ✅ Version information displayed

---

### Task 3: Create BFSI Sample Database

**Goal**: Create realistic BFSI database with customers, accounts, transactions

**SQL Script**: Will be generated automatically

**Tables to Create**:
1. **customers** (500 records)
   - customer_id (PK), first_name, last_name, email, phone
   - dob, ssn_last4, address, city, state, zip
   - account_open_date, customer_segment (retail/corporate/wealth)
   - credit_score, annual_income
   - modified_date (for incremental loads)

2. **accounts** (750 records, avg 1.5 accounts per customer)
   - account_id (PK), customer_id (FK)
   - account_type (checking/savings/credit/loan)
   - balance, credit_limit, interest_rate
   - open_date, status (active/closed/suspended)
   - last_transaction_date, modified_date

3. **transactions** (5000 records)
   - transaction_id (PK), account_id (FK)
   - amount, transaction_date, transaction_time
   - type (debit/credit), category (ATM/POS/transfer/payment)
   - merchant, merchant_category, location
   - status (completed/pending/failed)

**Data Characteristics**:
- Realistic names (using common US names)
- Valid email formats (firstname.lastname@email.com)
- Realistic phone numbers (format: +1-555-XXX-XXXX)
- Date ranges: accounts opened 2020-2024, transactions last 90 days
- Balance ranges: checking $500-$50k, savings $1k-$100k, credit $0-$25k
- Customer segments: 60% retail, 30% corporate, 10% wealth management

---

## Afternoon Tasks (Priority 2: SQL Server Connector Design)

### Task 4: SQL Server Connector Technical Design

**Components to Design**:

1. **Backend Python Connector** (`prefect-flows/utils/database_connectors.py`)
   - SQLServerConnector class
   - Connection string builder
   - Connection pooling
   - Test connection method
   - Query execution with batching
   - Incremental load support (watermark tracking)

2. **Prefect Database Bronze Task** (`prefect-flows/tasks/database_bronze.py`)
   - `ingest_from_database()` function
   - Table query builder
   - Custom SQL query support
   - Stored procedure execution
   - Schema introspection
   - Data type mapping (SQL Server → Arrow → Parquet)
   - Audit columns injection

3. **Frontend Components**:
   - `DatabaseSourceConfig.tsx` - Connection form
   - `DatabaseTableSelector.tsx` - Table/query/sproc selector
   - `DatabaseSchemaPreview.tsx` - Schema and data preview
   - API routes: test-connection, list-tables, get-schema

4. **API Endpoints**:
   - `POST /api/test-connection/database`
   - `GET /api/database/tables?connection=...`
   - `GET /api/database/schema?connection=...&table=...`
   - `POST /api/database/preview?connection=...&query=...`

---

## Files to Create Today

### 1. SQL Server Setup Script
**File**: `c:\Dev\FlowForge\scripts\setup-sqlserver-docker.sh`
**Purpose**: Automate SQL Server Docker installation

### 2. BFSI Sample Data Generator
**File**: `c:\Dev\FlowForge\scripts\generate-bfsi-data.py`
**Purpose**: Generate realistic BFSI test data

### 3. BFSI Database Schema
**File**: `c:\Dev\FlowForge\scripts\bfsi-schema.sql`
**Purpose**: Create database schema

### 4. SQL Server Connector Technical Spec
**File**: `c:\Dev\FlowForge\docs\technical-specs\SQL-SERVER-CONNECTOR-SPEC.md`
**Purpose**: Detailed implementation plan for Days 3-5

---

## Success Criteria for Day 2

### Must-Have (P0)
- [ ] SQL Server Docker container running
- [ ] BFSI database created with sample data (customers, accounts, transactions)
- [ ] SQL Server connector technical design complete
- [ ] Can query BFSI data from sqlcmd

### Should-Have (P1)
- [ ] Job execution test completed (if user can test manually)
- [ ] Data generation script creates realistic data
- [ ] Connection string builder logic designed

### Nice-to-Have (P2)
- [ ] Sample SQL queries for BFSI analytics documented
- [ ] Data quality rules for BFSI defined

---

## Risk Mitigation

### Risk 1: SQL Server Connection Issues
**Mitigation**:
- Use well-tested Docker image (mcr.microsoft.com/mssql/server:2022-latest)
- Use strong password that meets SQL Server requirements
- Test connection immediately after container start
- Have alternative: Azure SQL Database if local issues

### Risk 2: Data Generation Complexity
**Mitigation**:
- Use simple data generation (Python faker library)
- Focus on data structure over perfect realism
- Minimum viable data: 100 customers, 150 accounts, 1000 transactions
- Can expand later if needed

### Risk 3: Job Execution Test Blocked
**Mitigation**:
- If user unable to test today, proceed with SQL Server setup
- Can test execution after SQL Server connector built
- Prefect flows already exist, likely working

---

## Next Steps After Day 2

### Day 3 Morning
1. Install Python dependencies: `pyodbc`, `pymssql`, `sqlalchemy`
2. Create `database_connectors.py` with SQLServerConnector class
3. Test standalone connection from Python to SQL Server
4. Create `database_bronze.py` Prefect task

### Day 3 Afternoon
5. Test end-to-end: Python → SQL Server → Arrow → Parquet
6. Verify audit columns added correctly
7. Test incremental load with watermark

### Day 4
8. Build frontend database connection form
9. Create table selector UI
10. Implement test connection button
11. Add schema preview

---

## Commands Reference

### Docker Commands
```bash
# Start SQL Server
docker start flowforge-sqlserver

# Stop SQL Server
docker stop flowforge-sqlserver

# Remove container (if need to recreate)
docker rm flowforge-sqlserver

# View logs
docker logs flowforge-sqlserver

# Access SQL Server CLI
docker exec -it flowforge-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P FlowForge2024!
```

### SQL Server Connection Info
- **Host**: localhost
- **Port**: 1433
- **Username**: sa
- **Password**: FlowForge2024!
- **Database**: BFSI_Test (to be created)

### Python Connection String
```python
# PyODBC
conn_str = "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;DATABASE=BFSI_Test;UID=sa;PWD=FlowForge2024!;TrustServerCertificate=yes"

# Pymssql
host = "localhost"
port = 1433
database = "BFSI_Test"
username = "sa"
password = "FlowForge2024!"
```

---

## Documentation to Reference

- [SQL Server Docker Documentation](https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-docker)
- [PyODBC Documentation](https://github.com/mkleehammer/pyodbc/wiki)
- [Pymssql Documentation](https://pymssql.readthedocs.io/)
- [SQLAlchemy SQL Server Dialect](https://docs.sqlalchemy.org/en/20/dialects/mssql.html)

---

**Current Time**: Starting Day 2
**Next Milestone**: SQL Server running with BFSI data
**Estimated Time**: 2-3 hours for full setup
