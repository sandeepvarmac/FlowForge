# FlowForge Medallion Architecture - S3 Key Structure

This document describes the human-readable S3 object key naming scheme used across all layers of the medallion architecture.

## Design Principles

1. **Human-Readable**: Slugs instead of UUIDs make keys instantly recognizable
2. **Layer Identifiers**: Each filename includes `__src`, `__bronze`, `__silver`, or `__gold`
3. **Date Partitioning**: `yyyymmdd` folders enable time-based lifecycle policies
4. **Version Tracking**: Monotonic sequence numbers (`v001`, `v002`) for lineage
5. **Self-Documenting**: Filename alone tells the complete story

## Key Patterns by Layer

### Landing Layer
```
landing/{workflowSlug}/{jobSlug}/{yyyymmdd}/{workflowSlug}__{jobSlug}__{runId}__src__{originalFilename}
```

**Example**:
```
landing/customer-data-pipeline/ingest-countries/20251006/customer-data-pipeline__ingest-countries__cfee487b__src__countries.csv
```

- `workflowSlug`: "customer-data-pipeline" (from "Customer Data Pipeline")
- `jobSlug`: "ingest-countries" (from "Ingest Countries")
- `runId`: "cfee487b" (first 8 chars of Prefect flow run UUID)
- Original filename preserved for audit trail

### Bronze Layer
```
bronze/{workflowSlug}/{jobSlug}/{yyyymmdd}/{workflowSlug}__{jobSlug}__{runId}__bronze__v{sequence}.parquet
```

**Example**:
```
bronze/customer-data-pipeline/ingest-countries/20251006/customer-data-pipeline__ingest-countries__cfee487b__bronze__v001.parquet
```

- Raw CSV ingestion → Parquet conversion
- Adds audit columns: `_ingested_at`, `_source_file`
- Sequence number allows multiple bronze outputs per run (rare)

### Silver Layer
```
silver/{workflowSlug}/{jobSlug}/{yyyymmdd}/{workflowSlug}__{jobSlug}__{runId}__silver__current.parquet
silver/{workflowSlug}/{jobSlug}/{yyyymmdd}/archive/{timestamp}__v{sequence}.parquet
```

**Current Version Example**:
```
silver/customer-data-pipeline/ingest-countries/20251006/customer-data-pipeline__ingest-countries__cfee487b__silver__current.parquet
```

**Archive Example**:
```
silver/customer-data-pipeline/ingest-countries/20251006/archive/20251006_174427__v001.parquet
```

- `current.parquet`: Latest deduplicated, cleaned dataset
- Archive: Previous versions with full timestamp
- Deduplication via primary keys
- Surrogate key column: `_sk_id`

### Gold Layer
```
gold/{domain}/{dataset}/{yyyymmdd}/{dataset}__{runId}__gold__{view|metric}.parquet
```

**Example**:
```
gold/analytics/ingest-countries/20251006/ingest-countries__cfee487b__gold__view.parquet
```

- `domain`: "analytics", "ml-features", "reports", etc.
- `dataset`: Derived from job slug
- `view|metric`: Identifies output type
- ZSTD compression for optimal analytics performance

## Slug Generation

### Workflow/Job Name → Slug
```python
from utils.slugify import slugify

slugify("Customer Data Pipeline")  # → "customer-data-pipeline"
slugify("Ingest Countries")         # → "ingest-countries"
slugify("Load_Orders_2024")         # → "load-orders-2024"
```

**Rules**:
- Lowercase
- Replace spaces/underscores with hyphens
- Remove non-alphanumeric characters (except hyphens)
- Strip leading/trailing hyphens

### Run ID Generation
```python
from utils.slugify import generate_run_id

# From Prefect flow run UUID
generate_run_id("cfee487b-5e77-4abf-b7cd-b3214fbda3e5")  # → "cfee487b"

# Fallback (no Prefect context)
generate_run_id()  # → "20251006-a3b4c5d6"
```

## Benefits

### 1. Console Browsability
```bash
aws s3 ls s3://flowforge-data/bronze/customer-data-pipeline/ingest-countries/20251006/
# Instantly see workflow, job, date, and layer
```

### 2. Query Engine Compatibility
- Date partitions: `WHERE date = '20251006'`
- Hive-style: `country=US/state=CA/`
- Athena/Trino optimized

### 3. Lifecycle Management
```xml
<LifecycleConfiguration>
  <Rule>
    <Filter>
      <Prefix>bronze/</Prefix>
    </Filter>
    <Expiration>
      <Days>30</Days>
    </Expiration>
  </Rule>
</LifecycleConfiguration>
```

### 4. Debugging
```
Error in: customer-data-pipeline__ingest-countries__cfee487b__silver__current.parquet
          ↑ workflow            ↑ job          ↑ run    ↑ layer
```
Single filename provides complete context for troubleshooting.

## Migration Notes

### Backward Compatibility
Legacy keys remain accessible:
```
bronze/wf_1759769179008_gut8lj/job_1759769232427_px5h1w/countries_20251006_174316.parquet
```

New keys are used for all new runs after deployment.

### Metadata Persistence
The following fields are added to `job_executions`:
- `run_id`: Short identifier (e.g., "cfee487b")
- `bronze_filename`: Full filename for reconstruction
- `silver_filename`: Full filename for reconstruction
- `gold_filename`: Full filename for reconstruction

This allows downstream tools to assemble full S3 keys:
```typescript
const bronzeKey = `bronze/${workflow_slug}/${job_slug}/${date}/${bronze_filename}`
```

## Example: Complete Flow

### Input
- Workflow: "Customer Data Pipeline"
- Job: "Ingest Countries"
- File: `countries.csv`
- Prefect Run: `cfee487b-5e77-4abf-b7cd-b3214fbda3e5`

### Generated Keys
```
landing/customer-data-pipeline/ingest-countries/20251006/
  └─ customer-data-pipeline__ingest-countries__cfee487b__src__countries.csv

bronze/customer-data-pipeline/ingest-countries/20251006/
  └─ customer-data-pipeline__ingest-countries__cfee487b__bronze__v001.parquet

silver/customer-data-pipeline/ingest-countries/20251006/
  ├─ customer-data-pipeline__ingest-countries__cfee487b__silver__current.parquet
  └─ archive/
      └─ 20251006_174427__v001.parquet

gold/analytics/ingest-countries/20251006/
  └─ ingest-countries__cfee487b__gold__view.parquet
```

## Future Enhancements

1. **Partition Support**: Add optional partition keys after date folder
   ```
   silver/.../{yyyymmdd}/country=US/state=CA/current.parquet
   ```

2. **Metric Outputs**: Distinguish analytical views from metrics
   ```
   gold/analytics/customers/20251006/customers__abc123__gold__churn-rate.parquet
   ```

3. **Schema Versioning**: Track breaking schema changes
   ```
   bronze/.../v001__schema-v2.parquet
   ```

## References

- Slug utility: `prefect-flows/utils/slugify.py`
- Bronze task: `prefect-flows/tasks/bronze.py`
- Silver task: `prefect-flows/tasks/silver.py`
- Gold task: `prefect-flows/tasks/gold.py`
- Orchestrator: `prefect-flows/flows/medallion.py`
