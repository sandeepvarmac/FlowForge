"""
Test script for database_bronze task
Tests end-to-end ingestion from SQL Server to Bronze Parquet
"""

import sys
import os
from datetime import datetime
import uuid

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from tasks.database_bronze import (
    ingest_from_database,
    test_database_connection,
    list_database_tables,
    get_database_schema
)


def test_connection():
    """Test database connection"""
    print("\n" + "="*60)
    print("TEST 1: Database Connection")
    print("="*60)

    result = test_database_connection(
        db_type='sql-server',
        connection_config={
            'host': 'localhost',
            'port': 1433,
            'database': 'BFSI_Test',
            'username': 'sa',
            'password': 'FlowForge2024!'
        }
    )

    print(f"Success: {result['success']}")
    print(f"Message: {result['message']}")
    if result['success']:
        print(f"Server Version: {result.get('server_version', 'N/A')}")

    return result['success']


def test_list_tables():
    """Test listing tables"""
    print("\n" + "="*60)
    print("TEST 2: List Database Tables")
    print("="*60)

    result = list_database_tables(
        db_type='sql-server',
        connection_config={
            'host': 'localhost',
            'port': 1433,
            'database': 'BFSI_Test',
            'username': 'sa',
            'password': 'FlowForge2024!'
        }
    )

    print(f"Success: {result['success']}")
    print(f"Tables found: {result['count']}")
    for table in result.get('tables', []):
        print(f"  - {table}")

    return result['success']


def test_get_schema():
    """Test getting table schema"""
    print("\n" + "="*60)
    print("TEST 3: Get Table Schema")
    print("="*60)

    result = get_database_schema(
        db_type='sql-server',
        connection_config={
            'host': 'localhost',
            'port': 1433,
            'database': 'BFSI_Test',
            'username': 'sa',
            'password': 'FlowForge2024!'
        },
        table_name='customers'
    )

    print(f"Success: {result['success']}")
    print(f"Table: {result.get('table_name', 'N/A')}")
    print(f"Row Count: {result.get('row_count', 0)}")
    print(f"Columns: {len(result.get('schema', []))}")

    for col in result.get('schema', [])[:5]:
        print(f"  - {col['column_name']}: {col['data_type']}")

    return result['success']


def test_full_ingestion():
    """Test full table ingestion"""
    print("\n" + "="*60)
    print("TEST 4: Full Table Ingestion (Customers)")
    print("="*60)

    batch_id = f"test_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    result = ingest_from_database(
        job_id='test_job_customers',
        source_config={
            'type': 'sql-server',
            'connection': {
                'host': 'localhost',
                'port': 1433,
                'database': 'BFSI_Test',
                'username': 'sa',
                'password': 'FlowForge2024!'
            },
            'databaseConfig': {
                'tableName': 'customers',
                'isIncremental': False
            }
        },
        destination_config={
            'bronzeConfig': {
                'tableName': 'bronze_customers',
                'storageFormat': 'parquet',
                'loadStrategy': 'append',
                'auditColumns': True,
                'compression': 'snappy'
            }
        },
        batch_id=batch_id
    )

    print(f"\nResult Summary:")
    print(f"  Status: {result.get('status', 'unknown')}")
    print(f"  Records: {result.get('records_processed', 0)}")
    print(f"  File Path: {result.get('bronze_file_path', 'N/A')}")
    print(f"  File Size: {result.get('file_size_bytes', 0) / 1024:.2f} KB")
    print(f"  Compression: {result.get('compression', 'N/A')}")

    if result.get('schema'):
        print(f"  Schema columns: {len(result['schema'])}")
        print(f"  First 5 columns:")
        for col in result['schema'][:5]:
            print(f"    - {col['name']}: {col['type']}")

    return result.get('status') == 'success'


def test_accounts_ingestion():
    """Test accounts table ingestion"""
    print("\n" + "="*60)
    print("TEST 5: Full Table Ingestion (Accounts)")
    print("="*60)

    batch_id = f"test_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    result = ingest_from_database(
        job_id='test_job_accounts',
        source_config={
            'type': 'sql-server',
            'connection': {
                'host': 'localhost',
                'port': 1433,
                'database': 'BFSI_Test',
                'username': 'sa',
                'password': 'FlowForge2024!'
            },
            'databaseConfig': {
                'tableName': 'accounts'
            }
        },
        destination_config={
            'bronzeConfig': {
                'tableName': 'bronze_accounts',
                'storageFormat': 'parquet',
                'auditColumns': True,
                'compression': 'snappy'
            }
        },
        batch_id=batch_id
    )

    print(f"\nResult Summary:")
    print(f"  Status: {result.get('status', 'unknown')}")
    print(f"  Records: {result.get('records_processed', 0)}")
    print(f"  File Size: {result.get('file_size_bytes', 0) / 1024:.2f} KB")

    return result.get('status') == 'success'


def test_incremental_load():
    """Test incremental load with watermark"""
    print("\n" + "="*60)
    print("TEST 6: Incremental Load (Customers)")
    print("="*60)

    # Use a past date as watermark to get some records
    watermark = '2024-01-01'
    batch_id = f"test_batch_incr_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    result = ingest_from_database(
        job_id='test_job_customers_incr',
        source_config={
            'type': 'sql-server',
            'connection': {
                'host': 'localhost',
                'port': 1433,
                'database': 'BFSI_Test',
                'username': 'sa',
                'password': 'FlowForge2024!'
            },
            'databaseConfig': {
                'tableName': 'customers',
                'isIncremental': True,
                'deltaColumn': 'modified_date',
                'lastWatermark': watermark
            }
        },
        destination_config={
            'bronzeConfig': {
                'tableName': 'bronze_customers_incr',
                'storageFormat': 'parquet',
                'auditColumns': True,
                'compression': 'snappy'
            }
        },
        batch_id=batch_id
    )

    print(f"\nResult Summary:")
    print(f"  Status: {result.get('status', 'unknown')}")
    print(f"  Records: {result.get('records_processed', 0)}")
    print(f"  Old Watermark: {watermark}")
    print(f"  New Watermark: {result.get('watermark_value', 'N/A')}")
    print(f"  File Size: {result.get('file_size_bytes', 0) / 1024:.2f} KB")

    return result.get('status') == 'success'


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("DATABASE BRONZE TASK - COMPREHENSIVE TEST SUITE")
    print("="*60)

    tests = [
        ("Connection Test", test_connection),
        ("List Tables", test_list_tables),
        ("Get Schema", test_get_schema),
        ("Full Ingestion - Customers", test_full_ingestion),
        ("Full Ingestion - Accounts", test_accounts_ingestion),
        ("Incremental Load", test_incremental_load)
    ]

    results = {}

    for test_name, test_func in tests:
        try:
            success = test_func()
            results[test_name] = "PASS" if success else "FAIL"
        except Exception as e:
            print(f"\nERROR in {test_name}: {e}")
            import traceback
            traceback.print_exc()
            results[test_name] = "ERROR"

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    for test_name, result in results.items():
        status_symbol = "[PASS]" if result == "PASS" else "[FAIL]"
        print(f"{status_symbol} {test_name}: {result}")

    passed = sum(1 for r in results.values() if r == "PASS")
    total = len(results)

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n ALL TESTS PASSED! Database bronze ingestion is working correctly.")
        return 0
    else:
        print(f"\n {total - passed} test(s) failed. Please review errors above.")
        return 1


if __name__ == "__main__":
    exit(main())
