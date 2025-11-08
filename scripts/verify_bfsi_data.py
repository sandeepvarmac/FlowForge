"""
Quick script to verify BFSI database data and run sample queries
"""

import pymssql

HOST = 'localhost'
PORT = 1433
USER = 'sa'
PASSWORD = 'FlowForge2024!'
DATABASE = 'BFSI_Test'

def run_queries():
    """Run sample BFSI queries"""
    conn = pymssql.connect(server=HOST, port=PORT, user=USER, password=PASSWORD, database=DATABASE)
    cursor = conn.cursor()

    print("\n" + "=" * 60)
    print("BFSI Database Verification Queries")
    print("=" * 60 + "\n")

    # Query 1: Customer summary by segment
    print("1. Customer Summary by Segment:")
    print("-" * 60)
    cursor.execute("""
    SELECT
        customer_segment,
        COUNT(*) as customer_count,
        AVG(credit_score) as avg_credit_score,
        AVG(annual_income) as avg_annual_income
    FROM customers
    GROUP BY customer_segment
    ORDER BY customer_count DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]:12} | Customers: {row[1]:3} | Avg Credit: {row[2]:.0f} | Avg Income: ${row[3]:,.2f}")

    # Query 2: Account summary by type
    print("\n2. Account Summary by Type:")
    print("-" * 60)
    cursor.execute("""
    SELECT
        account_type,
        COUNT(*) as account_count,
        SUM(balance) as total_balance,
        AVG(balance) as avg_balance
    FROM accounts
    WHERE status = 'active'
    GROUP BY account_type
    ORDER BY account_count DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]:10} | Accounts: {row[1]:3} | Total: ${row[2]:,.2f} | Avg: ${row[3]:,.2f}")

    # Query 3: Transaction summary
    print("\n3. Transaction Summary (Last 30 Days):")
    print("-" * 60)
    cursor.execute("""
    SELECT
        transaction_type,
        COUNT(*) as txn_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
    FROM transactions
    WHERE transaction_date >= DATEADD(day, -30, GETDATE())
    GROUP BY transaction_type
    ORDER BY txn_count DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]:6} | Count: {row[1]:4} | Total: ${row[2]:,.2f} | Avg: ${row[3]:,.2f}")

    # Query 4: Top merchants
    print("\n4. Top 10 Merchants by Transaction Count:")
    print("-" * 60)
    cursor.execute("""
    SELECT TOP 10
        merchant,
        merchant_category,
        COUNT(*) as txn_count,
        SUM(amount) as total_amount
    FROM transactions
    GROUP BY merchant, merchant_category
    ORDER BY txn_count DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]:25} | {row[1]:20} | Txns: {row[2]:3} | Total: ${row[3]:,.2f}")

    # Query 5: Customer 360 sample
    print("\n5. Customer 360 Sample (First 5 Customers):")
    print("-" * 60)
    cursor.execute("""
    SELECT TOP 5
        c.customer_id,
        c.first_name + ' ' + c.last_name as customer_name,
        c.customer_segment,
        COUNT(DISTINCT a.account_id) as num_accounts,
        SUM(a.balance) as total_balance,
        COUNT(DISTINCT t.transaction_id) as num_transactions
    FROM customers c
    LEFT JOIN accounts a ON c.customer_id = a.customer_id
    LEFT JOIN transactions t ON a.account_id = t.account_id
    GROUP BY c.customer_id, c.first_name, c.last_name, c.customer_segment
    ORDER BY num_transactions DESC
    """)
    for row in cursor.fetchall():
        print(f"   ID: {row[0]:3} | {row[1]:25} | {row[2]:10} | Accounts: {row[3]:2} | Balance: ${row[4] or 0:,.2f} | Txns: {row[5]}")

    print("\n" + "=" * 60)
    print("Verification Complete!")
    print("=" * 60 + "\n")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    try:
        run_queries()
    except Exception as e:
        print(f"Error: {e}")
