# FlowForge Deployment Architecture - Design Document

**Date:** October 20, 2025
**Purpose:** Define proper deployment strategy for multi-environment, multi-team usage
**Status:** Design Proposal

---

## 🔴 **Current Architecture Issues**

### **Issue 1: Generic Deployment Name**
```
Current: flowforge-medallion/customer-data
Problem: "customer-data" is specific but used by ALL workflows
```

### **Issue 2: No Environment Isolation**
```
Current: One deployment for Dev, QA, UAT, Production
Problem: No separation between environments
Risk: Dev workflows could affect Production
```

### **Issue 3: No Team Separation**
```
Current: One deployment for all teams/business units
Problem: No resource isolation, security concerns
Risk: Finance data mixed with Marketing, compliance issues
```

---

## ✅ **Recommended Architecture**

### **Tier 1: Environment-Based Deployments** (Phase 2 - High Priority)

#### **Deployment Structure:**
```
flowforge-medallion/{environment}

Deployments:
- flowforge-medallion/production
- flowforge-medallion/uat
- flowforge-medallion/qa
- flowforge-medallion/development
```

#### **Work Pool Structure:**
```
Work Pools per Environment:
- flowforge-production     (High resources, monitored)
- flowforge-uat            (Medium resources)
- flowforge-qa             (Low resources, auto-scale)
- flowforge-development    (Shared, low priority)
```

#### **Configuration:**
```bash
# apps/web/.env.local
ENVIRONMENT=production  # Options: production, uat, qa, development

# Deployment IDs per environment
PREFECT_DEPLOYMENT_ID_PRODUCTION=xxx-xxx-xxx
PREFECT_DEPLOYMENT_ID_UAT=yyy-yyy-yyy
PREFECT_DEPLOYMENT_ID_QA=zzz-zzz-zzz
PREFECT_DEPLOYMENT_ID_DEV=www-www-www

# Dynamic lookup
PREFECT_DEPLOYMENT_ID=${PREFECT_DEPLOYMENT_ID_[ENVIRONMENT]}
```

#### **Database Schema Changes:**
```sql
-- Add environment column to workflows
ALTER TABLE workflows ADD COLUMN environment TEXT DEFAULT 'production'
  CHECK(environment IN ('production', 'uat', 'qa', 'development'));

-- Add index for environment filtering
CREATE INDEX idx_workflows_environment ON workflows(environment);

-- Update API to use environment-specific deployment
```

#### **Deployment Selection Logic:**
```typescript
// apps/web/src/app/api/workflows/[workflowId]/run/route.ts

// Get workflow environment
const workflow = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(workflowId)
const environment = workflow.environment || 'production'

// Select deployment based on environment
const deploymentKey = `PREFECT_DEPLOYMENT_ID_${environment.toUpperCase()}`
const deploymentId = process.env[deploymentKey]

if (!deploymentId) {
  throw new Error(`No deployment configured for environment: ${environment}`)
}

// Trigger flow run
await triggerPrefectRun(deploymentId, parameters)
```

---

### **Tier 2: Team-Based Isolation** (Phase 3 - Enterprise Feature)

#### **Deployment Structure:**
```
flowforge-medallion/{environment}/{team}

Examples:
- flowforge-medallion/production/marketing
- flowforge-medallion/production/finance
- flowforge-medallion/production/sales
- flowforge-medallion/uat/marketing
- flowforge-medallion/development/shared
```

#### **Work Pool Structure:**
```
Team-Specific Work Pools:
- flowforge-prod-marketing     (Marketing team, dedicated)
- flowforge-prod-finance       (Finance team, secure, compliance)
- flowforge-prod-sales         (Sales team, moderate)
- flowforge-uat-shared         (All teams, shared UAT)
- flowforge-dev-shared         (All teams, shared Dev)
```

#### **Configuration:**
```bash
# apps/web/.env.local - Deployment matrix
PREFECT_DEPLOYMENT_PRODUCTION_MARKETING=aaa-aaa-aaa
PREFECT_DEPLOYMENT_PRODUCTION_FINANCE=bbb-bbb-bbb
PREFECT_DEPLOYMENT_PRODUCTION_SALES=ccc-ccc-ccc
PREFECT_DEPLOYMENT_UAT_MARKETING=ddd-ddd-ddd
PREFECT_DEPLOYMENT_UAT_FINANCE=eee-eee-eee
PREFECT_DEPLOYMENT_QA_SHARED=fff-fff-fff
PREFECT_DEPLOYMENT_DEV_SHARED=ggg-ggg-ggg
```

#### **Database Schema Changes:**
```sql
-- Workflows already have business_unit field - rename to team
ALTER TABLE workflows RENAME COLUMN business_unit TO team;

-- Add constraint for valid teams
ALTER TABLE workflows ADD CONSTRAINT check_team
  CHECK(team IN ('marketing', 'finance', 'sales', 'operations', 'engineering', 'shared'));

-- Composite index for environment + team
CREATE INDEX idx_workflows_env_team ON workflows(environment, team);
```

#### **Deployment Selection Logic:**
```typescript
// Dynamic deployment lookup
const workflow = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(workflowId)
const environment = workflow.environment || 'production'
const team = workflow.team || 'shared'

// Build deployment key: PREFECT_DEPLOYMENT_{ENV}_{TEAM}
const deploymentKey = `PREFECT_DEPLOYMENT_${environment.toUpperCase()}_${team.toUpperCase()}`
const deploymentId = process.env[deploymentKey]

if (!deploymentId) {
  // Fallback to environment-only deployment
  const fallbackKey = `PREFECT_DEPLOYMENT_${environment.toUpperCase()}_SHARED`
  const fallbackId = process.env[fallbackKey]

  if (!fallbackId) {
    throw new Error(`No deployment configured for: ${environment}/${team}`)
  }

  return fallbackId
}

return deploymentId
```

---

### **Tier 3: Per-Workflow Deployments** (Optional - Maximum Isolation)

#### **When to Use:**
- Workflow requires specific Python dependencies
- Workflow needs custom execution environment
- Workflow has unique security requirements
- Workflow needs dedicated resources

#### **Deployment Structure:**
```
flowforge-medallion/{environment}/{team}/{workflow_id}

Example:
- flowforge-medallion/production/finance/wf_1760966518995_tju50j
```

#### **Database Schema:**
```sql
-- Add deployment_id column to workflows
ALTER TABLE workflows ADD COLUMN prefect_deployment_id TEXT;

-- Store deployment ID with each workflow
CREATE INDEX idx_workflows_deployment ON workflows(prefect_deployment_id);
```

#### **Lifecycle Management:**
```typescript
// Create workflow -> Create Prefect deployment
async function createWorkflow(data: CreateWorkflowRequest) {
  // 1. Create workflow in SQLite
  const workflow = await db.prepare(`INSERT INTO workflows ...`).run(...)

  // 2. Create Prefect deployment for this workflow
  const deploymentId = await createPrefectDeployment({
    name: `${workflow.environment}/${workflow.team}/${workflow.id}`,
    workPool: `flowforge-${workflow.environment}-${workflow.team}`,
    parameters: { workflow_id: workflow.id }
  })

  // 3. Store deployment ID
  await db.prepare(`UPDATE workflows SET prefect_deployment_id = ? WHERE id = ?`)
    .run(deploymentId, workflow.id)

  return workflow
}

// Delete workflow -> Delete Prefect deployment
async function deleteWorkflow(workflowId: string) {
  const workflow = await db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(workflowId)

  // 1. Delete Prefect deployment
  if (workflow.prefect_deployment_id) {
    await fetch(`${PREFECT_API_URL}/deployments/${workflow.prefect_deployment_id}`, {
      method: 'DELETE'
    })
  }

  // 2. Delete workflow from SQLite
  await db.prepare(`DELETE FROM workflows WHERE id = ?`).run(workflowId)
}
```

---

## 📊 **Comparison Matrix**

| Feature | Current (MVP) | Tier 1: Environment | Tier 2: Team | Tier 3: Per-Workflow |
|---------|---------------|---------------------|--------------|----------------------|
| **Deployment Count** | 1 | 4 (4 envs) | 12-20 (4 envs × 3-5 teams) | 100s (1 per workflow) |
| **Environment Isolation** | ❌ None | ✅ Full | ✅ Full | ✅ Full |
| **Team Isolation** | ❌ None | ❌ None | ✅ Full | ✅ Full |
| **Workflow Isolation** | ❌ None | ❌ None | ❌ None | ✅ Full |
| **Management Complexity** | ✅ Low | ✅ Low | ⚠️ Medium | ❌ High |
| **Resource Control** | ❌ None | ✅ Per Env | ✅ Per Team | ✅ Per Workflow |
| **Compliance Ready** | ❌ No | ⚠️ Partial | ✅ Yes | ✅ Yes |
| **Best For** | MVP/Demo | Multi-env deployment | Enterprise/Teams | Advanced isolation |

---

## 🎯 **Recommended Implementation Plan**

### **Phase 2A: Environment-Based Deployments** (2-3 days)

**Priority:** HIGH - Critical for production readiness

**Tasks:**
1. ✅ Add `environment` column to workflows table
2. ✅ Create 4 Prefect deployments (prod, uat, qa, dev)
3. ✅ Create 4 work pools with appropriate resources
4. ✅ Update workflow run API to use environment-specific deployment
5. ✅ Add environment selector to Create Workflow modal
6. ✅ Update .env.local with all deployment IDs
7. ✅ Test deployment isolation

**Benefits:**
- ✅ Production workflows isolated from dev/test
- ✅ Can scale production resources independently
- ✅ Dev changes don't break production
- ✅ Meets basic compliance requirements

---

### **Phase 2B: Team-Based Isolation** (3-5 days)

**Priority:** MEDIUM - Important for enterprise customers

**Tasks:**
1. ✅ Rename `business_unit` to `team` in workflows table
2. ✅ Create deployment matrix (4 envs × 3-5 teams = 12-20 deployments)
3. ✅ Create team-specific work pools
4. ✅ Update deployment selection logic with fallback
5. ✅ Add team-based resource quotas
6. ✅ Update UI to show team/environment badges
7. ✅ Test team isolation and permissions

**Benefits:**
- ✅ Complete team separation
- ✅ Finance data isolated (compliance)
- ✅ Team-specific resource allocation
- ✅ Cost tracking per team
- ✅ Better security posture

---

### **Phase 3: Per-Workflow Deployments** (Optional - 5-7 days)

**Priority:** LOW - Only if specific use cases require it

**Tasks:**
1. ✅ Add `prefect_deployment_id` column to workflows
2. ✅ Implement deployment creation in workflow lifecycle
3. ✅ Implement deployment deletion when workflow deleted
4. ✅ Handle deployment failures gracefully
5. ✅ Add deployment status monitoring
6. ✅ Update UI to show deployment status per workflow

**Benefits:**
- ✅ Maximum isolation
- ✅ Workflow-specific configurations
- ✅ Clean workflow deletion
- ✅ Advanced use cases supported

**Drawbacks:**
- ⚠️ Deployment proliferation
- ⚠️ Higher management overhead
- ⚠️ More complex troubleshooting

---

## 🔧 **Quick Fix for Current MVP**

### **Rename Existing Deployment (Immediate)**

```bash
# Option 1: Delete and recreate with generic name
docker exec flowforge-prefect-server prefect deployment delete flowforge-medallion/customer-data

# Create new generic deployment
docker exec flowforge-prefect-server bash -c '
cd /opt/prefect
cat > create_deploy.py << "EOFPYTHON"
import os
os.environ["PREFECT_API_URL"] = "http://localhost:4200/api"

from prefect import flow
from prefect.deployments import Deployment

@flow(name="flowforge-medallion", log_prints=True)
def medallion_pipeline(workflow_id: str, job_id: str, **kwargs):
    print(f"Medallion pipeline: {workflow_id}/{job_id}")
    return {"status": "completed"}

deployment = Deployment.build_from_flow(
    flow=medallion_pipeline,
    name="default",  # Generic name
    work_pool_name="flowforge-local",
    work_queue_name="default",
)

deployment_id = deployment.apply()
print(f"===DEPLOYMENT_ID:{deployment_id}===")
EOFPYTHON

python create_deploy.py
'

# Update .env.local with new deployment ID
```

---

## 📋 **Decision Matrix**

### **Choose Implementation Based on Your Needs:**

| Your Situation | Recommended Tier | Timeline |
|----------------|------------------|----------|
| **MVP/Demo only** | Current (1 deployment) | Now |
| **Single environment** | Current + rename to "default" | 10 minutes |
| **Multiple environments** | Tier 1 (Environment-based) | 2-3 days |
| **Enterprise/Multiple teams** | Tier 2 (Environment + Team) | 5-7 days |
| **Advanced isolation needs** | Tier 3 (Per-workflow) | 7-10 days |

---

## ✅ **Recommendation for FlowForge MVP**

### **Immediate (Now):**
1. Rename deployment to `flowforge-medallion/default`
2. Update deployment ID in `.env.local`
3. Restart web app
4. Continue with current architecture

### **Phase 2 (Before Customer Demos):**
1. Implement **Tier 1: Environment-Based Deployments**
2. Create deployments for: production, uat, qa, development
3. Add environment selector to UI
4. Document deployment strategy

### **Phase 3 (Enterprise Readiness):**
1. Implement **Tier 2: Team-Based Isolation**
2. Create team-specific work pools
3. Add team-based RBAC
4. Implement cost tracking per team

---

## 🎯 **Summary**

**Your Question:** Shouldn't the deployment name be more generic? Shouldn't there be deployments for each environment/team?

**Answer:** ✅ **YES, ABSOLUTELY!**

**Current Issue:**
- ❌ One deployment (`customer-data`) for everything
- ❌ No environment isolation
- ❌ No team separation

**Recommended Solution:**
- ✅ **Tier 1:** Environment-based deployments (Priority: HIGH)
- ✅ **Tier 2:** Team-based isolation (Priority: MEDIUM)
- ✅ **Tier 3:** Per-workflow deployments (Priority: LOW/Optional)

**Next Steps:**
1. Decide which tier to implement
2. Update architecture accordingly
3. Create additional deployments
4. Update code to use proper deployment selection

---

**Status:** Design document ready for implementation
**Owner:** Architecture Team
**Review Date:** Before Phase 2 deployment
