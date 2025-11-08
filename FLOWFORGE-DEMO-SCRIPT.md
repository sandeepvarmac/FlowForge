# FlowForge Demo Script - Complete Walkthrough

**Version:** 1.0
**Last Updated:** October 23, 2025
**Duration:** 20-30 minutes (Full Demo) | 10-15 minutes (Express Demo)
**Audience:** Sales prospects, C-level executives, Data teams

---

## 📋 Table of Contents

1. [Pre-Demo Checklist](#pre-demo-checklist)
2. [Demo Environment Setup](#demo-environment-setup)
3. [Demo Narrative & Flow](#demo-narrative--flow)
4. [Full Demo Script (30 minutes)](#full-demo-script-30-minutes)
5. [Express Demo Script (15 minutes)](#express-demo-script-15-minutes)
6. [Key Talking Points](#key-talking-points)
7. [Handling Common Questions](#handling-common-questions)
8. [Demo Data & Files](#demo-data--files)
9. [Troubleshooting](#troubleshooting)

---

## ✅ Pre-Demo Checklist

### 24 Hours Before Demo:

- [ ] **Verify FlowForge is running**
  ```bash
  cd c:/Dev/FlowForge
  docker-compose ps  # All services should be "Up (healthy)"
  ```

- [ ] **Test web application**
  - Visit: http://localhost:3000
  - Confirm dashboard loads without errors
  - Check all navigation links work

- [ ] **Verify Prefect server**
  - Visit: http://localhost:4200
  - Confirm deployments are visible
  - Check workers are healthy

- [ ] **Prepare demo data files**
  - Customer data CSV (clean)
  - Sales transactions CSV (with quality issues)
  - Invoice PDF (for IDP demo if applicable)

- [ ] **Clean up old test data**
  ```bash
  # Optional: Reset to clean state
  cd apps/web
  rm -f data/flowforge.db
  npm run dev  # Will recreate fresh database
  ```

- [ ] **Test complete workflow end-to-end**
  - Create workflow → Add job → Upload file → Run → Verify results

### 1 Hour Before Demo:

- [ ] **Start all services**
  ```bash
  cd c:/Dev/FlowForge
  docker-compose up -d
  cd apps/web
  npm run dev
  ```

- [ ] **Close unnecessary browser tabs**
- [ ] **Open demo tabs:**
  - Tab 1: FlowForge Dashboard (http://localhost:3000)
  - Tab 2: Prefect UI (http://localhost:4200)
  - Tab 3: MinIO Console (http://localhost:9001)
  - Tab 4: Demo data folder (File Explorer)

- [ ] **Prepare screen sharing**
  - Use 1080p resolution
  - Close distracting applications
  - Mute notifications

- [ ] **Review customer background**
  - Industry vertical
  - Pain points
  - Current data tools
  - Technical sophistication

---

## 🖥️ Demo Environment Setup

### Required Services Running:

```bash
# Check all services
docker ps

# Expected output:
# flowforge-prefect-server   Up (healthy)   0.0.0.0:4200->4200/tcp
# flowforge-postgres         Up (healthy)   0.0.0.0:5432->5432/tcp
# flowforge-minio            Up (healthy)   0.0.0.0:9000-9001->9000-9001/tcp
```

### Browser Setup:

**Recommended:** Chrome or Edge (best dev tools)

**Window Layout:**
- Primary screen: FlowForge UI (maximize browser)
- Secondary screen (if available): Prefect UI, terminal logs

**Browser Extensions to Disable:**
- Ad blockers
- Privacy extensions that might interfere

### Demo Data Files:

**Location:** `c:/Dev/FlowForge/demo-data/`

**Files Needed:**

1. **customers.csv** (Clean data)
   ```csv
   customer_id,first_name,last_name,email,phone,city,state,lifetime_value
   C001,John,Smith,john.smith@email.com,555-0100,Seattle,WA,45000
   C002,Sarah,Johnson,sarah.j@email.com,555-0101,Portland,OR,67000
   C003,Michael,Brown,michael.b@email.com,555-0102,San Francisco,CA,125000
   ```

2. **sales_transactions.csv** (Data quality issues - for demo)
   ```csv
   transaction_id,customer_id,order_date,product,quantity,amount,status
   T001,C001,2024-01-15,Widget A,5,250.00,completed
   T002,C002,2024-01-16,Widget B,,-500.00,completed
   T003,,2024-01-17,Widget C,10,1000.00,pending
   T004,C003,INVALID_DATE,Widget A,3,150.00,completed
   ```

3. **invoice_sample.pdf** (Optional - for IDP demo)

---

## 📖 Demo Narrative & Flow

### Story Arc:

**Act 1: The Problem (2 minutes)**
- Current state: Manual data pipeline development is slow
- Pain: 4-6 weeks to build a single pipeline
- Impact: Business insights delayed, engineering bottleneck

**Act 2: The Solution (15 minutes)**
- FlowForge makes pipeline creation self-service
- Show AI-powered schema detection (3 seconds)
- Build complete pipeline in 5 minutes
- Power users can do this themselves

**Act 3: The Results (5 minutes)**
- Real-time monitoring and orchestration
- Data quality validation
- Bronze → Silver → Gold data layers
- Production-grade architecture

**Act 4: The Business Value (5 minutes)**
- Time savings: 4 weeks → 30 minutes
- Cost savings: $863K over 3 years vs DIY
- Team empowerment: Power users enabled

---

## 🎬 Full Demo Script (30 minutes)

### Part 1: Introduction (2 minutes)

**[SCREEN: FlowForge Dashboard]**

**SAY:**
> "Welcome! Today I'm going to show you FlowForge - a modern data pipeline platform that makes building production-grade data pipelines as easy as creating a Power BI report.
>
> We're going to build a complete customer data pipeline from scratch - in about 5 minutes. This same pipeline would typically take a data engineer 4-6 weeks to build using traditional tools.
>
> What makes FlowForge different is that it's designed for self-service. Just like Power BI empowered business analysts to create their own dashboards, FlowForge empowers power users to create their own data pipelines - no coding required.
>
> Let's dive in."

**[PAUSE for questions]**

---

### Part 2: Create Workflow (3 minutes)

**[SCREEN: FlowForge Dashboard - Workflows Page]**

**ACTION:**
1. Click "Workflows" in left navigation
2. Click "Create Workflow" button

**SAY:**
> "First, let's create a new workflow. Think of a workflow as a container for one or more data pipelines. For example, you might have a 'Customer 360' workflow that includes multiple data sources - CRM, transactions, support tickets."

**[SCREEN: Create Workflow Modal]**

**ACTION:**
1. **Workflow Name:** "Customer 360 Pipeline"
2. **Description:** "Consolidate customer data from multiple sources"
3. **Environment:** Production (point out dropdown)
4. **Team:** Finance (point out team isolation)
5. Click "Create Workflow"

**SAY:**
> "Notice we can specify the environment - Production, UAT, QA, or Development. This ensures dev workflows don't interfere with production data. We can also assign this to a specific team like Finance or Marketing - this provides data isolation and security boundaries for compliance.
>
> [CLICK CREATE]
>
> Great! Our workflow is created. Now let's add a data source."

**[SCREEN: Workflow Detail Page - Empty State]**

---

### Part 3: AI-Powered Schema Detection (5 minutes) ⭐ **KEY DEMO MOMENT**

**[SCREEN: Workflow Detail - Click "Add Job"]**

**ACTION:**
1. Click "Add Job" button

**SAY:**
> "Now here's where FlowForge starts to shine. We're going to upload a CSV file and watch FlowForge's AI analyze it in real-time."

**[SCREEN: Add Job Modal - File Upload]**

**ACTION:**
1. **Job Name:** "Customer Data Import"
2. Click "Upload File" button
3. Select `customers.csv` from demo-data folder
4. **[WAIT for upload]**

**SAY (while uploading):**
> "I'm uploading a customer CSV file with about 1,000 rows. In a traditional approach, I'd need to manually write schema definitions, figure out data types, identify primary keys, and name columns properly.
>
> Watch what FlowForge does instead..."

**[SCREEN: AI Analysis Running - Loading State]**

**ACTION:**
- **[WAIT for AI analysis - should take 3-5 seconds]**

**SAY (as AI runs):**
> "FlowForge is using AI - specifically GPT-4 - to analyze this file. It's detecting:
> - Column data types (string, integer, decimal, date)
> - Primary keys
> - Business-friendly column names
> - Data patterns and relationships"

**[SCREEN: AI Results Displayed]**

**ACTION:**
- Point to each detected field

**SAY:**
> "And there it is - 3 seconds! Look at what the AI detected:
>
> [POINT TO PRIMARY KEY]
> - **Primary Key:** customer_id - correctly identified as the unique identifier
>
> [POINT TO COLUMN MAPPING]
> - **Column Names:** The AI transformed 'cust_id' → 'customer_id', 'fname' → 'first_name', etc.
> - **Data Types:** Strings, integers, decimals all correctly classified
> - **Business Names:** 'ltv' became 'lifetime_value' - much more readable
>
> This alone saves a data engineer 30-60 minutes of work. And it's done in 3 seconds."

**[SCREEN: Scroll to Transformation Config]**

**ACTION:**
- Scroll down to show Bronze/Silver/Gold configuration

**SAY:**
> "FlowForge also implements what's called the Medallion Architecture - the same pattern used by Databricks and modern data lakehouses.
>
> [POINT TO EACH LAYER]
> - **Bronze Layer:** Raw data, exactly as uploaded - immutable, audit trail
> - **Silver Layer:** Cleaned, validated, deduplicated - business-ready
> - **Gold Layer:** Aggregated, enriched - analytics-ready
>
> This is production-grade data engineering best practice - built in automatically."

**ACTION:**
5. Click "Save Job"

**SAY:**
> "Let's save this configuration and run the pipeline."

**[SCREEN: Workflow Detail - Job Card Visible]**

---

### Part 4: Run Workflow & Real-Time Monitoring (7 minutes)

**[SCREEN: Workflow Detail Page - Job Saved]**

**ACTION:**
1. Click "Run Workflow" button (top right)

**SAY:**
> "Now I'm going to execute this pipeline. Behind the scenes, FlowForge is going to:
> 1. Spin up a Prefect workflow engine
> 2. Read the file from S3/cloud storage
> 3. Apply transformations
> 4. Write to Bronze, Silver, and Gold layers
> 5. Validate data quality
>
> All orchestrated automatically."

**[SCREEN: Execution Starting - Shows Execution ID]**

**ACTION:**
- Note the execution ID displayed
- Click "Orchestration" → "Monitor" in left navigation

**SAY:**
> "Let's go to the Monitor page to watch this in real-time."

**[SCREEN: Monitor Page - Execution Running]**

**ACTION:**
- Point to the running execution
- Show status: "Running"
- Show started_at timestamp

**SAY:**
> "Here we can see our workflow execution. Status is 'Running' and we can see it started just now.
>
> Let me switch over to the Prefect UI to show you the orchestration engine."

**[SWITCH TAB: Prefect UI - http://localhost:4200]**

**ACTION:**
1. Click "Flow Runs" in left nav
2. Find the most recent flow run (should be at top)
3. Click on it to open details

**SAY:**
> "This is Prefect - our workflow orchestration engine. Think of it like Apache Airflow but more modern.
>
> [POINT TO FLOW RUN]
> - Here's our customer data pipeline executing
> - You can see each task: Read → Transform → Validate → Write Bronze → Silver → Gold
> - Each task shows status: Pending → Running → Completed"

**[SCREEN: Prefect Flow Run - Task Graph]**

**ACTION:**
- Point to task graph/timeline
- Show logs for one task (if available)

**SAY:**
> "One of the powerful things here is observability. If something fails, we get detailed logs, error messages, and retry logic. This is production-grade orchestration - the same level of reliability used by companies like Airbnb, Nike, and Spotify."

**[SWITCH BACK: FlowForge Monitor Page]**

**ACTION:**
- Refresh page (or wait for auto-refresh)
- Check if status changed to "Completed"

**SAY:**
> "Let's switch back to FlowForge and see if our pipeline completed..."
>
> [IF COMPLETED]
> "Perfect! Status is now 'Completed'. Duration was about 30-45 seconds. Let's go see the results."
>
> [IF STILL RUNNING]
> "Still running - should complete in another 15-20 seconds. While we wait, let me show you something else..."

---

### Part 5: Explore Results - Data Assets (5 minutes)

**[SCREEN: FlowForge - Click "Data Assets" → "Explorer"]**

**ACTION:**
1. Click "Data Assets" in left nav
2. Click "Explorer" sub-item

**SAY:**
> "Now let's explore the data that was created. FlowForge provides a built-in data explorer - you can query your Bronze, Silver, and Gold tables directly."

**[SCREEN: Data Explorer - Table List]**

**ACTION:**
- Point to table list (should show customer tables)

**SAY:**
> "Here we can see the tables that were created:
> - bronze_customers - Raw data
> - silver_customers - Cleaned data
> - gold_customers - Analytics-ready
>
> Let's query the Silver layer."

**[SCREEN: Click on silver_customers table]**

**ACTION:**
1. Click "silver_customers" table
2. SQL preview should show data
3. Point to columns and data

**SAY:**
> "And here's our data! Notice:
> - Column names are clean and business-friendly
> - Data types are correct (integers, decimals, dates)
> - All 1,000 rows were processed
> - No errors, no manual intervention needed
>
> [POINT TO QUERY INTERFACE]
> Power users can also write SQL queries here to explore the data before connecting it to their BI tool."

**[SCREEN: Optional - Click "Data Lineage" tab]**

**ACTION:**
- Click "Data Lineage" in top nav

**SAY:**
> "And here's something really powerful - data lineage. We can see the entire flow:
> - Source file → Bronze layer → Silver layer → Gold layer
> - Every transformation tracked
> - Full audit trail for compliance
>
> This is critical for regulated industries like finance and healthcare."

---

### Part 6: Data Quality & Pattern Matching (Optional - 3 minutes)

**[IF TIME PERMITS]**

**SAY:**
> "Let me show you one more powerful feature - pattern matching for processing multiple files."

**[SCREEN: Back to Workflows → Customer 360 Pipeline]**

**ACTION:**
1. Navigate back to workflow
2. Click "Edit Job" on Customer Data Import

**[SCREEN: Edit Job Modal - File Config]**

**ACTION:**
1. Scroll to "File Upload Mode" dropdown
2. Change from "Single File" to "Pattern Matching"
3. Show pattern field: `customer_*.csv`

**SAY:**
> "In single-file mode, we upload one file at a time. But in pattern matching mode, FlowForge can automatically process multiple files.
>
> For example, if I set the pattern to 'customer_*.csv', FlowForge will find and process:
> - customer_january.csv
> - customer_february.csv
> - customer_march.csv
>
> All automatically. This is perfect for scenarios like:
> - Daily/weekly data drops
> - Multi-region files
> - Historical backfills
>
> [CLOSE MODAL]
>
> I won't save this change, but you get the idea."

---

### Part 7: Deployment Architecture (3 minutes)

**[SCREEN: Switch to PowerPoint/PDF - Architecture Slide]**

**SAY:**
> "Now let me talk about deployment - this is where FlowForge really differentiates itself.
>
> [SHOW ARCHITECTURE DIAGRAM]
>
> FlowForge deploys into YOUR cloud account:
> - Your AWS account
> - Your Azure subscription
> - Your Google Cloud project
>
> This means:
> ✅ Your data never leaves your cloud
> ✅ You maintain full control and compliance
> ✅ No vendor lock-in
> ✅ No data transfer costs
>
> Compare this to Fivetran or Matillion:
> - They run in THEIR cloud
> - Your data moves through their infrastructure
> - You pay for data egress
> - You're locked into their architecture
>
> FlowForge gives you the best of both worlds:
> - Cloud-native architecture
> - Self-service ease of use
> - But deployed in your environment"

**[SHOW TIMELINE COMPARISON SLIDE]**

**SAY:**
> "And deployment is fast:
> - **FlowForge:** 1 week to production
> - **DIY (build from scratch):** 12 months
> - **Enterprise SaaS (Informatica):** 6 months for implementation
>
> That's 50x faster than building it yourself."

---

### Part 8: Pricing & Business Value (3 minutes)

**[SCREEN: Switch to Pricing Slide]**

**SAY:**
> "Let me talk briefly about pricing and ROI.
>
> [SHOW PRICING TIERS]
>
> FlowForge has three tiers:
> - **Starter:** $500/month - Up to 5 workflows, 10GB data
> - **Professional:** $2,000/month - Unlimited workflows, 100GB data
> - **Enterprise:** Custom pricing - Unlimited everything, SLA, dedicated support
>
> Now, let's talk about ROI..."

**[SHOW BUILD VS BUY SLIDE]**

**SAY:**
> "If you build this yourself from scratch:
> - 4 data engineers full-time: $550K per year
> - 12 months to MVP
> - Ongoing maintenance: $164K/year
> - **3-Year Total: $1.042 million**
>
> With FlowForge:
> - Professional tier: $24K/year
> - Cloud infrastructure: $9.6K/year
> - 0.25 FTE admin: $37K/year
> - **3-Year Total: $178K**
>
> That's **$863,000 saved** - an 83% cost reduction.
>
> But beyond cost, consider:
> - **Time to value:** 1 week vs 12 months
> - **Team empowerment:** Power users can build pipelines
> - **Engineering freed up:** 3.75 FTE engineers freed for strategic work
> - **Business agility:** Launch new data products in days, not months"

---

### Part 9: Q&A and Next Steps (3 minutes)

**[SCREEN: Back to FlowForge Dashboard]**

**SAY:**
> "So to recap what we've seen today:
>
> ✅ AI-powered schema detection - 3 seconds vs 30 minutes
> ✅ Self-service pipeline creation - Power users enabled
> ✅ Production-grade architecture - Medallion pattern, orchestration
> ✅ Real-time monitoring - Full observability
> ✅ Deploy in YOUR cloud - No vendor lock-in
> ✅ 1 week to production - 50x faster than DIY
>
> What questions do you have?"

**[PAUSE for Q&A]**

**TRANSITION TO NEXT STEPS:**
> "Great questions! Here's what I'd recommend as next steps:
>
> **Option 1: Proof of Concept (2 weeks)**
> - We deploy FlowForge in your cloud (1 week)
> - You build 2-3 real pipelines with your data (1 week)
> - No cost, no commitment
>
> **Option 2: Pilot Program (1 month)**
> - Start with Professional tier
> - One team (e.g., Finance or Marketing)
> - Migrate 5-10 existing pipelines
> - Measure time/cost savings
>
> Which approach sounds more interesting to you?"

**[CLOSE]**

---

## ⚡ Express Demo Script (15 minutes)

**For time-constrained demos or executive audiences:**

### Condensed Flow:

**1. Introduction (1 minute)**
- "We're going to build a production-grade data pipeline in 5 minutes - something that normally takes 4-6 weeks."

**2. Create Workflow + AI Detection (4 minutes)**
- Create workflow → Upload file → Show AI analysis (3 seconds)
- "AI detected schema, primary keys, data types - no coding required"

**3. Run & Monitor (3 minutes)**
- Run workflow → Show Prefect orchestration
- "Production-grade monitoring, same level as Airbnb and Spotify use"

**4. Results (2 minutes)**
- Show data explorer → Bronze/Silver/Gold tables
- "Medallion architecture - Databricks best practice, built-in"

**5. Business Value (3 minutes)**
- Deploy in YOUR cloud (not SaaS)
- 1 week vs 12 months
- $863K saved vs DIY
- Power users enabled (like Power BI)

**6. Next Steps (2 minutes)**
- POC offer → Close

---

## 💬 Key Talking Points

### Positioning Statements:

**"Power BI for Data Pipelines"**
> "Just like Power BI democratized business intelligence by enabling analysts to create their own dashboards, FlowForge democratizes data engineering by enabling power users to create their own data pipelines."

**"Deploy in YOUR Cloud"**
> "Unlike Fivetran or Matillion which run in their cloud, FlowForge deploys into YOUR AWS, Azure, or Google Cloud account. Your data never leaves your environment. You maintain full control for compliance, security, and cost."

**"AI-Powered Self-Service"**
> "Our AI analyzes your data files and automatically generates schema definitions, detects primary keys, and suggests business-friendly column names - in 3 seconds. This eliminates 80% of the manual configuration work."

**"Production-Grade Architecture"**
> "FlowForge implements the Medallion Architecture - the same pattern used by Databricks and modern data platforms. Bronze, Silver, Gold layers provide data quality, audit trails, and analytics-ready datasets."

**"50x Faster Than Building It Yourself"**
> "Deploy FlowForge in 1 week vs 12 months to build from scratch. That's 50x faster time-to-value, with 83% lower cost over 3 years."

---

## ❓ Handling Common Questions

### Q: "How does this compare to Fivetran?"

**ANSWER:**
> "Great question. Fivetran is a strong SaaS product for pre-built connectors - if you need to pull data from Salesforce, HubSpot, etc., they're excellent.
>
> FlowForge is different in three key ways:
>
> 1. **Custom Data Sources:** We're designed for custom CSV/Excel files, API calls, and data sources Fivetran doesn't support. If your data isn't in a standard SaaS tool, you need FlowForge.
>
> 2. **Deploy in YOUR Cloud:** Fivetran runs in their cloud. Your data moves through their infrastructure. FlowForge deploys in YOUR AWS/Azure/GCP account. Your data never leaves your environment.
>
> 3. **Cost Structure:** Fivetran charges based on Monthly Active Rows (MAR) - costs can scale unpredictably. FlowForge is flat-rate pricing starting at $500/month. Much more predictable.
>
> Think of them as complementary: Use Fivetran for SaaS connectors, FlowForge for custom data sources and full control."

---

### Q: "Can we integrate this with Databricks / Snowflake?"

**ANSWER:**
> "Absolutely! FlowForge is vendor-neutral and designed to work with your existing data stack.
>
> **For Databricks:**
> - FlowForge writes data to S3/ADLS/GCS
> - You point your Databricks external tables at those locations
> - Or we can write directly to Delta Lake format
>
> **For Snowflake:**
> - FlowForge can use Snowflake as a destination
> - We land data in S3/Azure Blob
> - Snowflake's Snowpipe auto-ingests
> - Or we write via COPY INTO commands
>
> In fact, many of our customers use FlowForge as the 'last mile' - they use Fivetran for SaaS data, then FlowForge for custom sources, and everything lands in Databricks or Snowflake."

---

### Q: "What about data security and compliance?"

**ANSWER:**
> "Security and compliance are built-in:
>
> **Data Residency:**
> - FlowForge deploys in YOUR cloud account
> - Data never leaves your environment
> - No third-party data transfer
>
> **Audit Trail:**
> - Full data lineage tracking
> - Every transformation logged
> - Bronze layer preserves immutable raw data
>
> **Access Control:**
> - Team-based isolation (Finance, Marketing, Sales)
> - Environment separation (Dev, QA, Prod)
> - Role-based access control (coming in Q3)
>
> **Compliance Ready:**
> - GDPR: Data stays in your region
> - HIPAA: PHI never leaves your environment
> - SOX: Full audit trail and immutable records
>
> We've designed this from the ground up to meet enterprise compliance requirements."

---

### Q: "What if we need to process really large files (100GB+)?"

**ANSWER:**
> "Great question. FlowForge is built for scale:
>
> **Current Architecture:**
> - We use chunked reading - files are processed in 10MB chunks
> - DuckDB engine handles 100GB+ files efficiently
> - Parquet output format provides 10x compression
>
> **For Very Large Files (500GB+):**
> - We can deploy on larger compute (16+ vCPU, 64GB+ RAM)
> - Or implement Spark-based processing (roadmap item)
>
> **Pattern Matching for Scale:**
> - If you have daily 100GB files, we recommend splitting into smaller files
> - Example: Instead of 1x 100GB file, use 100x 1GB files
> - FlowForge's pattern matching processes them in parallel
> - Much faster and more resilient
>
> What's your typical file size and frequency?"

---

### Q: "Can we customize the transformations?"

**ANSWER:**
> "Yes! FlowForge supports multiple levels of customization:
>
> **Level 1: No-Code Transformations (Available Now)**
> - Column mapping and renaming
> - Data type conversions
> - Filtering rows based on conditions
> - All via UI dropdowns and fields
>
> **Level 2: SQL Transformations (Q2 2025)**
> - Write custom SQL SELECT statements
> - Apply complex business logic
> - Join multiple sources
> - Power users can do this without engineering
>
> **Level 3: Python Transformations (Q3 2025)**
> - Write custom Python functions
> - Import libraries (pandas, numpy, etc.)
> - Ultimate flexibility for advanced use cases
>
> The goal is: Simple transformations stay simple (no-code), complex transformations are possible (SQL/Python)."

---

### Q: "What happens if a workflow fails?"

**ANSWER:**
> "FlowForge has robust error handling:
>
> **Real-Time Alerts:**
> - Email/Slack notifications on failure
> - See exactly which task failed and why
>
> **Automatic Retries:**
> - Transient errors (network issues) → Auto-retry 3x
> - Configurable retry delays (exponential backoff)
>
> **Detailed Logs:**
> - Full execution logs available in UI
> - Error messages include line numbers and context
> - Can download logs for troubleshooting
>
> **Data Safety:**
> - Bronze layer always preserves raw data
> - Failed runs don't corrupt existing data
> - Can replay from Bronze if needed
>
> **Support:**
> - Enterprise tier includes SLA-backed support
> - Direct Slack channel for urgent issues
>
> In production, we see 99.5%+ success rates once pipelines are stable."

---

### Q: "What's your roadmap for the next 6-12 months?"

**ANSWER:**
> "Great question. Here's what's coming:
>
> **Q1-Q2 2025 (Next 3 months):**
> - ✅ Workflow Triggers (scheduled, event-based) - SHIPPED
> - Data Quality Rules (completeness, accuracy checks)
> - Database Connectors (MySQL, PostgreSQL, SQL Server)
> - Role-Based Access Control (RBAC)
>
> **Q2-Q3 2025 (3-6 months):**
> - SQL Transformations (custom queries in UI)
> - Incremental Processing (delta loads, not full refresh)
> - Git Integration (version control for workflows)
> - Advanced Alerting (PagerDuty, ServiceNow)
>
> **Q3-Q4 2025 (6-12 months):**
> - Python Transformations (custom code)
> - Intelligent Document Processing (PDF/image extraction)
> - Integration Marketplace (pre-built connectors)
> - Multi-Region Deployments
>
> We ship every 2 weeks and take customer feedback very seriously. If there's something critical for your use case, we can prioritize it."

---

## 📁 Demo Data & Files

### Creating Demo Data Files:

**Location:** `c:/Dev/FlowForge/demo-data/`

#### 1. customers.csv (Clean Data - For Success Demo)

```csv
customer_id,first_name,last_name,email,phone,city,state,zip_code,lifetime_value,signup_date,customer_status
C001,John,Smith,john.smith@email.com,555-0100,Seattle,WA,98101,45000,2023-01-15,active
C002,Sarah,Johnson,sarah.j@email.com,555-0101,Portland,OR,97201,67000,2023-02-20,active
C003,Michael,Brown,michael.b@email.com,555-0102,San Francisco,CA,94102,125000,2023-03-10,active
C004,Emily,Davis,emily.d@email.com,555-0103,Los Angeles,CA,90001,89000,2023-04-05,active
C005,David,Wilson,david.w@email.com,555-0104,San Diego,CA,92101,52000,2023-05-12,active
C006,Lisa,Martinez,lisa.m@email.com,555-0105,Phoenix,AZ,85001,73000,2023-06-18,active
C007,James,Garcia,james.g@email.com,555-0106,Denver,CO,80201,98000,2023-07-22,active
C008,Maria,Rodriguez,maria.r@email.com,555-0107,Austin,TX,78701,110000,2023-08-30,active
C009,Robert,Lee,robert.l@email.com,555-0108,Chicago,IL,60601,145000,2023-09-14,active
C010,Jennifer,White,jennifer.w@email.com,555-0109,Boston,MA,02101,78000,2023-10-20,active
```

**Purpose:** Demonstrates clean data processing, AI schema detection, successful pipeline execution.

---

#### 2. sales_transactions.csv (Data Quality Issues - For Quality Demo)

```csv
transaction_id,customer_id,order_date,product_name,category,quantity,unit_price,total_amount,payment_status,payment_method
T001,C001,2024-01-15,Widget A,Electronics,5,50.00,250.00,completed,credit_card
T002,C002,2024-01-16,Widget B,Electronics,,-100.00,-500.00,completed,credit_card
T003,,2024-01-17,Widget C,Home,10,100.00,1000.00,pending,paypal
T004,C003,INVALID_DATE,Widget A,Electronics,3,50.00,150.00,completed,debit_card
T005,C004,2024-01-19,Widget D,Electronics,-5,75.00,-375.00,failed,credit_card
T006,C005,2024-01-20,Widget E,Books,2,25.00,50.00,completed,credit_card
T007,C006,2024-01-21,,Electronics,1,200.00,200.00,completed,paypal
T008,C007,2024-01-22,Widget F,Home,100,5.00,500.00,completed,credit_card
T009,C008,2024-01-23,Widget G,Electronics,0,150.00,0.00,pending,credit_card
T010,C999,2024-01-24,Widget H,Electronics,3,50.00,150.00,completed,cash
```

**Data Quality Issues Present:**
- Row 2: Negative quantity and amount
- Row 3: Missing customer_id
- Row 4: Invalid date format
- Row 5: Negative quantity
- Row 7: Missing product_name
- Row 9: Zero quantity
- Row 10: customer_id doesn't exist (C999)

**Purpose:** Demonstrates data quality validation, error handling, and how FlowForge flags issues.

---

#### 3. invoice_sample.pdf (For IDP Demo - Optional)

**Content:**
```
INVOICE

Invoice #: INV-2024-001
Date: January 15, 2024

Bill To:
Acme Corporation
123 Business St
Seattle, WA 98101

Description                    Qty    Unit Price    Amount
---------------------------------------------------------
Professional Services           40     $150.00      $6,000.00
Cloud Infrastructure             1    $2,500.00     $2,500.00
Support & Maintenance            1      $500.00       $500.00

                                       Subtotal:     $9,000.00
                                       Tax (10%):      $900.00
                                       TOTAL:        $9,900.00

Payment Terms: Net 30
Due Date: February 14, 2024
```

**Purpose:** Demonstrates IDP (Intelligent Document Processing) capabilities if showing Phase 3 roadmap.

---

### Demo Data Setup Script:

```bash
# Create demo-data directory
cd c:/Dev/FlowForge
mkdir demo-data

# Create customers.csv
cat > demo-data/customers.csv << 'EOF'
customer_id,first_name,last_name,email,phone,city,state,zip_code,lifetime_value,signup_date,customer_status
C001,John,Smith,john.smith@email.com,555-0100,Seattle,WA,98101,45000,2023-01-15,active
C002,Sarah,Johnson,sarah.j@email.com,555-0101,Portland,OR,97201,67000,2023-02-20,active
C003,Michael,Brown,michael.b@email.com,555-0102,San Francisco,CA,94102,125000,2023-03-10,active
C004,Emily,Davis,emily.d@email.com,555-0103,Los Angeles,CA,90001,89000,2023-04-05,active
C005,David,Wilson,david.w@email.com,555-0104,San Diego,CA,92101,52000,2023-05-12,active
C006,Lisa,Martinez,lisa.m@email.com,555-0105,Phoenix,AZ,85001,73000,2023-06-18,active
C007,James,Garcia,james.g@email.com,555-0106,Denver,CO,80201,98000,2023-07-22,active
C008,Maria,Rodriguez,maria.r@email.com,555-0107,Austin,TX,78701,110000,2023-08-30,active
C009,Robert,Lee,robert.l@email.com,555-0108,Chicago,IL,60601,145000,2023-09-14,active
C010,Jennifer,White,jennifer.w@email.com,555-0109,Boston,MA,02101,78000,2023-10-20,active
EOF

# Create sales_transactions.csv
cat > demo-data/sales_transactions.csv << 'EOF'
transaction_id,customer_id,order_date,product_name,category,quantity,unit_price,total_amount,payment_status,payment_method
T001,C001,2024-01-15,Widget A,Electronics,5,50.00,250.00,completed,credit_card
T002,C002,2024-01-16,Widget B,Electronics,,-100.00,-500.00,completed,credit_card
T003,,2024-01-17,Widget C,Home,10,100.00,1000.00,pending,paypal
T004,C003,INVALID_DATE,Widget A,Electronics,3,50.00,150.00,completed,debit_card
T005,C004,2024-01-19,Widget D,Electronics,-5,75.00,-375.00,failed,credit_card
T006,C005,2024-01-20,Widget E,Books,2,25.00,50.00,completed,credit_card
T007,C006,2024-01-21,,Electronics,1,200.00,200.00,completed,paypal
T008,C007,2024-01-22,Widget F,Home,100,5.00,500.00,completed,credit_card
T009,C008,2024-01-23,Widget G,Electronics,0,150.00,0.00,pending,credit_card
T010,C999,2024-01-24,Widget H,Electronics,3,50.00,150.00,completed,cash
EOF

echo "✅ Demo data files created in demo-data/"
```

---

## 🐛 Troubleshooting

### Issue 1: Services Not Running

**Symptom:** Demo shows "fetch failed" or connection errors

**Fix:**
```bash
cd c:/Dev/FlowForge
docker-compose ps  # Check status
docker-compose up -d  # Start if needed
curl http://localhost:4200/api/health  # Verify Prefect
```

---

### Issue 2: AI Schema Detection Fails

**Symptom:** AI analysis hangs or returns "API key invalid"

**Fix:**
```bash
# Check OpenAI API key
cd c:/Dev/FlowForge/apps/web
grep OPENAI_API_KEY .env.local

# If missing or invalid, update it
echo "OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE" >> .env.local

# Restart web app
npm run dev
```

---

### Issue 3: Workflow Execution Hangs

**Symptom:** Workflow stays in "Running" status for 5+ minutes

**Cause:** Prefect worker not running or deployment misconfigured

**Fix:**
```bash
# Check Prefect workers
cd c:/Dev/FlowForge/prefect-flows
prefect work-pool ls
prefect worker ls

# If no workers, start one
prefect worker start --pool flowforge-local
```

---

### Issue 4: Data Not Showing in Explorer

**Symptom:** Workflow completes but no data in Data Explorer

**Cause:** DuckDB database not connected or S3 files not written

**Fix:**
```bash
# Check MinIO buckets
open http://localhost:9001
# Login: minioadmin / minioadmin123
# Verify flowforge-data bucket exists
# Check for Bronze/Silver/Gold folders with data

# Check DuckDB file
cd c:/Dev/FlowForge/apps/web/data
ls -lh analytics.duckdb  # Should exist and have size > 0
```

---

### Issue 5: Demo Too Slow

**Symptom:** AI detection takes 30+ seconds, pipeline runs take 5+ minutes

**Cause:** Resource constraints or network latency

**Short-term Fix:**
- Close other applications
- Use smaller demo file (100 rows instead of 1000)
- Pre-run the workflow before demo (use cached results)

**Long-term Fix:**
```bash
# Increase Docker resources
# Docker Desktop → Settings → Resources
# CPU: 4+ cores
# Memory: 8GB+
# Swap: 2GB+
```

---

## 🎯 Demo Success Metrics

**Measure Demo Effectiveness:**

- [ ] **Engagement:** Prospect asked 3+ questions during demo
- [ ] **Understanding:** Prospect could explain FlowForge to their team
- [ ] **Next Steps:** Scheduled POC or pilot program
- [ ] **Technical Validation:** CTO/Engineering team wants deeper dive
- [ ] **Budget Alignment:** Discussed pricing without sticker shock

**Post-Demo Follow-Up:**
1. Send deck within 24 hours
2. Schedule technical deep-dive (if requested)
3. Provide POC deployment plan (if interested)
4. Share ROI calculator customized to their use case

---

## 📞 Support During Demo

**If Demo Fails:**
- "Let me show you this on slides instead while I troubleshoot"
- Have backup: PowerPoint with screenshots of successful demo
- Focus on architecture and business value
- Offer to record a working demo and send later

**Internal Support:**
- Slack: #sales-engineering
- Email: demo-support@flowforge.com
- Phone: XXX-XXX-XXXX (during business hours)

---

**Last Updated:** October 23, 2025
**Version:** 1.0
**Maintained by:** Sales Engineering Team

**Feedback?** Submit improvements to this script via GitHub or Slack #sales-enablement
