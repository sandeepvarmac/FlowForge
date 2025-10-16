# FlowForge Workflow Triggers System

## Overview

The FlowForge Workflow Triggers System enables automated workflow execution through multiple trigger types:

1. **Manual Triggers** - User-initiated executions (existing functionality)
2. **Time-Based Triggers** - Scheduled execution using cron expressions
3. **Dependency-Based Triggers** - Automatic execution after upstream workflow completion
4. **Event-Driven Triggers** - Future: Webhooks, file arrival, etc.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    FlowForge API (Node.js)                   │
├─────────────────────────────────────────────────────────────┤
│  - Workflow Triggers CRUD                                    │
│  - Circular Dependency Detection                             │
│  - Execution Completion Handler                              │
│  - Deployment Sync Endpoints                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
┌────────────────┐   ┌───────────────────┐
│  Prefect       │   │  Trigger Handler  │
│  Deployments   │   │  (Python)         │
├────────────────┤   ├───────────────────┤
│ - CronSchedule │   │ - notify_         │
│ - Pause/Resume │   │   completion()    │
│ - Lifecycle    │   │ - Evaluate        │
│   Management   │   │   conditions      │
└────────────────┘   │ - Trigger         │
                     │   downstream      │
                     └───────────────────┘
```

### Database Schema

```sql
-- Workflow Triggers
CREATE TABLE workflow_triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  trigger_type TEXT NOT NULL, -- 'manual', 'scheduled', 'dependency', 'event'
  enabled INTEGER DEFAULT 1,
  trigger_name TEXT,

  -- Scheduled triggers
  cron_expression TEXT,
  timezone TEXT DEFAULT 'UTC',
  next_run_at INTEGER,
  last_run_at INTEGER,

  -- Dependency triggers
  depends_on_workflow_id TEXT REFERENCES workflows(id),
  dependency_condition TEXT, -- 'on_success', 'on_failure', 'on_completion'
  delay_minutes INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Executions track which trigger initiated them
ALTER TABLE executions ADD COLUMN trigger_id TEXT;
ALTER TABLE executions ADD COLUMN trigger_type TEXT DEFAULT 'manual';
```

## Time-Based Triggers (Scheduled)

### How It Works

1. **Create Trigger**: User creates a scheduled trigger with cron expression
2. **Sync Deployment**: API calls Python script to create Prefect deployment
3. **Prefect Scheduling**: Prefect scheduler automatically runs workflow at specified times
4. **Automatic Management**: Enable/disable operations pause/resume Prefect deployments

### Example Usage

```typescript
// Create daily 2 AM trigger
const trigger = await TriggersService.createTrigger('workflow_123', {
  triggerType: 'scheduled',
  triggerName: 'Daily Processing',
  cronExpression: '0 2 * * *',
  timezone: 'America/New_York',
  enabled: true
});

// Preview next 5 runs
const preview = await TriggersService.previewSchedule('workflow_123', {
  cron: '0 2 * * *',
  timezone: 'America/New_York',
  count: 5
});
// Returns: [1705726800, 1705813200, 1705899600, 1705986000, 1706072400]
```

### Cron Expression Format

Standard 5-field cron format:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-6, Sunday=0)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Examples:**
- `0 2 * * *` - Daily at 2:00 AM
- `*/15 * * * *` - Every 15 minutes
- `0 0 * * 1` - Every Monday at midnight
- `0 9-17 * * 1-5` - Every hour from 9 AM to 5 PM on weekdays

### Python Integration

```python
# prefect-flows/utils/cron_utils.py
from utils.cron_utils import calculate_next_runs, validate_cron_expression

# Validate cron expression
is_valid, error = validate_cron_expression("0 2 * * *")

# Calculate next 5 runs
next_runs = calculate_next_runs("0 2 * * *", "UTC", 5)
# Returns: [datetime, datetime, datetime, datetime, datetime]

# Get human-readable description
description = format_cron_description("0 2 * * *")
# Returns: "Daily at 2:00 AM"
```

## Dependency-Based Triggers

### How It Works

1. **Create Trigger**: User creates dependency trigger linking two workflows
2. **Circular Check**: System validates no circular dependencies exist
3. **Workflow Executes**: Upstream workflow completes (success or failure)
4. **Notify Completion**: Medallion flow calls `notify_completion()`
5. **Evaluate Conditions**: System checks trigger conditions
6. **Trigger Downstream**: Matching downstream workflows are triggered

### Condition Types

| Condition | When Triggers | Use Case |
|-----------|---------------|----------|
| `on_success` | Upstream completes successfully | Normal data flow |
| `on_failure` | Upstream fails | Error handling workflows |
| `on_completion` | Upstream finishes (success or fail) | Audit/logging workflows |

### Example Usage

```typescript
// Create dependency trigger
const trigger = await TriggersService.createTrigger('workflow_downstream', {
  triggerType: 'dependency',
  triggerName: 'After Customer Ingestion',
  dependsOnWorkflowId: 'workflow_upstream',
  dependencyCondition: 'on_success',
  delayMinutes: 5, // Wait 5 minutes after upstream completes
  enabled: true
});

// Validate no circular dependencies
const validation = await TriggersService.validateDependency(
  'workflow_downstream',
  'workflow_upstream'
);
// Returns: { valid: true, message: "..." }
```

### Delay Support

Delays allow for:
- **Eventual consistency windows**: Wait for external systems to sync
- **Rate limiting**: Prevent overwhelming downstream systems
- **Cool-down periods**: Allow resources to become available

**Implementation:**
- Delays: 0-60 minutes
- Default: 0 (immediate execution)
- MVP: Delays are logged but execution is immediate (production would use job queue)

### Circular Dependency Prevention

The system prevents circular dependencies using **depth-first search (DFS)** graph traversal:

```
Workflow A → Workflow B → Workflow C
                         ↓
                    Workflow D

# Attempting to add: Workflow D → Workflow A would create a cycle
# System detects: A → B → C → D → A (circle!)
# Response: { valid: false, chain: ["A", "B", "C", "D", "A"], error: "..." }
```

### Python Integration

```python
# In Prefect flows
from services.trigger_handler import notify_completion

@flow(name="my-workflow")
def my_workflow(workflow_id: str, execution_id: str):
    try:
        # ... workflow logic ...
        status = "completed"
    except Exception as e:
        status = "failed"
        raise
    finally:
        # Notify completion to trigger dependents
        notify_completion(
            execution_id=execution_id,
            workflow_id=workflow_id,
            status=status
        )
```

### API Integration

The medallion pipeline automatically calls the completion endpoint:

```typescript
// After workflow completes, Prefect flow calls:
POST /api/executions/{executionId}/complete
{
  "status": "completed", // or "failed"
  "workflowId": "workflow_123"
}

// System responds with triggered workflows:
{
  "triggeredCount": 2,
  "triggered": [
    {
      "workflowId": "downstream_1",
      "executionId": "exec_...",
      "condition": "on_success"
    },
    {
      "workflowId": "downstream_2",
      "executionId": "exec_...",
      "condition": "on_completion"
    }
  ],
  "skipped": []
}
```

## Multiple Triggers Per Workflow

A workflow can have multiple triggers simultaneously:

```typescript
// Workflow runs:
// 1. Daily at 2 AM
// 2. After customer ingestion completes
// 3. Manually triggered by users

const triggers = [
  {
    triggerType: 'scheduled',
    cronExpression: '0 2 * * *',
    timezone: 'UTC'
  },
  {
    triggerType: 'dependency',
    dependsOnWorkflowId: 'customer_ingestion',
    dependencyCondition: 'on_success'
  },
  {
    triggerType: 'manual' // Implicit - always available
  }
];
```

## Execution Tracking

Every execution records which trigger initiated it:

```sql
SELECT
  e.id,
  e.status,
  e.trigger_type, -- 'manual', 'scheduled', 'dependency'
  e.trigger_id,
  t.trigger_name
FROM executions e
LEFT JOIN workflow_triggers t ON e.trigger_id = t.id
WHERE e.workflow_id = 'workflow_123';
```

## API Endpoints

### Triggers CRUD
- `GET /api/workflows/:id/triggers` - List all triggers
- `POST /api/workflows/:id/triggers` - Create trigger
- `GET /api/workflows/:id/triggers/:triggerId` - Get trigger
- `PUT /api/workflows/:id/triggers/:triggerId` - Update trigger
- `DELETE /api/workflows/:id/triggers/:triggerId` - Delete trigger

### Management
- `PATCH /api/workflows/:id/triggers/:triggerId/enable` - Enable trigger
- `PATCH /api/workflows/:id/triggers/:triggerId/disable` - Disable trigger

### Scheduling
- `GET /api/workflows/:id/triggers/schedule/preview` - Preview next runs
- `POST /api/workflows/:id/triggers/:triggerId/sync-deployment` - Sync with Prefect
- `DELETE /api/workflows/:id/triggers/:triggerId/sync-deployment` - Remove deployment

### Dependencies
- `GET /api/workflows/:id/triggers/dependencies` - Get dependency graph
- `POST /api/workflows/:id/triggers/validate-dependency` - Check circular deps
- `GET /api/workflows/available-upstream` - List workflows for dependencies
- `GET /api/workflows/:id/triggers/:triggerId/history` - Get trigger history

### Execution
- `POST /api/executions/:executionId/complete` - Notify completion (triggers dependents)

## Error Handling

### Scheduled Triggers
- **Prefect unavailable**: Enable/disable operations log error but don't fail request
- **Invalid cron**: Returns 400 with validation error
- **Deployment creation fails**: Returns 500 with details

### Dependency Triggers
- **Circular dependency**: Returns 400 with dependency chain
- **Upstream workflow not found**: Returns 404
- **Downstream workflow fails**: Logged, doesn't affect upstream

### Execution Notifications
- **Notification fails**: Logged in Prefect flow, doesn't fail pipeline
- **Trigger evaluation error**: Skips trigger, logs error, continues with others

## Future Enhancements

### Production Delays
Replace immediate execution with proper job queue:
```python
# Using Celery, Bull, or Prefect deployments
schedule_delayed_execution(
    workflow_id="workflow_123",
    execution_id="exec_456",
    delay_minutes=5
)
```

### Event-Driven Triggers
- Webhooks (GitHub, Slack, custom)
- File arrival (S3, Azure Blob)
- Database changes (CDC)
- Message queues (Kafka, RabbitMQ)

### Advanced Scheduling
- Multiple cron schedules per trigger
- Blackout windows (don't run during maintenance)
- Retry policies for failed scheduled runs
- SLA monitoring and alerts

## Troubleshooting

### Scheduled trigger not running
1. Check trigger is enabled: `trigger.enabled === true`
2. Verify Prefect deployment exists: `GET /api/workflows/:id/triggers/:triggerId/sync-deployment`
3. Check Prefect logs for errors
4. Verify cron expression is valid: `GET /api/workflows/:id/triggers/schedule/preview`

### Dependency trigger not firing
1. Verify upstream workflow completed: Check executions table
2. Check trigger condition matches execution status
3. Verify trigger is enabled
4. Check execution completion was called: Look for logs in Prefect
5. Check for circular dependencies: `POST /api/workflows/:id/triggers/validate-dependency`

### Circular dependency false positive
Run dependency graph check to visualize relationships:
```typescript
const graph = await TriggersService.getDependencyGraph('workflow_123');
console.log('Upstream:', graph.upstream);
console.log('Downstream:', graph.downstream);
```

## Development

### Running Tests
```bash
# API tests
cd apps/web
npm test -- triggers

# Python tests
cd prefect-flows
pytest tests/services/test_trigger_handler.py
```

### Local Development
```bash
# Start FlowForge API
cd apps/web
npm run dev

# Start Prefect server
prefect server start

# Run workflow with triggers
cd prefect-flows
python flows/medallion.py workflow_123 job_456 "Test Workflow" "Test Job" landing/test.csv
```

## References

- [Prefect Deployments](https://docs.prefect.io/concepts/deployments/)
- [Cron Expression Syntax](https://crontab.guru/)
- [Croniter Library](https://github.com/kiorky/croniter)
- [FlowForge Architecture Docs](../docs/architecture.md)
