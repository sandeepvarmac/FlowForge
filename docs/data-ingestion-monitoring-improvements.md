# Data Ingestion Monitoring - Future Improvements

**Created:** 2025-10-13
**Status:** Design Document - For Future Implementation
**Priority:** Phase 2 Feature

---

## Problem Statement

The current "Landing Files" section in the workflow detail page is too narrow in scope:
- Only shows manually uploaded files via UI
- Doesn't account for database sources, APIs, streaming, or external file drops
- Not production-ready for real-world data ingestion patterns
- Doesn't adapt based on job source type

## Real-World Data Ingestion Patterns

### 1. File-Based Sources
- **Manual Upload (UI)** - Current implementation ✅
- **S3/Blob Storage Monitoring** - External processes drop files → trigger ingestion
- **SFTP/FTP Drop Folders** - Partners upload files to SFTP → auto-detect and process
- **Email Attachments** - Files arrive via email → extract and ingest
- **File Pattern Matching** - Monitor for `customer_*.csv` and process all matches

### 2. Database Sources
- **SQL Databases** - PostgreSQL, MySQL, SQL Server, Oracle, Snowflake
- **NoSQL Databases** - MongoDB, DynamoDB, Cassandra, DocumentDB
- **Data Warehouses** - BigQuery, Redshift, Synapse Analytics
- No "landing files" - data is queried directly and written to Bronze

### 3. API Sources
- **REST APIs** - Fetch data via HTTP endpoints (pagination, incremental)
- **GraphQL APIs** - Query specific data structures
- **Webhooks** - Real-time event-driven ingestion
- **SaaS Connectors** - Salesforce, HubSpot, Stripe, etc.
- No "landing files" - data is fetched and transformed on-the-fly

### 4. Streaming Sources
- **Message Queues** - Kafka, Kinesis, Event Hubs, Pub/Sub
- **Change Data Capture (CDC)** - Debezium, Oracle GoldenGate
- **IoT Streams** - Device telemetry, sensor data
- Continuous ingestion - no discrete "landing files"

### 5. Batch Orchestration
- **Scheduled Pulls** - Automated daily/hourly jobs fetch data
- **Event-Driven** - Cloud Storage events trigger workflows (S3 PUT event)
- **Incremental Loads** - Watermark-based (fetch records > last_timestamp)

---

## Modern Data Platform Benchmarks

### Databricks Lakehouse
- **Data Sources Tab**: Shows configured sources with connection status
- **Ingestion Monitoring**: Tracks ingestion jobs, not just files
- **AutoLoader**: Monitors cloud storage for new files automatically
- **Delta Live Tables**: Declarative pipelines - source doesn't matter

### Fivetran / Airbyte
- **Sources & Destinations**: Configuration-driven connectors
- **Sync History**: Shows sync runs with records synced, not files
- **Connection Health**: Monitors source connectivity
- **Schema Drift Detection**: Tracks source schema changes

### dbt Cloud
- **Source Freshness**: Monitors when data was last updated in source
- **Source Tests**: Data quality checks at source level
- **Lineage Graph**: Shows source → models relationships
- No concept of "landing files" - works with any source

### Snowflake
- **Snowpipe**: Auto-ingestion from cloud storage (event-driven)
- **Data Load History**: Tracks all ingestion jobs (files, API, streaming)
- **External Tables**: Query S3/Azure/GCS directly without ingestion
- **Tasks & Streams**: Scheduled/event-driven processing

### AWS Glue / Azure Data Factory
- **Connectors**: 100+ pre-built connectors (DB, API, SaaS)
- **Monitoring Dashboard**: Shows pipeline runs, records processed, errors
- **Data Catalog**: Central metadata repository for all sources
- **Triggers**: Time-based, event-based, or manual

---

## Proposed Solution: Dynamic "Data Ingestion" Section

### Architecture Changes

```typescript
interface DataSource {
  type: 'file' | 'database' | 'api' | 'streaming' | 'nosql'
  config: FileConfig | DatabaseConfig | APIConfig | StreamingConfig
  monitoringMetrics: {
    lastIngestionTime?: Date
    totalRecordsIngested: number
    ingestionHealth: 'healthy' | 'warning' | 'error'
    sourceConnectionStatus?: 'connected' | 'disconnected'
  }
}
```

### UI Components by Source Type

#### 1. File-Based Sources (`file`)

**Card Title:** "Source Files" or "Ingestion Files"

**Content:**
- **Manual Upload Mode**: Show uploaded files with metadata (current behavior)
- **Pattern Matching Mode**: Show files matching pattern in landing folder
  - Example: `customer_*.csv` → `customer_2024.csv`, `customer_jan.csv`
  - Auto-detect new files and show "New files available" badge
- **External Drop Mode**: Monitor external storage location
  - Show files detected by file watcher/S3 events
  - Display file arrival time, size, processing status

**Example Layout:**
```
┌─────────────────────────────────────────────────┐
│ Source Files (Pattern: customer_*.csv) [Refresh]│
├─────────────────────────────────────────────────┤
│ ✓ customer_2024_01.csv    1.2 MB   2h ago      │
│ ⏳ customer_2024_02.csv    980 KB   5m ago      │
│ ❌ customer_2024_03.csv    2.1 MB   Failed      │
└─────────────────────────────────────────────────┘
```

#### 2. Database Sources (`database`, `nosql`)

**Card Title:** "Source Connection"

**Content:**
- Connection status (connected/disconnected)
- Last sync time and next scheduled sync
- Records ingested in last run
- Source schema drift detection
- Query preview (for SQL sources)

**Example Layout:**
```
┌─────────────────────────────────────────────────┐
│ Source: PostgreSQL Database      [Test Connection]│
├─────────────────────────────────────────────────┤
│ Status: ● Connected                              │
│ Host: prod-postgres.company.com:5432            │
│ Database: sales_db                               │
│ Table: customers                                 │
│                                                  │
│ Last Sync: 10 minutes ago                       │
│ Records Synced: 1,234 rows (5 new, 12 updated) │
│ Next Sync: In 50 minutes                        │
│                                                  │
│ Schema Changes Detected: ⚠️ 2 new columns       │
└─────────────────────────────────────────────────┘
```

#### 3. API Sources (`api`)

**Card Title:** "API Endpoint"

**Content:**
- API endpoint URL and authentication status
- Last successful call timestamp
- Records fetched in last run
- Rate limit status
- Error rate and retry attempts

**Example Layout:**
```
┌─────────────────────────────────────────────────┐
│ Source: REST API (Salesforce)    [Test Endpoint]│
├─────────────────────────────────────────────────┤
│ Status: ● Active                                 │
│ Endpoint: api.salesforce.com/data/v57.0/query  │
│ Auth: OAuth 2.0 (Expires in 45 days)           │
│                                                  │
│ Last Call: 15 minutes ago                       │
│ Records Fetched: 856 records                    │
│ API Rate Limit: 4,200 / 5,000 calls remaining  │
│                                                  │
│ Errors (Last 24h): 0                            │
└─────────────────────────────────────────────────┘
```

#### 4. Streaming Sources (`streaming`)

**Card Title:** "Stream Status"

**Content:**
- Stream health and lag metrics
- Messages/events consumed per minute
- Current offset/partition info
- Consumer group status

**Example Layout:**
```
┌─────────────────────────────────────────────────┐
│ Source: Kafka Topic (customer-events)   [Monitor]│
├─────────────────────────────────────────────────┤
│ Status: ● Streaming                              │
│ Topic: customer-events (3 partitions)           │
│ Consumer Group: flowforge-ingestion             │
│                                                  │
│ Current Lag: 42 messages (~2 seconds)           │
│ Throughput: 1,234 msg/min                       │
│                                                  │
│ Last 10 minutes: 12,340 events processed        │
└─────────────────────────────────────────────────┘
```

### Unified "Ingestion History" Section

Regardless of source type, add a universal **"Ingestion History"** card that shows:
- All ingestion runs (whether from files, DB pulls, API calls, streams)
- Records processed per run
- Duration and status
- Errors and warnings

```
┌─────────────────────────────────────────────────┐
│ Ingestion History              [View All Runs]  │
├─────────────────────────────────────────────────┤
│ ✓ 2 hours ago      1,234 records   2.3s         │
│ ✓ 4 hours ago      1,189 records   2.1s         │
│ ❌ 6 hours ago      Failed (Connection timeout)  │
│ ✓ 8 hours ago      1,256 records   2.4s         │
└─────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Refactor Current "Landing Files" (Immediate)
**Goal:** Make current implementation conditional and properly scoped

**Tasks:**
1. Rename "Landing Files" to "Source Files"
2. Add source type detection logic in workflow detail page
3. Show "Source Files" card ONLY for `file-based` jobs
4. Hide this card for other source types (database, api, streaming, nosql)
5. Update card header to reflect upload mode:
   - "Source Files (Single File Upload)"
   - "Source Files (Pattern: customer_*.csv)"
   - "Source Files (External Drop Folder)"

**Files to Modify:**
- `apps/web/src/app/(routes)/workflows/[id]/page.tsx`

**Estimated Effort:** 2-3 hours

---

### Phase 2: Add Source Monitoring Cards (Next Sprint)
**Goal:** Create adaptive UI components for each source type

**Tasks:**
1. Create `SourceMonitorCard` component with type variants
2. Implement `FileSourceCard` (enhanced version of current)
3. Create placeholder cards with "Coming Soon" badge:
   - `DatabaseSourceCard`
   - `APISourceCard`
   - `StreamingSourceCard`
   - `NoSQLSourceCard`
4. Add connection testing capabilities (database/API)
5. Display source health metrics

**New Components:**
```
apps/web/src/components/sources/
  ├── source-monitor-card.tsx       (parent wrapper)
  ├── file-source-card.tsx          (file-based)
  ├── database-source-card.tsx      (SQL/NoSQL)
  ├── api-source-card.tsx           (REST/GraphQL)
  ├── streaming-source-card.tsx     (Kafka/Kinesis)
  └── generic-source-card.tsx       (fallback)
```

**Estimated Effort:** 1-2 days

---

### Phase 3: Universal Ingestion History (Future)
**Goal:** Track and display all ingestion events regardless of source

**Tasks:**
1. Extend `job_executions` table with source-specific metrics
2. Create unified ingestion history API endpoint
3. Build `IngestionHistoryCard` component
4. Add filtering by date range, status, records processed
5. Link to detailed execution logs in Prefect UI
6. Add export to CSV functionality

**Database Schema Changes:**
```sql
-- Add to job_executions table
ALTER TABLE job_executions ADD COLUMN source_type TEXT;
ALTER TABLE job_executions ADD COLUMN source_identifier TEXT; -- filename, table name, API endpoint, etc.
ALTER TABLE job_executions ADD COLUMN records_fetched INTEGER;
ALTER TABLE job_executions ADD COLUMN records_inserted INTEGER;
ALTER TABLE job_executions ADD COLUMN records_updated INTEGER;
ALTER TABLE job_executions ADD COLUMN records_skipped INTEGER;
```

**Estimated Effort:** 3-4 days

---

### Phase 4: Advanced Features (Future Roadmap)
**Goal:** Production-grade monitoring and alerting

**Features:**
1. **Auto-Discovery**: Detect new files in landing folder automatically
   - S3 event notifications → trigger workflow
   - File watcher for SFTP/FTP locations

2. **Schema Drift Alerts**: Notify when source schema changes
   - Compare current schema with last known schema
   - Alert on: new columns, removed columns, type changes
   - Show diff visualization

3. **Source Freshness SLAs**: Alert if data hasn't arrived within expected time
   - Configure expected arrival window (e.g., "files arrive by 9 AM daily")
   - Send alerts if data is late
   - Dashboard showing freshness status

4. **Connection Health Monitoring**: Periodic heartbeat checks for DB/API sources
   - Background job tests connection every N minutes
   - Track connection success rate
   - Alert on degraded connectivity

5. **Source Lineage**: Track upstream dependencies
   - Show which external systems feed into each job
   - Impact analysis: "What breaks if this source goes down?"

6. **Cost Monitoring**: Track API call costs, storage costs
   - Show cost per ingestion run
   - Budget alerts and forecasting

**Estimated Effort:** 2-3 weeks per feature

---

## Technical Implementation Details

### Component Structure

```typescript
// apps/web/src/components/sources/source-monitor-card.tsx

interface SourceMonitorCardProps {
  job: Job
  workflowId: string
}

export function SourceMonitorCard({ job, workflowId }: SourceMonitorCardProps) {
  const sourceType = job.sourceConfig.type

  switch (sourceType) {
    case 'file':
      return <FileSourceCard job={job} workflowId={workflowId} />
    case 'database':
      return <DatabaseSourceCard job={job} workflowId={workflowId} />
    case 'nosql':
      return <NoSQLSourceCard job={job} workflowId={workflowId} />
    case 'api':
      return <APISourceCard job={job} workflowId={workflowId} />
    case 'streaming':
      return <StreamingSourceCard job={job} workflowId={workflowId} />
    default:
      return <GenericSourceCard job={job} workflowId={workflowId} />
  }
}
```

### API Endpoints to Create

```typescript
// Connection testing
GET  /api/jobs/{jobId}/test-connection
POST /api/jobs/{jobId}/test-connection

// Ingestion history
GET  /api/jobs/{jobId}/ingestion-history?limit=10&offset=0&status=failed

// Source health
GET  /api/jobs/{jobId}/source-health

// Schema drift
GET  /api/jobs/{jobId}/schema-drift
```

---

## Design Principles

1. **Source-Agnostic**: UI adapts to job's source type
2. **Production-Ready**: Focus on monitoring, not just configuration
3. **Proactive Alerts**: Detect issues before they cause failures
4. **Contextual Information**: Show metrics relevant to each source type
5. **Consistent UX**: Unified patterns across all source types

---

## References

- **Fivetran Connector Monitoring**: https://fivetran.com/docs/getting-started/fivetran-dashboard
- **Databricks AutoLoader**: https://docs.databricks.com/ingestion/auto-loader/index.html
- **Airbyte Connection Status**: https://docs.airbyte.com/understanding-airbyte/connections
- **dbt Source Freshness**: https://docs.getdbt.com/docs/deploy/source-freshness

---

## Notes for Implementation

- Start with Phase 1 to fix immediate UX issues
- Phase 2 can be built incrementally (one source type at a time)
- Phase 3 requires database schema changes - plan migration carefully
- Phase 4 features are independent and can be prioritized based on user needs

**Key Insight:** Modern data platforms don't assume files - they're source-agnostic and show metrics relevant to each source type.
