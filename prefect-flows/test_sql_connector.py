"""
Test script for SQL Server connector
"""

from utils.database_connectors import SQLServerConnector

def main():
    print("\n" + "=" * 60)
    print("Testing SQL Server Connector")
    print("=" * 60 + "\n")

    # Initialize connector
    connector = SQLServerConnector(
        host='localhost',
        port=1433,
        database='BFSI_Test',
        username='sa',
        password='FlowForge2024!'
    )

    # Test 1: Connection
    print("Test 1: Testing connection...")
    result = connector.test_connection()
    print(f"  Success: {result['success']}")
    print(f"  Message: {result['message']}")
    if result['success']:
        print(f"  Version: {result['server_version']}")
    print()

    if not result['success']:
        print("Connection failed. Exiting.")
        return

    # Test 2: List tables
    print("Test 2: Listing tables...")
    tables = connector.list_tables()
    print(f"  Found {len(tables)} tables:")
    for table in tables:
        print(f"    - {table}")
    print()

    # Test 3: Get schema
    print("Test 3: Getting schema for 'customers' table...")
    schema = connector.get_schema('customers')
    print(f"  Found {len(schema)} columns:")
    for col in schema[:5]:  # Show first 5
        print(f"    - {col['column_name']}: {col['data_type']}")
    print(f"    ... ({len(schema) - 5} more columns)")
    print()

    # Test 4: Get row count
    print("Test 4: Getting row count...")
    count = connector.get_row_count('customers')
    print(f"  Total customers: {count}")
    print()

    # Test 5: Preview data
    print("Test 5: Previewing first 5 rows...")
    rows = connector.preview_data('customers', limit=5)
    for i, row in enumerate(rows, 1):
        print(f"  Row {i}: {row['first_name']} {row['last_name']} - {row['email']}")
    print()

    # Test 6: Read full table as Arrow
    print("Test 6: Reading full table as Arrow Table...")
    arrow_table = connector.read_table('customers')
    print(f"  Arrow Table Shape: {arrow_table.num_rows} rows x {arrow_table.num_columns} columns")
    print(f"  Column Names: {arrow_table.column_names[:5]}...")
    print(f"  Memory Size: {arrow_table.nbytes / 1024:.2f} KB")
    print()

    # Test 7: Incremental load simulation
    print("Test 7: Testing incremental load...")
    # Get the oldest modified_date as baseline
    arrow_table_incremental = connector.read_query(
        "SELECT TOP 10 * FROM customers ORDER BY modified_date DESC"
    )
    print(f"  Retrieved {arrow_table_incremental.num_rows} most recent records")
    print()

    print("=" * 60)
    print("All tests completed successfully!")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
