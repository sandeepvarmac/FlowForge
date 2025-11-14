"""
Database Connector Classes for FlowForge
Supports SQL Server, PostgreSQL, MySQL, Oracle, and more.
"""

import pymssql
import psycopg2
import psycopg2.extras
import pyarrow as pa
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from abc import ABC, abstractmethod


class DatabaseConnector(ABC):
    """Base class for all database connectors"""

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test database connection"""
        pass

    @abstractmethod
    def list_tables(self) -> List[str]:
        """List all tables in database"""
        pass

    @abstractmethod
    def get_schema(self, table_name: str) -> List[Dict[str, str]]:
        """Get schema for a specific table"""
        pass

    @abstractmethod
    def read_table(self, table_name: str, batch_size: int = 10000) -> pa.Table:
        """Read entire table into Arrow Table"""
        pass

    @abstractmethod
    def read_query(self, query: str) -> pa.Table:
        """Execute custom query and return Arrow Table"""
        pass


class SQLServerConnector(DatabaseConnector):
    """SQL Server database connector using pymssql"""

    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout: int = 30
    ):
        """
        Initialize SQL Server connector

        Args:
            host: Database host (e.g., 'localhost')
            port: Database port (default: 1433)
            database: Database name
            username: Database username
            password: Database password
            timeout: Connection timeout in seconds
        """
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self.timeout = timeout
        self.connection = None

    def connect(self) -> pymssql.Connection:
        """
        Create database connection

        Returns:
            pymssql.Connection object

        Raises:
            Exception if connection fails
        """
        try:
            self.connection = pymssql.connect(
                server=self.host,
                port=self.port,
                database=self.database,
                user=self.username,
                password=self.password,
                timeout=self.timeout,
                login_timeout=self.timeout
            )
            return self.connection
        except Exception as e:
            raise Exception(f"Failed to connect to SQL Server: {str(e)}")

    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None

    def test_connection(self) -> Dict[str, Any]:
        """
        Test database connection

        Returns:
            {
                'success': bool,
                'message': str,
                'server_version': str (if success)
            }
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            # Get SQL Server version
            cursor.execute("SELECT @@VERSION")
            version = cursor.fetchone()[0]

            # Get database name
            cursor.execute("SELECT DB_NAME()")
            db_name = cursor.fetchone()[0]

            cursor.close()
            self.close()

            return {
                'success': True,
                'message': f'Successfully connected to {db_name}',
                'server_version': version.split('\n')[0].strip(),
                'database': db_name
            }

        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}'
            }

    def list_tables(self) -> List[str]:
        """
        List all tables in database

        Returns:
            List of table names
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
            """)

            tables = [row[0] for row in cursor.fetchall()]

            cursor.close()
            self.close()

            return tables

        except Exception as e:
            raise Exception(f"Failed to list tables: {str(e)}")

    def get_schema(self, table_name: str) -> List[Dict[str, str]]:
        """
        Get schema for a specific table

        Args:
            table_name: Name of the table

        Returns:
            List of dicts with column info:
            [
                {
                    'column_name': str,
                    'data_type': str,
                    'is_nullable': bool,
                    'max_length': int (optional),
                    'numeric_precision': int (optional),
                    'numeric_scale': int (optional)
                }
            ]
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    CHARACTER_MAXIMUM_LENGTH,
                    NUMERIC_PRECISION,
                    NUMERIC_SCALE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = %s
                ORDER BY ORDINAL_POSITION
            """, (table_name,))

            schema = []
            for row in cursor.fetchall():
                col_info = {
                    'column_name': row[0],
                    'data_type': row[1],
                    'is_nullable': row[2] == 'YES'
                }
                if row[3]:  # max_length
                    col_info['max_length'] = row[3]
                if row[4]:  # numeric_precision
                    col_info['numeric_precision'] = row[4]
                if row[5]:  # numeric_scale
                    col_info['numeric_scale'] = row[5]

                schema.append(col_info)

            cursor.close()
            self.close()

            return schema

        except Exception as e:
            raise Exception(f"Failed to get schema for {table_name}: {str(e)}")

    def _sql_type_to_arrow(self, sql_type: str, precision: Optional[int] = None, scale: Optional[int] = None) -> pa.DataType:
        """
        Map SQL Server data types to Arrow data types

        Args:
            sql_type: SQL Server data type
            precision: Numeric precision (for DECIMAL/NUMERIC)
            scale: Numeric scale (for DECIMAL/NUMERIC)

        Returns:
            PyArrow DataType
        """
        type_mapping = {
            # Integer types
            'tinyint': pa.int8(),
            'smallint': pa.int16(),
            'int': pa.int32(),
            'bigint': pa.int64(),

            # Float types
            'real': pa.float32(),
            'float': pa.float64(),

            # String types
            'char': pa.string(),
            'nchar': pa.string(),
            'varchar': pa.string(),
            'nvarchar': pa.string(),
            'text': pa.string(),
            'ntext': pa.string(),

            # Date/time types
            'date': pa.date32(),
            'datetime': pa.timestamp('ms'),
            'datetime2': pa.timestamp('us'),
            'smalldatetime': pa.timestamp('ms'),
            'time': pa.time64('us'),

            # Boolean
            'bit': pa.bool_(),

            # Binary
            'binary': pa.binary(),
            'varbinary': pa.binary(),

            # Money
            'money': pa.decimal128(19, 4),
            'smallmoney': pa.decimal128(10, 4),
        }

        # Handle DECIMAL/NUMERIC with precision and scale
        if sql_type in ['decimal', 'numeric']:
            if precision and scale is not None:
                return pa.decimal128(precision, scale)
            else:
                return pa.decimal128(18, 0)  # Default

        return type_mapping.get(sql_type, pa.string())  # Default to string for unknown types

    def read_table(
        self,
        table_name: str,
        batch_size: int = 10000,
        where_clause: Optional[str] = None,
        order_by: Optional[str] = None
    ) -> pa.Table:
        """
        Read entire table into Arrow Table

        Args:
            table_name: Name of the table to read
            batch_size: Number of rows per batch (for memory efficiency)
            where_clause: Optional WHERE clause (without 'WHERE' keyword)
            order_by: Optional ORDER BY clause (without 'ORDER BY' keyword)

        Returns:
            PyArrow Table with all data
        """
        # Build query
        query = f"SELECT * FROM {table_name}"
        if where_clause:
            query += f" WHERE {where_clause}"
        if order_by:
            query += f" ORDER BY {order_by}"

        return self.read_query(query)

    def read_query(self, query: str) -> pa.Table:
        """
        Execute custom SQL query and return Arrow Table

        Args:
            query: SQL query to execute

        Returns:
            PyArrow Table with query results
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            # Execute query
            cursor.execute(query)

            # Get column names and types
            columns = [desc[0] for desc in cursor.description]

            # Fetch all rows
            rows = cursor.fetchall()

            cursor.close()
            self.close()

            if not rows:
                # Return empty table with schema
                return pa.table({col: [] for col in columns})

            # Convert to dict of lists (column-oriented)
            data = {}
            for i, col_name in enumerate(columns):
                data[col_name] = [row[i] for row in rows]

            # Create Arrow Table
            arrow_table = pa.table(data)

            return arrow_table

        except Exception as e:
            raise Exception(f"Failed to execute query: {str(e)}")

    def get_incremental_data(
        self,
        table_name: str,
        delta_column: str,
        last_value: Any,
        batch_size: int = 10000
    ) -> pa.Table:
        """
        Read incremental data based on watermark column

        Args:
            table_name: Name of the table
            delta_column: Column to use for incremental logic (e.g., 'modified_date')
            last_value: Last watermark value from previous run
            batch_size: Number of rows per batch

        Returns:
            PyArrow Table with new/updated records
        """
        # Build WHERE clause for incremental load
        if isinstance(last_value, (datetime, str)):
            where_clause = f"{delta_column} > '{last_value}'"
        else:
            where_clause = f"{delta_column} > {last_value}"

        return self.read_table(
            table_name=table_name,
            batch_size=batch_size,
            where_clause=where_clause,
            order_by=delta_column
        )

    def get_row_count(self, table_name: str) -> int:
        """
        Get total row count for a table

        Args:
            table_name: Name of the table

        Returns:
            Number of rows
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]

            cursor.close()
            self.close()

            return count

        except Exception as e:
            raise Exception(f"Failed to get row count: {str(e)}")

    def preview_data(self, table_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Preview first N rows of a table

        Args:
            table_name: Name of the table
            limit: Number of rows to return

        Returns:
            List of row dicts
        """
        try:
            conn = self.connect()
            cursor = conn.cursor(as_dict=True)

            cursor.execute(f"SELECT TOP {limit} * FROM {table_name}")
            rows = cursor.fetchall()

            cursor.close()
            self.close()

            return rows

        except Exception as e:
            raise Exception(f"Failed to preview data: {str(e)}")


# Additional connector classes can be added here
class PostgreSQLConnector(DatabaseConnector):
    """PostgreSQL database connector using psycopg2"""

    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout: int = 30
    ):
        """
        Initialize PostgreSQL connector

        Args:
            host: Database host (e.g., 'localhost')
            port: Database port (default: 5432)
            database: Database name
            username: Database username
            password: Database password
            timeout: Connection timeout in seconds
        """
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self.timeout = timeout
        self.connection = None

    def connect(self) -> psycopg2.extensions.connection:
        """
        Create database connection

        Returns:
            psycopg2.Connection object

        Raises:
            Exception if connection fails
        """
        try:
            self.connection = psycopg2.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.username,
                password=self.password,
                connect_timeout=self.timeout
            )
            return self.connection
        except Exception as e:
            raise Exception(f"Failed to connect to PostgreSQL: {str(e)}")

    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None

    def test_connection(self) -> Dict[str, Any]:
        """
        Test database connection

        Returns:
            {
                'success': bool,
                'message': str,
                'server_version': str (if success)
            }
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            # Get PostgreSQL version
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]

            # Get database name
            cursor.execute("SELECT current_database()")
            db_name = cursor.fetchone()[0]

            cursor.close()
            self.close()

            return {
                'success': True,
                'message': f'Successfully connected to {db_name}',
                'server_version': version.split('\n')[0].strip(),
                'database': db_name
            }

        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}'
            }

    def list_tables(self) -> List[str]:
        """
        List all tables in database (excluding Prefect system tables)

        Returns:
            List of table names
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            # Exclude Prefect system tables
            prefect_tables = [
                'agent', 'alembic_version', 'artifact', 'artifact_collection',
                'automation', 'automation_bucket', 'automation_event_follower',
                'automation_related_resource', 'block_document', 'block_document_reference',
                'block_schema', 'block_schema_reference', 'block_type',
                'composite_trigger_child_firing', 'concurrency_limit', 'concurrency_limit_v2',
                'configuration', 'csrf_token', 'deployment', 'deployment_schedule',
                'event_resources', 'events', 'flow', 'flow_run', 'flow_run_input',
                'flow_run_notification_policy', 'flow_run_notification_queue',
                'flow_run_state', 'log', 'saved_search', 'task_run', 'task_run_state',
                'task_run_state_cache', 'variable', 'work_pool', 'work_queue', 'worker'
            ]

            cursor.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                    AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)

            # Filter out Prefect system tables
            tables = [row[0] for row in cursor.fetchall() if row[0] not in prefect_tables]

            cursor.close()
            self.close()

            return tables

        except Exception as e:
            raise Exception(f"Failed to list tables: {str(e)}")

    def get_schema(self, table_name: str) -> List[Dict[str, str]]:
        """
        Get schema for a specific table

        Args:
            table_name: Name of the table

        Returns:
            List of dicts with column info
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    column_name,
                    data_type,
                    is_nullable,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale
                FROM information_schema.columns
                WHERE table_schema = 'public'
                    AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,))

            schema = []
            for row in cursor.fetchall():
                col_info = {
                    'column_name': row[0],
                    'data_type': row[1],
                    'is_nullable': row[2] == 'YES'
                }
                if row[3]:  # max_length
                    col_info['max_length'] = row[3]
                if row[4]:  # numeric_precision
                    col_info['numeric_precision'] = row[4]
                if row[5]:  # numeric_scale
                    col_info['numeric_scale'] = row[5]

                schema.append(col_info)

            cursor.close()
            self.close()

            return schema

        except Exception as e:
            raise Exception(f"Failed to get schema for {table_name}: {str(e)}")

    def _pg_type_to_arrow(self, pg_type: str, precision: Optional[int] = None, scale: Optional[int] = None) -> pa.DataType:
        """
        Map PostgreSQL data types to Arrow data types

        Args:
            pg_type: PostgreSQL data type
            precision: Numeric precision (for DECIMAL/NUMERIC)
            scale: Numeric scale (for DECIMAL/NUMERIC)

        Returns:
            PyArrow DataType
        """
        type_mapping = {
            # Integer types
            'smallint': pa.int16(),
            'integer': pa.int32(),
            'bigint': pa.int64(),

            # Float types
            'real': pa.float32(),
            'double precision': pa.float64(),

            # String types
            'character': pa.string(),
            'character varying': pa.string(),
            'text': pa.string(),

            # Date/time types
            'date': pa.date32(),
            'timestamp without time zone': pa.timestamp('us'),
            'timestamp with time zone': pa.timestamp('us', tz='UTC'),
            'time without time zone': pa.time64('us'),

            # Boolean
            'boolean': pa.bool_(),

            # Binary
            'bytea': pa.binary(),

            # UUID
            'uuid': pa.string(),

            # JSON
            'json': pa.string(),
            'jsonb': pa.string(),
        }

        # Handle NUMERIC/DECIMAL with precision and scale
        if pg_type in ['numeric', 'decimal']:
            if precision and scale is not None:
                return pa.decimal128(precision, scale)
            else:
                return pa.decimal128(18, 0)  # Default

        return type_mapping.get(pg_type, pa.string())  # Default to string for unknown types

    def read_table(
        self,
        table_name: str,
        batch_size: int = 10000,
        where_clause: Optional[str] = None,
        order_by: Optional[str] = None
    ) -> pa.Table:
        """
        Read entire table into Arrow Table

        Args:
            table_name: Name of the table to read
            batch_size: Number of rows per batch (for memory efficiency)
            where_clause: Optional WHERE clause (without 'WHERE' keyword)
            order_by: Optional ORDER BY clause (without 'ORDER BY' keyword)

        Returns:
            PyArrow Table with all data
        """
        # Build query
        query = f"SELECT * FROM {table_name}"
        if where_clause:
            query += f" WHERE {where_clause}"
        if order_by:
            query += f" ORDER BY {order_by}"

        return self.read_query(query)

    def read_query(self, query: str) -> pa.Table:
        """
        Execute custom SQL query and return Arrow Table

        Args:
            query: SQL query to execute

        Returns:
            PyArrow Table with query results
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            # Execute query
            cursor.execute(query)

            # Get column names
            columns = [desc[0] for desc in cursor.description]

            # Fetch all rows
            rows = cursor.fetchall()

            cursor.close()
            self.close()

            if not rows:
                # Return empty table with schema
                return pa.table({col: [] for col in columns})

            # Convert to dict of lists (column-oriented)
            data = {}
            for i, col_name in enumerate(columns):
                data[col_name] = [row[i] for row in rows]

            # Create Arrow Table
            arrow_table = pa.table(data)

            return arrow_table

        except Exception as e:
            raise Exception(f"Failed to execute query: {str(e)}")

    def get_incremental_data(
        self,
        table_name: str,
        delta_column: str,
        last_value: Any,
        batch_size: int = 10000
    ) -> pa.Table:
        """
        Read incremental data based on watermark column

        Args:
            table_name: Name of the table
            delta_column: Column to use for incremental logic
            last_value: Last watermark value from previous run
            batch_size: Number of rows per batch

        Returns:
            PyArrow Table with new/updated records
        """
        # Build WHERE clause for incremental load
        if isinstance(last_value, (datetime, str)):
            where_clause = f"{delta_column} > '{last_value}'"
        else:
            where_clause = f"{delta_column} > {last_value}"

        return self.read_table(
            table_name=table_name,
            batch_size=batch_size,
            where_clause=where_clause,
            order_by=delta_column
        )

    def get_row_count(self, table_name: str) -> int:
        """
        Get total row count for a table

        Args:
            table_name: Name of the table

        Returns:
            Number of rows
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()

            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]

            cursor.close()
            self.close()

            return count

        except Exception as e:
            raise Exception(f"Failed to get row count: {str(e)}")

    def preview_data(self, table_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Preview first N rows of a table

        Args:
            table_name: Name of the table
            limit: Number of rows to return

        Returns:
            List of row dicts
        """
        try:
            conn = self.connect()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            cursor.execute(f"SELECT * FROM {table_name} LIMIT %s", (limit,))
            rows = cursor.fetchall()

            cursor.close()
            self.close()

            return [dict(row) for row in rows]

        except Exception as e:
            raise Exception(f"Failed to preview data: {str(e)}")


class MySQLConnector(DatabaseConnector):
    """MySQL connector (placeholder for future implementation)"""
    pass


class OracleConnector(DatabaseConnector):
    """Oracle connector (placeholder for future implementation)"""
    pass
