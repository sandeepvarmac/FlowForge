# File-Based Data Ingestion - Research & Architecture

**Created:** 2025-10-13
**Status:** Research & Design Document
**Purpose:** Comprehensive analysis of modern file ingestion patterns for FlowForge

---

## Executive Summary

This document provides a comprehensive analysis of file-based data ingestion patterns used by modern data platforms (Databricks, Snowflake, AWS Glue, Azure Data Factory, Airbyte, Fivetran). It serves as the foundation for expanding FlowForge's file ingestion capabilities beyond the current manual CSV upload to support production-grade data pipelines.

**Current State:** Manual CSV upload with AI-powered column naming
**Vision:** Production-ready file ingestion framework supporting multiple formats, patterns, and automation strategies

---

## 1. FILE INGESTION PATTERNS (How Files Are Loaded)

### A. Manual Upload (Current Implementation ✅)
**Use Case:** Ad-hoc data loads, one-time imports, testing, prototyping
**User Action:** User manually uploads file via UI
**Platforms:** All platforms support this as starting point

**Examples:**
- Uploading a customer export from Salesforce for analysis
- Importing historical data from Excel spreadsheet
- Testing new data source before automation
- One-time backfill of archived data

**Characteristics:**
- Simple, no configuration required
- Good for exploratory analysis
- Not suitable for production pipelines
- Human intervention required for each load

---

### B. Cloud Storage Monitoring (Auto-Ingest) 🔥 PRODUCTION STANDARD

**Use Case:** Production pipelines where external processes drop files into cloud storage
**Mechanism:** Event-driven notifications trigger automatic ingestion
**Platforms:** Snowflake Snowpipe, Databricks AutoLoader, AWS Glue, Azure Data Factory

#### **Implementation Patterns:**

##### **Snowflake Snowpipe**
- **AWS S3:** S3 → SNS → SQS → Snowpipe
- **Azure Blob:** Blob Storage → Event Grid → Storage Queue → Snowpipe
- **GCP:** GCS → Pub/Sub → Snowpipe
- **Trigger:** ObjectCreated events (Put, Post, Copy, CompleteMultipartUpload)
- **Features:** Exactly-once guarantees, automatic retry, serverless compute

##### **Databricks AutoLoader**
- **Detection Modes:**
  - **Directory Listing:** Polls directory for new files (simple setup)
  - **File Notification:** Cloud events (S3 Events, Event Grid, Pub/Sub) - more scalable
- **Features:**
  - Near real-time ingestion (millions of files per hour)
  - Schema inference and evolution
  - Rescued data column for malformed records
  - Exactly-once guarantees via RocksDB checkpoints
  - Cost-efficient (scales with files, not directories)

**Examples:**
- Partner uploads daily sales files to S3 → automatic ingestion triggers
- IoT devices write telemetry to Azure Blob → real-time processing
- External vendor drops inventory updates to GCS → pipeline processes immediately

**Characteristics:**
- Event-driven, no polling overhead
- Near real-time ingestion
- Scales to millions of files
- Production-grade reliability
- Requires cloud permissions setup

---

### C. SFTP/FTP Drop Folders

**Use Case:** Partner integrations, legacy systems, B2B file exchanges, regulated industries
**Mechanism:** Scheduled polling or event-based monitoring of SFTP/FTP directories
**Platforms:** Azure Data Factory, AWS Glue, Fivetran, Airbyte

#### **Implementation Patterns:**

##### **Azure Data Factory SFTP Connector**
- **Authentication:** Basic, SSH public key, multifactor
- **Features:**
  - Incremental load via `modifiedDatetimeStart` / `modifiedDatetimeEnd`
  - File format support: CSV, JSON, Parquet, Avro, ORC, XML
  - Compression codec support
  - File metadata filtering
  - Delete source file after copy (optional)

##### **SFTP Support in Azure Blob Storage**
- Native SFTP endpoint on Blob Storage accounts
- Partners can upload directly to Azure without VPN/ExpressRoute
- Fully managed, no VM/gateway required
- Limitation: FTPS and FTP not supported, only SFTP

**Examples:**
- Bank uploads daily transaction files to SFTP at 2 AM
- Healthcare provider drops patient records via secure FTP
- Retailer receives supplier catalogs via SFTP daily
- Government agency delivers compliance reports via SFTP

**Characteristics:**
- Secure file transfer (encrypted)
- Partner-friendly (no API integration needed)
- Scheduled or event-driven polling
- Legacy system compatibility
- Firewall-friendly

---

### D. File Pattern Matching (Glob Patterns) ✅ Partially Implemented

**Use Case:** Multiple related files with naming conventions
**Mechanism:** Match files using wildcards (`customer_*.csv`, `orders_2024*.parquet`)
**Platforms:** All modern platforms support glob/regex patterns

#### **Pattern Syntax:**
- `*` - Match zero or more characters
- `?` - Match exactly one character
- `[abc]` - Match any character in brackets
- `[a-z]` - Match any character in range
- `{csv,json}` - Match alternatives

**Examples:**
- **Daily Files:** `customer_*.csv` → `customer_2024-01-15.csv`, `customer_2024-01-16.csv`
- **Regional Files:** `sales_{US,EU,APAC}_*.parquet` → `sales_US_jan.parquet`, `sales_EU_jan.parquet`
- **Versioned Files:** `data_v?.json` → `data_v1.json`, `data_v2.json`, `data_v3.json`
- **Time-Partitioned:** `logs/2024/01/*/access.log` → All January 2024 logs

**Characteristics:**
- Flexible file matching
- Process multiple files in single job
- Supports incremental additions
- Schema must be consistent across files

---

### E. Directory/Folder Ingestion

**Use Case:** Entire directory of files needs to be processed
**Mechanism:** Recursively scan directory and process all files
**Platforms:** Databricks AutoLoader, AWS Glue, Azure Data Factory

**Examples:**
- Ingest all files from `/landing/2024/Q1/` folder
- Process entire archive directory: `/archives/historical_data/*`
- Recursive scan: `/data/**/*.parquet` (all Parquet files in any subdirectory)

**Characteristics:**
- Batch processing of multiple files
- Can mix file formats if platform supports
- Useful for backfills and migrations
- May require file sorting/ordering logic

---

### F. Incremental/Watermark-Based Loading 🔥 PRODUCTION CRITICAL

**Use Case:** Only load new/changed files since last run
**Mechanism:** Track last modified timestamp or use file metadata
**Platforms:** All production platforms support this

#### **Watermark Strategies:**

##### **File Timestamp-Based**
- Track last processed timestamp in state table
- Only process files with `modified_time > last_watermark`
- Update watermark after successful run
- Example: Azure Data Factory `modifiedDatetimeStart`/`modifiedDatetimeEnd`

##### **Filename-Based Watermark**
- Extract date/sequence from filename: `data_2024-01-15.csv`
- Track last processed date/sequence
- Process only newer files

##### **Checkpoint Files** (Databricks AutoLoader, Kafka Connect)
- Store processed file list in checkpoint location (RocksDB, JSON)
- Skip files already in checkpoint
- Exactly-once guarantees

##### **Change Data Capture (CDC) for Files**
- Debezium-style file monitoring
- Track INSERT/UPDATE/DELETE operations
- Example: Airbyte CDC connectors

**Examples:**
- Only process files modified after last successful run (timestamp: 2024-01-15 14:30:00)
- Incremental backfill: Process 1 month at a time using date range filters
- Resume after failure: Checkpoint tracks processed files, resume from last checkpoint

**Characteristics:**
- Cost-efficient (avoid reprocessing)
- Faster incremental runs
- Enables near real-time pipelines
- Requires state management

---

### G. Archive/Historical Backfill

**Use Case:** Bulk import of historical data
**Mechanism:** Process files from a date range or archive location
**Platforms:** All platforms support batch historical loads

**Examples:**
- Backfill 5 years of transaction history from archived Parquet files
- Migrate data from legacy system: process 10TB of historical CSV files
- One-time load: Import 1 million customer records from data warehouse export

**Strategies:**
- **Parallel Processing:** Distribute files across multiple workers
- **Date Range Filtering:** Process 1 year at a time to avoid memory issues
- **Staged Approach:** Bronze (raw) → Silver (dedupe) → Gold (aggregate)

**Characteristics:**
- One-time or infrequent operation
- Large data volumes
- May require special performance tuning
- Often combined with incremental after backfill

---

### H. Streaming File Ingestion (Near Real-Time)

**Use Case:** Near real-time ingestion as files arrive
**Mechanism:** Continuous monitoring with micro-batch processing
**Platforms:** Databricks AutoLoader (streaming mode), Kafka Connect File Source

#### **Databricks AutoLoader Streaming Mode:**
```python
df = spark.readStream.format("cloudFiles") \
    .option("cloudFiles.format", "json") \
    .option("cloudFiles.schemaLocation", checkpoint_path) \
    .load("/mnt/data/landing")

df.writeStream \
    .format("delta") \
    .option("checkpointLocation", checkpoint_path) \
    .start("/mnt/data/bronze")
```

**Examples:**
- IoT sensors writing JSON files every second → stream to Delta Lake
- Log files arriving continuously → parse and index in real-time
- Partner API generates files every 5 minutes → ingest with <1 minute latency

**Characteristics:**
- Micro-batch processing (seconds to minutes)
- Continuously running stream
- Exactly-once semantics
- Auto-scaling based on file arrival rate
- More complex than batch

---

## 2. FILE FORMATS (What Files Are Supported)

### Structured Formats (Tabular Data)

#### A. Delimited Text Files

##### **CSV (Comma-Separated Values)** ✅ CURRENT IMPLEMENTATION
**Use Case:** Universal interchange format, Excel exports, simple datasets
**Platform Support:** All platforms
**Characteristics:**
- Human-readable
- Large ecosystem support
- No schema enforcement
- Compression recommended (GZIP)

**Variants & Options:**
- **Delimiters:** Comma `,`, Tab `\t`, Pipe `|`, Semicolon `;`, Custom
- **Encoding:** UTF-8, UTF-16, Latin-1 (ISO-8859-1), Windows-1252
- **Headers:** With header row / Without header row (AI column naming)
- **Quoting:** Double quotes `"`, Single quotes `'`, No quotes
- **Escape Character:** Backslash `\`, Double quote `""`, Custom
- **Line Terminators:** CRLF (`\r\n` Windows), LF (`\n` Unix), CR (`\r` Mac)
- **Skip Rows:** Skip header rows, comment lines (e.g., `# comment`)
- **Null Representation:** Empty string `""`, `NULL`, `\N`, Custom

**Advanced Features:**
- **Multi-line Fields:** Fields containing newlines (quoted)
- **BOM (Byte Order Mark):** UTF-8 BOM detection
- **Malformed Row Handling:** Skip, quarantine, fail
- **Schema Inference:** Auto-detect types from sample rows

**Example:**
```csv
customer_id,name,email,country,revenue
1,"John Doe",john@example.com,US,1234.56
2,"Jane Smith",jane@example.com,UK,2345.67
```

---

##### **TSV (Tab-Separated Values)**
**Use Case:** Data exports from databases, less ambiguity than CSV
**Characteristics:**
- Tab delimiter reduces quote/escape issues
- Common in bioinformatics, genomics
- Unix-friendly (awk, cut, paste)

---

##### **PSV (Pipe-Separated Values)**
**Use Case:** Data with commas in text fields
**Example:** `1|John Doe|New York, NY|Sales`

---

##### **Fixed-Width Text Files**
**Use Case:** Legacy mainframe systems, COBOL exports
**Characteristics:**
- Each field has fixed character positions
- No delimiters, padding with spaces
- Column definitions required (start, length)

**Example:**
```
NAME                EMAIL                   AMOUNT
John Doe            john@example.com        001234
Jane Smith          jane@example.com        002345
```
Column specs: `NAME (1-20), EMAIL (21-40), AMOUNT (41-46)`

---

#### B. Columnar Formats (Analytics-Optimized) 🔥 RECOMMENDED FOR DATA LAKES

##### **Parquet (Apache Parquet)**
**Use Case:** Data lake storage, analytics workloads, large datasets
**Platform Support:** All modern platforms (Spark, Presto, BigQuery, Snowflake, Redshift)

**Characteristics:**
- **Columnar Storage:** Store data by column, not row
- **Compression:** Excellent compression ratios (GZIP, Snappy, ZSTD)
- **Schema Embedded:** Self-describing with metadata
- **Predicate Pushdown:** Only read required columns and rows
- **Type System:** Rich types (INT32, INT64, FLOAT, DOUBLE, TIMESTAMP, DECIMAL, ARRAY, MAP)
- **Nested Data:** Supports structs, arrays, maps

**Performance Benefits:**
- 10-100x faster queries than CSV (columnar access)
- 5-10x smaller storage size (compression)
- Cloud-optimized (read only required data)

**When to Use:**
- Data lake landing zone (Bronze/Silver/Gold layers)
- Large datasets (>100MB)
- Analytical queries (aggregations, filters)
- Long-term storage

**Example Schema:**
```python
schema = StructType([
    StructField("customer_id", IntegerType()),
    StructField("name", StringType()),
    StructField("orders", ArrayType(StructType([
        StructField("order_id", IntegerType()),
        StructField("amount", DecimalType(10, 2))
    ])))
])
```

---

##### **ORC (Optimized Row Columnar)**
**Use Case:** Hive ecosystem, MapReduce workloads
**Platform Support:** Hive, Spark, Presto, Trino

**Characteristics:**
- Similar to Parquet (columnar, compressed)
- ACID transaction support
- Bloom filters for fast lookups
- Strong type system with TIMESTAMP precision

**Parquet vs ORC:**
- Parquet: Wider ecosystem, better cloud support
- ORC: Better for Hive, stronger ACID guarantees
- **Recommendation:** Use Parquet unless Hive-specific

---

##### **Avro (Apache Avro)**
**Use Case:** Schema evolution, streaming data, Kafka messages
**Platform Support:** Kafka, Hadoop, Spark, Flink

**Characteristics:**
- **Row-Based Format:** Each record is self-contained
- **Schema Evolution:** Forward/backward compatibility
- **Compact Binary:** Smaller than JSON, larger than Parquet
- **Schema Registry:** Central schema versioning (Confluent Schema Registry)
- **Dynamic Typing:** Schema not embedded in file (stored separately)

**When to Use:**
- Kafka messages (standard format)
- Schema changes frequently
- Need to read/write full rows
- Streaming pipelines

**Schema Evolution Example:**
```json
// Version 1
{"name": "string", "age": "int"}

// Version 2 (added field with default)
{"name": "string", "age": "int", "email": "string", "default": ""}
```

---

#### C. Spreadsheet Formats

##### **Excel (XLSX, XLS)**
**Use Case:** Business user exports, financial reports, templates
**Platform Support:** AWS Glue DataBrew, Azure Data Factory, Pandas, Python openpyxl

**Characteristics:**
- Multiple sheets per file
- Formulas, formatting, charts
- Data types: numbers, dates, text, formulas
- Header rows, merged cells, comments

**Challenges:**
- Not streaming-friendly (must read entire file)
- Formulas may not evaluate correctly
- Formatting can cause type mismatches
- Multiple sheets require handling logic

**Handling Strategies:**
- **Sheet Selection:** Specify which sheet to read (index or name)
- **Header Row Detection:** Auto-detect or specify row number
- **Formula Evaluation:** Read calculated values, not formulas
- **Type Inference:** Convert Excel dates to timestamps

**Example:**
```python
# Read specific sheet with header on row 2
df = pd.read_excel("sales_report.xlsx", sheet_name="Q1 Sales", header=1)
```

---

##### **Google Sheets**
**Use Case:** Collaborative spreadsheets, real-time data entry
**Integration:** Google Sheets API or export to CSV/XLSX

---

#### D. Semi-Structured Formats

##### **JSON (JavaScript Object Notation)**
**Use Case:** APIs, NoSQL databases, nested data, configuration files
**Platform Support:** All modern platforms

**Characteristics:**
- Human-readable
- Nested objects and arrays
- Schema-less (flexible structure)
- UTF-8 encoding
- Larger file size than binary formats

**Variants:**

###### **Standard JSON (Single Object/Array)**
```json
{
  "customers": [
    {"id": 1, "name": "John", "orders": [{"order_id": 100, "amount": 50.00}]},
    {"id": 2, "name": "Jane", "orders": [{"order_id": 101, "amount": 75.00}]}
  ]
}
```

###### **JSON Lines (JSONL / NDJSON - Newline-Delimited JSON)** 🔥 RECOMMENDED
**Use Case:** Streaming, logs, line-by-line processing
```json
{"id": 1, "name": "John", "orders": [{"order_id": 100, "amount": 50.00}]}
{"id": 2, "name": "Jane", "orders": [{"order_id": 101, "amount": 75.00}]}
```
**Benefits:**
- Streaming-friendly (process line by line)
- Append-only writes
- Resilient to corruption (one bad line doesn't break file)
- Common for logs and event streams

###### **JSON Streaming**
- Continuous JSON objects without newlines
- Used in real-time APIs

**Schema Handling:**
- **Flattening:** Convert nested JSON to flat table
- **VARIANT Column:** Store entire JSON as string (Snowflake VARIANT)
- **Schema Inference:** Auto-detect structure from sample

**Example Flattening:**
```json
// Input
{"customer": {"id": 1, "name": "John"}, "order": {"id": 100, "amount": 50}}

// Flattened
customer_id | customer_name | order_id | order_amount
1           | John          | 100      | 50.00
```

---

##### **XML (Extensible Markup Language)**
**Use Case:** Legacy systems, SOAP APIs, government data, HL7 healthcare
**Platform Support:** AWS Glue, Azure Data Factory, Spark XML

**Characteristics:**
- Hierarchical structure
- Namespaces, attributes, CDATA
- Verbose (larger than JSON)
- Schema validation (XSD)

**Example:**
```xml
<customers>
  <customer id="1">
    <name>John Doe</name>
    <email>john@example.com</email>
  </customer>
</customers>
```

**Challenges:**
- Complex parsing (XPath, XSLT)
- Namespaces can complicate extraction
- Attributes vs elements ambiguity

---

#### E. Log Formats

##### **Apache/Nginx Access Logs**
**Use Case:** Web server logs, API access logs
**Format:** Combined Log Format (CLF)
```
127.0.0.1 - - [15/Jan/2024:14:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234
```

**Parsing:**
- Regex patterns to extract fields
- Convert to structured format (timestamp, IP, method, path, status, size)

---

##### **JSON Logs (Structured Logging)**
**Use Case:** Application logs, microservices, cloud-native apps
**Example:**
```json
{"timestamp": "2024-01-15T14:30:00Z", "level": "INFO", "service": "api", "message": "User login", "user_id": 123}
```

---

#### F. Binary Formats

##### **Protocol Buffers (Protobuf)**
**Use Case:** gRPC APIs, Google services, high-performance serialization
**Characteristics:**
- Compact binary format
- Schema defined in `.proto` files
- Language-agnostic
- Forward/backward compatibility

---

##### **MessagePack**
**Use Case:** Binary JSON alternative, faster serialization
**Characteristics:**
- Binary encoding of JSON-like data
- Smaller and faster than JSON
- Less human-readable

---

### 3. FILE COMPRESSION TYPES

Modern platforms support compressed files to reduce storage and transfer costs:

| Compression | Extension | Speed | Ratio | Use Case | Splittable |
|-------------|-----------|-------|-------|----------|------------|
| **GZIP** | `.gz` | Medium | High | Universal, CSV/JSON compression | No |
| **BZIP2** | `.bz2` | Slow | Highest | Maximum compression | Yes (Hadoop) |
| **ZIP** | `.zip` | Fast | Medium | Multiple files, Windows-friendly | No |
| **SNAPPY** | `.snappy` | Very Fast | Low | Parquet/Avro, low latency | No |
| **LZ4** | `.lz4` | Fastest | Low | Real-time streaming | No |
| **ZSTD** | `.zst` | Fast | High | Best balance (recommended) | No |
| **LZO** | `.lzo` | Fast | Medium | Hadoop/Hive | Yes (with index) |

**Nested Compression Examples:**
- `customer_data.csv.gz` - GZIP-compressed CSV
- `orders.parquet.snappy` - Snappy-compressed Parquet (internal)
- `logs.json.zst` - Zstandard-compressed JSON

**Splittable Compression:**
- Non-splittable (GZIP, SNAPPY): Single file processed by one worker
- Splittable (BZIP2, LZO with index): File can be split across multiple workers
- Parquet/ORC: Internally compressed per row group (always splittable)

**Recommendation:**
- **CSV/JSON:** GZIP (ubiquitous) or ZSTD (better ratio)
- **Parquet:** SNAPPY (fast, good balance) or ZSTD (better compression)
- **Streaming:** LZ4 (lowest latency) or SNAPPY
- **Archive:** BZIP2 (best compression for cold storage)

---

## 4. FILE METADATA & CONFIGURATION OPTIONS

### File Structure Options

| Option | Description | Example Values |
|--------|-------------|----------------|
| **Header Presence** | Does file have header row? | `true`, `false` |
| **Delimiter** | Field separator | `,` (CSV), `\t` (TSV), `|` (PSV), `;`, custom |
| **Quote Character** | Text field wrapper | `"` (double), `'` (single), none |
| **Escape Character** | Escape quotes/delimiters | `\` (backslash), `""` (double quote), custom |
| **Line Terminator** | End of line character | `\r\n` (Windows), `\n` (Unix), `\r` (old Mac) |
| **Skip Rows** | Number of rows to skip | `0` (none), `1` (skip header comment), `N` |
| **Encoding** | Character encoding | `UTF-8`, `ISO-8859-1`, `Windows-1252`, `UTF-16` |
| **Null Representation** | How nulls are represented | `NULL`, `\N`, empty string `""`, `NA`, custom |
| **Comment Character** | Lines to ignore | `#`, `//`, `;` |
| **Trim Whitespace** | Remove leading/trailing spaces | `true`, `false` |

---

### Schema Handling Strategies

#### **Schema Inference (Auto-Detection)**
- **Mechanism:** Read sample rows, detect types automatically
- **Platforms:** All modern platforms support this
- **Options:**
  - `infer_schema_length`: Number of rows to sample (e.g., 100, 1000, all)
  - Heuristics: Is this column a date? Number? String?

**Example (Polars):**
```python
df = pl.read_csv("data.csv", infer_schema_length=1000)
# Auto-detects: id→Int64, date→Date, amount→Float64
```

---

#### **Schema Evolution**
- **Use Case:** Source schema changes over time (new columns, removed columns, type changes)
- **Modes:**
  - **Strict Mode:** Fail on schema mismatch (recommended for production)
  - **Add New Columns:** Automatically add new columns with NULL for old data
  - **Ignore Extra Columns:** Ignore columns not in target schema
  - **Merge Schemas:** Union of all schemas seen

**Databricks AutoLoader Schema Evolution:**
```python
.option("cloudFiles.schemaEvolutionMode", "addNewColumns")
.option("cloudFiles.schemaLocation", checkpoint_path)
```

---

#### **Schema Registry (Avro/Protobuf)**
- **Use Case:** Centralized schema management, version control
- **Platform:** Confluent Schema Registry, AWS Glue Schema Registry
- **Features:**
  - Schema versioning (v1, v2, v3)
  - Compatibility checks (forward, backward, full)
  - Schema ID embedded in messages

---

#### **Schema Validation**
- **Strict Mode:** Exact schema match required
- **Permissive Mode:** Cast types, allow nulls
- **Rescued Data Column:** Capture malformed records instead of failing

**Databricks Rescued Data:**
```python
.option("rescuedDataColumn", "_rescued_data")
```
Malformed rows stored in `_rescued_data` column as JSON string.

---

### File Filtering Options

#### **Date Range Filtering**
- Only process files modified within date range
- **Example (Azure Data Factory):**
  ```
  modifiedDatetimeStart: "2024-01-01T00:00:00Z"
  modifiedDatetimeEnd: "2024-01-31T23:59:59Z"
  ```

#### **File Size Validation**
- **Min Size:** Skip empty or tiny files (e.g., min 1KB)
- **Max Size:** Reject files exceeding limit (e.g., max 5GB)
- **Use Case:** Detect incomplete uploads, prevent memory issues

#### **File Age Filtering**
- Only files older/newer than X hours
- **Example:** Only process files at least 1 hour old (ensure upload complete)

#### **Filename Pattern (Regex/Glob)**
- Match files by name pattern
- **Example:** `^customer_[0-9]{8}\.csv$` (customer_20240115.csv)

---

## 5. ERROR HANDLING & RECOVERY PATTERNS

### Common Failure Scenarios

#### **Malformed Files**
- **Issue:** Invalid CSV structure, corrupt Parquet, truncated JSON
- **Detection:** Parser errors, schema validation failures
- **Examples:**
  - CSV with mismatched column counts
  - Parquet with corrupted footer
  - JSON with unclosed brackets

#### **Schema Mismatches**
- **Issue:** Unexpected columns, type changes, missing required fields
- **Examples:**
  - Expected INT, got STRING
  - New column appeared: `customer_tier` (not in schema)
  - Required column `customer_id` is missing

#### **Duplicate Files**
- **Issue:** Same file processed twice (reprocessing causes duplicates)
- **Detection:** Checksum (MD5, SHA256), filename tracking
- **Prevention:** Idempotent processing, deduplication

#### **Partial Files**
- **Issue:** File still being written when ingestion starts
- **Detection:** File size changing, write lock, `.tmp` suffix
- **Prevention:** Wait for "complete" signal (marker file, staging folder)

#### **Network/Storage Failures**
- **Issue:** Connection timeout, cloud storage outage
- **Retry Strategy:** Exponential backoff, circuit breaker

---

### Recovery Strategies

#### **Quarantine Folder (Dead Letter Queue)**
**Mechanism:** Move bad files to error location for manual review
**Implementation:**
```
/landing/customer_data.csv → [Parse Error] → /quarantine/2024-01-15/customer_data.csv
```
**Metadata Logged:**
- Original file path
- Error message and stack trace
- Timestamp of failure
- Job ID and attempt number

---

#### **Skip & Log**
**Mechanism:** Continue processing, log errors, optionally send alerts
**Use Case:** Non-critical data, prefer availability over consistency
**Example:**
```
Row 123: Invalid email format → Skip row, log warning, continue
Row 456: Amount is NULL → Skip row, log warning, continue
```

---

#### **Retry Logic with Exponential Backoff**
**Mechanism:** Retry failed operations with increasing delays
**Example:**
```
Attempt 1: Immediate
Attempt 2: Wait 5 seconds
Attempt 3: Wait 25 seconds
Attempt 4: Wait 125 seconds
Attempt 5: Fail (mark as failed, send alert)
```

---

#### **Alert & Halt**
**Mechanism:** Stop pipeline on critical errors, send alerts
**Use Case:** Production pipelines, data quality thresholds
**Examples:**
- Row count < expected minimum (data loss detected)
- >10% rows failed validation (data quality issue)
- Schema change detected (breaking change)

---

#### **Rescued Data Column (Databricks)**
**Mechanism:** Store malformed data in special column instead of failing
**Use Case:** Preserve all data, investigate later
**Example:**
```sql
SELECT customer_id, name, _rescued_data
FROM bronze_customers
WHERE _rescued_data IS NOT NULL
```

---

#### **Checkpoint Restart**
**Mechanism:** Resume from last successful checkpoint after failure
**Implementation:**
- Track processed files in checkpoint table
- After crash, read checkpoint and skip processed files
- Exactly-once guarantees

**Databricks AutoLoader Checkpoint:**
```
/checkpoint/bronze_customers/
  ├── offsets/
  │   └── 0  (RocksDB - list of processed files)
  └── metadata/
```

---

## 6. PRODUCTION-GRADE FEATURES

### Performance Optimization

#### **Parallel Processing**
- Process multiple files concurrently
- Distribute files across Spark executors
- **Example:** 100 files → 10 workers → 10x faster

#### **Chunked Reading**
- Read large files in chunks (avoid OOM)
- Stream processing for 10GB+ files
- **Example (Pandas):** `chunksize=10000` (read 10K rows at a time)

#### **Partitioning**
- Organize files by date/category for faster queries
- **Example:** `/bronze/customers/year=2024/month=01/day=15/data.parquet`
- Query optimization: Only scan relevant partitions

#### **Columnar Pushdown (Parquet/ORC)**
- Only read required columns from columnar files
- **Example:** Query needs 2 columns → Only read those 2, skip other 98
- 10-100x faster than reading entire file

---

### Data Governance

#### **Audit Logging**
- Track all file ingestions with metadata
- **Logged:**
  - Job ID, workflow ID, file path
  - Start time, end time, duration
  - Rows processed, rows failed
  - User who triggered job
  - Source system, destination layer

#### **Lineage Tracking**
- Track data flow: File → Bronze → Silver → Gold
- **Use Case:** Impact analysis, root cause debugging
- **Tools:** DataHub, Collibra, Alation, AWS Glue Data Catalog

#### **Data Quality Metrics**
- **Row Counts:** Source rows, target rows, delta
- **Null Rates:** % of NULL values per column
- **Duplicate Rates:** % of duplicate records
- **Data Freshness:** Time since last data arrival

#### **PII Detection**
- Scan for sensitive data (emails, SSNs, credit cards)
- **Patterns:**
  - Email: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`
  - SSN: `\b\d{3}-\d{2}-\d{4}\b`
  - Credit Card: Luhn algorithm validation
- **Actions:** Tag columns, mask data, alert compliance team

---

### Scalability Patterns

#### **Auto-Scaling**
- Scale compute based on file volume
- **Example:** 10 files → 2 workers, 1000 files → 50 workers
- **Platforms:** Databricks, AWS Glue (DPU auto-scaling), Azure Data Factory

#### **Cost Optimization**
- **Event-Driven vs Polling:**
  - Event-driven: Pay per file processed (Snowpipe model)
  - Polling: Pay for continuous compute (less efficient)
- **Compression:** Reduce storage and transfer costs
- **Spot Instances:** Use for non-critical batch workloads

#### **Checkpoint Management**
- Track processed files (avoid reprocessing)
- **Storage:** RocksDB, DynamoDB, SQL table
- **Guarantees:** Exactly-once semantics
- **Example:** Databricks AutoLoader checkpoint location

---

## 7. MODERN PLATFORM FEATURE COMPARISON

| Feature | Databricks AutoLoader | Snowflake Snowpipe | AWS Glue | Azure Data Factory |
|---------|----------------------|-------------------|----------|-------------------|
| **Event-Driven Ingestion** | ✅ Yes (S3 Events, Event Grid) | ✅ Yes (SNS/SQS, Event Grid) | ✅ Yes (S3 Events) | ✅ Yes (Storage Events) |
| **Schema Inference** | ✅ Auto-detect types | ✅ Auto-detect types | ✅ Glue Crawler | ⚠️ Manual schema |
| **Schema Evolution** | ✅ Add columns, rescue data | ⚠️ Limited | ✅ Glue Catalog | ⚠️ Limited |
| **Exactly-Once Guarantees** | ✅ Checkpoint-based | ✅ Built-in | ⚠️ Job bookmarks | ⚠️ Manual deduplication |
| **File Formats** | JSON, CSV, Parquet, Avro, ORC, XML, text | CSV, JSON, Parquet, Avro, ORC | CSV, JSON, Parquet, Avro, ORC | CSV, JSON, Parquet, Avro, ORC, XML, Excel |
| **Compression Support** | All major codecs | All major codecs | All major codecs | All major codecs |
| **Incremental Loading** | ✅ Native | ✅ Native | ✅ Job bookmarks | ✅ Watermark-based |
| **SFTP/FTP Support** | ⚠️ Via connectors | ❌ No | ⚠️ Limited | ✅ Native |
| **Rescued Data** | ✅ Rescued column | ❌ No | ❌ No | ❌ No |
| **Cost Model** | Compute per hour (DBU) | Per-file + compute | DPU per hour | Activity runs |
| **Streaming Support** | ✅ Structured Streaming | ⚠️ Continuous load | ❌ Batch only | ⚠️ Tumbling window |

---

## 8. IMPLEMENTATION RECOMMENDATIONS FOR FLOWFORGE

### Phase 1: Core File Types (Immediate - 2 weeks)
**Goal:** Support 80% of common file ingestion use cases

#### **Formats to Implement:**
1. ✅ **CSV** (Already done - enhance with advanced options)
   - Add: delimiter selection, encoding, quote character
   - Add: skip rows, null representation
   - Add: compression support (GZIP, ZSTD)

2. **JSON / JSONL** (High priority)
   - Standard JSON (single object/array)
   - JSON Lines (newline-delimited - streaming-friendly)
   - Schema inference and flattening

3. **Parquet** (Data lake standard)
   - Read Parquet files
   - Display schema and row count
   - Column pruning

4. **Excel (XLSX)** (Business user friendly)
   - Sheet selection (by name or index)
   - Header row detection
   - Type inference

**Technical Tasks:**
- Update file upload component to accept multiple formats
- Add format-specific configuration UI
- Update backend parsers (Polars supports all these formats)
- Add format detection (from extension or file signature)

---

### Phase 2: Advanced Ingestion Patterns (Next - 3 weeks)
**Goal:** Support production-grade automation

#### **Patterns to Implement:**

1. ✅ **Pattern Matching (Glob)** (Partially done - complete it)
   - UI: File pattern input field
   - Backend: List files matching pattern from MinIO
   - Process all matching files in single job

2. **Cloud Storage Monitoring (S3/MinIO Events)**
   - MinIO Event Notifications → Webhook → Trigger workflow
   - Track processed files (checkpoint table)
   - Auto-trigger on file upload

3. **Incremental Loading with Watermarks**
   - UI: Enable incremental mode, select watermark column
   - Backend: Track last processed timestamp
   - Only process new files since last run

4. **SFTP/FTP Connector (Optional - Future)**
   - UI: SFTP connection config (host, port, credentials)
   - Backend: Paramiko (Python SSH library)
   - Scheduled polling or manual trigger

**Technical Tasks:**
- Design MinIO event webhook receiver
- Create checkpoint table schema
- Update job execution to track processed files
- Add watermark tracking to job config

---

### Phase 3: Additional Formats (Later - 1-2 weeks)
**Goal:** Support specialized data sources

#### **Formats to Add:**
1. **Avro** (Kafka/streaming pipelines)
2. **ORC** (Hadoop/Hive compatibility)
3. **XML** (Legacy systems, SOAP APIs)
4. **Fixed-Width Text** (Mainframe exports)

**Priority:** Lower - Only add when specific use cases arise

---

### Phase 4: Production Features (Future - Ongoing)
**Goal:** Enterprise-grade reliability and observability

#### **Features to Build:**
1. **Dead Letter Queue / Quarantine Folder**
   - Move failed files to quarantine location
   - Log error metadata
   - Provide UI for retry/investigate

2. **Schema Evolution & Drift Detection**
   - Detect when source schema changes
   - Alert on new columns, type changes
   - Option to auto-add columns or fail

3. **Data Quality Rules**
   - UI: Define rules (NOT NULL, unique, min/max, regex)
   - Backend: Validate at Bronze layer
   - Quarantine or reject invalid rows

4. **Real-Time Streaming Ingestion**
   - Continuously monitor folder for new files
   - Process files as they arrive (micro-batches)
   - Use Prefect's streaming capabilities

5. **Advanced Performance**
   - Parallel file processing (multiple files at once)
   - Chunked reading for large files
   - Partitioned output (by date, category)

6. **Data Governance**
   - Full lineage tracking (file → Bronze → Silver → Gold)
   - PII detection and masking
   - Audit logs for compliance

---

## 9. TECHNICAL ARCHITECTURE RECOMMENDATIONS

### File Format Handler Architecture

```python
# Pluggable architecture for file format handlers

class FileFormatHandler(ABC):
    @abstractmethod
    def can_handle(self, file_path: str) -> bool:
        pass

    @abstractmethod
    def read(self, file_path: str, options: dict) -> pl.DataFrame:
        pass

    @abstractmethod
    def infer_schema(self, file_path: str) -> list[dict]:
        pass

class CSVHandler(FileFormatHandler):
    def can_handle(self, file_path: str) -> bool:
        return file_path.endswith('.csv')

    def read(self, file_path: str, options: dict) -> pl.DataFrame:
        return pl.read_csv(
            file_path,
            has_header=options.get('has_header', True),
            separator=options.get('delimiter', ','),
            encoding=options.get('encoding', 'utf-8'),
            # ...
        )

class JSONHandler(FileFormatHandler):
    # Similar implementation

class ParquetHandler(FileFormatHandler):
    # Similar implementation

# Factory pattern to select handler
def get_handler(file_path: str) -> FileFormatHandler:
    for handler in [CSVHandler(), JSONHandler(), ParquetHandler(), ExcelHandler()]:
        if handler.can_handle(file_path):
            return handler
    raise ValueError(f"No handler found for {file_path}")
```

---

### Event-Driven Ingestion Architecture

```
┌──────────────┐
│ MinIO/S3     │
│ Landing Zone │
└──────┬───────┘
       │ File Upload
       │ (PUT object)
       ▼
┌──────────────┐
│ MinIO Event  │
│ Notification │
└──────┬───────┘
       │ Webhook POST
       ▼
┌──────────────────┐
│ FlowForge API    │
│ /api/events/file │
└──────┬───────────┘
       │ Parse event
       │ Extract: bucket, key, size
       ▼
┌──────────────────┐
│ Checkpoint Check │
│ (Already processed?)
└──────┬───────────┘
       │ No → Process
       ▼
┌──────────────────┐
│ Trigger Prefect  │
│ Workflow Run     │
└──────────────────┘
```

---

### Database Schema Extensions

#### **Checkpoint Table (Track Processed Files)**
```sql
CREATE TABLE file_checkpoints (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL, -- MD5 or SHA256
  processed_at INTEGER NOT NULL, -- timestamp (ms)
  status TEXT NOT NULL, -- 'processed', 'failed', 'quarantined'
  error_message TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(job_id, file_path)
);
```

#### **Job Source Config Extensions**
```typescript
interface FileSourceConfig {
  // Existing
  filePath: string
  filePattern: string
  uploadMode: 'single' | 'pattern' | 'directory' | 'auto-ingest'

  // New
  fileFormat: 'csv' | 'json' | 'jsonl' | 'parquet' | 'avro' | 'orc' | 'excel' | 'xml'
  compression?: 'gzip' | 'bzip2' | 'zip' | 'snappy' | 'lz4' | 'zstd' | 'none'

  // CSV-specific
  delimiter?: string
  quoteChar?: string
  escapeChar?: string
  encoding?: string
  skipRows?: number
  nullValue?: string

  // Excel-specific
  sheetName?: string
  sheetIndex?: number
  headerRow?: number

  // JSON-specific
  jsonMode?: 'standard' | 'lines'
  flatten?: boolean
  maxNestingDepth?: number

  // Incremental
  incrementalMode?: boolean
  watermarkColumn?: string
  lastWatermark?: string

  // Auto-ingest
  eventDriven?: boolean
  pollingInterval?: number // seconds
}
```

---

## 10. REFERENCES & RESOURCES

### Official Documentation
- **Databricks AutoLoader:** https://docs.databricks.com/ingestion/cloud-object-storage/auto-loader/
- **Snowflake Snowpipe:** https://docs.snowflake.com/en/user-guide/data-load-snowpipe
- **AWS Glue:** https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-format.html
- **Azure Data Factory:** https://learn.microsoft.com/en-us/azure/data-factory/

### File Format Specifications
- **Parquet:** https://parquet.apache.org/docs/
- **Avro:** https://avro.apache.org/docs/
- **ORC:** https://orc.apache.org/docs/
- **CSV RFC 4180:** https://www.ietf.org/rfc/rfc4180.txt

### Polars Documentation (Our Parser)
- **Polars I/O:** https://docs.pola.rs/user-guide/io/
- **CSV Reading:** https://docs.pola.rs/api/python/stable/reference/api/polars.read_csv.html
- **JSON Reading:** https://docs.pola.rs/api/python/stable/reference/api/polars.read_json.html
- **Parquet Reading:** https://docs.pola.rs/api/python/stable/reference/api/polars.read_parquet.html

---

## 11. CONCLUSION

This research document provides a comprehensive foundation for building a production-grade file ingestion framework in FlowForge. The recommended phased approach balances immediate user value (Phase 1: Core formats) with long-term scalability (Phase 2-4: Automation, governance, streaming).

**Key Takeaways:**
1. **Start Simple:** CSV + JSON + Parquet covers 80% of use cases
2. **Add Automation:** Pattern matching and cloud storage monitoring unlock production pipelines
3. **Build Resilience:** Checkpoints, error handling, and data quality are critical for reliability
4. **Think Long-Term:** Architecture should support schema evolution, streaming, and governance

**Next Steps:**
- Review and approve implementation plan for Phase 1-2 MVP
- Design database schema extensions
- Create UI mockups for format selection and configuration
- Build file format handler framework
