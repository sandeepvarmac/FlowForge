# File Ingestion Framework - Phase 1 & 2 MVP Implementation Plan

**Created:** 2025-10-13
**Timeline:** 5 weeks (2 weeks Phase 1 + 3 weeks Phase 2)
**Status:** Ready for Implementation
**Owner:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Core File Types (Weeks 1-2)](#phase-1-core-file-types-weeks-1-2)
3. [Phase 2: Advanced Ingestion Patterns (Weeks 3-5)](#phase-2-advanced-ingestion-patterns-weeks-3-5)
4. [Database Schema Changes](#database-schema-changes)
5. [Testing Strategy](#testing-strategy)
6. [Success Metrics](#success-metrics)
7. [Risks & Mitigations](#risks--mitigations)

---

## Overview

### Goals

**Phase 1:** Expand file format support from CSV-only to CSV, JSON, Parquet, and Excel
**Phase 2:** Add production-grade automation (pattern matching, incremental loading, cloud storage monitoring)

### Current State

✅ **Implemented:**
- Manual CSV upload via UI
- AI-powered column naming for headerless CSVs
- Basic file upload component
- Bronze → Silver → Gold medallion pipeline

❌ **Missing:**
- Support for JSON, Parquet, Excel formats
- File format auto-detection
- Advanced CSV options (delimiter, encoding, compression)
- Pattern matching for multiple files
- Incremental loading with watermarks
- Event-driven ingestion from cloud storage

### Target State (After Phase 1-2)

✅ **Will Support:**
- 4 file formats: CSV, JSON/JSONL, Parquet, Excel (XLSX)
- File format auto-detection from extension
- Advanced CSV configuration (delimiter, encoding, quote char, skip rows)
- Compression support (GZIP, ZSTD)
- Pattern matching (glob: `customer_*.csv`)
- Incremental loading (process only new files)
- MinIO event-driven ingestion
- Checkpoint tracking (avoid reprocessing)

---

## Phase 1: Core File Types (Weeks 1-2)

**Goal:** Support 80% of common file ingestion use cases with 4 core formats

---

### Task 1.1: Enhance CSV Configuration (2 days)

**Current:** Basic CSV upload with AI column naming
**Enhancement:** Add advanced CSV options matching industry standards

#### Frontend Changes (`apps/web/src/components/jobs/create-job-modal.tsx`)

**Add CSV Configuration Section:**
```typescript
interface CSVConfig {
  delimiter: ',' | '\t' | '|' | ';' | 'custom'
  customDelimiter?: string
  encoding: 'utf-8' | 'iso-8859-1' | 'windows-1252'
  quoteChar: '"' | "'" | 'none'
  escapeChar: '\\' | '""' | 'custom'
  skipRows: number
  nullValue: string // 'NULL', '\\N', '', 'NA'
  trimWhitespace: boolean
  compression: 'none' | 'gzip' | 'zstd'
}
```

**UI Layout (Expandable "Advanced CSV Options" section):**
```
┌─────────────────────────────────────────────────┐
│ Advanced CSV Options                [Expand ▼] │
├─────────────────────────────────────────────────┤
│ Delimiter: [Comma ▼] Encoding: [UTF-8 ▼]      │
│ Quote Char: [" ▼]    Skip Rows: [0]           │
│ Null Value: [Empty string ▼]                   │
│ ☑ Trim whitespace                              │
│ Compression: [Auto-detect ▼]                   │
└─────────────────────────────────────────────────┘
```

**Implementation Steps:**
1. Add `CSVAdvancedOptions` component (collapsible section)
2. Store CSV config in `fileConfig.csvOptions`
3. Update `CSVFileUpload` to accept and apply these options
4. Add preview that shows how data will be parsed with current settings

**Files to Modify:**
- `apps/web/src/components/jobs/create-job-modal.tsx` (UI)
- `apps/web/src/components/jobs/csv-file-upload.tsx` (Apply options)
- `apps/web/src/types/workflow.ts` (Add CSVConfig interface)

**Acceptance Criteria:**
- User can select delimiter (comma, tab, pipe, semicolon, custom)
- User can select encoding (UTF-8, ISO-8859-1, Windows-1252)
- User can specify skip rows and null representation
- Preview updates dynamically when options change
- Options are saved to job config and passed to Prefect

---

### Task 1.2: Add JSON/JSONL Support (3 days)

**Goal:** Support JSON and JSON Lines (newline-delimited JSON)

#### Frontend Changes

**File Upload Component:**
- Detect `.json` or `.jsonl` extension
- For JSON: Show detected structure (nested objects, arrays)
- For JSONL: Show sample records (first 5 lines)

**JSON Configuration UI:**
```typescript
interface JSONConfig {
  mode: 'standard' | 'lines' // Standard JSON or JSON Lines
  flatten: boolean // Flatten nested objects
  maxNestingDepth: number // Max depth to flatten
  arrayHandling: 'explode' | 'json_string' // Arrays as rows or JSON string
}
```

**UI Layout:**
```
┌─────────────────────────────────────────────────┐
│ JSON Configuration                              │
├─────────────────────────────────────────────────┤
│ Format: ⦿ Standard JSON  ○ JSON Lines (JSONL)  │
│ ☑ Flatten nested objects (Max depth: [3])     │
│ Array Handling: [Explode to rows ▼]           │
└─────────────────────────────────────────────────┘
```

#### Backend Changes (`prefect-flows/utils/file_handlers.py` - NEW FILE)

**Create File Handler Architecture:**
```python
from abc import ABC, abstractmethod
import polars as pl
from pathlib import Path

class FileFormatHandler(ABC):
    """Abstract base class for file format handlers."""

    @abstractmethod
    def can_handle(self, file_path: str) -> bool:
        """Check if this handler can process the file."""
        pass

    @abstractmethod
    def read(self, file_path: str, options: dict) -> pl.DataFrame:
        """Read file and return Polars DataFrame."""
        pass

    @abstractmethod
    def infer_schema(self, file_path: str, sample_rows: int = 100) -> list[dict]:
        """Infer schema from file."""
        pass

    @abstractmethod
    def supported_extensions(self) -> list[str]:
        """Return list of supported file extensions."""
        pass


class JSONHandler(FileFormatHandler):
    def can_handle(self, file_path: str) -> bool:
        return file_path.lower().endswith(('.json', '.jsonl'))

    def read(self, file_path: str, options: dict) -> pl.DataFrame:
        mode = options.get('mode', 'standard')
        flatten = options.get('flatten', True)

        if mode == 'lines':
            # JSON Lines (newline-delimited)
            df = pl.read_ndjson(file_path)
        else:
            # Standard JSON
            df = pl.read_json(file_path)

        # Flatten nested structures if requested
        if flatten:
            df = self._flatten_dataframe(df, max_depth=options.get('maxNestingDepth', 3))

        return df

    def _flatten_dataframe(self, df: pl.DataFrame, max_depth: int = 3) -> pl.DataFrame:
        """Flatten nested JSON structures."""
        # Example: {"user": {"name": "John", "age": 30}}
        # Becomes: user_name="John", user_age=30

        for col in df.columns:
            if df[col].dtype == pl.Struct:
                # Unnest struct columns
                df = df.unnest(col)

        return df

    def infer_schema(self, file_path: str, sample_rows: int = 100) -> list[dict]:
        """Infer schema by reading first N rows."""
        mode = 'lines' if file_path.endswith('.jsonl') else 'standard'

        if mode == 'lines':
            df = pl.read_ndjson(file_path, n_rows=sample_rows)
        else:
            df = pl.read_json(file_path)
            df = df.head(sample_rows)

        # Convert Polars schema to FlowForge schema format
        schema = []
        for col_name, dtype in df.schema.items():
            schema.append({
                "name": col_name,
                "type": self._polars_to_flowforge_type(dtype),
                "sample": str(df[col_name][0]) if len(df) > 0 else None
            })

        return schema

    def supported_extensions(self) -> list[str]:
        return ['.json', '.jsonl', '.ndjson']

    def _polars_to_flowforge_type(self, dtype) -> str:
        """Convert Polars dtype to FlowForge type string."""
        mapping = {
            pl.Int8: 'integer', pl.Int16: 'integer', pl.Int32: 'integer', pl.Int64: 'integer',
            pl.Float32: 'float', pl.Float64: 'float',
            pl.Utf8: 'string', pl.Boolean: 'boolean',
            pl.Date: 'date', pl.Datetime: 'datetime',
            pl.Struct: 'object', pl.List: 'array'
        }
        return mapping.get(type(dtype), 'string')
```

**Update Bronze Task to Use Handlers:**
```python
# prefect-flows/tasks/bronze.py

from utils.file_handlers import get_file_handler

@task(name="bronze_ingest")
def bronze_ingest(
    file_format: str,  # 'csv', 'json', 'parquet', 'excel'
    file_options: dict,
    # ... other params
):
    # Get appropriate handler
    handler = get_file_handler(file_format)

    # Read file using handler
    df = handler.read(local_csv, options=file_options)

    # Rest of bronze processing...
```

**Implementation Steps:**
1. Create `prefect-flows/utils/file_handlers.py` with abstract base class
2. Implement `JSONHandler` class
3. Update bronze task to use handler pattern
4. Add JSON schema inference to upload component
5. Update frontend to show JSON preview

**Files to Create:**
- `prefect-flows/utils/file_handlers.py` (Handler framework)

**Files to Modify:**
- `prefect-flows/tasks/bronze.py` (Use handlers)
- `apps/web/src/components/jobs/csv-file-upload.tsx` → Rename to `file-upload.tsx`
- `apps/web/src/components/jobs/create-job-modal.tsx` (JSON config UI)

**Test Cases:**
- ✅ Standard JSON with nested objects
- ✅ JSON Lines (one JSON per line)
- ✅ Flattening nested structures
- ✅ Arrays in JSON (explode to rows vs preserve as JSON string)
- ✅ Large JSON files (streaming/chunked reading)

---

### Task 1.3: Add Parquet Support (2 days)

**Goal:** Support Apache Parquet files (columnar format, data lake standard)

#### Why Parquet is Critical
- **Industry Standard:** All modern data platforms use Parquet for data lakes
- **Performance:** 10-100x faster queries than CSV (columnar access)
- **Compression:** 5-10x smaller storage (built-in compression)
- **Schema Included:** Self-describing, no schema inference needed

#### Frontend Changes

**Parquet Upload Detection:**
- Detect `.parquet` extension
- Show Parquet metadata: row count, column count, file size, compression codec
- Display schema (Parquet schema is embedded in file)

**UI Preview:**
```
┌─────────────────────────────────────────────────┐
│ Parquet File Detected                           │
├─────────────────────────────────────────────────┤
│ Rows: 1,234,567      Columns: 15                │
│ Size: 45.2 MB        Compression: Snappy        │
│                                                  │
│ Schema:                                         │
│ • customer_id (Int64)                           │
│ • name (String)                                 │
│ • email (String)                                │
│ • created_at (Timestamp[ms])                    │
│ • revenue (Decimal(10,2))                       │
│                                                  │
│ [Preview First 100 Rows]                        │
└─────────────────────────────────────────────────┘
```

#### Backend Changes

**ParquetHandler Implementation:**
```python
class ParquetHandler(FileFormatHandler):
    def can_handle(self, file_path: str) -> bool:
        return file_path.lower().endswith('.parquet')

    def read(self, file_path: str, options: dict) -> pl.DataFrame:
        # Parquet reading is straightforward with Polars
        columns = options.get('columns', None)  # Column pruning
        row_count = options.get('n_rows', None)  # Limit rows

        df = pl.read_parquet(
            file_path,
            columns=columns,
            n_rows=row_count,
            use_pyarrow=True  # Use PyArrow for better compatibility
        )

        return df

    def infer_schema(self, file_path: str, sample_rows: int = 100) -> list[dict]:
        """Parquet has embedded schema - no inference needed."""
        # Read Parquet metadata without loading data
        import pyarrow.parquet as pq

        parquet_file = pq.ParquetFile(file_path)
        schema = parquet_file.schema_arrow

        # Convert PyArrow schema to FlowForge format
        flowforge_schema = []
        for field in schema:
            flowforge_schema.append({
                "name": field.name,
                "type": self._pyarrow_to_flowforge_type(field.type),
                "nullable": field.nullable
            })

        return flowforge_schema

    def get_metadata(self, file_path: str) -> dict:
        """Extract Parquet file metadata."""
        import pyarrow.parquet as pq

        parquet_file = pq.ParquetFile(file_path)
        metadata = parquet_file.metadata

        return {
            "num_rows": metadata.num_rows,
            "num_columns": metadata.num_columns,
            "num_row_groups": metadata.num_row_groups,
            "compression": metadata.row_group(0).column(0).compression,
            "file_size": Path(file_path).stat().st_size,
            "created_by": metadata.created_by
        }

    def supported_extensions(self) -> list[str]:
        return ['.parquet']
```

**Implementation Steps:**
1. Implement `ParquetHandler` in file_handlers.py
2. Add Parquet metadata extraction
3. Update upload component to show Parquet metadata
4. Test with compressed Parquet files (Snappy, GZIP, ZSTD)

**Files to Modify:**
- `prefect-flows/utils/file_handlers.py` (Add ParquetHandler)
- `apps/web/src/components/jobs/file-upload.tsx` (Parquet preview)
- Add `pyarrow` to requirements.txt

**Test Cases:**
- ✅ Read uncompressed Parquet
- ✅ Read Snappy-compressed Parquet
- ✅ Read GZIP-compressed Parquet
- ✅ Read ZSTD-compressed Parquet
- ✅ Column pruning (only read selected columns)
- ✅ Nested Parquet schema (structs, arrays)
- ✅ Large Parquet files (100MB+)

---

### Task 1.4: Add Excel Support (3 days)

**Goal:** Support Excel files (XLSX/XLS) - critical for business users

#### Why Excel is Important
- **Business Users:** Most common format for business exports
- **Finance/Accounting:** Excel is the standard for financial data
- **Reports:** Many systems export to Excel

#### Challenges
- Multiple sheets per file
- Headers may not be on first row
- Merged cells, formulas, formatting
- Not streaming-friendly (must read entire file)

#### Frontend Changes

**Excel Configuration UI:**
```typescript
interface ExcelConfig {
  sheetSelection: 'by_name' | 'by_index' | 'all_sheets'
  sheetName?: string // If by_name
  sheetIndex?: number // If by_index (0-based)
  headerRow: number // Which row contains headers (0-based)
  skipRows: number // Rows to skip before header
  evaluateFormulas: boolean // Evaluate formulas or keep as is
}
```

**UI Layout:**
```
┌─────────────────────────────────────────────────┐
│ Excel Configuration                             │
├─────────────────────────────────────────────────┤
│ Sheets Detected: [Sheet1, Sales, Summary]      │
│                                                  │
│ Select Sheet: ⦿ By Name  ○ By Index  ○ All     │
│ Sheet Name: [Sheet1 ▼]                         │
│                                                  │
│ Header Row: [0] (First row)                    │
│ Skip Rows: [0] (Rows to skip before header)   │
│ ☑ Evaluate formulas                            │
└─────────────────────────────────────────────────┘
```

#### Backend Changes

**ExcelHandler Implementation:**
```python
class ExcelHandler(FileFormatHandler):
    def can_handle(self, file_path: str) -> bool:
        return file_path.lower().endswith(('.xlsx', '.xls'))

    def read(self, file_path: str, options: dict) -> pl.DataFrame:
        # Use Polars read_excel (uses fastexcel under the hood)
        sheet_name = options.get('sheetName', None)
        sheet_index = options.get('sheetIndex', 0)
        header_row = options.get('headerRow', 0)
        skip_rows = options.get('skipRows', 0)

        # Determine sheet to read
        if sheet_name:
            sheet_id = sheet_name
        elif sheet_index is not None:
            sheet_id = sheet_index
        else:
            sheet_id = 0  # Default to first sheet

        df = pl.read_excel(
            file_path,
            sheet_id=sheet_id,
            read_options={"header_row": header_row, "skip_rows": skip_rows}
        )

        return df

    def list_sheets(self, file_path: str) -> list[str]:
        """List all sheet names in Excel file."""
        import openpyxl

        workbook = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        sheet_names = workbook.sheetnames
        workbook.close()

        return sheet_names

    def infer_schema(self, file_path: str, sample_rows: int = 100) -> list[dict]:
        """Infer schema from Excel sheet."""
        # Read first N rows
        df = pl.read_excel(file_path, read_options={"n_rows": sample_rows})

        schema = []
        for col_name, dtype in df.schema.items():
            schema.append({
                "name": col_name,
                "type": self._polars_to_flowforge_type(dtype),
                "sample": str(df[col_name][0]) if len(df) > 0 else None
            })

        return schema

    def supported_extensions(self) -> list[str]:
        return ['.xlsx', '.xls']
```

**Dependencies:**
```bash
pip install polars[excel]  # Includes fastexcel
pip install openpyxl  # For sheet listing
```

**Implementation Steps:**
1. Implement `ExcelHandler` in file_handlers.py
2. Add sheet listing functionality
3. Update upload component with sheet selector
4. Handle multi-sheet Excel files (option to process all sheets)
5. Add formula evaluation toggle

**Files to Modify:**
- `prefect-flows/utils/file_handlers.py` (Add ExcelHandler)
- `apps/web/src/components/jobs/file-upload.tsx` (Excel config UI)
- `prefect-flows/requirements.txt` (Add polars[excel], openpyxl)

**Test Cases:**
- ✅ Single sheet Excel
- ✅ Multi-sheet Excel (select specific sheet)
- ✅ Header row not on first row
- ✅ Skip rows before header
- ✅ Formulas (evaluate vs keep as is)
- ✅ Date formatting (Excel serial dates → timestamps)
- ✅ Merged cells (warning/error handling)

---

### Task 1.5: File Format Auto-Detection (1 day)

**Goal:** Automatically detect file format from extension and file signature

#### Implementation

**Handler Registry and Auto-Detection:**
```python
# prefect-flows/utils/file_handlers.py

# Registry of all handlers
HANDLERS = [
    CSVHandler(),
    JSONHandler(),
    ParquetHandler(),
    ExcelHandler()
]

def get_file_handler(file_path: str) -> FileFormatHandler:
    """Get appropriate handler for file based on extension."""
    for handler in HANDLERS:
        if handler.can_handle(file_path):
            return handler

    # Fallback: Try to detect from file signature (magic bytes)
    file_type = detect_file_type_from_signature(file_path)
    if file_type:
        return get_handler_by_type(file_type)

    raise ValueError(f"No handler found for file: {file_path}")

def detect_file_type_from_signature(file_path: str) -> str | None:
    """Detect file type from magic bytes (file signature)."""
    with open(file_path, 'rb') as f:
        header = f.read(8)

    # Magic bytes for different formats
    if header[:4] == b'PAR1':
        return 'parquet'
    elif header[:2] == b'PK':  # ZIP archive (XLSX is a ZIP)
        return 'excel'
    elif header[0:1] == b'{' or header[0:1] == b'[':
        return 'json'

    # Default to CSV for plain text
    return 'csv'
```

**Frontend Auto-Detection:**
```typescript
// apps/web/src/components/jobs/file-upload.tsx

const detectFileFormat = (file: File): FileFormat => {
  const extension = file.name.split('.').pop()?.toLowerCase()

  const formatMap: Record<string, FileFormat> = {
    'csv': 'csv',
    'tsv': 'csv',
    'txt': 'csv',
    'json': 'json',
    'jsonl': 'json',
    'ndjson': 'json',
    'parquet': 'parquet',
    'xlsx': 'excel',
    'xls': 'excel'
  }

  return formatMap[extension] || 'csv' // Default to CSV
}
```

**Implementation Steps:**
1. Create handler registry
2. Implement magic byte detection
3. Update upload component to auto-detect format
4. Show detected format with option to override

**Files to Modify:**
- `prefect-flows/utils/file_handlers.py` (Registry + detection)
- `apps/web/src/components/jobs/file-upload.tsx` (Auto-detect on upload)

**Test Cases:**
- ✅ Detect CSV from `.csv` extension
- ✅ Detect JSON from `.json` extension
- ✅ Detect Parquet from magic bytes (even if extension is wrong)
- ✅ User can override auto-detected format

---

### Task 1.6: Compression Support (1 day)

**Goal:** Support compressed files (GZIP, ZSTD) for all formats

#### Implementation

**Decompression Wrapper:**
```python
# prefect-flows/utils/file_handlers.py

import gzip
import zstandard as zstd

def decompress_if_needed(file_path: str) -> str:
    """
    Decompress file if it's compressed, return path to decompressed file.
    If not compressed, return original path.
    """
    if file_path.endswith('.gz'):
        # GZIP compressed
        decompressed_path = file_path.replace('.gz', '')
        with gzip.open(file_path, 'rb') as f_in:
            with open(decompressed_path, 'wb') as f_out:
                f_out.write(f_in.read())
        return decompressed_path

    elif file_path.endswith('.zst'):
        # Zstandard compressed
        decompressed_path = file_path.replace('.zst', '')
        dctx = zstd.ZstdDecompressor()
        with open(file_path, 'rb') as f_in:
            with open(decompressed_path, 'wb') as f_out:
                f_out.write(dctx.decompress(f_in.read()))
        return decompressed_path

    # Not compressed
    return file_path
```

**Update Handlers to Use Decompression:**
```python
class FileFormatHandler(ABC):
    def read(self, file_path: str, options: dict) -> pl.DataFrame:
        # Decompress if needed
        file_path = decompress_if_needed(file_path)

        # Then read with format-specific logic
        return self._read_impl(file_path, options)

    @abstractmethod
    def _read_impl(self, file_path: str, options: dict) -> pl.DataFrame:
        pass
```

**Note:** Polars has built-in support for GZIP-compressed CSV/JSON, but explicit decompression gives us more control.

**Implementation Steps:**
1. Add decompression utilities
2. Update handlers to decompress before reading
3. Test with `.csv.gz`, `.json.gz`, `.parquet` (Parquet is already compressed internally)

**Dependencies:**
```bash
pip install zstandard
```

**Test Cases:**
- ✅ GZIP-compressed CSV (`.csv.gz`)
- ✅ GZIP-compressed JSON (`.json.gz`)
- ✅ Zstandard-compressed CSV (`.csv.zst`)
- ✅ Uncompressed files (no change)
- ✅ Parquet (already compressed internally with Snappy/ZSTD)

---

### Phase 1 Summary

**Deliverables:**
- ✅ 4 file formats supported: CSV, JSON/JSONL, Parquet, Excel
- ✅ Advanced CSV options (delimiter, encoding, skip rows, etc.)
- ✅ File format auto-detection
- ✅ Compression support (GZIP, ZSTD)
- ✅ Pluggable handler architecture (easy to add new formats)

**Timeline:** 2 weeks (10 working days)

**Files Created:**
- `prefect-flows/utils/file_handlers.py` (Handler framework)

**Files Modified:**
- `apps/web/src/components/jobs/csv-file-upload.tsx` → `file-upload.tsx` (Rename, expand)
- `apps/web/src/components/jobs/create-job-modal.tsx` (Format config UI)
- `prefect-flows/tasks/bronze.py` (Use handlers)
- `apps/web/src/types/workflow.ts` (New interfaces)
- `prefect-flows/requirements.txt` (Dependencies)

---

## Phase 2: Advanced Ingestion Patterns (Weeks 3-5)

**Goal:** Production-grade automation for file ingestion

---

### Task 2.1: Complete Pattern Matching Implementation (2 days)

**Current State:** UI supports pattern matching, backend processes single file
**Enhancement:** Backend processes ALL files matching pattern

#### Backend Changes

**Pattern Matching in Bronze Task:**
```python
# prefect-flows/tasks/bronze.py

@task(name="bronze_ingest")
def bronze_ingest(
    upload_mode: str,  # 'single', 'pattern', 'directory'
    file_pattern: str,  # 'customer_*.csv', 'orders_2024*.parquet'
    # ... other params
):
    from utils.s3 import S3Client
    import fnmatch

    s3 = S3Client()

    if upload_mode == 'single':
        # Current behavior: process single file
        files_to_process = [landing_key]

    elif upload_mode == 'pattern':
        # NEW: List all files matching pattern
        landing_prefix = f"landing/{workflow_slug}/{job_slug}/"
        all_files = s3.list_objects(prefix=landing_prefix)

        # Filter files matching glob pattern
        files_to_process = [
            f for f in all_files
            if fnmatch.fnmatch(f, f"{landing_prefix}{file_pattern}")
        ]

        logger.info(f"Found {len(files_to_process)} files matching pattern: {file_pattern}")

    elif upload_mode == 'directory':
        # Future: process entire directory
        pass

    # Process all matched files
    all_dataframes = []
    for file_key in files_to_process:
        logger.info(f"Processing file: {file_key}")

        # Download file
        local_file = s3.download(file_key)

        # Read with appropriate handler
        handler = get_file_handler(local_file)
        df = handler.read(local_file, options=file_options)

        # Add audit columns
        df = df.with_columns([
            pl.lit(file_key).alias("_source_file"),
            pl.lit(datetime.now()).alias("_ingested_at")
        ])

        all_dataframes.append(df)

    # Concatenate all dataframes
    if len(all_dataframes) == 0:
        raise ValueError(f"No files found matching pattern: {file_pattern}")

    combined_df = pl.concat(all_dataframes)
    logger.info(f"Combined {len(all_dataframes)} files into {combined_df.height} rows")

    # Rest of Bronze processing (write to S3)
    # ...
```

**Frontend Changes:**
- When pattern mode is selected, show instructions: "Upload a sample file to detect schema. At runtime, all matching files will be processed."
- Show warning if pattern doesn't match any files

**Implementation Steps:**
1. Update Bronze task to support pattern matching
2. Add S3 listing functionality to S3Client
3. Test with multiple CSV files matching pattern
4. Add validation: all files must have same schema

**Files to Modify:**
- `prefect-flows/tasks/bronze.py` (Pattern matching logic)
- `prefect-flows/utils/s3.py` (Add list_objects method)

**Test Cases:**
- ✅ Pattern matches 5 CSV files → concatenate into single DataFrame
- ✅ Pattern matches 0 files → error with clear message
- ✅ Files have mismatched schemas → error with diff
- ✅ Pattern matches 100+ files → process in batches (avoid OOM)

---

### Task 2.2: Checkpoint Tracking (Avoid Reprocessing) (3 days)

**Goal:** Track processed files to avoid reprocessing on subsequent runs

#### Database Schema

**Create Checkpoint Table:**
```sql
-- apps/web/migrations/008_create_file_checkpoints.sql

CREATE TABLE IF NOT EXISTS file_checkpoints (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL, -- MD5 hash of file content
  file_size INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processed', 'failed', 'quarantined')),
  error_message TEXT,
  processed_at INTEGER NOT NULL, -- timestamp (ms)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(job_id, file_path),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_checkpoints_job_id ON file_checkpoints(job_id);
CREATE INDEX idx_file_checkpoints_status ON file_checkpoints(status);
CREATE INDEX idx_file_checkpoints_processed_at ON file_checkpoints(processed_at DESC);
```

#### Backend Implementation

**Checkpoint Utility:**
```python
# prefect-flows/utils/checkpoint.py

import hashlib
from datetime import datetime
from utils.metadata_catalog import get_database_connection

def compute_file_hash(file_path: str) -> str:
    """Compute MD5 hash of file."""
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def is_file_processed(job_id: str, file_path: str, file_hash: str) -> bool:
    """Check if file has already been processed."""
    conn = get_database_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT status FROM file_checkpoints
        WHERE job_id = ? AND file_path = ? AND file_hash = ? AND status = 'processed'
    """, (job_id, file_path, file_hash))

    result = cursor.fetchone()
    conn.close()

    return result is not None

def record_processed_file(
    job_id: str,
    workflow_id: str,
    file_path: str,
    file_hash: str,
    file_size: int,
    row_count: int,
    status: str = 'processed',
    error_message: str | None = None
):
    """Record that a file has been processed."""
    conn = get_database_connection()
    cursor = conn.cursor()

    checkpoint_id = f"checkpoint_{int(datetime.now().timestamp() * 1000)}"
    now_ms = int(datetime.now().timestamp() * 1000)

    cursor.execute("""
        INSERT OR REPLACE INTO file_checkpoints (
            id, job_id, workflow_id, file_path, file_hash, file_size, row_count,
            status, error_message, processed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        checkpoint_id, job_id, workflow_id, file_path, file_hash, file_size, row_count,
        status, error_message, now_ms, now_ms, now_ms
    ))

    conn.commit()
    conn.close()
```

**Update Bronze Task:**
```python
@task(name="bronze_ingest")
def bronze_ingest(
    job_id: str,
    workflow_id: str,
    # ... other params
):
    from utils.checkpoint import is_file_processed, record_processed_file, compute_file_hash

    # List files matching pattern
    files_to_process = [...]

    # Filter out already-processed files
    new_files = []
    for file_key in files_to_process:
        # Download file temporarily to compute hash
        local_file = s3.download(file_key)
        file_hash = compute_file_hash(local_file)
        file_size = Path(local_file).stat().st_size

        # Check if already processed
        if is_file_processed(job_id, file_key, file_hash):
            logger.info(f"Skipping already-processed file: {file_key} (hash: {file_hash})")
            continue

        new_files.append((file_key, local_file, file_hash, file_size))

    logger.info(f"Processing {len(new_files)} new files (skipped {len(files_to_process) - len(new_files)} already-processed)")

    # Process new files
    for file_key, local_file, file_hash, file_size in new_files:
        try:
            # Read and process file
            handler = get_file_handler(local_file)
            df = handler.read(local_file, options=file_options)

            # ... Bronze processing ...

            # Record successful processing
            record_processed_file(
                job_id=job_id,
                workflow_id=workflow_id,
                file_path=file_key,
                file_hash=file_hash,
                file_size=file_size,
                row_count=df.height,
                status='processed'
            )

        except Exception as e:
            # Record failure
            logger.error(f"Failed to process {file_key}: {e}")
            record_processed_file(
                job_id=job_id,
                workflow_id=workflow_id,
                file_path=file_key,
                file_hash=file_hash,
                file_size=file_size,
                row_count=0,
                status='failed',
                error_message=str(e)
            )
            raise
```

**Implementation Steps:**
1. Create migration for file_checkpoints table
2. Implement checkpoint utilities
3. Update Bronze task to check/record checkpoints
4. Add API endpoint to view checkpoint history: `GET /api/jobs/{jobId}/checkpoints`

**Files to Create:**
- `apps/web/migrations/008_create_file_checkpoints.sql`
- `prefect-flows/utils/checkpoint.py`

**Files to Modify:**
- `prefect-flows/tasks/bronze.py` (Use checkpoints)
- `apps/web/src/app/api/jobs/[jobId]/checkpoints/route.ts` (View checkpoint history)

**Test Cases:**
- ✅ First run: Process all files
- ✅ Second run: Skip already-processed files
- ✅ File changed (different hash): Process again
- ✅ Failed file: Retry on next run (status='failed')
- ✅ 100+ files: Efficient checkpoint queries

---

### Task 2.3: Incremental Loading (Watermark-Based) (3 days)

**Goal:** Only process files modified after last successful run

#### Database Schema

**Add Watermark Tracking to Jobs Table:**
```sql
-- apps/web/migrations/009_add_watermark_tracking.sql

ALTER TABLE jobs ADD COLUMN incremental_mode INTEGER DEFAULT 0 CHECK(incremental_mode IN (0, 1));
ALTER TABLE jobs ADD COLUMN watermark_column TEXT; -- Column to use for watermarking (e.g., 'modified_time')
ALTER TABLE jobs ADD COLUMN last_watermark TEXT; -- Last processed watermark value
```

#### UI Changes

**Job Configuration - Incremental Loading Section:**
```
┌─────────────────────────────────────────────────┐
│ Incremental Loading                 [Disabled ▼]│
├─────────────────────────────────────────────────┤
│ ☐ Enable Incremental Mode                      │
│                                                  │
│ Watermark Strategy:                             │
│ ⦿ File Timestamp (modified_time)                │
│ ○ Filename Pattern (extract date from name)    │
│                                                  │
│ Last Processed: 2024-01-15 14:30:00 UTC        │
│ (Will process files modified after this time)  │
└─────────────────────────────────────────────────┘
```

#### Backend Implementation

**Watermark Filtering:**
```python
# prefect-flows/tasks/bronze.py

@task(name="bronze_ingest")
def bronze_ingest(
    incremental_mode: bool,
    watermark_column: str,
    last_watermark: str | None,
    # ... other params
):
    from utils.s3 import S3Client
    from datetime import datetime

    s3 = S3Client()

    # List all files matching pattern
    landing_prefix = f"landing/{workflow_slug}/{job_slug}/"
    all_files = s3.list_objects_with_metadata(prefix=landing_prefix)

    # Filter by watermark if incremental mode enabled
    if incremental_mode and last_watermark:
        last_watermark_dt = datetime.fromisoformat(last_watermark)

        files_to_process = [
            f for f in all_files
            if f['last_modified'] > last_watermark_dt
        ]

        logger.info(f"Incremental mode: Found {len(files_to_process)} files modified after {last_watermark}")
    else:
        files_to_process = all_files
        logger.info(f"Full refresh mode: Processing all {len(files_to_process)} files")

    # Process files...
    # ...

    # Update watermark after successful processing
    if incremental_mode and len(files_to_process) > 0:
        new_watermark = max(f['last_modified'] for f in files_to_process)
        update_job_watermark(job_id, new_watermark.isoformat())
        logger.info(f"Updated watermark to: {new_watermark}")
```

**Update Watermark Utility:**
```python
# prefect-flows/utils/metadata_catalog.py

def update_job_watermark(job_id: str, watermark: str):
    """Update the last processed watermark for a job."""
    conn = get_database_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE jobs
        SET last_watermark = ?, updated_at = ?
        WHERE id = ?
    """, (watermark, int(datetime.now().timestamp() * 1000), job_id))

    conn.commit()
    conn.close()
```

**Implementation Steps:**
1. Add watermark columns to jobs table
2. Update job config UI with incremental mode toggle
3. Implement watermark filtering in Bronze task
4. Update watermark after successful run
5. Add API to view watermark history

**Files to Create:**
- `apps/web/migrations/009_add_watermark_tracking.sql`

**Files to Modify:**
- `prefect-flows/tasks/bronze.py` (Watermark filtering)
- `prefect-flows/utils/metadata_catalog.py` (Watermark tracking)
- `apps/web/src/components/jobs/create-job-modal.tsx` (Incremental config UI)
- `apps/web/src/types/workflow.ts` (Add incremental fields)

**Test Cases:**
- ✅ First run (no watermark): Process all files
- ✅ Second run: Only process files modified after watermark
- ✅ No new files: Skip processing, log info
- ✅ Watermark updated after successful run
- ✅ Failed run: Don't update watermark (retry next time)

---

### Task 2.4: MinIO Event-Driven Ingestion (4 days)

**Goal:** Automatically trigger workflows when files arrive in MinIO

#### Architecture

```
┌──────────────┐
│ MinIO        │
│ Landing Zone │
└──────┬───────┘
       │ File Upload
       │ (PUT object)
       ▼
┌──────────────────┐
│ MinIO Event      │
│ Notification     │
│ (Webhook)        │
└──────┬───────────┘
       │ HTTP POST
       ▼
┌──────────────────────┐
│ FlowForge API        │
│ /api/events/s3       │
└──────┬───────────────┘
       │ Parse event
       │ (bucket, key, size)
       ▼
┌──────────────────────┐
│ Match Job            │
│ (Pattern matching)   │
└──────┬───────────────┘
       │ Found match
       ▼
┌──────────────────────┐
│ Trigger Prefect Run  │
│ (via Prefect API)    │
└──────────────────────┘
```

#### MinIO Configuration

**Enable Event Notifications:**
```bash
# Configure MinIO to send webhooks on file upload
mc admin config set myminio notify_webhook:1 endpoint="http://localhost:3000/api/events/s3"
mc admin config set myminio notify_webhook:1 queue_limit="10"

# Enable notifications for bucket
mc event add myminio/flowforge-data arn:minio:sqs::1:webhook --event put
```

#### Backend - Event Receiver API

**Create Event Handler:**
```typescript
// apps/web/src/app/api/events/s3/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import axios from 'axios'

interface S3Event {
  EventName: string // 's3:ObjectCreated:Put'
  Key: string // 'landing/workflow-slug/job-slug/file.csv'
  Records: Array<{
    s3: {
      bucket: { name: string }
      object: { key: string, size: number }
    }
  }>
}

export async function POST(request: NextRequest) {
  try {
    const event: S3Event = await request.json()

    console.log('[S3 Event] Received event:', event)

    // Parse object key to extract workflow/job info
    // Format: landing/{workflow_slug}/{job_slug}/{filename}
    const key = event.Records[0].s3.object.key
    const parts = key.split('/')

    if (parts[0] !== 'landing' || parts.length < 4) {
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
    }

    const workflowSlug = parts[1]
    const jobSlug = parts[2]
    const filename = parts.slice(3).join('/')

    console.log(`[S3 Event] Workflow: ${workflowSlug}, Job: ${jobSlug}, File: ${filename}`)

    // Find workflow and job
    const workflow = db.prepare('SELECT id FROM workflows WHERE slug = ?').get(workflowSlug)
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const job = db.prepare('SELECT id, source_config FROM jobs WHERE workflow_id = ? AND slug = ?')
      .get(workflow.id, jobSlug)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if job has auto-ingest enabled
    const sourceConfig = JSON.parse(job.source_config)
    if (sourceConfig.fileConfig?.uploadMode !== 'auto-ingest') {
      return NextResponse.json({ message: 'Job does not have auto-ingest enabled' }, { status: 200 })
    }

    // Check if filename matches pattern (if pattern specified)
    const filePattern = sourceConfig.fileConfig?.filePattern
    if (filePattern) {
      const { minimatch } = await import('minimatch')
      if (!minimatch(filename, filePattern)) {
        console.log(`[S3 Event] File ${filename} does not match pattern ${filePattern}, skipping`)
        return NextResponse.json({ message: 'File does not match pattern' }, { status: 200 })
      }
    }

    // Trigger Prefect workflow run
    console.log(`[S3 Event] Triggering workflow run for ${workflow.id}`)

    const prefectDeploymentId = workflow.prefect_deployment_id
    const triggerResponse = await axios.post(
      `http://localhost:4200/api/deployments/${prefectDeploymentId}/create_flow_run`,
      {
        parameters: {
          workflow_id: workflow.id,
          job_id: job.id,
          landing_key: key,
          triggered_by: 's3_event'
        }
      }
    )

    console.log(`[S3 Event] Flow run created: ${triggerResponse.data.id}`)

    return NextResponse.json({
      message: 'Workflow triggered',
      flow_run_id: triggerResponse.data.id
    })

  } catch (error) {
    console.error('[S3 Event] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### UI Changes

**Add "Auto-Ingest" Upload Mode:**
```typescript
// apps/web/src/components/jobs/create-job-modal.tsx

<FormField>
  <FormLabel>Upload Mode</FormLabel>
  <Select value={formData.sourceConfig.fileConfig?.uploadMode || 'single'}>
    <option value="single">Single File (Manual upload)</option>
    <option value="pattern">Pattern Matching (e.g., customer_*.csv)</option>
    <option value="auto-ingest">Auto-Ingest (Event-driven) 🔥</option>
  </Select>
</FormField>

{formData.sourceConfig.fileConfig?.uploadMode === 'auto-ingest' && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-2">
      <Zap className="w-4 h-4 text-blue-600" />
      <span className="text-sm font-semibold text-blue-900">Auto-Ingest Enabled</span>
    </div>
    <p className="text-xs text-blue-700">
      This job will automatically trigger when files are uploaded to:
      <code className="bg-white px-2 py-1 rounded ml-1">
        landing/{workflowSlug}/{jobSlug}/
      </code>
    </p>
    <p className="text-xs text-blue-700 mt-2">
      Upload files via MinIO console, AWS CLI, or partner SFTP.
    </p>
  </div>
)}
```

**Implementation Steps:**
1. Configure MinIO webhook notifications
2. Create event receiver API endpoint
3. Implement job pattern matching
4. Add auto-ingest mode to UI
5. Test with file upload to MinIO
6. Add event log table (track all events received)

**Files to Create:**
- `apps/web/src/app/api/events/s3/route.ts` (Event receiver)
- `apps/web/migrations/010_create_event_log.sql` (Event tracking)

**Files to Modify:**
- `apps/web/src/components/jobs/create-job-modal.tsx` (Auto-ingest UI)
- MinIO configuration (setup webhook)

**Event Log Table:**
```sql
CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, -- 's3_put', 's3_delete', 'manual_trigger'
  source TEXT NOT NULL, -- 'minio', 'api', 'ui'
  payload TEXT NOT NULL, -- JSON of full event
  workflow_id TEXT,
  job_id TEXT,
  flow_run_id TEXT, -- Prefect flow run ID if triggered
  status TEXT NOT NULL CHECK(status IN ('received', 'processed', 'ignored', 'failed')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
);

CREATE INDEX idx_event_log_created_at ON event_log(created_at DESC);
CREATE INDEX idx_event_log_status ON event_log(status);
```

**Test Cases:**
- ✅ File uploaded to MinIO → Event received by API
- ✅ Event triggers Prefect workflow
- ✅ File matches pattern → Trigger
- ✅ File doesn't match pattern → Ignore
- ✅ Job has auto-ingest disabled → Ignore
- ✅ Multiple files uploaded in quick succession → Queue events
- ✅ Event failure → Retry logic

---

### Phase 2 Summary

**Deliverables:**
- ✅ Pattern matching: Process multiple files matching glob pattern
- ✅ Checkpoint tracking: Skip already-processed files
- ✅ Incremental loading: Watermark-based filtering
- ✅ Event-driven ingestion: Auto-trigger on file upload

**Timeline:** 3 weeks (15 working days)

**Files Created:**
- `apps/web/migrations/008_create_file_checkpoints.sql`
- `apps/web/migrations/009_add_watermark_tracking.sql`
- `apps/web/migrations/010_create_event_log.sql`
- `prefect-flows/utils/checkpoint.py`
- `apps/web/src/app/api/events/s3/route.ts`
- `apps/web/src/app/api/jobs/[jobId]/checkpoints/route.ts`

**Files Modified:**
- `prefect-flows/tasks/bronze.py` (All new patterns)
- `prefect-flows/utils/s3.py` (Add list_objects, metadata)
- `prefect-flows/utils/metadata_catalog.py` (Watermark tracking)
- `apps/web/src/components/jobs/create-job-modal.tsx` (Config UI)
- MinIO configuration (webhook setup)

---

## Database Schema Changes

### Summary of All New Tables

1. **file_checkpoints** - Track processed files (avoid reprocessing)
2. **event_log** - Track S3 events and triggers
3. **jobs table alterations** - Add incremental mode and watermark columns

### Migration Files

1. `008_create_file_checkpoints.sql` - Checkpoint tracking
2. `009_add_watermark_tracking.sql` - Incremental loading
3. `010_create_event_log.sql` - Event tracking

---

## Testing Strategy

### Unit Tests

**File Handlers:**
- ✅ CSVHandler reads various CSV formats
- ✅ JSONHandler reads JSON and JSONL
- ✅ ParquetHandler reads compressed Parquet
- ✅ ExcelHandler reads multi-sheet Excel
- ✅ Compression wrapper handles GZIP/ZSTD

**Checkpoint Utilities:**
- ✅ File hash computation
- ✅ Checkpoint insert/update
- ✅ Already-processed file detection

**Watermark Utilities:**
- ✅ Watermark filtering
- ✅ Watermark update after success
- ✅ Watermark persistence on failure

### Integration Tests

**End-to-End File Ingestion:**
1. Upload CSV file → Verify Bronze created
2. Upload JSON file → Verify Bronze created
3. Upload Parquet file → Verify Bronze created
4. Upload Excel file (multi-sheet) → Verify Bronze created
5. Upload compressed CSV.gz → Verify decompression + Bronze

**Pattern Matching:**
1. Upload 5 files matching pattern → All processed
2. Upload 5 files, 3 matching pattern → Only 3 processed
3. Pattern matches 0 files → Error with clear message

**Checkpoint Tests:**
1. Process files → Verify checkpoints created
2. Re-run job → Verify files skipped
3. Modify file (change hash) → Verify reprocessed
4. Failed file → Verify marked as failed, retry next run

**Incremental Loading:**
1. First run → Process all files, set watermark
2. Upload new files → Process only new, update watermark
3. No new files → Skip processing, log message

**Event-Driven Ingestion:**
1. Upload file to MinIO → Verify event received
2. Event matches job pattern → Verify workflow triggered
3. Event doesn't match → Verify ignored
4. Multiple files → Verify all events processed

### Performance Tests

**Large File Handling:**
- ✅ 100MB CSV file
- ✅ 1GB Parquet file
- ✅ 100+ files matching pattern

**Concurrent Processing:**
- ✅ 10 simultaneous file uploads
- ✅ Event queue handling (burst of 50 events)

---

## Success Metrics

### Phase 1 Success Criteria

- [ ] 4 file formats supported (CSV, JSON, Parquet, Excel)
- [ ] File format auto-detection works correctly
- [ ] Advanced CSV options available in UI
- [ ] All file handlers have unit tests
- [ ] Documentation updated with examples

### Phase 2 Success Criteria

- [ ] Pattern matching processes 10+ files in single job
- [ ] Checkpoint prevents reprocessing (verified in logs)
- [ ] Incremental mode reduces processing time by 80%+
- [ ] Event-driven ingestion triggers within 5 seconds of file upload
- [ ] Zero data loss (all files tracked in checkpoints)

### Production Readiness Checklist

- [ ] Error handling for all file types
- [ ] Logging at DEBUG, INFO, ERROR levels
- [ ] Database migrations tested (up and down)
- [ ] API endpoints secured (authentication)
- [ ] MinIO webhook configured with retry
- [ ] Documentation for users (how to use each mode)

---

## Risks & Mitigations

### Risk 1: Large File Memory Issues
**Risk:** Loading 10GB file into memory causes OOM
**Mitigation:**
- Use streaming/chunked reading (Polars `read_csv(batch_size=...)`)
- Set max file size limits (e.g., 5GB per file)
- Alert users to split large files

### Risk 2: Schema Mismatches in Pattern Matching
**Risk:** Files matching pattern have different schemas
**Mitigation:**
- Validate schema of first file, enforce on others
- Show schema diff in error message
- Add "strict schema validation" toggle

### Risk 3: Event Webhook Failures
**Risk:** MinIO webhook fails, events lost
**Mitigation:**
- Configure MinIO webhook with retry
- Add event_log table to track received events
- Manual trigger option if event missed

### Risk 4: Checkpoint Table Growth
**Risk:** Checkpoint table grows to millions of rows
**Mitigation:**
- Add retention policy (delete checkpoints >90 days)
- Partition table by date
- Archive old checkpoints to cold storage

### Risk 5: Incremental Mode Edge Cases
**Risk:** Watermark updated but processing failed midway
**Mitigation:**
- Only update watermark after ALL files processed
- Use database transactions (rollback on error)
- Add "force full refresh" option

---

## Timeline Summary

| Week | Phase | Tasks | Deliverables |
|------|-------|-------|-------------|
| 1 | Phase 1 | CSV enhancements, JSON support | CSV + JSON working |
| 2 | Phase 1 | Parquet, Excel, compression | All 4 formats working |
| 3 | Phase 2 | Pattern matching, checkpoints | Multiple files + deduplication |
| 4 | Phase 2 | Incremental loading | Watermark-based filtering |
| 5 | Phase 2 | Event-driven ingestion | MinIO auto-trigger |

**Total Duration:** 5 weeks
**Estimated Effort:** 2 engineers × 5 weeks = 10 engineer-weeks

---

## Next Steps

1. **Review & Approve:** Review this plan with team
2. **Setup Environment:** Configure MinIO webhooks in dev environment
3. **Create Tasks:** Break down into Jira/GitHub issues
4. **Start Implementation:** Begin with Phase 1, Task 1.1 (CSV enhancements)
5. **Daily Standups:** Track progress, unblock issues
6. **Weekly Demos:** Show progress to stakeholders

---

## Appendix: Example Usage Scenarios

### Scenario 1: Daily CSV Files from Partner

**Setup:**
- Upload mode: Pattern matching (`sales_*.csv`)
- Incremental mode: Enabled (watermark by modified time)
- Schedule: Daily at 3 AM

**Flow:**
- Day 1: Partner uploads `sales_2024-01-15.csv` → Processed
- Day 2: Partner uploads `sales_2024-01-16.csv` → Only new file processed
- Day 3: No new files → Job runs, finds nothing, skips processing

### Scenario 2: Real-Time Event Stream (JSON Lines)

**Setup:**
- File format: JSON Lines (JSONL)
- Upload mode: Auto-ingest
- Pattern: `events_*.jsonl`

**Flow:**
- Application writes `events_2024-01-15_14-30.jsonl` to MinIO
- MinIO event triggers FlowForge
- File processed within seconds
- Next file arrives 5 minutes later → Auto-triggers again

### Scenario 3: Historical Backfill (Parquet Archives)

**Setup:**
- File format: Parquet
- Upload mode: Pattern matching (`archive_*.parquet`)
- Incremental mode: Disabled (full refresh)

**Flow:**
- Upload 100 Parquet files (5 years of history)
- Job processes all 100 files in parallel
- Concatenates into single Bronze table
- Checkpoints prevent reprocessing if job re-runs

### Scenario 4: Excel Reports from Finance

**Setup:**
- File format: Excel (XLSX)
- Sheet: "Monthly Report"
- Upload mode: Manual
- Schedule: Monthly

**Flow:**
- Finance uploads `Q1_Financial_Report.xlsx`
- Job reads "Monthly Report" sheet
- Header row detected automatically
- Data flows through Bronze → Silver → Gold

---

## Conclusion

This implementation plan provides a clear, phased approach to building a production-grade file ingestion framework for FlowForge. By focusing on the most common file formats (Phase 1) and then adding automation patterns (Phase 2), we deliver value incrementally while building toward a comprehensive solution.

**Key Principles:**
- ✅ Start simple, iterate quickly
- ✅ Leverage existing tools (Polars, MinIO, Prefect)
- ✅ Build for production (checkpoints, error handling, monitoring)
- ✅ User-friendly (auto-detection, clear errors, good docs)

**Questions or Concerns?** Review this plan with the team before starting implementation.
