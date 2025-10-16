# Pattern Matching User Guide

## Overview

Pattern Matching allows FlowForge workflows to automatically discover and process multiple files matching a glob pattern in a single job run. This is useful for scenarios where:

- Multiple files arrive with similar naming conventions (e.g., `customer_2024-01.csv`, `customer_2024-02.csv`)
- Files are generated daily/weekly/monthly with date suffixes
- Multiple source systems produce files with prefixes (e.g., `erp_orders_*.csv`, `crm_customers_*.json`)

---

## How It Works

### 1. Job Configuration

When creating a job in FlowForge, select **Pattern Matching** as the upload mode:

```
Upload Mode: Pattern Matching
File Pattern: customer_*.csv
```

Upload a **sample file** for schema detection. This file is used to:
- Detect column names and data types
- Generate AI-powered column names (if headerless)
- Configure Bronze/Silver/Gold layer settings

The sample file helps FlowForge understand the structure, but the actual job execution will process **all files matching the pattern**.

### 2. File Upload to Landing Zone

Upload your files to the landing zone in S3/MinIO:

```
s3://flowforge-data/landing/{workflow_id}/{job_id}/
├── customer_2024-01.csv
├── customer_2024-02.csv
├── customer_2024-03.csv
└── orders_2024.csv  (will be ignored - doesn't match pattern)
```

### 3. Workflow Execution

When you run the workflow:

1. FlowForge scans the landing zone: `landing/{workflow_id}/{job_id}/`
2. Applies the pattern: `customer_*.csv`
3. Finds matching files:
   - ✅ `customer_2024-01.csv`
   - ✅ `customer_2024-02.csv`
   - ✅ `customer_2024-03.csv`
   - ❌ `orders_2024.csv` (doesn't match)
4. Triggers **one Prefect flow run per file**
5. Each file is processed through Bronze → Silver → Gold
6. Creates **separate data assets** in the metadata catalog

### 4. Monitoring Execution

In the Execution Monitor, you'll see:

```
Job Execution: Ingest Customers
Status: Running
Files Processed: 3
Prefect Flow Runs:
  - flow_run_abc123 (customer_2024-01.csv)
  - flow_run_def456 (customer_2024-02.csv)
  - flow_run_ghi789 (customer_2024-03.csv)
```

---

## Pattern Syntax

FlowForge uses Unix-style glob patterns (Python `fnmatch`):

| Pattern | Description | Matches | Doesn't Match |
|---------|-------------|---------|---------------|
| `*.csv` | Any CSV file | `file.csv`, `data.csv` | `file.txt` |
| `customer_*.csv` | CSV files starting with "customer_" | `customer_2024.csv`, `customer_jan.csv` | `orders.csv` |
| `sales_*_2024.json` | JSON files with "sales_" prefix and "_2024" suffix | `sales_Q1_2024.json`, `sales_Q2_2024.json` | `sales_2023.json` |
| `data_[0-9]*.csv` | CSV files starting with "data_" followed by numbers | `data_1.csv`, `data_123.csv` | `data_abc.csv` |
| `*.parquet` | Any Parquet file | `data.parquet`, `orders.parquet` | `data.csv` |

### Wildcards
- `*` - Matches any sequence of characters (including none)
- `?` - Matches any single character
- `[abc]` - Matches any character in the brackets
- `[0-9]` - Matches any digit

---

## Use Cases

### 1. Daily File Uploads
**Scenario**: Your data source generates daily customer files

**Pattern**: `customer_YYYY-MM-DD.csv`
```
customer_2024-01-15.csv
customer_2024-01-16.csv
customer_2024-01-17.csv
```

**Configuration**:
- Upload Mode: Pattern Matching
- File Pattern: `customer_*.csv`
- Bronze Load Strategy: Append (keeps all historical data)

### 2. Monthly Reports
**Scenario**: Monthly sales reports from multiple regions

**Pattern**: `sales_{region}_202401.json`
```
sales_us_202401.json
sales_eu_202401.json
sales_apac_202401.json
```

**Configuration**:
- Upload Mode: Pattern Matching
- File Pattern: `sales_*_202401.json`
- Silver Merge Strategy: Merge/Upsert (deduplicate by region)

### 3. Multiple Source Systems
**Scenario**: Customer data from CRM, ERP, and E-commerce systems

**Pattern**: `{system}_customers_*.csv`
```
crm_customers_2024.csv
erp_customers_2024.csv
ecommerce_customers_2024.csv
```

**Configuration**:
- Upload Mode: Pattern Matching
- File Pattern: `*_customers_*.csv`
- Bronze Audit Columns: Enable (track source file in `_source_file`)
- Silver Merge Strategy: Merge/Upsert with `customer_id` as primary key

### 4. Historical Data Migration
**Scenario**: One-time historical data migration with multiple files

**Pattern**: `historical_data_part{N}.csv`
```
historical_data_part1.csv
historical_data_part2.csv
historical_data_part3.csv
...
historical_data_part50.csv
```

**Configuration**:
- Upload Mode: Pattern Matching
- File Pattern: `historical_data_part*.csv`
- Bronze Load Strategy: Append
- Silver Merge Strategy: Append (or Merge if deduplication needed)

---

## Best Practices

### 1. Use Descriptive Patterns
✅ **Good**: `customer_orders_*.csv` (specific)
❌ **Bad**: `*.csv` (too broad, matches everything)

### 2. Include Sample File
Always upload a **representative sample file** when configuring the job:
- Same schema as production files
- Same file format
- Used for AI schema detection and configuration

### 3. File Naming Conventions
Establish consistent naming conventions:
- Use underscores instead of spaces: `customer_data.csv` not `customer data.csv`
- Include timestamps: `sales_2024-01-15.csv`
- Add source identifiers: `erp_orders_*.csv`, `crm_customers_*.csv`

### 4. Test with Small Batches
Before processing hundreds of files:
1. Upload 2-3 test files
2. Run workflow to verify pattern matching
3. Check Data Assets Explorer for correct data assets
4. Scale up to full batch

### 5. Monitor Execution Logs
Check job execution logs to verify:
- Number of files found
- All files processed successfully
- Any errors or warnings

---

## Error Handling

### No Files Found
**Error**: `No files found matching pattern 'customer_*.csv' in landing/{workflow_id}/{job_id}/`

**Solutions**:
- Verify files are uploaded to correct landing zone path
- Check file pattern syntax
- Ensure file names match the pattern exactly (case-sensitive)

### Pattern Too Broad
**Warning**: Pattern `*.csv` matched 500 files, which may cause performance issues

**Solutions**:
- Use more specific patterns: `customer_2024*.csv`
- Split into multiple jobs with different patterns
- Process files in batches (upload subset, run, repeat)

### Individual File Failures
If one file fails during processing:
- Other files continue processing
- Failed file is logged in job execution
- Can be retried manually by re-running workflow

---

## Limitations

### Current Limitations (MVP)
1. **Case-Sensitive**: Pattern matching is case-sensitive
   - `Customer_*.csv` won't match `customer_*.csv`

2. **Flat Directory Only**: Only scans immediate landing zone directory
   - Doesn't search subdirectories
   - All files must be in `landing/{workflow_id}/{job_id}/`

3. **One Pattern Per Job**: Each job can only have one pattern
   - For multiple patterns, create multiple jobs

### Coming Soon
- **Regex Support**: Advanced pattern matching with regular expressions
- **Recursive Scanning**: Search subdirectories
- **File Age Filters**: Process only files modified within X days
- **File Size Filters**: Process only files within size range
- **Batch Processing**: Process files in batches (e.g., 100 at a time)

---

## Troubleshooting

### Q: Why aren't my files being processed?
A: Check:
1. Files are in correct landing zone: `landing/{workflow_id}/{job_id}/`
2. Pattern matches file names exactly (case-sensitive)
3. Upload mode is set to "Pattern Matching" (not "Single File")
4. Job status is "Ready" or "Configured" (not "Disabled")

### Q: How do I process files in subdirectories?
A: Currently not supported in MVP. Upload all files to the same directory or create separate jobs for each subdirectory.

### Q: Can I use different patterns for Bronze, Silver, and Gold?
A: No, pattern matching is applied at the job level. All layers process the same matched files.

### Q: How do I know which file created which data asset?
A: Enable Bronze audit columns - the `_source_file` column tracks the originating file name in every row.

### Q: What happens if I upload new files after the workflow runs?
A: New files are NOT automatically processed. You need to manually trigger the workflow again to process new files.

---

## API Reference

### Pattern Matching Function

**Python Function**:
```python
from utils.pattern_matcher import find_matching_files

matches = find_matching_files(
    s3_prefix="landing/workflow_123/job_456/",
    file_pattern="customer_*.csv"
)

# Returns:
# [
#   {'key': 'landing/.../customer_2024.csv', 'size': 1024, 'last_modified': '2024-01-15T10:00:00Z'},
#   {'key': 'landing/.../customer_jan.csv', 'size': 2048, 'last_modified': '2024-01-16T10:00:00Z'}
# ]
```

**REST API**:
```bash
# Trigger workflow execution (pattern matching happens automatically)
POST /api/workflows/{workflowId}/run

# Response includes file count
{
  "success": true,
  "executionId": "exec_...",
  "jobResults": [
    {
      "jobId": "job_...",
      "jobName": "Ingest Customers",
      "filesProcessed": 3,
      "allFlowRuns": ["flow_run_1", "flow_run_2", "flow_run_3"]
    }
  ]
}
```

---

## Examples

### Example 1: Daily Customer Files

**Job Configuration**:
```json
{
  "name": "Daily Customer Ingest",
  "sourceConfig": {
    "fileConfig": {
      "uploadMode": "pattern",
      "filePattern": "customer_*.csv"
    }
  },
  "destinationConfig": {
    "bronzeConfig": {
      "tableName": "bronze_customers",
      "loadStrategy": "append",
      "auditColumns": true
    },
    "silverConfig": {
      "tableName": "silver_customers",
      "mergeStrategy": "merge",
      "primaryKey": "customer_id"
    }
  }
}
```

**Landing Zone**:
```
landing/wf_123/job_456/
├── customer_2024-01-15.csv  (1000 rows)
├── customer_2024-01-16.csv  (1050 rows)
└── customer_2024-01-17.csv  (980 rows)
```

**Execution Result**:
- 3 Prefect flow runs created
- Bronze: 3 Parquet files (1000 + 1050 + 980 = 3030 total rows)
- Silver: 1 merged Parquet file (deduplicated to ~2500 unique customers)
- Gold: 1 analytics-ready Parquet file

### Example 2: Multi-Region Sales

**Job Configuration**:
```json
{
  "name": "Regional Sales Import",
  "sourceConfig": {
    "fileConfig": {
      "uploadMode": "pattern",
      "filePattern": "sales_*_Q1.json"
    }
  }
}
```

**Landing Zone**:
```
landing/wf_123/job_789/
├── sales_us_Q1.json
├── sales_eu_Q1.json
├── sales_apac_Q1.json
└── sales_us_Q2.json  (ignored - doesn't match pattern)
```

**Execution Result**:
- 3 files matched: sales_us_Q1.json, sales_eu_Q1.json, sales_apac_Q1.json
- sales_us_Q2.json is NOT processed (doesn't match `*_Q1.json`)
- Each region processed separately through Bronze → Silver → Gold

---

## Summary

Pattern Matching is a powerful feature for automating multi-file processing in FlowForge. By using glob patterns, you can:

✅ Process multiple files in a single workflow run
✅ Maintain consistent naming conventions
✅ Track individual file processing status
✅ Deduplicate across files in Silver layer
✅ Monitor all executions in one place

For questions or support, refer to the main FlowForge documentation or contact your administrator.

---

**Version**: 1.0
**Last Updated**: January 2025
