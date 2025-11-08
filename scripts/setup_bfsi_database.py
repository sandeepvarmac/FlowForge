"""
BFSI Sample Database Setup Script
Creates SQL Server database with realistic banking data for FlowForge testing.

Database: BFSI_Test
Tables: customers (500), accounts (750), transactions (5000)
"""

import pymssql
import random
from datetime import datetime, timedelta
from decimal import Decimal

# Connection configuration
HOST = 'localhost'
PORT = 1433
USER = 'sa'
PASSWORD = 'FlowForge2024!'

# Sample data for realistic generation
FIRST_NAMES = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Barbara', 'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa',
    'Edward', 'Deborah', 'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon',
    'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
    'Nicholas', 'Shirley', 'Eric', 'Angela', 'Jonathan', 'Helen', 'Stephen', 'Anna',
    'Larry', 'Brenda', 'Justin', 'Pamela', 'Scott', 'Nicole', 'Brandon', 'Emma'
]

LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
    'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
    'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
    'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
    'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson'
]

CITIES = [
    ('New York', 'NY', '10001'), ('Los Angeles', 'CA', '90001'), ('Chicago', 'IL', '60601'),
    ('Houston', 'TX', '77001'), ('Phoenix', 'AZ', '85001'), ('Philadelphia', 'PA', '19019'),
    ('San Antonio', 'TX', '78201'), ('San Diego', 'CA', '92101'), ('Dallas', 'TX', '75201'),
    ('San Jose', 'CA', '95101'), ('Austin', 'TX', '78701'), ('Jacksonville', 'FL', '32099'),
    ('Fort Worth', 'TX', '76101'), ('Columbus', 'OH', '43004'), ('San Francisco', 'CA', '94102'),
    ('Charlotte', 'NC', '28201'), ('Indianapolis', 'IN', '46201'), ('Seattle', 'WA', '98101'),
    ('Denver', 'CO', '80201'), ('Boston', 'MA', '02101')
]

MERCHANTS = [
    ('Walmart', 'Retail'), ('Amazon', 'E-commerce'), ('Target', 'Retail'),
    ('Starbucks', 'Food & Beverage'), ('McDonalds', 'Food & Beverage'),
    ('Whole Foods', 'Grocery'), ('Shell', 'Gas'), ('BP', 'Gas'),
    ('ATM Withdrawal', 'ATM'), ('Online Transfer', 'Transfer'), ('Direct Deposit', 'Deposit'),
    ('Check Deposit', 'Deposit'), ('Wire Transfer', 'Transfer'), ('Apple Store', 'Electronics'),
    ('Best Buy', 'Electronics'), ('Home Depot', 'Home Improvement'), ('Costco', 'Wholesale'),
    ('CVS Pharmacy', 'Healthcare'), ('Walgreens', 'Healthcare'), ('Uber', 'Transportation'),
    ('Lyft', 'Transportation'), ('Netflix', 'Entertainment'), ('Spotify', 'Entertainment'),
    ('Electric Company', 'Utilities'), ('Water Company', 'Utilities'), ('Gas Company', 'Utilities'),
    ('Internet Provider', 'Utilities'), ('Mobile Carrier', 'Telecom'), ('Insurance Payment', 'Insurance'),
    ('Mortgage Payment', 'Housing')
]

def create_connection(database=None):
    """Create connection to SQL Server"""
    try:
        conn = pymssql.connect(
            server=HOST,
            port=PORT,
            user=USER,
            password=PASSWORD,
            database=database
        )
        print(f" Connected to SQL Server{' - Database: ' + database if database else ''}")
        return conn
    except Exception as e:
        print(f" Connection failed: {e}")
        raise

def create_database():
    """Create BFSI_Test database"""
    conn = create_connection()
    conn.autocommit(True)  # Required for CREATE DATABASE
    cursor = conn.cursor()

    try:
        # Drop database if exists
        cursor.execute("IF EXISTS (SELECT name FROM sys.databases WHERE name = 'BFSI_Test') DROP DATABASE BFSI_Test")

        # Create database
        cursor.execute("CREATE DATABASE BFSI_Test")
        print(" Database BFSI_Test created successfully")

    except Exception as e:
        print(f" Database creation failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def create_tables():
    """Create tables in BFSI_Test database"""
    conn = create_connection('BFSI_Test')
    cursor = conn.cursor()

    try:
        # Customers table
        cursor.execute("""
        CREATE TABLE customers (
            customer_id INT PRIMARY KEY IDENTITY(1,1),
            first_name NVARCHAR(50) NOT NULL,
            last_name NVARCHAR(50) NOT NULL,
            email NVARCHAR(100) NOT NULL,
            phone NVARCHAR(20),
            date_of_birth DATE,
            ssn_last4 NCHAR(4),
            address NVARCHAR(200),
            city NVARCHAR(50),
            state NCHAR(2),
            zip_code NVARCHAR(10),
            account_open_date DATE NOT NULL,
            customer_segment NVARCHAR(20) NOT NULL,
            credit_score INT,
            annual_income DECIMAL(15,2),
            modified_date DATETIME DEFAULT GETDATE()
        )
        """)
        print(" Created table: customers")

        # Accounts table
        cursor.execute("""
        CREATE TABLE accounts (
            account_id INT PRIMARY KEY IDENTITY(1001,1),
            customer_id INT NOT NULL,
            account_type NVARCHAR(20) NOT NULL,
            balance DECIMAL(15,2) NOT NULL,
            credit_limit DECIMAL(15,2),
            interest_rate DECIMAL(5,2),
            open_date DATE NOT NULL,
            status NVARCHAR(20) NOT NULL,
            last_transaction_date DATE,
            modified_date DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        )
        """)
        print(" Created table: accounts")

        # Transactions table
        cursor.execute("""
        CREATE TABLE transactions (
            transaction_id INT PRIMARY KEY IDENTITY(10001,1),
            account_id INT NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            transaction_date DATE NOT NULL,
            transaction_time TIME NOT NULL,
            transaction_type NVARCHAR(10) NOT NULL,
            category NVARCHAR(50),
            merchant NVARCHAR(100),
            merchant_category NVARCHAR(50),
            location NVARCHAR(100),
            status NVARCHAR(20) NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(account_id)
        )
        """)
        print(" Created table: transactions")

        conn.commit()
        print(" All tables created successfully")

    except Exception as e:
        print(f" Table creation failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def generate_customers(num_customers=500):
    """Generate sample customer data"""
    conn = create_connection('BFSI_Test')
    cursor = conn.cursor()

    print(f" Generating {num_customers} customers...")

    # Define distribution
    segments = ['retail'] * 300 + ['corporate'] * 150 + ['wealth'] * 50
    random.shuffle(segments)

    try:
        for i in range(num_customers):
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            email = f"{first_name.lower()}.{last_name.lower()}@email.com"
            phone = f"+1-555-{random.randint(100,999)}-{random.randint(1000,9999)}"

            # Date of birth (25-75 years old)
            age = random.randint(25, 75)
            dob = datetime.now() - timedelta(days=age*365)

            ssn_last4 = f"{random.randint(0,9999):04d}"

            city, state, zip_code = random.choice(CITIES)
            address = f"{random.randint(100,9999)} {random.choice(['Main', 'Oak', 'Maple', 'Cedar', 'Elm', 'Park', 'Washington'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr', 'Ln'])}"

            # Account open date (last 4 years)
            days_ago = random.randint(0, 1460)
            account_open_date = datetime.now() - timedelta(days=days_ago)

            segment = segments[i]

            # Credit score and income based on segment
            if segment == 'retail':
                credit_score = random.randint(580, 750)
                annual_income = Decimal(random.randint(30000, 80000))
            elif segment == 'corporate':
                credit_score = random.randint(680, 800)
                annual_income = Decimal(random.randint(75000, 200000))
            else:  # wealth
                credit_score = random.randint(750, 850)
                annual_income = Decimal(random.randint(200000, 1000000))

            modified_date = datetime.now() - timedelta(days=random.randint(0, 30))

            cursor.execute("""
            INSERT INTO customers (
                first_name, last_name, email, phone, date_of_birth, ssn_last4,
                address, city, state, zip_code, account_open_date, customer_segment,
                credit_score, annual_income, modified_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                first_name, last_name, email, phone, dob.date(), ssn_last4,
                address, city, state, zip_code, account_open_date.date(), segment,
                credit_score, annual_income, modified_date
            ))

            if (i + 1) % 100 == 0:
                print(f"   Inserted {i + 1}/{num_customers} customers...")
                conn.commit()

        conn.commit()
        print(f" Successfully inserted {num_customers} customers")

    except Exception as e:
        print(f" Customer data insertion failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def generate_accounts(num_accounts=750):
    """Generate sample account data"""
    conn = create_connection('BFSI_Test')
    cursor = conn.cursor()

    print(f" Generating {num_accounts} accounts...")

    # Get all customer IDs
    cursor.execute("SELECT customer_id, customer_segment FROM customers")
    customers = cursor.fetchall()

    account_types = ['checking', 'savings', 'credit', 'loan']

    try:
        accounts_created = 0
        for _ in range(num_accounts):
            customer_id, segment = random.choice(customers)

            # Account type probabilities based on segment
            if segment == 'retail':
                account_type = random.choice(['checking'] * 4 + ['savings'] * 3 + ['credit'] * 2 + ['loan'])
            elif segment == 'corporate':
                account_type = random.choice(['checking'] * 3 + ['savings'] * 4 + ['credit'] * 2 + ['loan'])
            else:  # wealth
                account_type = random.choice(['checking'] * 2 + ['savings'] * 5 + ['credit'] + ['loan'])

            # Balance based on account type and segment
            if account_type == 'checking':
                balance = Decimal(str(round(random.uniform(500, 50000), 2)))
            elif account_type == 'savings':
                balance = Decimal(str(round(random.uniform(1000, 100000), 2)))
            elif account_type == 'credit':
                balance = Decimal(str(round(random.uniform(0, 15000), 2)))  # Outstanding balance
            else:  # loan
                balance = Decimal(str(round(random.uniform(5000, 200000), 2)))  # Loan amount

            # Credit limit for credit accounts
            credit_limit = Decimal(str(round(random.uniform(5000, 25000), 2))) if account_type == 'credit' else None

            # Interest rate
            if account_type == 'savings':
                interest_rate = Decimal(str(round(random.uniform(0.5, 3.5), 2)))
            elif account_type == 'credit':
                interest_rate = Decimal(str(round(random.uniform(12.99, 24.99), 2)))
            elif account_type == 'loan':
                interest_rate = Decimal(str(round(random.uniform(3.5, 8.5), 2)))
            else:
                interest_rate = None

            # Open date (within last 3 years)
            days_ago = random.randint(0, 1095)
            open_date = datetime.now() - timedelta(days=days_ago)

            # Status
            status = random.choice(['active'] * 90 + ['closed'] * 5 + ['suspended'] * 5)

            # Last transaction date (within last 90 days for active accounts)
            if status == 'active':
                last_trans_days = random.randint(0, 90)
                last_transaction_date = datetime.now() - timedelta(days=last_trans_days)
            else:
                last_transaction_date = open_date + timedelta(days=random.randint(30, 365))

            modified_date = datetime.now() - timedelta(days=random.randint(0, 15))

            cursor.execute("""
            INSERT INTO accounts (
                customer_id, account_type, balance, credit_limit, interest_rate,
                open_date, status, last_transaction_date, modified_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                customer_id, account_type, balance, credit_limit, interest_rate,
                open_date.date(), status, last_transaction_date.date(), modified_date
            ))

            accounts_created += 1
            if accounts_created % 100 == 0:
                print(f"   Inserted {accounts_created}/{num_accounts} accounts...")
                conn.commit()

        conn.commit()
        print(f" Successfully inserted {num_accounts} accounts")

    except Exception as e:
        print(f" Account data insertion failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def generate_transactions(num_transactions=5000):
    """Generate sample transaction data"""
    conn = create_connection('BFSI_Test')
    cursor = conn.cursor()

    print(f" Generating {num_transactions} transactions...")

    # Get active account IDs
    cursor.execute("SELECT account_id, account_type FROM accounts WHERE status = 'active'")
    accounts = cursor.fetchall()

    try:
        for i in range(num_transactions):
            account_id, account_type = random.choice(accounts)

            # Transaction amount based on account type
            if account_type in ['checking', 'savings']:
                # Mix of debits and credits
                transaction_type = random.choice(['debit'] * 6 + ['credit'] * 4)
                if transaction_type == 'debit':
                    amount = Decimal(str(round(-1 * random.uniform(5, 500), 2)))
                else:
                    amount = Decimal(str(round(random.uniform(100, 5000), 2)))
            elif account_type == 'credit':
                # Mostly charges, some payments
                transaction_type = random.choice(['debit'] * 7 + ['credit'] * 3)
                if transaction_type == 'debit':
                    amount = Decimal(str(round(-1 * random.uniform(10, 300), 2)))
                else:
                    amount = Decimal(str(round(random.uniform(50, 1000), 2)))
            else:  # loan
                # Mostly payments
                transaction_type = 'credit'
                amount = Decimal(str(round(random.uniform(200, 2000), 2)))

            # Transaction date (last 90 days)
            days_ago = random.randint(0, 90)
            transaction_date = datetime.now() - timedelta(days=days_ago)
            transaction_time = datetime.now().replace(
                hour=random.randint(0, 23),
                minute=random.randint(0, 59),
                second=random.randint(0, 59)
            ).time()

            # Merchant and category
            merchant, merchant_category = random.choice(MERCHANTS)

            # Location
            city, state, zip_code = random.choice(CITIES)
            location = f"{city}, {state}"

            # Status
            status = random.choice(['completed'] * 95 + ['pending'] * 4 + ['failed'])

            cursor.execute("""
            INSERT INTO transactions (
                account_id, amount, transaction_date, transaction_time, transaction_type,
                category, merchant, merchant_category, location, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                account_id, amount, transaction_date.date(), transaction_time, transaction_type,
                merchant_category, merchant, merchant_category, location, status
            ))

            if (i + 1) % 500 == 0:
                print(f"   Inserted {i + 1}/{num_transactions} transactions...")
                conn.commit()

        conn.commit()
        print(f" Successfully inserted {num_transactions} transactions")

    except Exception as e:
        print(f" Transaction data insertion failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def verify_data():
    """Verify data was inserted correctly"""
    conn = create_connection('BFSI_Test')
    cursor = conn.cursor()

    print("\n Data Verification:")
    print("=" * 60)

    try:
        # Count customers
        cursor.execute("SELECT COUNT(*) FROM customers")
        customer_count = cursor.fetchone()[0]
        print(f" Customers: {customer_count}")

        # Count accounts
        cursor.execute("SELECT COUNT(*) FROM accounts")
        account_count = cursor.fetchone()[0]
        print(f" Accounts: {account_count}")

        # Count transactions
        cursor.execute("SELECT COUNT(*) FROM transactions")
        transaction_count = cursor.fetchone()[0]
        print(f" Transactions: {transaction_count}")

        # Sample customer
        cursor.execute("SELECT TOP 1 * FROM customers")
        customer = cursor.fetchone()
        print(f"\n Sample Customer:")
        print(f"   ID: {customer[0]}, Name: {customer[1]} {customer[2]}, Email: {customer[3]}")

        # Sample account
        cursor.execute("SELECT TOP 1 * FROM accounts")
        account = cursor.fetchone()
        print(f"\n Sample Account:")
        print(f"   ID: {account[0]}, Type: {account[2]}, Balance: ${account[3]:,.2f}")

        # Sample transaction
        cursor.execute("SELECT TOP 1 * FROM transactions")
        transaction = cursor.fetchone()
        print(f"\n Sample Transaction:")
        print(f"   ID: {transaction[0]}, Amount: ${transaction[2]:,.2f}, Merchant: {transaction[7]}")

        print("\n" + "=" * 60)
        print(" BFSI_Test database setup complete!\n")

    except Exception as e:
        print(f" Verification failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def main():
    """Main execution"""
    print("\n" + "=" * 60)
    print("BFSI Sample Database Setup")
    print("=" * 60 + "\n")

    try:
        print("Step 1: Creating database...")
        create_database()

        print("\nStep 2: Creating tables...")
        create_tables()

        print("\nStep 3: Generating customer data...")
        generate_customers(500)

        print("\nStep 4: Generating account data...")
        generate_accounts(750)

        print("\nStep 5: Generating transaction data...")
        generate_transactions(5000)

        print("\nStep 6: Verifying data...")
        verify_data()

        print(" SUCCESS! BFSI_Test database is ready for FlowForge testing.\n")
        print("Connection Details:")
        print(f"  Host: {HOST}")
        print(f"  Port: {PORT}")
        print(f"  Database: BFSI_Test")
        print(f"  Username: {USER}")
        print(f"  Password: {PASSWORD}\n")

    except Exception as e:
        print(f"\n Setup failed: {e}")
        return 1

    return 0

if __name__ == "__main__":
    exit(main())

