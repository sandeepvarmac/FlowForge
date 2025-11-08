# FlowForge 2-Week Sprint Plan
## Goal: First Demo-Ready Vertical (BFSI Customer 360 with SQL Server Connector)

**Sprint Duration**: Days 1-10 (Starting: 2025-11-08)
**Target**: Demo-able BFSI Customer 360 pipeline in < 15 minutes

---

## Current State Assessment (Day 1 - Completed)

### ✅ What's Fully Implemented

#### 1. Core Platform Features
- **Workflow Management**: Create, edit, delete, pause/resume workflows
- **Job Management**: Full CRUD operations (Create, Read, Update, Delete, Clone)
- **File-based Data Ingestion**: CSV upload with AI-powered schema detection
- **Medallion Architecture**: Bronze/Silver/Gold layer configuration
- **Trigger System**: Manual, scheduled (cron), dependency, event-based triggers
- **Execution Tracking**: Detailed execution history with job-level tracking
- **Data Catalog**: Metadata catalog with asset tracking
- **Audit Logging**: Comprehensive audit trail

#### 2. Existing Test Data
**Workflow**: "Customer Data Pipeline" (ID: `wf_1762053456374_mgzh3`)
- Team: Analytics Team
- Environment: Development
- Status: Scheduled

**Job**: "Ingest Customers" (ID: `job_1762110139418_lx4iuh`)
- Type: file-based (CSV)
- Source: `Customers.csv`
- Bronze: `bronze_customers` (Parquet, Append, Audit columns enabled)
- Silver: `silver_customers` (Merge on `customer_id`, Surrogate keys)
- Gold: `gold_customers` (Full rebuild, Table materialization)
- Execution History: No executions yet (configured but not run)

#### 3. Technology Stack in Place
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, better-sqlite3
- **Storage**: MinIO (S3-compatible), Parquet format
- **Orchestration**: Prefect (configured, deployed)
- **Data Processing**: DuckDB, Polars, PyArrow
- **AI**: OpenAI integration for schema analysis

### 🔴 Critical Gaps (Must Implement)

#### 1. Database Connectors
- **SQL Server** ← **PRIMARY FOCUS (Days 3-5)**
- PostgreSQL, Oracle, MySQL, Snowflake (Later)

#### 2. Templates System
- **BFSI Customer 360 Template** ← **PRIMARY FOCUS (Days 6-8)**
- Template gallery UI
- Template instantiation logic

#### 3. Basic Lineage View
- **Visual diagram** ← **Days 9-10**
- Source → Bronze → Silver → Gold visualization

---

## Day-by-Day Implementation Plan

### **Day 1-2: Testing & Environment Setup** ✅ (CURRENT)

#### Day 1 Tasks (Today)
- [x] Comprehensive codebase review
- [x] Database state assessment
- [ ] Manual testing of existing features
  - [ ] Test job edit functionality
  - [ ] Test job clone functionality (confirmed working from logs)
  - [ ] Test job delete functionality (confirmed working from logs)
  - [ ] Test CSV upload and AI schema detection
- [ ] Set up SQL Server test environment
- [ ] Document testing results

#### Day 2 Tasks (Tomorrow)
- [ ] Install SQL Server (LocalDB or Docker container)
- [ ] Create sample BFSI database schema:
  - `customers` table (customer_id, first_name, last_name, email, phone, account_open_date, etc.)
  - `accounts` table (account_id, customer_id, account_type, balance, open_date, status)
  - `transactions` table (transaction_id, account_id, amount, transaction_date, type, merchant)
- [ ] Load sample data (100-500 records per table)
- [ ] Create detailed task breakdown for SQL Server connector
- [ ] Design UI mockups for database connection form

---

### **Day 3-5: SQL Server Connector Implementation**

#### Day 3: Backend Foundation
**Goal**: Test SQL Server connection from Python

**Tasks**:
1. **Install Python Dependencies**
   ```bash
   cd prefect-flows
   pip install pyodbc pymssql sqlalchemy
   ```

2. **Create Database Connection Module**
   - File: `prefect-flows/utils/database_connectors.py`
   - Implement `SQLServerConnector` class
   - Connection string builder
   - Connection pooling
   - Retry logic

3. **Create Database Bronze Task**
   - File: `prefect-flows/tasks/database_bronze.py`
   - Read from SQL Server table
   - Batch reading for large tables
   - Incremental load support (watermark tracking)
   - Convert to Arrow format
   - Write to Parquet with audit columns

4. **Test Standalone**
   ```python
   # Test script: test_sql_server.py
   from utils.database_connectors import SQLServerConnector
   from tasks.database_bronze import ingest_from_database

   # Test connection
   conn = SQLServerConnector(host='localhost', database='BFSI_Test', ...)
   result = conn.test_connection()

   # Test ingestion
   df = ingest_from_database(table='customers', ...)
   ```

**Success Criteria**:
- ✅ Can connect to SQL Server from Python
- ✅ Can read table data into Arrow format
- ✅ Can write Parquet with audit columns

#### Day 4: Frontend UI Components
**Goal**: Build database connection configuration UI

**Tasks**:
1. **Update Type Definitions** (apps/web/src/types/workflow.ts)
   - Ensure `DatabaseSourceConfig` is complete
   - Add connection validation types

2. **Create Database Connection Form**
   - File: `apps/web/src/components/jobs/database-source-config.tsx`
   - Form fields:
     - Connection Type: Connection String | Individual Fields
     - Host, Port, Database, Username, Password
     - Authentication: SQL Server Auth | Windows Auth
     - Test Connection button
   - Connection string builder utility
   - Credential masking for display

3. **Update Create Job Modal** (create-job-modal.tsx)
   - Add database source type option (remove "Coming Soon" badge)
   - Conditionally render `<DatabaseSourceConfig>` when type is 'database'
   - Handle database-specific form state

4. **Create Database Table/Query Selector**
   - Component: `apps/web/src/components/jobs/database-table-selector.tsx`
   - Three modes:
     - **Table Selection**: Dropdown of available tables
     - **Custom Query**: SQL editor with syntax highlighting
     - **Stored Procedure**: Procedure selector with parameter inputs
   - Preview schema after selection
   - Sample data preview (first 10 rows)

5. **Test Connection API**
   - Endpoint: `POST /api/test-connection/database`
   - File: `apps/web/src/app/api/test-connection/database/route.ts`
   - Calls Prefect task to test connection
   - Returns: `{ success: boolean, message: string, tables?: string[] }`

6. **Get Database Schema API**
   - Endpoint: `GET /api/database/schema?host=...&database=...&table=...`
   - Returns column names, data types, nullable, primary keys

**Success Criteria**:
- ✅ Can configure SQL Server connection in UI
- ✅ "Test Connection" button works and shows success/error
- ✅ Can select table from dropdown
- ✅ Can preview table schema and sample data

#### Day 5: Integration & Testing
**Goal**: End-to-end database ingestion working

**Tasks**:
1. **Update Medallion Flow** (prefect-flows/flows/medallion.py)
   - Add conditional logic for database sources
   - Call `database_bronze.ingest_from_database()` for database jobs
   - Pass connection config and query/table info

2. **Update Job Creation API** (apps/web/src/app/api/workflows/[workflowId]/jobs/route.ts)
   - Validate database source config
   - Store encrypted connection credentials
   - Create job with database config

3. **Update Job Execution API** (apps/web/src/app/api/workflows/[workflowId]/run/route.ts)
   - Pass database connection parameters to Prefect
   - Handle database-specific errors

4. **Incremental Load Configuration**
   - Add UI for delta column selection
   - Add watermark tracking in job_executions table
   - Update bronze task to use watermark

5. **End-to-End Testing**
   - Create job with SQL Server source
   - Configure Bronze/Silver/Gold layers
   - Execute job
   - Verify Parquet files created
   - Verify audit columns added
   - Check execution history

**Success Criteria**:
- ✅ Can create database job via UI
- ✅ Can execute database job
- ✅ Bronze Parquet files created with data from SQL Server
- ✅ Execution tracked in database
- ✅ Incremental loads work (delta column filtering)

---

### **Day 6-8: BFSI Customer 360 Template**

#### Day 6: Template System Foundation
**Goal**: Create template infrastructure

**Tasks**:
1. **Database Schema for Templates**
   ```sql
   CREATE TABLE workflow_templates (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     category TEXT, -- 'bfsi', 'healthcare', 'retail', etc.
     industry_vertical TEXT,
     use_case TEXT,
     template_version TEXT,
     config JSON, -- Full workflow + jobs configuration
     thumbnail_url TEXT,
     demo_data_url TEXT,
     documentation_url TEXT,
     tags JSON,
     is_active BOOLEAN DEFAULT 1,
     created_at INTEGER,
     updated_at INTEGER
   );
   ```

2. **Seed BFSI Customer 360 Template**
   - File: `apps/web/src/lib/db/templates-seed.ts`
   - Pre-configured workflow:
     - **Job 1**: SQL Server → Bronze (Customers table)
     - **Job 2**: CSV → Bronze (CRM data)
     - **Job 3**: Bronze → Silver (Deduplicate, merge on customer_id)
     - **Job 4**: Silver → Gold (Customer 360 view)

3. **Template API Routes**
   - `GET /api/templates` - List all templates
   - `GET /api/templates/:id` - Get template details
   - `POST /api/templates/:id/instantiate` - Create workflow from template

4. **Template Service**
   - File: `apps/web/src/lib/services/template-service.ts`
   - `getTemplates()`, `getTemplateById()`, `instantiateTemplate()`

**Success Criteria**:
- ✅ Template table exists with sample data
- ✅ Can fetch templates via API
- ✅ Instantiate API creates workflow from template

#### Day 7: Template UI & BFSI Configuration
**Goal**: Build template gallery and BFSI template

**Tasks**:
1. **Template Gallery Page**
   - File: `apps/web/src/app/(routes)/templates/page.tsx`
   - Card-based layout showing template thumbnails
   - Filter by category/industry
   - "Preview Template" and "Use Template" buttons

2. **Template Preview Modal**
   - File: `apps/web/src/components/templates/template-preview-modal.tsx`
   - Shows template details, jobs, data flow diagram
   - "Customize & Create" button

3. **BFSI Customer 360 Template Configuration**
   ```json
   {
     "name": "BFSI Customer 360 Pipeline",
     "category": "bfsi",
     "description": "Unified customer view combining core banking and CRM data",
     "jobs": [
       {
         "name": "Ingest Core Banking Customers",
         "type": "database",
         "sourceConfig": {
           "type": "sql-server",
           "databaseConfig": {
             "tableName": "customers",
             "isIncremental": true,
             "deltaColumn": "modified_date"
           }
         },
         "destinationConfig": {
           "bronzeConfig": { "tableName": "bronze_core_customers", ... },
           "silverConfig": null,
           "goldConfig": null
         }
       },
       {
         "name": "Ingest CRM Data",
         "type": "file-based",
         "sourceConfig": {
           "type": "csv",
           "fileConfig": { "filePath": "crm_customers.csv", ... }
         },
         "destinationConfig": {
           "bronzeConfig": { "tableName": "bronze_crm_customers", ... }
         }
       },
       {
         "name": "Build Silver Customer Master",
         "type": "gold-analytics",
         "sourceConfig": {
           "type": "multi-table",
           "tables": ["bronze_core_customers", "bronze_crm_customers"]
         },
         "destinationConfig": {
           "silverConfig": {
             "tableName": "silver_customer_master",
             "mergeStrategy": "merge",
             "primaryKey": "customer_id"
           }
         },
         "transformationConfig": {
           "derivedColumns": [
             {
               "name": "full_name",
               "expression": "CONCAT(first_name, ' ', last_name)"
             },
             {
               "name": "customer_tenure_days",
               "expression": "DATEDIFF('day', account_open_date, CURRENT_DATE)"
             }
           ]
         }
       },
       {
         "name": "Build Gold Customer 360",
         "type": "gold-analytics",
         "sourceConfig": {
           "type": "multi-table",
           "tables": ["silver_customer_master", "silver_accounts", "silver_transactions"]
         },
         "destinationConfig": {
           "goldConfig": {
             "tableName": "gold_customer_360",
             "aggregationEnabled": true,
             "denormalizationEnabled": true
           }
         },
         "transformationConfig": {
           "aggregations": [
             {
               "column": "account_balance",
               "function": "SUM",
               "alias": "total_balance"
             },
             {
               "column": "transaction_amount",
               "function": "SUM",
               "alias": "total_transaction_volume"
             },
             {
               "column": "transaction_id",
               "function": "COUNT",
               "alias": "transaction_count"
             }
           ]
         }
       }
     ]
   }
   ```

4. **Template Customization Wizard**
   - Allow user to modify:
     - Workflow name
     - Connection strings (for database jobs)
     - File paths (for file jobs)
     - Table names (Bronze/Silver/Gold)
     - Team, environment, tags

**Success Criteria**:
- ✅ Template gallery page loads with BFSI template
- ✅ Can preview BFSI template
- ✅ Can customize and instantiate template
- ✅ Workflow created with 4 pre-configured jobs

#### Day 8: BFSI Demo Data & Documentation
**Goal**: Create demo-ready sample data and docs

**Tasks**:
1. **Sample BFSI Database**
   - SQL Script: `demo-data/bfsi_sample_data.sql`
   - **customers** table: 500 customers
     - customer_id, first_name, last_name, email, phone, dob, ssn_last4
     - address, city, state, zip, account_open_date, customer_segment
     - modified_date (for incremental loads)
   - **accounts** table: 750 accounts (some customers have multiple)
     - account_id, customer_id, account_type (checking, savings, credit)
     - balance, credit_limit, open_date, status, modified_date
   - **transactions** table: 5000 transactions
     - transaction_id, account_id, amount, transaction_date, type
     - merchant, category, status

2. **Sample CRM CSV**
   - File: `demo-data/crm_customers.csv`
   - 500 rows with additional customer data:
     - customer_id, crm_id, preferred_contact_method, marketing_opt_in
     - loyalty_tier, lifetime_value, last_contact_date, assigned_rep

3. **BFSI Template Documentation**
   - File: `docs/templates/BFSI-CUSTOMER-360.md`
   - Use case description
   - Data sources required
   - Setup instructions
   - Expected outputs
   - Sample queries for Gold layer

4. **One-Pager Sales Doc**
   - File: `docs/sales/FLOWFORGE-BFSI-ONE-PAGER.md`
   - Problem statement
   - FlowForge solution
   - Key benefits
   - Quick start guide
   - ROI metrics

**Success Criteria**:
- ✅ Sample database ready with realistic data
- ✅ CRM CSV file created
- ✅ Documentation complete
- ✅ Can execute end-to-end demo in < 15 minutes

---

### **Day 9-10: Lineage Visualization & Demo Prep**

#### Day 9: Basic Lineage View
**Goal**: Visual data flow diagram

**Tasks**:
1. **Lineage Graph Component**
   - File: `apps/web/src/components/lineage/lineage-graph.tsx`
   - Use React Flow or D3.js
   - Node types: Source, Bronze, Silver, Gold
   - Edges: Data flow arrows
   - Tooltip on hover: Row counts, last updated

2. **Lineage API**
   - Endpoint: `GET /api/workflows/[workflowId]/lineage`
   - Returns graph structure:
     ```json
     {
       "nodes": [
         { "id": "source_sql_customers", "type": "source", "label": "SQL: customers" },
         { "id": "bronze_core_customers", "type": "bronze", "label": "bronze_core_customers" },
         { "id": "silver_customer_master", "type": "silver", "label": "silver_customer_master" },
         { "id": "gold_customer_360", "type": "gold", "label": "gold_customer_360" }
       ],
       "edges": [
         { "source": "source_sql_customers", "target": "bronze_core_customers" },
         { "source": "bronze_core_customers", "target": "silver_customer_master" },
         { "source": "silver_customer_master", "target": "gold_customer_360" }
       ]
     }
     ```

3. **Integrate into Workflow Detail Page**
   - Add "Lineage" tab in workflow detail view
   - Render lineage graph
   - Highlight path for selected job

**Success Criteria**:
- ✅ Lineage graph displays correctly
- ✅ Shows all layers (Source → Bronze → Silver → Gold)
- ✅ Interactive (zoom, pan, hover)

#### Day 10: Demo Rehearsal & Polish
**Goal**: Finalize demo and documentation

**Tasks**:
1. **Demo Script**
   - File: `docs/demos/BFSI-CUSTOMER-360-DEMO.md`
   - 15-minute walkthrough:
     - **Minutes 0-2**: Problem statement (Fragmented customer data)
     - **Minutes 2-5**: Show FlowForge template gallery, select BFSI template
     - **Minutes 5-8**: Customize template, enter SQL Server connection
     - **Minutes 8-12**: Execute workflow, show real-time execution progress
     - **Minutes 12-15**: Show results (Bronze/Silver/Gold tables, lineage, sample queries)

2. **Video Recording** (Optional)
   - Record 5-minute quick demo
   - Upload to internal drive or YouTube (unlisted)

3. **Bug Fixes & Polish**
   - Fix any UI glitches found during testing
   - Improve error messages
   - Add loading states where missing
   - Improve toast notifications

4. **Final Testing Checklist**
   - [ ] Template instantiation works
   - [ ] SQL Server connection works
   - [ ] CSV upload works
   - [ ] All 4 jobs execute successfully
   - [ ] Bronze files created with audit columns
   - [ ] Silver merge logic works (customer deduplication)
   - [ ] Gold aggregation works
   - [ ] Lineage graph displays correctly
   - [ ] Execution history tracks all jobs
   - [ ] Can re-run workflow (incremental load works)

5. **Presentation Deck Update**
   - Add screenshots from FlowForge
   - Update slide 10: "Live Demo" with actual FlowForge screenshots
   - Add slide: "BFSI Customer 360 Template"

**Success Criteria**:
- ✅ Can execute full demo in < 15 minutes
- ✅ Demo script finalized
- ✅ All features work smoothly
- ✅ Presentation deck updated

---

## Success Metrics (End of 2-Week Sprint)

### Must-Have (P0)
- [x] Codebase review completed ✅
- [ ] SQL Server connector fully functional
- [ ] BFSI Customer 360 template working end-to-end
- [ ] Can demo full pipeline in < 15 minutes
- [ ] Documentation complete

### Should-Have (P1)
- [ ] Lineage visualization working
- [ ] Demo video recorded
- [ ] Sales one-pager created

### Nice-to-Have (P2)
- [ ] Second database connector (PostgreSQL)
- [ ] Error handling improvements
- [ ] Performance optimizations

---

## Risk Mitigation

### Risk 1: SQL Server Connection Issues
**Mitigation**:
- Use Docker container for consistent environment
- Test with both SQL Server Authentication and Windows Authentication
- Have fallback to PostgreSQL if SQL Server proves difficult

### Risk 2: Template Complexity
**Mitigation**:
- Start with simple template (2 jobs instead of 4)
- Focus on core functionality first
- Polish later if time permits

### Risk 3: Demo Data Quality
**Mitigation**:
- Use realistic but simple data
- Pre-load data before demo
- Have backup sample files ready

---

## Next Steps After Sprint

### Week 3-4 (1-Month Goals)
1. Add PostgreSQL and MySQL connectors
2. Build Healthcare template
3. Create assessment wizard
4. Sales enablement materials
5. Deploy to cloud (Azure/AWS)

### Month 2-3 (3-Month Goals)
1. All 4 vertical templates (BFSI, Healthcare, Manufacturing, Insurance)
2. 6+ database connectors
3. API connector framework
4. Scheduling system
5. Monitoring dashboard
6. Advanced data quality features

---

## Daily Standup Format

Each morning, answer:
1. **What did I complete yesterday?**
2. **What am I working on today?**
3. **Any blockers?**

Track progress in this document by checking off tasks as completed.

---

## References

- **Codebase Review**: See comprehensive review in Agent response above
- **2026 Sales Strategy**: `C:\Dev\FlowForge\Review\2026_Sales_Strategy_ES.pdf`
- **MVP Scope**: `C:\Dev\FlowForge\docs\03-mvp-scope.md`
- **Database Schema**: `C:\Dev\FlowForge\apps\web\src\lib\db\schema.ts`
- **Type Definitions**: `C:\Dev\FlowForge\apps\web\src\types\workflow.ts`

---

**Document Created**: 2025-11-08
**Last Updated**: 2025-11-08
**Owner**: Sandeep Varma
**Sprint Status**: IN PROGRESS - Day 1 Complete
