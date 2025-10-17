# Workflow Triggers & Job Dependencies - Final Decision Document

**Date:** 2025-10-17
**Purpose:** Consolidate decisions for workflow triggers and job execution architecture
**Status:** Awaiting User Approval

---

## Executive Summary

FlowForge will adopt industry-standard patterns from Databricks, Airflow, and Prefect:
1. **Workflow Triggers:** Independent OR logic (Airflow pattern) - multiple trigger types allowed
2. **Job Dependencies:** Phased evolution from sequential to DAG-based execution

---

## Part 1: Workflow Triggers

### Current State (Week 2 - Complete)
✅ Database schema supports multiple triggers per workflow
✅ Three trigger types: Scheduled, Dependency, Event
✅ UI for creating triggers during workflow creation (optional)
✅ UI for managing triggers on workflow detail page
✅ Enable/disable toggle for individual triggers

### Decision: Independent OR Logic (Airflow Pattern)

**Rule:** A workflow can have multiple triggers of **any type**, and they operate **independently**:
- Each trigger fires the workflow independently
- Triggers do NOT check other triggers' conditions
- Triggers do NOT interact with each other
- Any trigger firing = workflow executes

### Examples

**Example 1: Mixed Trigger Types Allowed**
```
Workflow: "Daily Customer Report"
├─ Trigger 1 (Scheduled): Run at 2 AM EST daily
└─ Trigger 2 (Dependency): Run after "Customer ETL" workflow completes

Behavior:
- At 2 AM: Workflow runs (scheduled trigger fires)
- When "Customer ETL" completes: Workflow runs (dependency trigger fires)
- Two independent executions per day
```

**Example 2: Multiple Scheduled Triggers**
```
Workflow: "Data Quality Checks"
├─ Trigger 1 (Scheduled): Run at 6 AM EST (morning check)
├─ Trigger 2 (Scheduled): Run at 2 PM EST (afternoon check)
└─ Trigger 3 (Scheduled): Run at 10 PM EST (evening check)

Behavior:
- Workflow runs 3 times per day at specified times
- Each trigger is independent
```

**Example 3: Multiple Dependency Triggers (Future)**
```
Workflow: "Master Data Consolidation"
├─ Trigger 1 (Dependency): Run after "Sales ETL" completes successfully
├─ Trigger 2 (Dependency): Run after "Inventory ETL" completes successfully
└─ Trigger 3 (Dependency): Run after "Customer ETL" completes successfully

Behavior:
- Workflow runs after ANY upstream workflow completes
- Each dependency trigger fires independently
- Could run 3 times if all 3 upstream workflows complete
```

### UI/UX Implications

1. **Workflow Detail Page - Triggers Section Header:**
   ```
   Triggers (3) - Workflow runs when ANY trigger fires
   ```

2. **No Restrictions on Trigger Types:**
   - User can freely add Scheduled, Dependency, or Event triggers
   - No validation preventing mixed types
   - UI should clearly communicate independent OR logic

3. **Clear Messaging:**
   - "Add another trigger" button always available
   - Help text: "Each trigger fires this workflow independently"

### Database Schema (Current - No Changes Needed)

```sql
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('manual', 'scheduled', 'dependency', 'event')),
  enabled INTEGER DEFAULT 1,
  trigger_name TEXT,
  -- Trigger-specific fields...
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
```

**Status:** ✅ Already supports multiple independent triggers per workflow

### What This Means for Dependency Triggers

**Current Schema (Single Upstream):**
```sql
depends_on_workflow_id TEXT,  -- Single workflow
dependency_condition TEXT CHECK(dependency_condition IN ('on_success', 'on_failure', 'on_completion')),
```

**Future Enhancement (Multiple Upstreams with AND/OR Logic):**

This is a **separate concern** from the independent trigger OR logic. To support complex dependency scenarios like "Run after Workflow A AND Workflow B complete", we would need:

**Option A: JSON Array (Simpler for MVP+)**
```sql
-- In workflow_triggers table
depends_on_workflows TEXT, -- JSON: [{"workflow_id": "w1", "condition": "on_success"}, {"workflow_id": "w2", "condition": "on_success"}]
dependency_logic TEXT CHECK(dependency_logic IN ('all', 'any')), -- AND or OR
```

**Option B: Separate Table (More Scalable)**
```sql
CREATE TABLE trigger_dependencies (
  id TEXT PRIMARY KEY,
  trigger_id TEXT NOT NULL,
  depends_on_workflow_id TEXT NOT NULL,
  condition TEXT CHECK(condition IN ('on_success', 'on_failure', 'on_completion')),
  FOREIGN KEY (trigger_id) REFERENCES workflow_triggers(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Add to workflow_triggers table
dependency_logic TEXT CHECK(dependency_logic IN ('all', 'any')), -- How to combine multiple dependencies
```

**Recommendation:** Defer this to Phase 2 (post-MVP). Current single-upstream dependency is sufficient for MVP.

---

## Part 2: Job Dependencies Within Workflows

### Current State
❌ Jobs execute **sequentially only** via `order_index` field
❌ No dependency graph
❌ No parallel execution
❌ No conditional execution
❌ No visual DAG

**Current Schema:**
```sql
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,  -- Sequential only
  -- ...
);
```

### Industry Standards (Gap Analysis)

| Feature | FlowForge Current | Databricks | Airflow | Prefect |
|---------|------------------|------------|---------|---------|
| Execution Model | Sequential | DAG + Parallel | DAG + Parallel | DAG + Parallel |
| Dependency Graph | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| Parallel Execution | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| Conditional Execution | ❌ No | ✅ "Run if" rules | ✅ Trigger rules | ✅ wait_for |
| Visual DAG | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |

### Decision: Phased Evolution to DAG-Based Execution

---

## Phase 1: Foundation - Add Task Dependencies (Sequential Execution)
**Goal:** Enable dependency modeling without changing execution engine
**Timeline:** Post-MVP, Week 3-4 of Triggers System

### Changes Required

#### 1. Database Schema Addition
```sql
-- New table for job dependencies
CREATE TABLE IF NOT EXISTS job_dependencies (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  depends_on_job_id TEXT NOT NULL,
  condition TEXT DEFAULT 'on_success' CHECK(condition IN ('on_success', 'on_failure', 'on_completion')),
  created_at INTEGER NOT NULL,

  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_job_id) REFERENCES jobs(id) ON DELETE CASCADE,

  -- Prevent circular dependencies at DB level
  CHECK(job_id != depends_on_job_id),

  -- Prevent duplicate dependencies
  UNIQUE(job_id, depends_on_job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_dependencies_job_id ON job_dependencies(job_id);
CREATE INDEX IF NOT EXISTS idx_job_dependencies_depends_on ON job_dependencies(depends_on_job_id);

-- Keep order_index for backward compatibility and fallback
-- Jobs table remains unchanged
```

#### 2. Execution Logic (Still Sequential)
- Build dependency graph from `job_dependencies` table
- Detect parallel opportunities (jobs with no dependencies or same dependencies)
- Execute sequentially but log parallelization opportunities
- Validate no circular dependencies before execution

#### 3. UI Changes
- Visual DAG representation (read-only)
- Job configuration: Add "Dependencies" section
- Dependency selector: Choose upstream jobs
- Condition selector: on_success, on_failure, on_completion
- Visual validation of circular dependencies

#### 4. Validation & Error Handling
- Circular dependency detection algorithm
- Unreachable job detection (disconnected from DAG)
- Missing dependency validation

**Deliverables:**
✅ job_dependencies table
✅ Dependency graph construction
✅ Circular dependency validation API
✅ Visual DAG UI component (read-only)
✅ Job configuration UI for adding dependencies
✅ Sequential execution respecting dependencies (detect but don't use parallelism yet)

---

## Phase 2: Parallel Execution Engine
**Goal:** Execute independent jobs in parallel
**Timeline:** Post-MVP, Week 5-6 of Triggers System

### Changes Required

#### 1. Execution Engine Refactor
```typescript
// Current (sequential)
for (const job of sortedJobs) {
  await executeJob(job)
}

// New (parallel-aware)
const dagExecutor = new DAGExecutor(jobs, dependencies)
await dagExecutor.execute({
  maxParallelJobs: 5,
  failFast: true
})
```

#### 2. Parallel Execution Logic
- Topological sort of DAG
- Identify jobs with no pending dependencies
- Execute all ready jobs in parallel (up to concurrency limit)
- Update dependency status as jobs complete
- Handle fan-out and fan-in patterns

#### 3. Configuration
- Workflow-level setting: Max parallel jobs (default: 5)
- Global setting: Max concurrent tasks per workspace
- Job-level setting: Resource requirements (affects scheduling)

#### 4. Monitoring & UI
- Real-time DAG visualization showing running jobs
- Parallel execution progress indicators
- Resource utilization metrics

**Deliverables:**
✅ DAGExecutor class with parallel execution
✅ Topological sort algorithm
✅ Concurrency controls and limits
✅ Real-time DAG visualization (showing running state)
✅ Performance metrics (execution time comparison)

---

## Phase 3: Advanced Control Flow
**Goal:** Conditional execution, branching, dynamic tasks
**Timeline:** Post-MVP, Future Enhancement

### Features

#### 1. "Run If" Conditions (Databricks-style)
```typescript
interface JobDependency {
  dependsOnJobId: string
  runIfCondition: 'all_success' | 'at_least_one_success' | 'all_done' | 'none_failed' | 'all_failed'
}
```

**Use Cases:**
- Cleanup job: Run if ANY upstream job fails (`at_least_one_failed`)
- Summary report: Run only if ALL upstream jobs succeed (`all_success`)
- Archive job: Run when ALL upstream jobs complete regardless of status (`all_done`)

#### 2. Conditional Branching
```
Job 1: Data Validation
  ├─ (if passed) → Job 2: Process Data
  └─ (if failed) → Job 3: Send Alert & Stop
```

#### 3. Dynamic Task Mapping (Prefect-style)
```
Job 1: List Files → [file1.csv, file2.csv, file3.csv]
  ↓
Job 2: Process File (3 parallel instances, one per file)
  ↓
Job 3: Consolidate Results
```

#### 4. Loop Control
- Retry logic with backoff
- While loops (e.g., poll until condition met)
- For-each loops over dynamic data

**Deliverables:**
✅ Enhanced run-if conditions
✅ Conditional branching UI and execution
✅ Dynamic task mapping engine
✅ Loop control structures
✅ Advanced workflow patterns library

---

## MVP Priorities (Current Focus)

### In Scope for MVP (Week 2 - Already Complete)
✅ Multiple independent triggers per workflow (OR logic)
✅ Scheduled triggers with cron expressions
✅ Dependency triggers (single upstream workflow)
✅ Enable/disable triggers
✅ Delete triggers
✅ Triggers UI in workflow detail page
✅ Optional trigger during workflow creation

### Explicitly Out of Scope for MVP
❌ Multiple upstream workflows in single dependency trigger (AND/OR logic)
❌ Job dependencies within workflows (still sequential via order_index)
❌ Parallel job execution
❌ Visual DAG for jobs
❌ Conditional job execution
❌ "Run if" conditions for jobs
❌ Cross-workflow dependency validation in real-time

### Recommended Next Phase After MVP (Week 3-4)
1. **Dependency Triggers with Multiple Upstreams**
   - Schema: Add JSON array or separate table for multiple upstream workflows
   - UI: Multi-select upstream workflows
   - Logic: AND/OR combination logic
   - Validation: Circular dependency detection across workflows

2. **Job Dependencies Foundation (Phase 1)**
   - Schema: job_dependencies table
   - UI: Visual DAG (read-only), dependency configuration
   - Logic: Sequential execution respecting dependencies
   - Validation: Circular dependency detection

---

## Real-World Impact Examples

### Example 1: ETL Workflow Performance

**Current FlowForge (Sequential):**
```
Job 1: Extract Customers (5 min) ──→
Job 2: Extract Orders (5 min) ────→
Job 3: Extract Products (5 min) ──→
Job 4: Join & Transform (3 min) ──→
Total: 18 minutes
```

**With Phase 2 (Parallel Execution):**
```
Job 1: Extract Customers (5 min) ──┐
Job 2: Extract Orders (5 min) ─────┼──→ Job 4: Join & Transform (3 min)
Job 3: Extract Products (5 min) ───┘
Total: 8 minutes (56% faster!)
```

### Example 2: Complex Data Pipeline

**Scenario:** Financial reporting with multiple data sources

**Current (Sequential - 45 min total):**
```
1. Extract GL Data (10 min)
2. Extract AR Data (8 min)
3. Extract AP Data (7 min)
4. Extract Payroll Data (5 min)
5. Join Financial Data (8 min)
6. Generate Report (7 min)
```

**With Phase 2 (Parallel - 23 min total):**
```
1. Extract GL Data (10 min) ──────┐
2. Extract AR Data (8 min) ───────┤
3. Extract AP Data (7 min) ───────┼──→ 5. Join Financial Data (8 min) ──→ 6. Generate Report (7 min)
4. Extract Payroll Data (5 min) ──┘

Total: 10 + 8 + 7 = 25 minutes
Savings: 49% faster
```

**With Phase 3 (Conditional Logic):**
```
1. Extract GL Data (10 min) ──────┐
2. Extract AR Data (8 min) ───────┤
3. Extract AP Data (7 min) ───────┼──→ 5. Join Financial Data (8 min)
4. Extract Payroll Data (5 min) ──┘       ├─ (if success) → 6. Generate Report (7 min)
                                          └─ (if failed) → 7. Send Alert (1 min)
```

---

## Technical Debt & Migration Strategy

### Backward Compatibility

**Phase 1 Migration:**
- Keep `order_index` field in jobs table
- If job has no dependencies, fall back to `order_index` ordering
- Gradual migration: New workflows use dependencies, old workflows keep order_index

**Phase 2 Migration:**
- Existing sequential workflows continue to work
- Parallel execution only when dependencies explicitly defined
- No breaking changes to existing workflows

### Database Migrations

**Phase 1:**
```sql
-- Add new table (non-breaking)
CREATE TABLE IF NOT EXISTS job_dependencies (...);
```

**Phase 2:**
```sql
-- Add workflow-level config (non-breaking)
ALTER TABLE workflows ADD COLUMN max_parallel_jobs INTEGER DEFAULT 5;
```

**Phase 3:**
```sql
-- Enhance job_dependencies for run-if conditions (non-breaking)
ALTER TABLE job_dependencies ADD COLUMN run_if_condition TEXT DEFAULT 'on_success';
```

### Prefect Integration Considerations

FlowForge currently uses Prefect as the execution engine. Prefect supports:
✅ Parallel task execution (ThreadPoolTaskRunner, DaskTaskRunner)
✅ Task dependencies (wait_for parameter)
✅ Dynamic task mapping (.map() method)
✅ Conditional execution

**Implementation Strategy:**
- Phase 1: Build dependency graph in FlowForge, execute sequentially via Prefect
- Phase 2: Leverage Prefect's task runners for parallel execution
- Phase 3: Use Prefect's conditional execution features

---

## Summary of Decisions

### Workflow Triggers (Current State - Week 2 Complete)
✅ **Multiple independent triggers allowed** (OR logic, Airflow pattern)
✅ **No restrictions on trigger types** (can mix Scheduled, Dependency, Event)
✅ **Each trigger fires workflow independently** (no interaction between triggers)
✅ **Current schema supports this** (no changes needed)
✅ **UI clearly communicates OR logic** (header text, help messages)

### Job Dependencies (Future Phases)
📋 **Phase 1 (Post-MVP Week 3-4):** Add job dependencies, sequential execution
📋 **Phase 2 (Post-MVP Week 5-6):** Enable parallel execution
📋 **Phase 3 (Future):** Advanced control flow, conditional execution
📋 **Keep MVP simple:** Sequential execution via order_index remains for now

### MVP Boundary
✅ **IN:** Multiple independent workflow triggers, basic dependency triggers (single upstream)
❌ **OUT:** Complex dependency triggers (multiple upstreams), job dependencies, parallel execution

---

## Questions for User Approval

1. **Do you approve the independent OR logic for workflow triggers?** (Multiple trigger types allowed, each fires independently)

2. **Do you approve deferring complex dependency triggers to Phase 2?** (AND/OR logic for multiple upstream workflows)

3. **Do you approve the 3-phase plan for job dependencies?** (Foundation → Parallel → Advanced)

4. **What is your priority after MVP?**
   - Option A: Complex dependency triggers (multiple upstream workflows)
   - Option B: Job dependencies Phase 1 (foundation)
   - Option C: Other features

5. **Any changes or concerns with this plan?**

---

## Next Steps (Awaiting Approval)

1. User reviews and approves this document
2. Finalize MVP scope (confirm Week 2 is complete)
3. Update FEATURE-DEVELOPMENT-TRACKER.md with phases
4. Begin Phase 1 planning (if approved) or continue with other MVP features

---

**Document Status:** DRAFT - Awaiting User Review and Approval
**Last Updated:** 2025-10-17
**Owner:** Development Team
