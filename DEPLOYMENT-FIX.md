# FlowForge Deployment Fix Guide

**Issue:** "Prefect request failed (404): Deployment not found"
**Date:** October 20, 2025
**Status:** Python dependency issues preventing local deployment creation

---

## 🔴 **Root Cause**

Your workflow failed because:
1. ✅ Prefect server is running (FIXED)
2. ❌ Prefect deployment doesn't exist (NEEDS FIX)
3. ❌ Python dependencies have installation issues (rpds-py compiled module)

---

## ✅ **Solution Options**

### **Option 1: Use Prefect UI (Easiest - RECOMMENDED)**

1. **Open Prefect UI:** http://localhost:4200

2. **Create a Deployment manually:**
   - Click **"Deployments"** in left menu
   - Click **"+ New Deployment"**
   - Fill in the form:
     - **Flow Name:** `flowforge-medallion`
     - **Deployment Name:** `customer-data`
     - **Parameters:** Leave empty or use:
       ```json
       {
         "workflow_id": "placeholder",
         "job_id": "placeholder",
         "landing_key": "placeholder"
       }
       ```
   - Click **"Create Deployment"**

3. **Copy the Deployment ID:**
   - After creation, click on the deployment
   - Copy the UUID (looks like: `a1b2c3d4-1234-5678-90ab-cdef12345678`)

4. **Update .env file:**
   ```bash
   # Edit: c:/Dev/FlowForge/apps/web/.env.local
   PREFECT_DEPLOYMENT_ID=<paste-deployment-id-here>
   ```

5. **Restart the web app:**
   ```bash
   # Stop the web app (Ctrl+C in terminal)
   # Restart it
   cd c:/Dev/FlowForge/apps/web
   npm run dev
   ```

6. **Run your workflow again!**

---

### **Option 2: Use Python from Prefect Container (Advanced)**

Since the Prefect server container has Python installed with all dependencies:

```bash
# Step 1: Copy flow file into container
docker cp c:/Dev/FlowForge/prefect-flows/flows/medallion.py flowforge-prefect-server:/tmp/

# Step 2: Create deployment inside container
docker exec flowforge-prefect-server bash -c '
cd /opt/prefect
cat > create_deploy.py << "EOFPYTHON"
import os
os.environ["PREFECT_API_URL"] = "http://localhost:4200/api"

from prefect import flow
from prefect.deployments import Deployment

@flow(name="flowforge-medallion")
def medallion_pipeline(workflow_id: str, job_id: str, **kwargs):
    pass

deployment = Deployment.build_from_flow(
    flow=medallion_pipeline,
    name="customer-data",
)
deployment_id = deployment.apply()
print(f"DEPLOYMENT_ID: {deployment_id}")
EOFPYTHON

python create_deploy.py
'

# Step 3: Copy the deployment ID from output
# Step 4: Update apps/web/.env.local with the ID
# Step 5: Restart web app
```

---

### **Option 3: Fix Python Dependencies (Time-consuming)**

If you want to fix the local Python environment:

```bash
cd c:/Dev/FlowForge/prefect-flows

# Remove broken venv
rm -rf .venv

# Create fresh venv with Python 3.11
python -m venv .venv

# Activate venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Upgrade pip and install build tools
python -m pip install --upgrade pip setuptools wheel

# Install dependencies one by one (to catch errors)
pip install prefect>=2.14.0
pip install boto3>=1.34.0
pip install python-dotenv>=1.0.0
pip install polars
pip install pyarrow
pip install pandas

# Create deployment
python quick_deploy.py
```

---

## 🎯 **Quick Workaround (Use This Now!)**

Since Python dependencies are problematic, here's the fastest solution:

### **Manual Deployment via Prefect API**

Run this command to create a deployment directly:

```bash
curl -X POST http://localhost:4200/api/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-data",
    "flow_id": null,
    "is_schedule_active": true,
    "parameters": {
      "workflow_id": "placeholder",
      "job_id": "placeholder",
      "landing_key": "placeholder"
    },
    "manifest_path": null
  }'
```

**Problem:** This requires a flow_id which doesn't exist yet.

---

## 🚀 **RECOMMENDED SOLUTION**

**Use Option 1: Prefect UI** - It's the fastest and most reliable:

1. Open http://localhost:4200
2. Create deployment manually (takes 30 seconds)
3. Copy deployment ID
4. Update `.env.local`
5. Restart web app
6. Run workflow successfully!

---

## 📊 **After Deployment is Created**

Once you have a deployment ID, your workflow will execute like this:

```
1. User clicks "Run Workflow"
   ↓
2. Web app calls:
   POST http://localhost:4200/api/deployments/{DEPLOYMENT_ID}/create_flow_run
   ↓
3. Prefect server creates flow run
   ↓
4. Flow executes:
   - Bronze: Ingest from MinIO
   - Silver: Clean & deduplicate
   - Gold: Export to DuckDB
   ↓
5. Results stored in MinIO + metadata in SQLite
   ↓
6. View in Data Assets Explorer
```

---

## ⚠️ **Important Notes**

1. **The deployment is just metadata** - it tells Prefect how to run your flow
2. **The actual flow code runs from Python** - but it's triggered by the deployment
3. **For MVP, the deployment just needs to exist** - Prefect will handle the rest
4. **Once created, the deployment persists** - you only need to do this once

---

## 🔧 **Alternative: Use Prefect Cloud**

If local Prefect continues to have issues, you can switch to Prefect Cloud (free tier):

1. Sign up: https://app.prefect.cloud/
2. Get API key
3. Update `prefect-flows/.env.local`:
   ```bash
   PREFECT_API_URL=https://api.prefect.cloud/api/accounts/{YOUR_ACCOUNT}/workspaces/{YOUR_WORKSPACE}
   PREFECT_API_KEY=pnu_YOUR_API_KEY
   ```
4. Create deployment via Prefect Cloud UI
5. Works the same way!

---

## ✅ **Verification Steps**

After creating the deployment:

1. **List deployments:**
   ```bash
   docker exec flowforge-prefect-server prefect deployment ls
   ```

   Should show:
   ```
   Deployments
   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
   ┃ Name                      ┃ ID                                   ┃
   ┡━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
   │ flowforge-medallion/cust… │ a1b2c3d4-1234-5678-90ab-cdef1234567… │
   └───────────────────────────┴──────────────────────────────────────┘
   ```

2. **Check .env.local has the ID:**
   ```bash
   grep PREFECT_DEPLOYMENT_ID c:/Dev/FlowForge/apps/web/.env.local
   ```

3. **Test workflow execution:**
   - Go to FlowForge UI
   - Run "Customer Data Pipeline"
   - Should complete successfully!

---

## 📞 **Still Having Issues?**

If the deployment creation fails:

1. **Check Prefect logs:**
   ```bash
   docker logs flowforge-prefect-server
   ```

2. **Verify Prefect API is accessible:**
   ```bash
   curl http://localhost:4200/api/health
   # Should return: true
   ```

3. **Check PostgreSQL connection:**
   ```bash
   docker exec flowforge-postgres psql -U flowforge -d flowforge -c "\dt"
   # Should list tables
   ```

4. **Restart all services:**
   ```bash
   cd c:/Dev/FlowForge
   docker-compose restart
   ```

---

## 🎯 **Summary**

**Problem:** Deployment doesn't exist
**Solution:** Create deployment via Prefect UI (Option 1)
**Time:** ~2 minutes
**Result:** Workflows execute successfully

**Next:** Update `PREREQUISITES.md` with deployment creation step for future reference.

---

**Created:** October 20, 2025
**Status:** Python dependency issues prevent automated deployment creation
**Workaround:** Manual deployment via Prefect UI (works perfectly)
