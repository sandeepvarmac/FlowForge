"""
Generate BFSI Demo Dataset for FlowForge
Creates realistic banking data with intentional quality issues for AI detection demo
"""

import random
import datetime
import pandas as pd
from decimal import Decimal
import psycopg2
from faker import Faker

fake = Faker()
Faker.seed(42)  # For reproducibility
random.seed(42)

# Configuration
NUM_TRANSACTIONS = 1000
NUM_PRODUCTS = 50
NUM_CUSTOMERS = 500

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'flowforge',
    'user': 'flowforge',
    'password': 'flowforge123'
}


def generate_transactions():
    """Generate bank transactions with intentional quality issues"""
    transactions = []

    transaction_types = ['Purchase', 'Withdrawal', 'Deposit', 'Transfer', 'Refund']
    transaction_statuses_valid = ['completed', 'pending', 'failed']
    transaction_statuses_invalid = ['COMPLETED', 'unknown', 'processing']
    channels = ['ATM', 'Online', 'Mobile App', 'Branch']
    merchant_categories = ['Grocery', 'Gas Station', 'Restaurant', 'Retail', 'Healthcare', 'Entertainment']

    # Generate base transactions
    for i in range(NUM_TRANSACTIONS):
        transaction_id = f"TXN{i+1:06d}"
        customer_id = f"CUST{random.randint(1, NUM_CUSTOMERS):04d}"
        account_number = f"ACC{random.randint(1000000, 9999999)}"

        # Transaction date (mostly past, some future for quality issues)
        if i < 970:  # 97% valid dates
            days_ago = random.randint(1, 365)
            transaction_date = datetime.datetime.now() - datetime.timedelta(days=days_ago)
        else:  # 3% future dates (quality issue)
            days_future = random.randint(30, 500)
            transaction_date = datetime.datetime.now() + datetime.timedelta(days=days_future)

        transaction_type = random.choice(transaction_types)

        # Amount with outliers
        if i < 950:  # 95% normal amounts
            amount = round(random.uniform(1, 50000), 2)
        elif i < 970:  # 2% very high amounts (outliers)
            amount = round(random.uniform(500000, 10000000), 2)
        else:  # 3% negative amounts (refunds/errors)
            amount = round(random.uniform(-5000, -100), 2)

        # Merchant name with NULLs
        if i < 880:  # 88% have merchant names
            merchant_name = fake.company()
        else:  # 12% NULL merchant names
            merchant_name = None

        merchant_category = random.choice(merchant_categories) if merchant_name else None

        # Transaction status with invalid values
        if i < 980:  # 98% valid status
            transaction_status = random.choice(transaction_statuses_valid)
        else:  # 2% invalid status
            transaction_status = random.choice(transaction_statuses_invalid)

        branch_code = f"BR{random.randint(1, 50):03d}"
        channel = random.choice(channels)

        transactions.append({
            'transaction_id': transaction_id,
            'customer_id': customer_id,
            'account_number': account_number,
            'transaction_date': transaction_date,
            'transaction_type': transaction_type,
            'amount': amount,
            'merchant_name': merchant_name,
            'merchant_category': merchant_category,
            'transaction_status': transaction_status,
            'branch_code': branch_code,
            'channel': channel
        })

    # Add duplicates (5%)
    for i in range(50):
        duplicate_idx = random.randint(0, len(transactions) - 1)
        transactions.append(transactions[duplicate_idx].copy())

    return transactions


def insert_transactions_to_postgres(transactions):
    """Insert transactions into PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Create table
        cursor.execute("""
            DROP TABLE IF EXISTS bank_transactions CASCADE;

            CREATE TABLE bank_transactions (
                transaction_id VARCHAR(50) PRIMARY KEY,
                customer_id VARCHAR(20) NOT NULL,
                account_number VARCHAR(20) NOT NULL,
                transaction_date TIMESTAMP NOT NULL,
                transaction_type VARCHAR(20) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                merchant_name VARCHAR(100),
                merchant_category VARCHAR(50),
                transaction_status VARCHAR(20),
                branch_code VARCHAR(10),
                channel VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Insert data
        for txn in transactions:
            cursor.execute("""
                INSERT INTO bank_transactions
                (transaction_id, customer_id, account_number, transaction_date, transaction_type,
                 amount, merchant_name, merchant_category, transaction_status, branch_code, channel)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (transaction_id) DO NOTHING;
            """, (
                txn['transaction_id'],
                txn['customer_id'],
                txn['account_number'],
                txn['transaction_date'],
                txn['transaction_type'],
                txn['amount'],
                txn['merchant_name'],
                txn['merchant_category'],
                txn['transaction_status'],
                txn['branch_code'],
                txn['channel']
            ))

        conn.commit()
        print(f"SUCCESS: Inserted {len(transactions)} transactions into PostgreSQL")

        # Show statistics
        cursor.execute("SELECT COUNT(*) FROM bank_transactions")
        count = cursor.fetchone()[0]
        print(f"Total records in database: {count}")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"ERROR: Failed to insert transactions: {e}")


def generate_products():
    """Generate product pricing data with quality issues"""
    products = []

    product_categories = {
        'Checking': ['Premier Checking', 'Business Checking', 'Student Checking', 'Basic Checking', 'Senior Checking'],
        'Savings': ['High Yield Savings', 'Business Savings', 'Money Market', 'Kids Savings', 'Emergency Fund'],
        'Credit Card': ['Rewards Card', 'Cashback Card', 'Travel Card', 'Business Card', 'Secured Card'],
        'Loan': ['Personal Loan', 'Auto Loan', 'Home Equity', 'Student Loan', 'Business Loan']
    }

    product_id_counter = 1

    for category, product_types in product_categories.items():
        for i, ptype in enumerate(product_types):
            # Product ID with some missing (4%)
            if product_id_counter <= 48:  # 96% have product IDs
                product_id = f"PROD{product_id_counter:03d}"
            else:  # 4% missing product IDs
                product_id = None

            product_name = f"{ptype} Account" if category in ['Checking', 'Savings'] else ptype

            # Add duplicate product names (4%)
            if product_id_counter in [25, 26]:
                product_name = "Premium Savings Account"

            # Base fee with negative values (6%)
            if product_id_counter < 47:
                base_fee = round(random.uniform(0, 15), 2)
            else:  # 6% negative fees
                base_fee = round(random.uniform(-25, -5), 2)

            transaction_fee = round(random.uniform(0, 2), 2)
            annual_fee = round(random.uniform(0, 150), 2) if category == 'Credit Card' else 0

            # Interest rate with outliers (8%)
            if product_id_counter < 46:
                interest_rate = round(random.uniform(0.01, 5.00), 2)
            else:  # 8% outliers
                outlier_rates = [25.00, 30.00, -1.00, 0.00]
                interest_rate = random.choice(outlier_rates)

            min_balance = round(random.uniform(0, 10000), 2) if category in ['Checking', 'Savings'] else 0

            last_updated = datetime.date(2024, 10, 1)

            products.append({
                'product_id': product_id,
                'product_name': product_name,
                'product_category': category,
                'base_fee': base_fee,
                'transaction_fee': transaction_fee,
                'annual_fee': annual_fee,
                'interest_rate': interest_rate,
                'min_balance': min_balance,
                'last_updated': last_updated
            })

            product_id_counter += 1

    return products


def generate_customers():
    """Generate customer master data with quality issues"""
    customers = []

    customer_segments_valid = ['Premium', 'Standard', 'Basic']
    customer_segments_invalid = ['PREMIUM', 'premium', 'VIP', 'Gold']

    for i in range(NUM_CUSTOMERS):
        customer_id = f"CUST{i+1:04d}"
        first_name = fake.first_name()
        last_name = fake.last_name()

        # Email with validation issues (10%)
        if i < 450:  # 90% valid emails
            email = f"{first_name.lower()}.{last_name.lower()}@email.com"
        else:  # 10% invalid emails
            invalid_patterns = [
                f"{first_name.lower()}@invalid",
                f"badformat{i}",
                f"{first_name.lower()}missing",
                f"{first_name.lower()} @email.com",
                f"{first_name.lower()}@"
            ]
            email = random.choice(invalid_patterns)

        # Phone with format inconsistency (20%)
        phone_base = f"{random.randint(555, 999)}{random.randint(1000000, 9999999)}"
        if i < 400:  # 80% formatted
            phone = f"({phone_base[:3]}) {phone_base[3:6]}-{phone_base[6:]}"
        else:  # 20% inconsistent format
            formats = [
                phone_base,
                f"{phone_base[:3]}-{phone_base[3:6]}-{phone_base[6:]}",
                f"{phone_base[:3]}.{phone_base[3:6]}.{phone_base[6:]}"
            ]
            phone = random.choice(formats)

        # Date of birth with age validation issues (5%)
        if i < 475:  # 95% valid ages (18-90)
            years_ago = random.randint(18, 90)
            date_of_birth = datetime.date.today() - datetime.timedelta(days=years_ago * 365)
        else:  # 5% invalid ages
            invalid_ages = [10, 15, 100, 110, 120]
            years_ago = random.choice(invalid_ages)
            date_of_birth = datetime.date.today() - datetime.timedelta(days=years_ago * 365)

        # Customer segment with enum issues (8%)
        if i < 460:  # 92% valid segments
            customer_segment = random.choice(customer_segments_valid)
        else:  # 8% invalid segments
            customer_segment = random.choice(customer_segments_invalid)

        # Account since date
        years_ago = random.randint(1, 10)
        account_since = datetime.date.today() - datetime.timedelta(days=years_ago * 365)

        credit_score = random.randint(300, 850)
        city = fake.city()
        state = fake.state_abbr()
        zip_code = fake.zipcode()

        customers.append({
            'customer_id': customer_id,
            'first_name': first_name,
            'last_name': last_name,
            'email': email,
            'phone': phone,
            'date_of_birth': date_of_birth,
            'customer_segment': customer_segment,
            'account_since': account_since,
            'credit_score': credit_score,
            'city': city,
            'state': state,
            'zip_code': zip_code
        })

    return customers


def save_to_csv(data, filename):
    """Save data to CSV file"""
    import os
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    df = pd.DataFrame(data)
    df.to_csv(filename, index=False)
    print(f"SUCCESS: Saved {len(data)} records to {filename}")


def main():
    """Main function to generate all BFSI demo data"""
    print("=" * 60)
    print("FlowForge BFSI Demo Dataset Generator")
    print("=" * 60)
    print()

    # Generate transactions and insert to PostgreSQL
    print("[1/3] Generating bank transactions...")
    transactions = generate_transactions()
    insert_transactions_to_postgres(transactions)
    print()

    # Generate products and save to CSV
    print("[2/3] Generating product pricing data...")
    products = generate_products()
    save_to_csv(products, 'sample-data/bfsi/bank_product_pricing_2024Q4.csv')
    print()

    # Generate customers and save to CSV
    print("[3/3] Generating customer master data...")
    customers = generate_customers()
    save_to_csv(customers, 'sample-data/bfsi/customer_master_data.csv')
    print()

    print("=" * 60)
    print("SUCCESS: BFSI Demo Dataset Generation Complete!")
    print("=" * 60)
    print()
    print("Files created:")
    print("  - PostgreSQL: bank_transactions table (1,000 records)")
    print("  - CSV: bank_product_pricing_2024Q4.csv (50 records)")
    print("  - CSV: customer_master_data.csv (500 records)")
    print()
    print("Data quality issues intentionally included for AI demo:")
    print("  - Email format issues: 8-10%")
    print("  - Amount outliers: 5%")
    print("  - NULL values: 12%")
    print("  - Enum inconsistencies: 2-8%")
    print("  - Future dates: 3%")
    print("  - Duplicates: 5%")
    print("  - Negative fees: 6%")
    print("  - Interest rate outliers: 8%")
    print()


if __name__ == "__main__":
    main()
