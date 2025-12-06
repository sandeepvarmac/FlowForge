"""
Generate realistic Finance/Lending demo data for FlowForge demo.
Creates:
- PostgreSQL tables: customers, loan_applications, credit_scores
- CSV files: loan_payments.csv, property_valuations.csv
"""

import csv
import random
import string
from datetime import datetime, timedelta
from decimal import Decimal
import os

# Seed for reproducibility
random.seed(42)

# Configuration
NUM_CUSTOMERS = 5000
NUM_LOAN_APPLICATIONS = 10000
NUM_PAYMENTS = 10000
NUM_PROPERTY_VALUATIONS = 3000

# Sample data pools
FIRST_NAMES = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
    "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell"
]

CITIES = [
    ("New York", "NY", "10001"), ("Los Angeles", "CA", "90001"), ("Chicago", "IL", "60601"),
    ("Houston", "TX", "77001"), ("Phoenix", "AZ", "85001"), ("Philadelphia", "PA", "19101"),
    ("San Antonio", "TX", "78201"), ("San Diego", "CA", "92101"), ("Dallas", "TX", "75201"),
    ("San Jose", "CA", "95101"), ("Austin", "TX", "78701"), ("Jacksonville", "FL", "32201"),
    ("Fort Worth", "TX", "76101"), ("Columbus", "OH", "43201"), ("Charlotte", "NC", "28201"),
    ("Seattle", "WA", "98101"), ("Denver", "CO", "80201"), ("Boston", "MA", "02101"),
    ("Nashville", "TN", "37201"), ("Portland", "OR", "97201"), ("Miami", "FL", "33101"),
    ("Atlanta", "GA", "30301"), ("Las Vegas", "NV", "89101"), ("Detroit", "MI", "48201")
]

LOAN_PURPOSES = [
    "Home Purchase", "Home Refinance", "Home Equity", "Auto Purchase", "Auto Refinance",
    "Personal", "Debt Consolidation", "Business", "Education", "Medical"
]

LOAN_STATUSES = ["Pending", "Approved", "Funded", "Rejected", "Withdrawn"]

EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Self-employed", "Contractor", "Retired", "Unemployed"]

PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial"]


def generate_ssn():
    """Generate a fake SSN (XXX-XX-XXXX format)"""
    return f"{random.randint(100,999)}-{random.randint(10,99)}-{random.randint(1000,9999)}"


def generate_phone():
    """Generate a fake phone number"""
    return f"({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}"


def generate_email(first_name, last_name):
    """Generate email from name"""
    domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com"]
    return f"{first_name.lower()}.{last_name.lower()}{random.randint(1,99)}@{random.choice(domains)}"


def random_date(start_year, end_year):
    """Generate random date between years"""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    random_days = random.randint(0, delta.days)
    return start + timedelta(days=random_days)


def generate_customers():
    """Generate customer records"""
    customers = []
    for i in range(1, NUM_CUSTOMERS + 1):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        city, state, zip_code = random.choice(CITIES)

        customer = {
            "customer_id": f"CUST{i:06d}",
            "first_name": first_name,
            "last_name": last_name,
            "email": generate_email(first_name, last_name),
            "phone": generate_phone(),
            "ssn": generate_ssn(),
            "date_of_birth": random_date(1950, 2000).strftime("%Y-%m-%d"),
            "address": f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Park', 'Lake', 'Hill', 'River'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Rd'])}",
            "city": city,
            "state": state,
            "zip_code": zip_code,
            "employment_type": random.choice(EMPLOYMENT_TYPES),
            "annual_income": round(random.uniform(25000, 500000), 2),
            "created_date": random_date(2020, 2024).strftime("%Y-%m-%d"),
            "is_active": random.choice([True, True, True, True, False])  # 80% active
        }
        customers.append(customer)
    return customers


def generate_credit_scores(customers):
    """Generate credit score records for customers"""
    credit_scores = []
    for customer in customers:
        # Some variation in credit scores
        base_score = random.randint(300, 850)

        credit = {
            "credit_score_id": f"CS{customer['customer_id'][4:]}",
            "customer_id": customer["customer_id"],
            "credit_score": base_score,
            "credit_bureau": random.choice(["Equifax", "Experian", "TransUnion"]),
            "num_tradelines": random.randint(1, 30),
            "total_debt": round(random.uniform(0, 500000), 2),
            "available_credit": round(random.uniform(0, 100000), 2),
            "utilization_rate": round(random.uniform(0, 1), 2),
            "num_inquiries_6mo": random.randint(0, 10),
            "num_delinquencies": random.randint(0, 5),
            "bankruptcy_flag": random.choice([False, False, False, False, False, False, False, False, False, True]),  # 10%
            "score_date": random_date(2023, 2024).strftime("%Y-%m-%d")
        }
        credit_scores.append(credit)
    return credit_scores


def generate_loan_applications(customers):
    """Generate loan application records"""
    applications = []
    for i in range(1, NUM_LOAN_APPLICATIONS + 1):
        customer = random.choice(customers)
        loan_purpose = random.choice(LOAN_PURPOSES)

        # Loan amount varies by purpose
        if loan_purpose in ["Home Purchase", "Home Refinance"]:
            loan_amount = round(random.uniform(100000, 2000000), 2)
        elif loan_purpose in ["Auto Purchase", "Auto Refinance"]:
            loan_amount = round(random.uniform(10000, 80000), 2)
        elif loan_purpose == "Business":
            loan_amount = round(random.uniform(25000, 500000), 2)
        else:
            loan_amount = round(random.uniform(5000, 100000), 2)

        # Interest rate varies by loan type and amount
        base_rate = random.uniform(0.03, 0.15)

        application = {
            "loan_id": f"LOAN{i:07d}",
            "customer_id": customer["customer_id"],
            "loan_purpose": loan_purpose,
            "loan_amount": loan_amount,
            "interest_rate": round(base_rate, 4),
            "term_months": random.choice([12, 24, 36, 48, 60, 84, 120, 180, 240, 360]),
            "application_date": random_date(2022, 2024).strftime("%Y-%m-%d"),
            "status": random.choice(LOAN_STATUSES),
            "debt_to_income_ratio": round(random.uniform(0.1, 0.6), 2),
            "loan_to_value_ratio": round(random.uniform(0.5, 0.95), 2) if loan_purpose.startswith("Home") else None,
            "co_borrower_flag": random.choice([True, False, False, False]),  # 25%
            "property_type": random.choice(PROPERTY_TYPES) if loan_purpose.startswith("Home") else None,
            "underwriter_notes": random.choice([None, None, None, "Needs additional documentation", "Income verification required", "Excellent credit history"])
        }
        applications.append(application)
    return applications


def generate_loan_payments(applications):
    """Generate loan payment records (CSV file)"""
    payments = []
    # Only generate payments for funded loans
    funded_loans = [app for app in applications if app["status"] == "Funded"]

    for i in range(1, NUM_PAYMENTS + 1):
        loan = random.choice(funded_loans)
        payment_date = random_date(2023, 2024)

        # Calculate expected payment
        monthly_payment = loan["loan_amount"] * (loan["interest_rate"] / 12) / (1 - (1 + loan["interest_rate"] / 12) ** -loan["term_months"])

        # Add some variation - some late, some partial, some extra
        payment_status = random.choices(
            ["On-Time", "Late", "Partial", "Extra", "Missed"],
            weights=[70, 15, 5, 5, 5]
        )[0]

        if payment_status == "Partial":
            amount_paid = round(monthly_payment * random.uniform(0.3, 0.9), 2)
        elif payment_status == "Extra":
            amount_paid = round(monthly_payment * random.uniform(1.1, 2.0), 2)
        elif payment_status == "Missed":
            amount_paid = 0
        else:
            amount_paid = round(monthly_payment, 2)

        payment = {
            "payment_id": f"PAY{i:08d}",
            "loan_id": loan["loan_id"],
            "payment_date": payment_date.strftime("%Y-%m-%d"),
            "due_date": (payment_date - timedelta(days=random.randint(-5, 30))).strftime("%Y-%m-%d"),
            "amount_due": round(monthly_payment, 2),
            "amount_paid": amount_paid,
            "principal_amount": round(amount_paid * 0.6, 2),
            "interest_amount": round(amount_paid * 0.4, 2),
            "payment_status": payment_status,
            "payment_method": random.choice(["ACH", "Check", "Wire", "Online", "Auto-Pay"]),
            "days_past_due": max(0, random.randint(-5, 30)) if payment_status == "Late" else 0
        }
        payments.append(payment)
    return payments


def generate_property_valuations(applications):
    """Generate property valuation records (CSV file)"""
    valuations = []
    # Only for home loans
    home_loans = [app for app in applications if app["loan_purpose"].startswith("Home") and app["property_type"]]

    for i in range(1, min(NUM_PROPERTY_VALUATIONS + 1, len(home_loans) + 1)):
        loan = home_loans[i - 1] if i <= len(home_loans) else random.choice(home_loans)

        # Property value should be reasonable relative to loan amount
        base_value = loan["loan_amount"] / (loan["loan_to_value_ratio"] or 0.8)

        valuation = {
            "valuation_id": f"VAL{i:06d}",
            "loan_id": loan["loan_id"],
            "property_address": f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Maple', 'Cedar', 'Pine'])} {random.choice(['St', 'Ave', 'Blvd'])}",
            "property_type": loan["property_type"],
            "appraised_value": round(base_value * random.uniform(0.95, 1.1), 2),
            "assessed_value": round(base_value * random.uniform(0.7, 0.9), 2),
            "square_footage": random.randint(800, 5000),
            "year_built": random.randint(1950, 2023),
            "bedrooms": random.randint(1, 6),
            "bathrooms": round(random.uniform(1, 4), 1),
            "appraisal_date": random_date(2023, 2024).strftime("%Y-%m-%d"),
            "appraiser_name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "appraisal_company": random.choice(["National Appraisal Co", "Metro Valuations", "Premier Appraisers", "Quality Assessment LLC", "Accurate Appraisals Inc"])
        }
        valuations.append(valuation)
    return valuations


def save_to_csv(data, filepath, fieldnames):
    """Save data to CSV file"""
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    print(f"Created: {filepath} ({len(data)} rows)")


def generate_sql_inserts(table_name, data, filepath):
    """Generate SQL INSERT statements"""
    if not data:
        return

    columns = list(data[0].keys())

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"-- {table_name} table data\n")
        f.write(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        # Create table DDL
        f.write(f"DROP TABLE IF EXISTS {table_name} CASCADE;\n")
        f.write(f"CREATE TABLE {table_name} (\n")

        # Infer column types
        col_defs = []
        for col in columns:
            sample_val = data[0][col]
            if col.endswith('_id'):
                col_defs.append(f"    {col} VARCHAR(50) PRIMARY KEY" if col == columns[0] else f"    {col} VARCHAR(50)")
            elif col.endswith('_date') or col == 'date_of_birth':
                col_defs.append(f"    {col} DATE")
            elif col.endswith('_flag') or col == 'is_active':
                col_defs.append(f"    {col} BOOLEAN")
            elif isinstance(sample_val, bool):
                col_defs.append(f"    {col} BOOLEAN")
            elif isinstance(sample_val, float) or (isinstance(sample_val, str) and '.' in str(sample_val) and sample_val.replace('.','').replace('-','').isdigit()):
                col_defs.append(f"    {col} DECIMAL(15,2)")
            elif isinstance(sample_val, int) or (isinstance(sample_val, str) and sample_val.isdigit()):
                col_defs.append(f"    {col} INTEGER")
            else:
                col_defs.append(f"    {col} VARCHAR(255)")

        f.write(",\n".join(col_defs))
        f.write("\n);\n\n")

        # Insert statements in batches
        batch_size = 100
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            f.write(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES\n")

            values_list = []
            for row in batch:
                values = []
                for col in columns:
                    val = row[col]
                    if val is None:
                        values.append("NULL")
                    elif isinstance(val, bool):
                        values.append("TRUE" if val else "FALSE")
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    else:
                        # Escape single quotes
                        escaped = str(val).replace("'", "''")
                        values.append(f"'{escaped}'")
                values_list.append(f"({', '.join(values)})")

            f.write(",\n".join(values_list))
            f.write(";\n\n")

    print(f"Created: {filepath} ({len(data)} rows)")


def main():
    # Create output directories
    os.makedirs("c:/Dev/FlowForge/sample-data/lending", exist_ok=True)
    os.makedirs("c:/Dev/FlowForge/demo-data", exist_ok=True)

    print("Generating Finance/Lending demo data...")
    print("=" * 50)

    # Generate data
    print("\n1. Generating customers...")
    customers = generate_customers()

    print("2. Generating credit scores...")
    credit_scores = generate_credit_scores(customers)

    print("3. Generating loan applications...")
    loan_applications = generate_loan_applications(customers)

    print("4. Generating loan payments...")
    loan_payments = generate_loan_payments(loan_applications)

    print("5. Generating property valuations...")
    property_valuations = generate_property_valuations(loan_applications)

    # Save PostgreSQL data as SQL files
    print("\n" + "=" * 50)
    print("Saving PostgreSQL data (SQL files)...")

    generate_sql_inserts("customers", customers, "c:/Dev/FlowForge/demo-data/01_customers.sql")
    generate_sql_inserts("loan_applications", loan_applications, "c:/Dev/FlowForge/demo-data/02_loan_applications.sql")
    generate_sql_inserts("credit_scores", credit_scores, "c:/Dev/FlowForge/demo-data/03_credit_scores.sql")

    # Save CSV files
    print("\n" + "=" * 50)
    print("Saving CSV files...")

    save_to_csv(
        loan_payments,
        "c:/Dev/FlowForge/sample-data/lending/loan_payments.csv",
        list(loan_payments[0].keys())
    )

    save_to_csv(
        property_valuations,
        "c:/Dev/FlowForge/sample-data/lending/property_valuations.csv",
        list(property_valuations[0].keys())
    )

    print("\n" + "=" * 50)
    print("Demo data generation complete!")
    print("\nPostgreSQL tables (run SQL files in demo-data/):")
    print("  - customers (5,000 rows)")
    print("  - loan_applications (10,000 rows)")
    print("  - credit_scores (5,000 rows)")
    print("\nCSV files (in sample-data/lending/):")
    print("  - loan_payments.csv (10,000 rows)")
    print("  - property_valuations.csv (3,000 rows)")


if __name__ == "__main__":
    main()
