# BFSI Demo Dataset Design

## Overview
Comprehensive dataset for demonstrating FlowForge's AI-powered medallion architecture with Banking, Financial Services, and Insurance data.

---

## Demo Scenario: "Regional Bank Digital Transformation"

**Business Context:**
A regional bank is modernizing its data infrastructure. They need to:
- Consolidate customer data from legacy systems (PostgreSQL database)
- Integrate product pricing updates (Excel files from product team)
- Ensure data quality before analytics
- Reconcile data across all layers
- Generate daily analytics for business reporting

---

## Dataset Architecture

### **Job 1: Customer Transactions (PostgreSQL - Database)**
**Table:** `bank_transactions`
**Purpose:** Core transaction data from production banking system
**Row Count:** 1,000 records

#### Schema:
```sql
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
```

#### Intentional Data Quality Issues (for AI Detection):
1. **Email Format Issues** (8% bad data):
   - 920 valid emails: `customer123@email.com`
   - 80 invalid emails: `customer456@invalid`, `badformat`, `missing@`
   - **AI Should Detect:** Email pattern validation rule

2. **Amount Range Issues** (5% outliers):
   - 950 normal transactions: $1 - $50,000
   - 30 suspicious outliers: $500,000 - $10,000,000
   - 20 negative amounts: -$100 to -$5,000 (refunds/errors)
   - **AI Should Detect:** Amount range rule (0 < amount < $100,000 for 95% confidence)

3. **NULL Values** (12% in merchant_name):
   - 880 records with merchant names
   - 120 records with NULL merchant_name
   - **AI Should Detect:** Optional field, suggest allowing NULLs

4. **Transaction Status Enum** (98% valid):
   - 980 records: 'completed', 'pending', 'failed'
   - 20 records: 'COMPLETED', 'unknown', 'processing'
   - **AI Should Detect:** Enum validation rule + standardization

5. **Future Dates** (3% data entry errors):
   - 970 records: Past dates (2024-01-01 to 2024-12-31)
   - 30 records: Future dates (2025-06-15, 2026-01-01)
   - **AI Should Detect:** Date range validation (transaction_date <= TODAY)

6. **Duplicate Records** (5% duplicates):
   - 50 exact duplicate transaction_ids
   - **AI Should Detect:** Primary key uniqueness + suggest deduplication in Silver

#### Transaction Type Distribution:
- Purchase: 450 records
- Withdrawal: 250 records
- Deposit: 150 records
- Transfer: 100 records
- Refund: 50 records

#### Channel Distribution:
- ATM: 300 records
- Online: 350 records
- Mobile App: 250 records
- Branch: 100 records

---

### **Job 2: Product Pricing (Excel File - Manual Upload)**
**File:** `bank_product_pricing_2024Q4.xlsx`
**Purpose:** Latest product pricing from finance team
**Row Count:** 50 products

#### Schema:
```
| product_id | product_name              | product_category | base_fee | transaction_fee | annual_fee | interest_rate | min_balance | last_updated   |
|------------|---------------------------|------------------|----------|-----------------|------------|---------------|-------------|----------------|
| PROD001    | Premier Checking Account  | Checking         | 0.00     | 0.25            | 0.00       | 0.01          | 1000.00     | 2024-10-01     |
| PROD002    | Business Savings Account  | Savings          | 5.00     | 0.00            | 60.00      | 2.50          | 5000.00     | 2024-10-01     |
```

#### Intentional Data Quality Issues:
1. **Missing Product IDs** (4% missing):
   - 48 valid product_ids
   - 2 missing/NULL product_ids
   - **AI Should Detect:** NOT NULL rule for primary key

2. **Negative Fees** (6% data entry errors):
   - 47 positive fees
   - 3 negative fees: -$5.00, -$10.00, -$25.00
   - **AI Should Detect:** Fee amount >= 0 rule

3. **Interest Rate Range** (8% outliers):
   - 46 normal rates: 0.01% - 5.00%
   - 4 outlier rates: 25.00%, 30.00%, -1.00%, 0.00%
   - **AI Should Detect:** Interest rate validation (0% <= rate <= 10%)

4. **Duplicate Product Names** (4% duplicates):
   - 2 products with same name "Premium Savings Account"
   - **AI Should Detect:** Suggest unique constraint on product_name

#### Product Categories:
- Checking: 15 products
- Savings: 15 products
- Credit Card: 10 products
- Loan: 10 products

---

### **Job 3: Customer Master Data (Excel File - Manual Upload)**
**File:** `customer_master_data.xlsx`
**Purpose:** Customer demographic data for enrichment
**Row Count:** 500 customers

#### Schema:
```
| customer_id | first_name | last_name | email                  | phone          | date_of_birth | customer_segment | account_since | credit_score | city        | state | zip_code |
|-------------|------------|-----------|------------------------|----------------|---------------|------------------|---------------|--------------|-------------|-------|----------|
| CUST001     | John       | Smith     | john.smith@email.com   | (555) 123-4567 | 1985-03-15    | Premium          | 2020-01-15    | 750          | New York    | NY    | 10001    |
```

#### Intentional Data Quality Issues:
1. **Phone Format Inconsistency** (20% inconsistent):
   - 400 formatted: `(555) 123-4567`
   - 100 unformatted: `5551234567`, `555-123-4567`, `555.123.4567`
   - **AI Should Detect:** Suggest standardization rule

2. **Email Validation** (10% invalid):
   - 450 valid emails
   - 50 invalid: missing '@', wrong domain, spaces
   - **AI Should Detect:** Email regex pattern

3. **Age Validation** (5% outliers):
   - 475 customers: Age 18-90
   - 25 customers: Age < 18 or > 100
   - **AI Should Detect:** Age range validation

4. **Segment Enum** (8% invalid):
   - 460 valid: 'Premium', 'Standard', 'Basic'
   - 40 invalid: 'PREMIUM', 'premium', 'VIP', 'Gold'
   - **AI Should Detect:** Enum validation + case standardization

---

## AI Detection Scenarios

### **Bronze Layer AI Profiling:**

When data lands in Bronze, AI analyzes and suggests:

#### For `bank_transactions`:
```json
{
  "aiSuggestions": {
    "qualityRules": [
      {
        "rule": "email_format_validation",
        "column": "email",
        "type": "pattern",
        "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        "confidence": 92,
        "currentCompliance": "92% of records match pattern",
        "reasoning": "Detected email addresses with common pattern violations"
      },
      {
        "rule": "amount_range_validation",
        "column": "amount",
        "type": "range",
        "min": 0.01,
        "max": 100000,
        "confidence": 95,
        "currentCompliance": "95% within range",
        "reasoning": "30 outlier amounts detected above $100K (possible fraud or data errors)"
      },
      {
        "rule": "transaction_status_enum",
        "column": "transaction_status",
        "type": "enum",
        "allowedValues": ["completed", "pending", "failed"],
        "confidence": 98,
        "currentCompliance": "98% match allowed values",
        "reasoning": "20 records have non-standard status values"
      },
      {
        "rule": "future_date_check",
        "column": "transaction_date",
        "type": "custom",
        "condition": "transaction_date <= CURRENT_DATE",
        "confidence": 97,
        "currentCompliance": "97% are historical dates",
        "reasoning": "30 records have future dates (data entry errors)"
      },
      {
        "rule": "primary_key_unique",
        "column": "transaction_id",
        "type": "unique",
        "confidence": 95,
        "currentCompliance": "95% unique",
        "reasoning": "50 duplicate transaction IDs detected"
      }
    ],
    "primaryKeyRecommendation": {
      "column": "transaction_id",
      "confidence": 98,
      "reasoning": "100% populated, 95% unique after deduplication"
    },
    "joinKeyRecommendations": [
      {
        "column": "customer_id",
        "confidence": 95,
        "reasoning": "Foreign key to customer_master_data.customer_id"
      }
    ]
  }
}
```

#### For `bank_product_pricing`:
```json
{
  "aiSuggestions": {
    "qualityRules": [
      {
        "rule": "product_id_not_null",
        "column": "product_id",
        "type": "not_null",
        "confidence": 96,
        "currentCompliance": "96% non-null",
        "reasoning": "Primary key should not be null"
      },
      {
        "rule": "fee_non_negative",
        "column": "base_fee",
        "type": "range",
        "min": 0,
        "confidence": 94,
        "currentCompliance": "94% non-negative",
        "reasoning": "3 negative fees detected (data entry errors)"
      },
      {
        "rule": "interest_rate_range",
        "column": "interest_rate",
        "type": "range",
        "min": 0,
        "max": 10,
        "confidence": 92,
        "currentCompliance": "92% within 0-10%",
        "reasoning": "Industry standard interest rates are 0-10%"
      }
    ]
  }
}
```

---

## Reconciliation Scenarios

### **Bronze → Silver Reconciliation:**

#### Job 1 (Transactions):
```json
{
  "reconciliation": {
    "bronzeRecords": 1000,
    "silverRecords": 950,
    "discrepancy": -50,
    "aiExplanation": "50 records quarantined due to quality failures",
    "breakdown": {
      "duplicatesRemoved": 50,
      "invalidEmails": 0,
      "amountOutliers": 0,
      "futureDate": 0
    },
    "status": "explained",
    "recommendation": "Review quarantined records in Quality module"
  }
}
```

#### Job 2 (Products):
```json
{
  "reconciliation": {
    "bronzeRecords": 50,
    "silverRecords": 48,
    "discrepancy": -2,
    "aiExplanation": "2 records quarantined (missing product_id)",
    "breakdown": {
      "missingPrimaryKey": 2,
      "negativeFees": 0
    },
    "status": "explained",
    "recommendation": "Contact finance team for missing product IDs"
  }
}
```

### **Silver → Gold Reconciliation:**

```json
{
  "reconciliation": {
    "silverRecords": 950,
    "goldRecords": 950,
    "discrepancy": 0,
    "sumReconciliation": {
      "silverTotalAmount": 12545000.50,
      "goldTotalAmount": 12545000.50,
      "difference": 0.00,
      "tolerance": 0.01,
      "status": "passed"
    },
    "aiExplanation": "Perfect reconciliation - all silver records aggregated to gold",
    "status": "passed"
  }
}
```

---

## Demo Workflow Summary

### **4-Job Pipeline:**

1. **Job 1: PostgreSQL Transactions → Bronze**
   - AI detects 5 quality issues
   - Suggests 5 quality rules
   - Suggests primary key: `transaction_id`

2. **Job 2: Excel Products → Bronze**
   - AI detects 3 quality issues
   - Suggests 3 quality rules
   - Suggests primary key: `product_id`

3. **Job 3: Silver Transformation**
   - Execute quality rules from Quality module
   - 50 records quarantined (duplicates)
   - Deduplication based on primary key
   - Join transactions + products (if implemented)
   - AI reconciles: Bronze 1000 → Silver 950 ✅

4. **Job 4: Gold Analytics**
   - Aggregate by customer_segment, product_category
   - Calculate KPIs: Total Revenue, Avg Transaction Size, Transaction Count
   - AI reconciles: Silver 950 → Gold 950 rows ✅
   - Sum check: $12.5M matches ✅

---

## Expected AI Insights During Demo

### **Quality Module Insights:**
- "AI detected 8% email format issues - created validation rule with 92% confidence"
- "30 suspicious high-value transactions (>$100K) - flagged for review"
- "50 duplicate transaction IDs removed during Silver transformation"
- "Overall data quality: 87% (Good) - 13% quarantined"

### **Reconciliation Module Insights:**
- "Bronze → Silver: 950/1000 records (50 duplicates removed as expected)"
- "Silver → Gold: 950/950 records (perfect match)"
- "Financial reconciliation: $12.5M total across all layers ✅"
- "AI explains discrepancies automatically - no manual investigation needed"

---

## Files to Create

1. **PostgreSQL Setup Script:**
   - `scripts/setup_bfsi_database.sql`
   - Creates `bank_transactions` table
   - Inserts 1,000 records with quality issues

2. **Excel Files:**
   - `sample-data/bfsi/bank_product_pricing_2024Q4.xlsx`
   - `sample-data/bfsi/customer_master_data.xlsx`

3. **Data Generation Script:**
   - `scripts/generate_bfsi_data.py`
   - Generates realistic banking data with controlled quality issues

---

## Success Metrics for Demo

✅ **AI Detection Rate:**
- Detects 100% of intentional quality issues
- Suggests correct validation rules with >90% confidence

✅ **Quality Enforcement:**
- Silver layer rejects/quarantines bad data
- Quality score calculated correctly

✅ **Reconciliation Accuracy:**
- AI correctly explains 100% of discrepancies
- Sum/count reconciliation passes

✅ **User Experience:**
- Quality rules appear in Quality module UI
- Reconciliation results appear in Reconciliation module UI
- AI insights are clear and actionable

---

**Document Version:** 1.0
**Status:** Design Specification
**Next Steps:** Generate sample data and implement AI services
