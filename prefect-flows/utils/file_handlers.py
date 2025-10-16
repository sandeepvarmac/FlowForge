"""
File Format Handler Framework for FlowForge

Provides pluggable architecture for reading different file formats.
Supports CSV, JSON, Parquet, Excel, and compressed files.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional
import polars as pl
from prefect import get_run_logger
from prefect.exceptions import MissingContextError
import logging


def _get_logger():
    """Get logger - Prefect if available, otherwise standard logging."""
    try:
        return get_run_logger()
    except MissingContextError:
        return logging.getLogger(__name__)


class FileFormatHandler(ABC):
    """Abstract base class for file format handlers."""

    @abstractmethod
    def can_handle(self, file_path: str) -> bool:
        """
        Check if this handler can process the file.

        Args:
            file_path: Path to the file

        Returns:
            True if this handler can process the file
        """
        pass

    @abstractmethod
    def read(self, file_path: str, options: Dict[str, Any]) -> pl.DataFrame:
        """
        Read file and return Polars DataFrame.

        Args:
            file_path: Path to the file
            options: Format-specific options

        Returns:
            Polars DataFrame with file contents
        """
        pass

    @abstractmethod
    def infer_schema(self, file_path: str, sample_rows: int = 100) -> List[Dict[str, Any]]:
        """
        Infer schema from file.

        Args:
            file_path: Path to the file
            sample_rows: Number of rows to sample for inference

        Returns:
            List of column definitions with name, type, and sample value
        """
        pass

    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """
        Return list of supported file extensions.

        Returns:
            List of extensions (e.g., ['.csv', '.txt'])
        """
        pass

    def _polars_to_flowforge_type(self, dtype) -> str:
        """Convert Polars dtype to FlowForge type string."""
        type_mapping = {
            pl.Int8: 'integer',
            pl.Int16: 'integer',
            pl.Int32: 'integer',
            pl.Int64: 'integer',
            pl.UInt8: 'integer',
            pl.UInt16: 'integer',
            pl.UInt32: 'integer',
            pl.UInt64: 'integer',
            pl.Float32: 'float',
            pl.Float64: 'float',
            pl.Utf8: 'string',
            pl.String: 'string',
            pl.Boolean: 'boolean',
            pl.Date: 'date',
            pl.Datetime: 'datetime',
            pl.Time: 'time',
            pl.Struct: 'object',
            pl.List: 'array',
        }

        # Get the type of the dtype (e.g., type(pl.Int64) returns <class 'polars.datatypes.Int64'>)
        dtype_type = type(dtype)
        return type_mapping.get(dtype_type, 'string')


class CSVHandler(FileFormatHandler):
    """Handler for CSV (Comma-Separated Values) files."""

    def can_handle(self, file_path: str) -> bool:
        return file_path.lower().endswith(('.csv', '.txt', '.tsv'))

    def read(self, file_path: str, options: Dict[str, Any]) -> pl.DataFrame:
        logger = _get_logger()

        # Extract CSV options
        has_header = options.get('has_header', True)
        delimiter = options.get('delimiter', ',')
        encoding = options.get('encoding', 'utf-8')
        skip_rows = options.get('skip_rows', 0)
        infer_schema_length = options.get('infer_schema_length', None)

        logger.info(f"Reading CSV: has_header={has_header}, delimiter='{delimiter}', encoding='{encoding}'")

        try:
            df = pl.read_csv(
                file_path,
                has_header=has_header,
                separator=delimiter,
                encoding=encoding,
                skip_rows=skip_rows,
                try_parse_dates=True,
                infer_schema_length=infer_schema_length,
                ignore_errors=False,
            )

            logger.info(f"Successfully read CSV: {df.height} rows, {df.width} columns")
            return df

        except Exception as e:
            logger.error(f"Failed to read CSV file: {e}")
            raise

    def infer_schema(self, file_path: str, sample_rows: int = 100) -> List[Dict[str, Any]]:
        """Infer schema by reading first N rows."""
        df = pl.read_csv(file_path, n_rows=sample_rows, try_parse_dates=True)

        schema = []
        for col_name in df.columns:
            dtype = df.schema[col_name]
            sample_value = str(df[col_name][0]) if df.height > 0 else None

            schema.append({
                "name": col_name,
                "type": self._polars_to_flowforge_type(dtype),
                "sample": sample_value
            })

        return schema

    def supported_extensions(self) -> List[str]:
        return ['.csv', '.txt', '.tsv']


class JSONHandler(FileFormatHandler):
    """Handler for JSON and JSON Lines (JSONL) files."""

    def can_handle(self, file_path: str) -> bool:
        return file_path.lower().endswith(('.json', '.jsonl', '.ndjson'))

    def read(self, file_path: str, options: Dict[str, Any]) -> pl.DataFrame:
        logger = _get_logger()

        # Determine JSON mode
        if file_path.endswith('.jsonl') or file_path.endswith('.ndjson'):
            mode = 'lines'
        else:
            mode = options.get('mode', 'standard')

        logger.info(f"Reading JSON file in '{mode}' mode")

        try:
            if mode == 'lines':
                # JSON Lines (newline-delimited)
                df = pl.read_ndjson(file_path)
            else:
                # Standard JSON
                df = pl.read_json(file_path)

            logger.info(f"Successfully read JSON: {df.height} rows, {df.width} columns")
            return df

        except Exception as e:
            logger.error(f"Failed to read JSON file: {e}")
            raise

    def infer_schema(self, file_path: str, sample_rows: int = 100) -> List[Dict[str, Any]]:
        """Infer schema by reading first N rows."""
        # Determine mode from extension
        if file_path.endswith('.jsonl') or file_path.endswith('.ndjson'):
            df = pl.read_ndjson(file_path, n_rows=sample_rows)
        else:
            df = pl.read_json(file_path)
            df = df.head(sample_rows)

        schema = []
        for col_name in df.columns:
            dtype = df.schema[col_name]
            sample_value = str(df[col_name][0]) if df.height > 0 else None

            schema.append({
                "name": col_name,
                "type": self._polars_to_flowforge_type(dtype),
                "sample": sample_value
            })

        return schema

    def supported_extensions(self) -> List[str]:
        return ['.json', '.jsonl', '.ndjson']


class ParquetHandler(FileFormatHandler):
    """Handler for Apache Parquet files."""

    def can_handle(self, file_path: str) -> bool:
        return file_path.lower().endswith('.parquet')

    def read(self, file_path: str, options: Dict[str, Any]) -> pl.DataFrame:
        logger = _get_logger()

        # Parquet options
        columns = options.get('columns', None)  # Column pruning
        n_rows = options.get('n_rows', None)    # Limit rows

        logger.info(f"Reading Parquet file")

        try:
            df = pl.read_parquet(
                file_path,
                columns=columns,
                n_rows=n_rows,
                use_pyarrow=True  # Use PyArrow for better compatibility
            )

            logger.info(f"Successfully read Parquet: {df.height} rows, {df.width} columns")
            return df

        except Exception as e:
            logger.error(f"Failed to read Parquet file: {e}")
            raise

    def infer_schema(self, file_path: str, sample_rows: int = 100) -> List[Dict[str, Any]]:
        """Parquet has embedded schema - read metadata without loading data."""
        import pyarrow.parquet as pq

        # Read Parquet metadata
        parquet_file = pq.ParquetFile(file_path)
        schema_arrow = parquet_file.schema_arrow

        # Convert PyArrow schema to FlowForge format
        schema = []
        for field in schema_arrow:
            # Map PyArrow types to FlowForge types
            pa_type = str(field.type)
            if 'int' in pa_type.lower():
                flowforge_type = 'integer'
            elif 'float' in pa_type.lower() or 'double' in pa_type.lower():
                flowforge_type = 'float'
            elif 'string' in pa_type.lower() or 'utf8' in pa_type.lower():
                flowforge_type = 'string'
            elif 'bool' in pa_type.lower():
                flowforge_type = 'boolean'
            elif 'date' in pa_type.lower():
                flowforge_type = 'date'
            elif 'timestamp' in pa_type.lower():
                flowforge_type = 'datetime'
            else:
                flowforge_type = 'string'

            schema.append({
                "name": field.name,
                "type": flowforge_type,
                "nullable": field.nullable
            })

        return schema

    def get_metadata(self, file_path: str) -> Dict[str, Any]:
        """Extract Parquet file metadata."""
        import pyarrow.parquet as pq

        parquet_file = pq.ParquetFile(file_path)
        metadata = parquet_file.metadata

        return {
            "num_rows": metadata.num_rows,
            "num_columns": metadata.num_columns,
            "num_row_groups": metadata.num_row_groups,
            "compression": str(metadata.row_group(0).column(0).compression) if metadata.num_row_groups > 0 else "none",
            "file_size": Path(file_path).stat().st_size,
            "created_by": metadata.created_by
        }

    def supported_extensions(self) -> List[str]:
        return ['.parquet']


class ExcelHandler(FileFormatHandler):
    """Handler for Excel files (XLSX, XLS)."""

    def can_handle(self, file_path: str) -> bool:
        return file_path.lower().endswith(('.xlsx', '.xls'))

    def read(self, file_path: str, options: Dict[str, Any]) -> pl.DataFrame:
        logger = _get_logger()

        # Excel options
        sheet_name = options.get('sheet_name', None)
        sheet_index = options.get('sheet_index', 0)

        # Determine which sheet to read
        if sheet_name:
            sheet_id = sheet_name
        else:
            sheet_id = sheet_index

        logger.info(f"Reading Excel file, sheet: {sheet_id}")

        try:
            # pl.read_excel returns a dict of sheet_name -> DataFrame when sheet_id=None
            # or a single DataFrame when sheet_id is specified
            result = pl.read_excel(
                file_path,
                sheet_id=sheet_id,
            )

            # If result is a dict (multiple sheets), get the first one
            if isinstance(result, dict):
                df = list(result.values())[0]
            else:
                df = result

            logger.info(f"Successfully read Excel: {df.height} rows, {df.width} columns")
            return df

        except Exception as e:
            logger.error(f"Failed to read Excel file: {e}")
            raise

    def infer_schema(self, file_path: str, sample_rows: int = 100) -> List[Dict[str, Any]]:
        """Infer schema from Excel sheet."""
        # Read first N rows
        result = pl.read_excel(file_path)

        # If result is a dict, get the first sheet
        if isinstance(result, dict):
            df = list(result.values())[0]
        else:
            df = result

        df = df.head(sample_rows)

        schema = []
        for col_name in df.columns:
            dtype = df.schema[col_name]
            sample_value = str(df[col_name][0]) if df.height > 0 else None

            schema.append({
                "name": col_name,
                "type": self._polars_to_flowforge_type(dtype),
                "sample": sample_value
            })

        return schema

    def list_sheets(self, file_path: str) -> List[str]:
        """List all sheet names in Excel file."""
        try:
            import openpyxl
            workbook = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
            sheet_names = workbook.sheetnames
            workbook.close()
            return sheet_names
        except Exception:
            # Fallback: just return empty list if openpyxl not available
            return []

    def supported_extensions(self) -> List[str]:
        return ['.xlsx', '.xls']


# Registry of all handlers
HANDLERS = [
    CSVHandler(),
    JSONHandler(),
    ParquetHandler(),
    ExcelHandler()
]


def get_file_handler(file_path: str) -> FileFormatHandler:
    """
    Get appropriate handler for file based on extension.

    Args:
        file_path: Path to the file

    Returns:
        FileFormatHandler instance

    Raises:
        ValueError: If no handler found for file
    """
    for handler in HANDLERS:
        if handler.can_handle(file_path):
            return handler

    raise ValueError(f"No handler found for file: {file_path}")


def detect_file_format(file_path: str) -> str:
    """
    Detect file format from extension.

    Args:
        file_path: Path to the file

    Returns:
        Format name: 'csv', 'json', 'parquet', 'excel'
    """
    file_path_lower = file_path.lower()

    if file_path_lower.endswith(('.csv', '.txt', '.tsv')):
        return 'csv'
    elif file_path_lower.endswith(('.json', '.jsonl', '.ndjson')):
        return 'json'
    elif file_path_lower.endswith('.parquet'):
        return 'parquet'
    elif file_path_lower.endswith(('.xlsx', '.xls')):
        return 'excel'
    else:
        # Default to CSV for unknown extensions
        return 'csv'
