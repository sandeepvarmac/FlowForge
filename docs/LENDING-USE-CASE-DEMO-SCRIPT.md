# FlowForge Core: Lending Use Case Demo Script

## Overview

This demo script showcases FlowForge as an **AI-Powered Data Ingestion Platform** for a lending organization. The demo walks through an end-to-end scenario of setting up a loan portfolio analytics pipeline using data from multiple sources.

**Demo Duration:** 15-20 minutes

**Target Audience:** Leadership team at a lending organization

---

## Pre-Demo Setup Checklist

Before the demo, ensure the following are in place:

### Connections (Already Created)
- [ ] **PostgreSQL Database Connection**: "Lending PostgreSQL" pointing to the lending database with:
  - `customers` table (5,000 rows)
  - `loan_applications` table (10,000 rows)
  - `credit_scores` table (5,000 rows)

- [ ] **Storage Connection**: "Lending Data Files" pointing to local file storage with:
  - `loan_payments.csv` (10,000+ rows)
  - `property_valuations.csv` (2,971 rows)

### Application Running
- [ ] FlowForge web application running on `http://localhost:3000`
- [ ] Database server running with sample data loaded

---

## Demo Script

### Part 1: Introduce the Platform (2 minutes)

**Talking Points:**
- "Today I'll show you FlowForge, our AI-powered data ingestion platform that transforms how lending organizations manage their data pipelines."
- "Instead of spending months building data infrastructure, FlowForge helps you get clean, analytics-ready data in weeks."
- "The platform follows the industry-standard Medallion Architecture - Bronze for raw data, Silver for cleaned data, and Gold for analytics-ready data."

**Navigation:**
1. Start on the **Dashboard** (`/pipelines/dashboard`)
2. Briefly show the pipeline overview cards

---

### Part 2: Explore Data Sources (3 minutes)

**Navigation:**
1. Go to **Data Assets > Explorer** (`/data-assets/sources`)

**Talking Points - Databases Tab:**
- "Let's start by looking at our connected data sources."
- "Here we have our PostgreSQL database with our core lending tables."
- Click on **Lending PostgreSQL** connection
- Expand to show tables: `customers`, `loan_applications`, `credit_scores`
- Click on `loan_applications` table
- "Notice the AI Insights tab - FlowForge automatically analyzes the data and suggests primary keys and temporal columns for tracking changes over time."

**Talking Points - Storage Tab:**
- Click **Storage** tab
- "We also support file-based sources - CSV, Excel, JSON, and Parquet files."
- Click on **Lending Data Files** connection
- Navigate to show `loan_payments.csv`
- "The platform automatically detects schema, data types, and even identifies potential issues."

---

### Part 3: Create the Loan Portfolio Analytics Pipeline (5 minutes)

**Navigation:**
1. Go to **Pipelines** (`/pipelines`)
2. Click **+ New Pipeline**

**Demo Steps:**

#### Step 1: Basic Information
```
Pipeline Name: Loan Portfolio Analytics
Description: End-to-end pipeline for loan portfolio risk analysis and reporting, integrating customer data, loan applications, payment history, and property valuations.
Application: Loan Origination System (LOS)  [NEW - Lending specific option]
```

**Talking Points:**
- "Notice we've added lending-specific application options like Loan Origination System, Credit Decision Engine, and Risk Management System."

#### Step 2: Ownership
```
Business Unit: Lending Operations
Team: Credit Analytics Team
```

**Talking Points:**
- "Clear ownership and accountability is crucial for data governance in financial services."

#### Step 3: Configuration
```
Environment: Development
Data Classification: PII/Sensitive
Priority: High
Tags: lending, risk-analytics, portfolio
```

**Talking Points:**
- "We've flagged this as PII/Sensitive since it contains customer financial information - this ensures proper data handling throughout the pipeline."

Click **Create Pipeline**

---

### Part 4: Add Data Sources to Pipeline (8 minutes)

After creating the pipeline, you'll be on the Pipeline Detail page.

#### Source 1: Loan Applications (Database)

1. Click **+ Add Source**

**Step 1 - Select Source:**
- Select **Database** as source type
- Choose **Lending PostgreSQL** connection
- Select `loan_applications` table

**Talking Points:**
- "We're connecting to our loan origination system's database to pull loan application data."

**Step 2 - Load Strategy:**
```
Load Strategy: Incremental
Delta Column: updated_at
```

**Talking Points:**
- "The AI detected that `updated_at` is a temporal column - perfect for incremental loads. This means we only process new and changed records, significantly reducing processing time."

**Step 3 - Bronze Layer:**
- Review auto-populated settings
- Click **AI Data Architect** button

**Talking Points:**
- "Now here's where FlowForge's AI capabilities shine. Watch as the AI analyzes our data and provides recommendations."
- Wait for AI analysis modal
- "The AI has analyzed our schema and sample data. It's recommending schema evolution settings, audit columns, and compression strategies optimized for lending data."
- Click **Accept All Recommendations**

**Step 4 - Silver Layer:**
- Show AI recommendations for:
  - Primary Key: `application_id`
  - Merge Strategy: SCD Type 2
  - Deduplication: Enabled

**Talking Points:**
- "For the Silver layer, the AI recommends Slowly Changing Dimension Type 2 to track historical changes to loan applications - crucial for audit trails in financial services."

**Step 5 - Gold Layer:**
- Show aggregation recommendations
- "The Gold layer is optimized for analytics - the AI suggests aggregations like loan count by status, average loan amount by credit tier."

**Step 6 - Review & Create:**
- Review the complete configuration
- Show the AI Usage Summary badge
- Click **Create Source**

---

#### Source 2: Loan Payments (File-based)

1. Click **+ Add Source**

**Step 1 - Select Source:**
- Select **File-based** as source type
- Choose **Select from Storage** (not Upload)
- Select **Lending Data Files** connection
- Browse and select `loan_payments.csv`

**Talking Points:**
- "Payment data often comes from different systems - here we're pulling from our loan servicing platform's file exports."
- "Notice how FlowForge automatically detected 10,000+ rows and identified the schema."

**Step 2 - Load Strategy:**
```
Load Strategy: Full Refresh (for daily payment files)
```

**Step 3 - Bronze Layer:**
- Click **AI Data Architect**
- Accept recommendations

**Step 4 - Silver Layer:**
- Show AI detecting:
  - Primary Key: `payment_id`
  - Temporal Columns: `payment_date`, `due_date`

**Step 5 - Gold Layer:**
- Show aggregation recommendations for payment analytics

Click **Create Source**

---

#### Source 3: Customers (Database) - Quick Add

Briefly add the customers source to show multi-source pipelines:

1. Click **+ Add Source**
2. Select Database > Lending PostgreSQL > `customers`
3. Use AI Data Architect for quick configuration
4. Create the source

**Talking Points:**
- "With the AI Data Architect, adding additional sources takes just minutes. The AI learns from the data patterns and provides intelligent defaults."

---

### Part 5: Execute the Pipeline (2 minutes)

1. On the Pipeline Detail page, click **Run Pipeline**
2. Show the execution progress

**Talking Points:**
- "Let's execute our pipeline. FlowForge orchestrates the entire flow - extracting from sources, landing in Bronze, cleaning in Silver, and aggregating for Gold."
- "Notice the execution timeline showing each stage of the Medallion Architecture."

---

### Part 6: Key Value Propositions (Closing)

**Talking Points:**

1. **AI-Powered Configuration**
   - "Traditional data engineering takes weeks to configure data pipelines. With FlowForge's AI Data Architect, we configured three sources in under 10 minutes."

2. **Enterprise Data Governance**
   - "PII classification, audit trails, and data lineage are built-in - essential for lending compliance requirements."

3. **Medallion Architecture Best Practices**
   - "Bronze-Silver-Gold is the industry standard. FlowForge implements it automatically, ensuring your data is organized and auditable."

4. **Multi-Source Integration**
   - "Whether data comes from databases, files, or APIs, FlowForge unifies them into a cohesive data model."

5. **No-Code for 80% of Use Cases**
   - "Your business analysts can build and manage pipelines through the UI. Engineers only step in for complex customizations."

---

## Demo Data Summary

| Source | Type | Records | Key Fields |
|--------|------|---------|------------|
| loan_applications | PostgreSQL | 10,000 | application_id, customer_id, loan_amount, status, credit_score |
| customers | PostgreSQL | 5,000 | customer_id, name, email, phone, address |
| credit_scores | PostgreSQL | 5,000 | customer_id, score, score_date, bureau |
| loan_payments.csv | CSV File | 10,000+ | payment_id, loan_id, payment_date, amount, status |
| property_valuations.csv | CSV File | 2,971 | valuation_id, property_id, appraisal_value, valuation_date |

---

## Troubleshooting

### Storage Connection Not Showing
If "Lending Data Files" doesn't appear in the Storage Explorer:
- Check if the connection exists in `storage_connections` table
- Verify the `lastTestStatus` is either 'success' or null
- Connections with failed tests are hidden

### AI Data Architect Not Working
If AI recommendations fail:
1. Check that Anthropic API key is configured
2. Falls back to OpenAI if Anthropic unavailable
3. Check browser console for specific error messages

### Database Connection Issues
If PostgreSQL connection fails:
1. Verify database server is running
2. Check connection credentials in the connection settings
3. Test connection from the Data Assets > Connections page

---

## Post-Demo Next Steps

After the demo, typical follow-up actions:

1. **Technical Deep Dive** - Show the pipeline execution logs and metadata catalog
2. **Customization Discussion** - Discuss specific data sources and transformations needed
3. **Deployment Options** - Review cloud deployment (AWS, Azure, GCP) or on-premise installation
4. **POC Planning** - Define scope for a proof-of-concept with real lending data
