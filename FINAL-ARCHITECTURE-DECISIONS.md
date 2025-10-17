# Final Architecture Decisions - Workflow Triggers & Job Dependencies

**Date:** 2025-10-17
**Status:** ✅ APPROVED BY USER
**Purpose:** Consolidated decisions for workflow orchestration architecture

---

## Overview

This document outlines the final approved architecture for:
1. Workflow triggers (how workflows are initiated)
2. Job dependencies within workflows (how jobs execute)
3. Phased implementation approach (MVP → Phase 1 → Phase 2 → Phase 3)

All decisions follow industry standards from **Databricks** (golden standard), **Airflow**, and **Prefect**.

---

## PART 1: WORKFLOW TRIGGERS

### Decision 1: Independent OR Logic (Airflow Pattern)

**✅ APPROVED:** A workflow can have **multiple triggers of any type**, and they operate **independently**.

**Key Principles:**
1. **Multiple trigger types allowed:** Workflow can have Scheduled AND Dependency AND Event triggers
2. **Independent execution:** Each trigger fires the workflow independently
3. **OR logic:** ANY trigger firing = workflow executes
4. **No interaction:** Triggers do NOT check other triggers' conditions
5. **No restrictions:** Users can freely add/remove any trigger type

**Examples:**

**Example 1: Mixed Trigger Types**
```
Workflow: "Daily Customer Report"
├─ Trigger 1 (Scheduled): Run at 2 AM EST daily
└─ Trigger 2 (Dependency): Run after "Customer ETL" workflow completes

Result:
- At 2 AM daily: Workflow runs (scheduled trigger fires)
- When "Customer ETL" completes: Workflow runs (dependency trigger fires)
- Two independent executions, no interaction between triggers
```

**Example 2: Multiple Scheduled Triggers**
```
Workflow: "Data Quality Checks"
├─ Trigger 1 (Scheduled): Run at 6 AM EST
├─ Trigger 2 (Scheduled): Run at 2 PM EST
└─ Trigger 3 (Scheduled): Run at 10 PM EST

Result:
- Workflow runs 3 times per day
- Each schedule is independent
```

**Example 3: Multiple Dependency Triggers**
```
Workflow: "Master Consolidation"
├─ Trigger 1 (Dependency): Run after "Sales ETL" completes
├─ Trigger 2 (Dependency): Run after "Inventory ETL" completes
└─ Trigger 3 (Dependency): Run after "Customer ETL" completes

Result:
- Workflow runs after ANY upstream workflow completes
- Could execute 3 times if all upstreams complete
```

**Implementation Status:** ✅ Already implemented in Week 2

---

### Decision 2: Remove Trigger Selection from Create Workflow Modal

**✅ APPROVED:** Follow true Databricks pattern - triggers are ONLY added AFTER workflow creation.

**Changes Required:**

#### 1. Remove from Create Workflow Modal
```typescript
// DELETE THIS ENTIRE SECTION from create-workflow-modal.tsx

// ❌ Remove: Initial Trigger (Optional)
// ❌ Remove: Trigger type buttons (Scheduled, Dependency, Event)
// ❌ Remove: Configure Schedule section
// ❌ Remove: Configure Dependency section
// ❌ Remove: Timezone selectors
// ❌ Remove: Cron preset selectors
// ❌ Remove: All trigger-related state and logic
```

**Keep only:**
- Workflow Name
- Description
- Application/Source System
- Business Unit
- Team
- Environment
- Data Classification
- Priority
- Notification Email
- Tags
- Retention Days

#### 2. Updated User Journey

**Before (Current - Session 9):**
```
1. User clicks "Create Workflow"
2. Modal opens with workflow fields + optional trigger section
3. User fills workflow details
4. User optionally selects trigger type and configures it
5. User clicks "Create Workflow"
6. Workflow created with optional initial trigger
7. User routed to workflow detail page
```

**After (True Databricks Pattern):**
```
1. User clicks "Create Workflow"
2. Modal opens with workflow fields ONLY (no trigger section)
3. User fills workflow details
4. User clicks "Create Workflow"
5. Workflow created with NO triggers (manual execution only)
6. User routed to workflow detail page
7. User clicks "Add Trigger" button to add triggers
8. Add Trigger Modal opens (full trigger configuration UI)
```

#### 3. UI/UX Changes

**Workflow Detail Page - Default State (No Triggers):**
```
┌─────────────────────────────────────────┐
│ Triggers (0) - Manual Execution Only    │
│                                         │
│ [Add Trigger] Button                    │
│                                         │
│ No triggers configured. This workflow   │
│ runs manually only. Add triggers to     │
│ automate execution.                     │
└─────────────────────────────────────────┘
```

**Workflow Detail Page - With Triggers:**
```
┌─────────────────────────────────────────┐
│ Triggers (3) - Runs when ANY trigger    │
│ fires                       [Add Trigger]│
│                                         │
│ ● Scheduled - Daily at 2 AM EST         │
│   [Enabled] [Delete]                    │
│                                         │
│ ● Dependency - After "ETL Workflow"     │
│   [Enabled] [Delete]                    │
│                                         │
│ ● Event - On File Upload                │
│   [Disabled] [Delete]                   │
└─────────────────────────────────────────┘
```

**Implementation Status:** 📋 To be implemented (Session 10)

---

### Decision 3: Phased Enhancement for Dependency Triggers

**Current State (MVP - Week 2):**
- ✅ Single upstream workflow dependency
- ✅ Condition: on_success, on_failure, on_completion
- ✅ Optional delay in minutes

**Database Schema (Current):**
```sql
CREATE TABLE workflow_triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,

  -- Dependency triggers (SINGLE upstream only)
  depends_on_workflow_id TEXT,  -- Single workflow ID
  dependency_condition TEXT CHECK(dependency_condition IN ('on_success', 'on_failure', 'on_completion')),
  delay_minutes INTEGER DEFAULT 0,

  FOREIGN KEY (depends_on_workflow_id) REFERENCES workflows(id)
);
```

**Phase 2 Enhancement: Multiple Upstream Workflows with AND/OR Logic**

**New Schema (Phase 2):**
```sql
-- Option A: JSON Array (Simpler)
CREATE TABLE workflow_triggers (
  -- ... existing fields ...

  -- Enhanced for multiple upstreams
  depends_on_workflows TEXT,  -- JSON array: [{"workflow_id": "w1", "condition": "on_success"}, ...]
  dependency_logic TEXT CHECK(dependency_logic IN ('all', 'any')),  -- AND or OR

  -- Deprecated but keep for backward compatibility
  depends_on_workflow_id TEXT  -- NULL for new multi-dependency triggers
);

-- Option B: Separate Table (More Scalable - RECOMMENDED)
CREATE TABLE trigger_dependencies (
  id TEXT PRIMARY KEY,
  trigger_id TEXT NOT NULL,
  depends_on_workflow_id TEXT NOT NULL,
  condition TEXT CHECK(condition IN ('on_success', 'on_failure', 'on_completion')),

  FOREIGN KEY (trigger_id) REFERENCES workflow_triggers(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Add to workflow_triggers
ALTER TABLE workflow_triggers
ADD COLUMN dependency_logic TEXT DEFAULT 'all' CHECK(dependency_logic IN ('all', 'any'));
```

**Phase 2 Examples:**

**Example 1: AND Logic (All Must Complete)**
```
Workflow: "Master Report"
└─ Dependency Trigger: Run after ALL of:
   ├─ Workflow A completes successfully
   ├─ Workflow B completes successfully
   └─ Workflow C completes successfully

Logic: all (AND)
Result: Workflow runs ONLY when A AND B AND C all complete successfully
```

**Example 2: OR Logic (Any Can Trigger)**
```
Workflow: "Data Validation"
└─ Dependency Trigger: Run after ANY of:
   ├─ Workflow A completes successfully
   ├─ Workflow B completes successfully
   └─ Workflow C completes successfully

Logic: any (OR)
Result: Workflow runs when first upstream completes, then again for each subsequent completion
```

**Example 3: Mixed Conditions**
```
Workflow: "Error Handler"
└─ Dependency Trigger: Run after ALL of:
   ├─ Workflow A completes (success OR failure)
   ├─ Workflow B completes (success OR failure)
   └─ Workflow C completes (success OR failure)

Logic: all (AND)
Conditions: on_completion for all
Result: Workflow runs when all 3 upstreams complete, regardless of success/failure
```

**Implementation Status:** 📋 Post-MVP Phase 2 (Timeline TBD)

---

## PART 2: JOB DEPENDENCIES WITHIN WORKFLOWS

### Current State (MVP)

**✅ KEEP AS-IS FOR MVP:** Jobs execute sequentially via `order_index` field.

**Current Schema:**
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,  -- Sequential execution: 1, 2, 3, ...
  -- ... other fields ...
);
```

**Current Execution Logic:**
```typescript
// Simple sequential execution
const jobs = await getJobsForWorkflow(workflowId)
const sortedJobs = jobs.sort((a, b) => a.order - b.order)

for (const job of sortedJobs) {
  await executeJob(job)
}
```

**Limitations:**
- ❌ No parallel execution (performance bottleneck)
- ❌ No dependency graph
- ❌ No conditional execution
- ❌ No visual DAG

**Industry Gap:**

| Feature | FlowForge MVP | Databricks | Airflow | Prefect |
|---------|---------------|------------|---------|---------|
| Execution Model | Sequential | DAG + Parallel | DAG + Parallel | DAG + Parallel |
| Parallel Execution | ❌ | ✅ | ✅ | ✅ |
| Dependency Graph | ❌ | ✅ | ✅ | ✅ |
| Visual DAG | ❌ | ✅ | ✅ | ✅ |
| Conditional Execution | ❌ | ✅ | ✅ | ✅ |

**Decision:** Accept this limitation for MVP, address in phased approach post-MVP.

---

### Phase 1: Job Dependencies Foundation (Sequential Execution)

**Goal:** Enable dependency modeling without changing execution engine

**Timeline:** Post-MVP, estimated 2-3 weeks

#### 1. Database Schema Changes

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

  -- Prevent self-dependencies
  CHECK(job_id != depends_on_job_id),

  -- Prevent duplicate dependencies
  UNIQUE(job_id, depends_on_job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_dependencies_job_id ON job_dependencies(job_id);
CREATE INDEX IF NOT EXISTS idx_job_dependencies_depends_on ON job_dependencies(depends_on_job_id);

-- Keep order_index in jobs table for backward compatibility
-- Fallback: If no dependencies defined, use order_index
```

#### 2. Execution Logic (Still Sequential)

```typescript
class DAGExecutor {
  async execute(jobs: Job[], dependencies: JobDependency[]) {
    // 1. Build dependency graph
    const graph = this.buildGraph(jobs, dependencies)

    // 2. Validate graph (detect circular dependencies)
    this.validateGraph(graph)

    // 3. Topological sort (execution order)
    const executionOrder = this.topologicalSort(graph)

    // 4. Detect parallelization opportunities (log but don't use yet)
    const parallelGroups = this.detectParallelGroups(graph)
    console.log('Parallel opportunities detected:', parallelGroups)

    // 5. Execute sequentially (respecting dependencies)
    for (const job of executionOrder) {
      // Check if dependencies are satisfied
      const canRun = this.checkDependencies(job, dependencies, executedJobs)

      if (canRun) {
        await executeJob(job)
        executedJobs.push(job)
      } else {
        throw new Error(`Job ${job.id} dependencies not satisfied`)
      }
    }
  }
}
```

#### 3. Validation & Error Handling

```typescript
// Circular dependency detection
function detectCircularDependencies(jobs: Job[], dependencies: JobDependency[]): boolean {
  // DFS-based cycle detection
  // Return true if circular dependency found
}

// Unreachable job detection
function detectUnreachableJobs(jobs: Job[], dependencies: JobDependency[]): Job[] {
  // Find jobs with no path from any starting job
  // Return list of unreachable jobs
}

// API endpoint for validation
POST /api/workflows/:workflowId/jobs/validate-dependencies
{
  "job_id": "job-123",
  "depends_on_job_ids": ["job-456", "job-789"]
}

Response:
{
  "valid": false,
  "errors": [
    {
      "type": "circular_dependency",
      "message": "Adding this dependency would create a circular dependency: job-123 → job-456 → job-789 → job-123"
    }
  ]
}
```

#### 4. UI Components

**A. Visual DAG Representation (Read-Only)**
```tsx
<WorkflowDAG
  jobs={jobs}
  dependencies={dependencies}
  mode="readonly"
  highlightCriticalPath={true}
/>

Visual:
┌─────────┐
│ Job 1   │
│ Extract │
└────┬────┘
     ├──────────┐
┌────▼────┐ ┌───▼────┐
│ Job 2   │ │ Job 3  │
│ Clean   │ │ Enrich │
└────┬────┘ └───┬────┘
     └──────┬───┘
       ┌────▼────┐
       │ Job 4   │
       │ Load    │
       └─────────┘
```

**B. Job Configuration - Dependencies Section**
```tsx
<JobConfigurationForm>
  {/* ... existing fields ... */}

  <DependenciesSection>
    <h3>Dependencies</h3>
    <p>Select which jobs must complete before this job runs</p>

    <MultiSelect
      label="Depends On Jobs"
      options={availableJobs}
      value={selectedDependencies}
      onChange={handleDependencyChange}
    />

    {selectedDependencies.map(dep => (
      <DependencyCondition
        job={dep}
        condition={dep.condition}
        onConditionChange={(condition) => handleConditionChange(dep.id, condition)}
      />
    ))}

    {validationError && (
      <Alert variant="error">
        {validationError.message}
      </Alert>
    )}
  </DependenciesSection>
</JobConfigurationForm>
```

**C. Dependency Condition Selector**
```tsx
<Select value={condition} onChange={setCondition}>
  <option value="on_success">Run on Success</option>
  <option value="on_failure">Run on Failure</option>
  <option value="on_completion">Run on Completion (any status)</option>
</Select>
```

#### 5. Deliverables

✅ `job_dependencies` table created
✅ `DAGExecutor` class with graph building and validation
✅ Circular dependency detection algorithm
✅ API endpoint for dependency validation
✅ Visual DAG component (read-only, displays dependency graph)
✅ Job configuration UI for adding/removing dependencies
✅ Sequential execution respecting dependencies (detect parallelism opportunities, log them)

**Implementation Status:** 📋 Post-MVP Phase 1

---

### Phase 2: Parallel Execution Engine

**Goal:** Execute independent jobs in parallel for performance gains

**Timeline:** Post-MVP Phase 1, estimated 2-3 weeks

#### 1. Enhanced Execution Engine

```typescript
class DAGExecutor {
  async executeParallel(
    jobs: Job[],
    dependencies: JobDependency[],
    options: ExecutionOptions
  ) {
    const graph = this.buildGraph(jobs, dependencies)
    this.validateGraph(graph)

    // Track job states
    const pending = new Set(jobs.map(j => j.id))
    const running = new Map<string, Promise<JobResult>>()
    const completed = new Map<string, JobResult>()
    const failed = new Set<string>()

    while (pending.size > 0 || running.size > 0) {
      // Find jobs ready to run (all dependencies satisfied)
      const readyJobs = this.findReadyJobs(pending, dependencies, completed, failed)

      // Respect concurrency limit
      const availableSlots = options.maxParallelJobs - running.size
      const jobsToStart = readyJobs.slice(0, availableSlots)

      // Start ready jobs in parallel
      for (const job of jobsToStart) {
        pending.delete(job.id)
        running.set(job.id, this.executeJobAsync(job))
      }

      // Wait for at least one job to complete
      if (running.size > 0) {
        const completed = await Promise.race(
          Array.from(running.entries()).map(([id, promise]) =>
            promise.then(result => ({ id, result }))
          )
        )

        running.delete(completed.id)

        if (completed.result.status === 'failed') {
          failed.add(completed.id)

          if (options.failFast) {
            // Cancel all running jobs
            throw new Error(`Job ${completed.id} failed, stopping workflow`)
          }
        } else {
          completed.set(completed.id, completed.result)
        }
      }
    }

    return { completed, failed }
  }

  private findReadyJobs(
    pending: Set<string>,
    dependencies: JobDependency[],
    completed: Map<string, JobResult>,
    failed: Set<string>
  ): Job[] {
    return Array.from(pending)
      .map(jobId => jobs.find(j => j.id === jobId))
      .filter(job => {
        const deps = dependencies.filter(d => d.job_id === job.id)

        return deps.every(dep => {
          const depJob = completed.get(dep.depends_on_job_id)
          const depFailed = failed.has(dep.depends_on_job_id)

          switch (dep.condition) {
            case 'on_success':
              return depJob && depJob.status === 'completed'
            case 'on_failure':
              return depFailed
            case 'on_completion':
              return depJob || depFailed
            default:
              return false
          }
        })
      })
  }
}
```

#### 2. Configuration Options

**Workflow-Level Settings:**
```typescript
interface WorkflowExecutionConfig {
  maxParallelJobs: number  // Default: 5, Max: 20
  failFast: boolean         // Default: true (stop on first failure)
  retryFailedJobs: boolean  // Default: false
  maxRetries: number        // Default: 3
}
```

**Database Schema:**
```sql
ALTER TABLE workflows
ADD COLUMN execution_config TEXT;  -- JSON

-- Example JSON value:
{
  "maxParallelJobs": 5,
  "failFast": true,
  "retryFailedJobs": false,
  "maxRetries": 3
}
```

#### 3. Real-Time Monitoring

**Enhanced Visual DAG (Live Execution State):**
```tsx
<WorkflowDAG
  jobs={jobs}
  dependencies={dependencies}
  executionState={liveExecutionState}  // Real-time updates via WebSocket
  mode="live"
/>

Visual:
┌─────────┐
│ Job 1   │ ✅ Completed (5m 23s)
│ Extract │
└────┬────┘
     ├──────────┐
┌────▼────┐ ┌───▼────┐
│ Job 2   │ │ Job 3  │ ⏳ Running (2m 15s)
│ Clean   │ │ Enrich │
└────┬────┘ └───┬────┘
     └──────┬───┘
       ┌────▼────┐
       │ Job 4   │ ⏸️ Pending
       │ Load    │
       └─────────┘

Legend:
✅ Completed
⏳ Running (with elapsed time)
⏸️ Pending (waiting for dependencies)
❌ Failed
⚠️ Retrying
```

**Execution Metrics Dashboard:**
```
Workflow Execution: Daily ETL Pipeline
Status: Running
Started: 2025-10-17 02:00:15
Elapsed: 8m 45s

Progress: [████████░░░] 75% (3 of 4 jobs completed)

Parallelization Stats:
- Average parallel jobs: 2.3
- Peak parallel jobs: 3
- Time saved vs sequential: 9m 35s (52%)

Currently Running:
- Job 3 (Enrich Data): 2m 15s / ~5m
- Resource usage: 45% CPU, 2.1 GB memory
```

#### 4. Performance Comparison

**Built-in Performance Analytics:**
```typescript
interface ExecutionPerformance {
  totalDuration: number           // Actual duration with parallel execution
  sequentialDuration: number      // Estimated duration if sequential
  timeSaved: number               // sequentialDuration - totalDuration
  percentImprovement: number      // (timeSaved / sequentialDuration) * 100
  avgParallelJobs: number         // Average concurrent jobs during execution
  peakParallelJobs: number        // Maximum concurrent jobs
  criticalPathDuration: number    // Longest dependency chain
}
```

**Example Output:**
```
Execution Performance Report
============================
Actual Duration: 8m 15s
Sequential Duration: 18m 30s
Time Saved: 10m 15s (55% faster)

Parallelization:
- Average concurrent jobs: 2.4
- Peak concurrent jobs: 3
- Critical path: Job1 → Job3 → Job4 (8m)
```

#### 5. Deliverables

✅ Parallel execution engine with concurrency controls
✅ Topological sort with parallel opportunity detection
✅ Real-time execution monitoring (live DAG visualization)
✅ Workflow execution configuration UI
✅ Performance analytics and comparison metrics
✅ WebSocket integration for live updates
✅ Resource utilization tracking

**Implementation Status:** 📋 Post-MVP Phase 2

---

### Phase 3: Advanced Control Flow

**Goal:** Conditional execution, branching, dynamic tasks

**Timeline:** Future enhancement (6+ months post-MVP)

#### 1. "Run If" Conditions (Databricks-style)

**Enhanced Dependency Conditions:**
```typescript
interface JobDependency {
  jobId: string
  dependsOnJobIds: string[]
  runIfCondition:
    | 'all_success'              // All dependencies succeeded
    | 'at_least_one_success'     // At least one dependency succeeded
    | 'all_done'                 // All completed (any status)
    | 'none_failed'              // No dependencies failed
    | 'all_failed'               // All dependencies failed
    | 'at_least_one_failed'      // At least one dependency failed
}
```

**Use Cases:**

**Error Handler Pattern:**
```
Job 1: Process Data
  ├─ (if success) → Job 2: Send Success Email
  └─ (if failed)  → Job 3: Send Alert & Cleanup
```

**Conditional Report Pattern:**
```
Job 1: Data Validation
Job 2: ETL Processing
Job 3: Data Quality Check
  └─ (if ALL succeeded) → Job 4: Generate Executive Report
  └─ (if ANY failed)    → Job 5: Generate Error Report
```

#### 2. Conditional Branching

**Branch Node Type:**
```typescript
interface ConditionalBranch {
  condition: {
    type: 'data_quality' | 'record_count' | 'custom_sql'
    expression: string
  }
  trueBranch: Job[]
  falseBranch: Job[]
}
```

**Example:**
```
Job 1: Extract Data
  ↓
Decision: Record count > 1000?
  ├─ (YES) → Job 2: Full Processing → Job 4: Load to Warehouse
  └─ (NO)  → Job 3: Light Processing → Job 4: Load to Warehouse
```

#### 3. Dynamic Task Mapping (Prefect-style)

**Map Job Over Dynamic Inputs:**
```typescript
interface DynamicJob {
  baseJob: Job
  inputSource: 'file_list' | 'query_result' | 'api_response'
  mapExpression: string  // e.g., "files.map(f => ({ file: f }))"
  aggregateResults: boolean
}
```

**Example:**
```
Job 1: List Files in S3 → ["file1.csv", "file2.csv", "file3.csv"]
  ↓ (dynamic mapping)
Job 2: Process File (3 parallel instances)
  ├─ Instance 1: Process file1.csv
  ├─ Instance 2: Process file2.csv
  └─ Instance 3: Process file3.csv
  ↓ (aggregate)
Job 3: Consolidate All Results
```

#### 4. Loop Control

**Retry Logic:**
```typescript
interface RetryConfig {
  maxAttempts: number
  backoffStrategy: 'fixed' | 'exponential' | 'linear'
  initialDelaySeconds: number
  maxDelaySeconds: number
  retryOnErrors: string[]  // Specific error codes to retry
}
```

**While Loop (Polling):**
```typescript
interface WhileLoop {
  condition: string  // SQL or expression
  maxIterations: number
  sleepSeconds: number
  bodyJobs: Job[]
}

Example:
WHILE api_status != 'ready' AND iterations < 10:
  SLEEP 30 seconds
  Job: Check API Status
```

#### 5. Deliverables

✅ Enhanced "run if" conditions with all Databricks patterns
✅ Conditional branching engine
✅ Dynamic task mapping with aggregation
✅ Loop control (retry, while, for-each)
✅ Advanced workflow patterns library
✅ Visual workflow designer for complex patterns

**Implementation Status:** 📋 Future Enhancement

---

## CONSOLIDATED IMPLEMENTATION ROADMAP

### ✅ MVP / Week 2 (COMPLETE)

**Workflow Triggers:**
- ✅ Multiple independent triggers per workflow (OR logic)
- ✅ Scheduled triggers (cron expressions, timezones)
- ✅ Dependency triggers (single upstream workflow)
- ✅ Enable/disable/delete triggers
- ✅ Triggers UI on workflow detail page
- ✅ Trigger creation during workflow setup (TO BE REMOVED in Session 10)

**Job Execution:**
- ✅ Sequential execution via `order_index`

---

### 📋 Session 10 (NEXT - IMMEDIATE)

**Remove Initial Trigger from Create Workflow Modal:**
1. ✅ Remove entire "Initial Trigger (Optional)" section from create-workflow-modal.tsx
2. ✅ Remove all trigger-related state (initialTriggerType, cronExpression, timezone, etc.)
3. ✅ Remove trigger creation logic from workflow creation API call
4. ✅ Simplify Create Workflow Modal to metadata only
5. ✅ Update user journey: Create workflow → Route to detail page → Add triggers separately
6. ✅ Test complete flow: Create workflow → Add trigger → Enable/disable → Delete
7. ✅ Update documentation (FEATURE-DEVELOPMENT-TRACKER.md)
8. ✅ Commit changes

**Estimated Time:** 1-2 hours

---

### 📋 Phase 1: Enhanced Dependency Triggers (Post-MVP)

**Multiple Upstream Workflows with AND/OR Logic:**
1. Database schema changes (trigger_dependencies table OR JSON array)
2. API endpoints for complex dependency validation
3. Circular dependency detection across workflows
4. UI for multi-select upstream workflows
5. UI for AND/OR logic selection
6. Testing with complex scenarios

**Estimated Time:** 2-3 weeks

---

### 📋 Phase 2: Job Dependencies Foundation (Post-MVP)

**DAG Modeling with Sequential Execution:**
1. Database schema (job_dependencies table)
2. DAG building and validation logic
3. Circular dependency detection for jobs
4. Topological sort algorithm
5. Visual DAG component (read-only)
6. Job configuration UI for dependencies
7. Sequential execution respecting dependencies
8. Detect and log parallelization opportunities

**Estimated Time:** 2-3 weeks

---

### 📋 Phase 3: Parallel Job Execution (Post-MVP)

**Parallel Execution Engine:**
1. Parallel execution logic with concurrency controls
2. Real-time execution monitoring (WebSocket)
3. Live DAG visualization with execution state
4. Performance analytics and metrics
5. Workflow execution configuration UI
6. Resource utilization tracking
7. Performance comparison (parallel vs sequential)

**Estimated Time:** 2-3 weeks

---

### 📋 Phase 4: Advanced Control Flow (Future)

**Conditional Execution and Dynamic Tasks:**
1. Enhanced "run if" conditions (all Databricks patterns)
2. Conditional branching engine
3. Dynamic task mapping
4. Loop control (retry, while, for-each)
5. Advanced workflow patterns library
6. Visual workflow designer

**Estimated Time:** 4-6 weeks

---

## REAL-WORLD IMPACT EXAMPLES

### Example 1: ETL Pipeline Performance

**Current (Sequential):**
```
Job 1: Extract Customers    (5 min)  ──→
Job 2: Extract Orders        (5 min)  ──→
Job 3: Extract Products      (5 min)  ──→
Job 4: Join & Transform      (3 min)  ──→
Total: 18 minutes
```

**With Phase 3 (Parallel):**
```
Job 1: Extract Customers    (5 min)  ──┐
Job 2: Extract Orders        (5 min)  ──┼──→ Job 4: Join & Transform (3 min)
Job 3: Extract Products      (5 min)  ──┘
Total: 8 minutes (56% faster)
```

**Savings: 10 minutes per execution**
- Daily: 10 min × 1 = 10 min saved
- Monthly: 10 min × 30 = 300 min (5 hours) saved
- Yearly: 10 min × 365 = 3,650 min (60.8 hours) saved

---

### Example 2: Financial Reporting

**Current (Sequential - 45 min):**
```
1. Extract GL Data           (10 min)
2. Extract AR Data           (8 min)
3. Extract AP Data           (7 min)
4. Extract Payroll Data      (5 min)
5. Join Financial Data       (8 min)
6. Generate Report           (7 min)
```

**With Phase 3 (Parallel - 23 min):**
```
1. Extract GL Data       (10 min) ──┐
2. Extract AR Data       (8 min)  ──┤
3. Extract AP Data       (7 min)  ──┼──→ 5. Join (8 min) ──→ 6. Report (7 min)
4. Extract Payroll       (5 min)  ──┘

Total: max(10,8,7,5) + 8 + 7 = 25 minutes
Actual: ~23 minutes (accounting for startup overhead)
Savings: 49% faster
```

---

## DATABASE MIGRATION SUMMARY

### Current Schema (MVP - No Changes)
```sql
-- Workflows table (no changes)
-- Workflow triggers table (no changes)
-- Jobs table (keep order_index for backward compatibility)
-- Job executions table (no changes)
```

### Phase 1: Enhanced Dependency Triggers
```sql
-- Option B: Separate table (RECOMMENDED)
CREATE TABLE trigger_dependencies (
  id TEXT PRIMARY KEY,
  trigger_id TEXT NOT NULL,
  depends_on_workflow_id TEXT NOT NULL,
  condition TEXT CHECK(condition IN ('on_success', 'on_failure', 'on_completion')),
  FOREIGN KEY (trigger_id) REFERENCES workflow_triggers(id) ON DELETE CASCADE
);

ALTER TABLE workflow_triggers
ADD COLUMN dependency_logic TEXT DEFAULT 'all' CHECK(dependency_logic IN ('all', 'any'));
```

### Phase 2: Job Dependencies Foundation
```sql
CREATE TABLE job_dependencies (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  depends_on_job_id TEXT NOT NULL,
  condition TEXT DEFAULT 'on_success',
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  UNIQUE(job_id, depends_on_job_id)
);
```

### Phase 3: Parallel Execution
```sql
ALTER TABLE workflows
ADD COLUMN execution_config TEXT;  -- JSON: {maxParallelJobs: 5, failFast: true, ...}
```

### Phase 4: Advanced Control Flow
```sql
ALTER TABLE job_dependencies
ADD COLUMN run_if_condition TEXT DEFAULT 'on_success';

CREATE TABLE conditional_branches (...);
CREATE TABLE dynamic_job_mappings (...);
```

---

## BACKWARD COMPATIBILITY STRATEGY

### Phase 1
- Keep `order_index` in jobs table
- If job has no dependencies → fall back to order_index
- Existing workflows continue working unchanged
- New workflows can use dependencies or order_index

### Phase 2
- Existing sequential workflows continue to work
- Parallel execution only when dependencies explicitly defined
- No breaking changes

### Phase 3
- All existing workflows remain compatible
- Advanced features opt-in only

---

## PREFECT INTEGRATION NOTES

FlowForge uses Prefect as execution engine. Prefect supports:
- ✅ Parallel task execution (ThreadPoolTaskRunner, DaskTaskRunner)
- ✅ Task dependencies (wait_for parameter)
- ✅ Dynamic task mapping (.map() method)
- ✅ Conditional execution

**Implementation Strategy:**
- **Phase 1:** Build DAG in FlowForge, execute sequentially via Prefect
- **Phase 2:** Leverage Prefect's task runners for parallel execution
- **Phase 3:** Use Prefect's dynamic features for advanced control flow

---

## SUMMARY - ALL APPROVED DECISIONS

### ✅ Workflow Triggers
1. **Independent OR logic** - multiple trigger types allowed, each fires independently
2. **Remove initial trigger from Create Workflow Modal** - follow true Databricks pattern
3. **Phased enhancement** - single upstream now, multiple upstreams in Phase 1

### ✅ Job Dependencies
1. **Keep sequential for MVP** - accept current limitation
2. **Phase 1:** Add dependency graph, sequential execution
3. **Phase 2:** Enable parallel execution (56% performance improvement)
4. **Phase 3:** Advanced control flow (future)

### ✅ Implementation Priority
1. **Session 10 (Next):** Remove initial trigger from Create Workflow Modal
2. **Post-MVP Phase 1:** Enhanced dependency triggers OR job dependencies foundation
3. **Post-MVP Phase 2:** Parallel execution engine
4. **Future:** Advanced control flow

---

**DOCUMENT STATUS:** ✅ APPROVED BY USER
**LAST UPDATED:** 2025-10-17
**NEXT ACTION:** Implement Session 10 changes (remove initial trigger from Create Workflow Modal)
