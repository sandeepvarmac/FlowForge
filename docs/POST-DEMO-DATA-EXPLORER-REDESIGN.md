# Post-Demo: Data Explorer Redesign Plan

## Executive Summary

This document outlines the comprehensive redesign of FlowForge's data exploration experience, transitioning from a **workflow-centric** model to an **asset-centric** model inspired by Microsoft Purview, Databricks Unity Catalog, and Snowflake.

## Current State (Demo Version)

### Problems
1. **Workflow-Centric Design**: Data Assets Explorer is organized by workflows/jobs, implying ownership
2. **No Source Exploration**: Cannot browse source systems before ingestion
3. **Orphan Issue**: Deleting workflows leaves orphaned datasets
4. **Limited Discovery**: Must drill down through workflows to find data

## Target Architecture: Three Explorers

### 1. Source Data Explorer (NEW)
**Purpose**: Explore data at the source before ingestion

**Access**: `Integrations > Sources > [Connection] > 🔍 Explore Source`

**Features**:
- Live connection to source systems
- Browse schemas, tables, files
- Preview first 100 rows without ingestion
- Quick "Add to Job" button for instant Bronze job creation
- SQL query interface for databases

**Key Routes**:
- `/integrations/sources/[id]/explore` - Main explorer page
- `/api/database-connections/[id]/tables` - List tables
- `/api/database-connections/[id]/preview?table=X&limit=100` - Preview data

**Demo Value**:
> "Before ingesting, let me explore what's in my PostgreSQL database... I can see bank_transactions with 1,000 rows. Let me preview the data... Now I'll click 'Add to Job' to create an ingestion workflow."

---

### 2. Data Assets Explorer (REDESIGN)
**Purpose**: Explore processed datasets (Bronze/Silver/Gold layers)

**Access**: `Data Assets > Explorer`

**Current Design**: Workflow hierarchy in sidebar → Select workflow → Select job → View datasets

**New Design**: Asset-first with multiple views

#### **New UI Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│  Data Assets Explorer              [Environment: Dev ▾]     │
│  🔍 Search assets by name, tags, description...             │
├─────────────────────────────────────────────────────────────┤
│  [All Assets] [By Source] [By Layer] [By Owner] [Orphaned] │
│                                                              │
│  Filters: Layer [All▾] Source [All▾] Status [All▾]         │
│                                                              │
│  📊 Showing 156 assets                                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ customers    │  │ orders       │  │ products     │     │
│  │ _gold        │  │ _silver      │  │ _bronze      │     │
│  │ [Gold]       │  │ [Silver]     │  │ [Bronze]     │     │
│  │ 1.2M rows    │  │ 850K rows    │  │ 3.4M rows    │     │
│  │ Quality: 95% │  │ Quality: 88% │  │ Quality: -   │     │
│  │ ────────────│  │ ────────────│  │ ────────────│     │
│  │ Source:      │  │ Source:      │  │ Source:      │     │
│  │ 📋 Customer  │  │ 📋 Order ETL │  │ 📋 Product   │     │
│  │    ETL       │  │              │  │    Sync      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

#### **Tab 1: All Assets (Default)**
- Grid view of all assets
- Source shown as metadata
- Independent of workflow status

#### **Tab 2: By Source**
- Group by producing workflow/job
- Show "Active Workflows", "Archived Workflows", "Orphaned Assets"
- Orphans clearly marked with recommendations

#### **Tab 3: By Layer**
- Bronze → Silver → Gold pipeline view
- Layer-specific metrics

#### **Tab 4: By Owner**
- Team/user-based grouping
- Useful for governance

#### **Tab 5: Orphaned Assets**
- Assets whose source workflow/job was deleted
- Show age, size, last access
- Bulk cleanup actions

#### **Asset Detail View Enhancements**:

Add "Source Information" section:
```
┌────────────────────────────────────────────────┐
│  Source Information                             │
│  ────────────────────────────────────────────  │
│  Produced by:                                   │
│    📋 Workflow: Customer Data Pipeline          │
│    🔧 Job: Customer Transform                   │
│    🚀 Last Run: Run #456 (2h ago, ✅ Success)   │
│                                                  │
│  Workflow Status: 🟢 Active                     │
│  ──────────────────────────────────────────── │
│  [View Source Workflow] [View Job Details]     │
└────────────────────────────────────────────────┘
```

Add "Asset Actions":
- Query in SQL Editor
- Export Data
- Set Retention Policy
- **Delete Asset** (with impact analysis)

---

### 3. Target Data Explorer (FUTURE)
**Purpose**: Monitor data published to external destinations

**Access**: `Integrations > Destinations > [Connection] > Monitor`

**Features**:
- View tables synced to Snowflake/Databricks
- Last sync status and timestamp
- Sync history and error logs
- Trigger manual sync

**Example**:
```
┌─────────────────────────────────────────────────┐
│  Snowflake: Production Warehouse               │
│                                                 │
│  📊 DIM_CUSTOMERS (975 rows)                   │
│     Source: customers_gold                      │
│     Last Sync: 2h ago • Status: ✅ Success     │
│     [View in Snowflake] [Sync Now]             │
└─────────────────────────────────────────────────┘
```

---

## Data Lifecycle Independence

### Core Principle
**Data assets exist independently from workflows**

### Implications

| Action | Current Behavior | New Behavior |
|--------|------------------|--------------|
| Delete Workflow | Cascade delete assets (orphans) | Assets remain accessible, marked as orphaned |
| Archive Workflow | N/A | Assets remain fully accessible |
| Delete Job | Cascade delete assets | Assets remain, source marked as deleted |
| Delete Asset | N/A | Independent action with impact analysis |

### Workflow/Job Archive & Delete Strategy

#### **Archive**
- Status: `status='archived'`
- Execution logs: Visible with "(Archived)" label
- Data assets: Fully accessible
- Can execute: No
- UI: Move to "Archived" tab

#### **Soft Delete**
- Status: `status='deleted'`, `deleted_at` timestamp
- Execution logs: Visible with "(Deleted)" label
- Data assets: Fully accessible
- Retention: 30 days
- Recovery: Possible within retention period

#### **Hard Delete**
- After 30-day retention
- Workflow/job records removed
- Execution logs: Archived to cold storage or deleted
- Data assets: **Still accessible** (independent lifecycle)

---

## Database Schema Changes

```sql
-- Workflows table
ALTER TABLE workflows ADD COLUMN status TEXT DEFAULT 'active'; -- 'active', 'archived', 'deleted'
ALTER TABLE workflows ADD COLUMN archived_at INTEGER;
ALTER TABLE workflows ADD COLUMN deleted_at INTEGER;

-- Jobs table
ALTER TABLE jobs ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE jobs ADD COLUMN archived_at INTEGER;
ALTER TABLE jobs ADD COLUMN deleted_at INTEGER;

-- metadata_catalog (NO CHANGES)
-- Assets remain independent with job_id as metadata reference
```

---

## Implementation Phases

### **Phase 1: Source Data Explorer (2-3 days)**
**Priority**: HIGH (enables demo flow)

**Tasks**:
1. Create `/integrations/sources/[id]/explore` route
2. Build API endpoints:
   - `GET /api/database-connections/[id]/tables`
   - `GET /api/database-connections/[id]/preview?table=X`
3. Create UI components:
   - Table list sidebar
   - Data preview panel
   - "Add to Job" quick action
4. Add "Explore Source" button to connection cards

**Demo Impact**: Enables "browse before ingest" narrative

---

### **Phase 2: Data Assets Redesign (1 week)**
**Priority**: MEDIUM (post-demo)

**Tasks**:
1. Refactor Data Assets Explorer to asset-first view
2. Add tabbed navigation (All, By Source, By Layer, By Owner, Orphaned)
3. Implement orphan detection logic
4. Add source context metadata to asset cards
5. Create orphan management interface
6. Update asset detail page with source information

---

### **Phase 3: Archive & Soft Delete (1 week)**
**Priority**: MEDIUM (post-demo)

**Tasks**:
1. Add database schema migrations
2. Implement archive workflow/job actions
3. Implement soft delete with 30-day retention
4. Create "Archived" tab in Workflows page
5. Update execution logs to show context
6. Build recovery UI for deleted workflows

---

### **Phase 4: Target Data Explorer (2 weeks)**
**Priority**: LOW (future feature)

**Tasks**:
1. Design destination connector framework
2. Create destination connection UI
3. Build Target Data Explorer pages
4. Implement sync monitoring
5. Add manual sync triggers

---

## Navigation Changes

### **Before (Current)**
```
Home → Workflows → Select Workflow → View Jobs → Select Job → View Assets → Select Asset
(5 clicks to reach asset)
```

### **After (Redesign)**
```
Home → Data Assets Explorer → [Search/Filter] → Select Asset
(2 clicks to reach asset)

Source: Home → Integrations → Sources → [Connection] → Explore
Target: Home → Integrations → Destinations → [Connection] → Monitor
```

---

## Key Design Decisions

### 1. **Asset Independence**
- Assets are first-class citizens
- Workflows are "producers" but don't "own" data
- Delete workflow ≠ Delete data

### 2. **Three Separate Explorers**
- Source: Pre-ingestion exploration
- Assets: Processed datasets (Bronze/Silver/Gold)
- Target: Post-publishing monitoring

### 3. **Orphan Visibility**
- Don't hide orphaned assets
- Provide explicit management interface
- Recommendations: Keep, Archive, Delete

### 4. **Execution History Preservation**
- Always keep execution logs (audit trail)
- Mark context (Archived/Deleted) but never hide
- Compliance and debugging requirement

---

## Success Metrics

### Post-Redesign Goals
1. **Time to Asset**: Reduce from 5 clicks to 2 clicks
2. **Source Exploration**: Enable pre-ingestion browsing
3. **Asset Discovery**: 80% of assets found via search (not drill-down)
4. **Orphan Management**: Zero surprise orphans
5. **User Feedback**: "Data feels independent from pipelines"

---

## References & Inspiration

### Industry Leaders
- **Microsoft Purview**: Asset-first catalog with lineage
- **Databricks Unity Catalog**: Asset independence from notebooks
- **Snowflake Data Catalog**: Search-first discovery
- **Fivetran**: Source exploration before sync
- **Airbyte**: Connector-based source browsing

### Key Takeaways
1. Data assets outlive workflows
2. Search > Hierarchy for discovery
3. Source exploration increases confidence
4. Orphan detection is a feature, not a bug
5. Execution history is sacred (never delete)

---

## Demo Preparation Checklist

### Immediate (This Week)
- [x] Delete orphaned assets for clean slate
- [x] Update Sources UI to generic text
- [ ] Test workflow creation flow
- [ ] Test data assets appear correctly
- [ ] Prepare demo script with talking points

### Post-Demo (Next 2 Weeks)
- [ ] Implement Source Data Explorer
- [ ] Redesign Data Assets Explorer to asset-centric
- [ ] Add archive/soft delete support
- [ ] Document migration guide for users

---

## Questions for Discussion

1. **Retention Policy**: Should orphaned assets auto-delete after 90 days?
2. **Access Control**: How do permissions work for orphaned assets?
3. **Cost Tracking**: Should orphaned assets count toward storage quotas?
4. **Lineage**: How to show lineage when source workflow is deleted?
5. **Search**: Should search index include deleted workflows?

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Author**: FlowForge Team with Claude Code
**Status**: Planning / Pre-Implementation
