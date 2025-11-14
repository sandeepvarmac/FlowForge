# How to See the AI-Powered Features in FlowForge

## Quick Start Guide

### 1. Access the Application
- Open your browser and go to: **http://localhost:3000** or **http://localhost:3001** (whichever is working)
- You should see the FlowForge dashboard

### 2. Navigate to a Workflow
- Click on any existing workflow (e.g., "BFSI Demo Workflow")
- OR create a new workflow if needed

### 3. Click "Add Job" Button
- You'll see the "Create Job" modal open with a multi-step wizard

### 4. Configure Job Basics (Step 1)
**This is where you select your data source:**

#### For Database Source:
1. Select **"Database"** as the job type
2. Choose **"PostgreSQL"** (or any database connection you have)
3. Click the dropdown to **select an existing database connection**
   - If you don't have one, click "Create New Connection" and configure:
     - Host: your database host
     - Port: 5432 (for PostgreSQL)
     - Database name
     - Username/Password
4. After selecting a connection, a **table selector** will appear
5. **Select a table** from the dropdown (e.g., `bank_transactions`)
6. Wait for the schema to load (you'll see column preview)
7. Click **"Next"** button

### 5. See AI Suggestions (Step 2 - Bronze Layer)
**THIS IS WHERE YOU'LL SEE THE AI FEATURES! 🤖**

After clicking "Next", you should see:

```
┌─────────────────────────────────────────────────────┐
│ 🤖 AI Data Architect Suggestions       Loading...   │
│ AI is analyzing your data...                        │
└─────────────────────────────────────────────────────┘
```

After 3-5 seconds, it will change to:

```
┌─────────────────────────────────────────────────────┐
│ 🤖 AI Data Architect Suggestions       91% ✓ High  │
│ Based on analyzing bank_transactions    [Review ▼] │
├─────────────────────────────────────────────────────┤
│ ✓ Incremental Load: ENABLED                         │
│ ✓ Partitioning: ENABLED (DATE)                      │
│ ✓ Schema Evolution: ENABLED                         │
│                                                      │
│ [Accept & Continue →] [Adjust AI Suggestions]       │
└─────────────────────────────────────────────────────┘
```

### 6. Interact with AI Suggestions
- Click **"Review"** or **"Adjust AI Suggestions"** to expand the card
- You'll see detailed information:
  - Individual confidence scores (95%, 88%, 90%)
  - AI reasoning with lightbulb icons 💡
  - Configuration parameters
  - Color-coded confidence badges

- Click **"Accept & Continue"** to:
  - Apply AI suggestions to Bronze configuration
  - Automatically populate form fields
  - Move to next step (Silver Layer)

---

## Troubleshooting

### Issue 1: Not Seeing the AI Card

**Possible Causes:**
1. **You're not using a database source**
   - AI suggestions only work for database sources (not CSV files)
   - Solution: Select "Database" as job type

2. **Table not selected**
   - AI card only appears after table is selected
   - Solution: Make sure you select a table from the dropdown in Step 1

3. **AI API call failed**
   - Check browser console (F12) for errors
   - Common error: `ANTHROPIC_API_KEY not set`
   - Solution: Set environment variable in `.env.local`

4. **Still loading**
   - AI analysis takes 3-5 seconds
   - Wait for the loading spinner to finish

### Issue 2: AI Suggestions Show Error

**Error Message**: "Failed to generate AI suggestions"

**Possible Causes:**
1. **Missing ANTHROPIC_API_KEY**
   - Check `.env.local` file in `apps/web/` directory
   - Add: `ANTHROPIC_API_KEY=sk-ant-api03-xxx`

2. **Database connection issue**
   - AI needs to sample 1000 rows from your table
   - Make sure database is accessible
   - Check that table has data

3. **Python environment issue**
   - AI service runs Python subprocess
   - Make sure Python virtual environment is set up
   - Path: `prefect-flows/.venv/Scripts/python.exe`

### Issue 3: Server Not Running

**Solution:**
```bash
cd apps/web
npm run dev
```

The server will automatically find an available port (3000, 3001, or 3002)

---

## Checking if AI Features Are Working

### Method 1: Check Files Exist
```bash
# Check AI component exists
ls apps/web/src/components/ai/ai-suggestion-card.tsx

# Check API endpoint exists
ls apps/web/src/app/api/ai/config/bronze/route.ts

# Check Python AI service exists
ls prefect-flows/utils/ai_config_assistant.py
```

### Method 2: Check Browser Console
1. Open browser (http://localhost:3000 or 3001)
2. Press F12 to open Developer Tools
3. Go to "Console" tab
4. Navigate through the job creation wizard
5. Look for these log messages:
   - "Auto-loading tables..."
   - "Fetching AI suggestions..."
   - "AI suggestions received"

### Method 3: Check Network Tab
1. Open browser Developer Tools (F12)
2. Go to "Network" tab
3. Navigate to Bronze Layer step
4. Look for API call: `POST /api/ai/config/bronze`
5. Check response - should have `suggestions` object

### Method 4: Direct API Test
You can test the API endpoint directly:

```bash
# Using curl (if table and connection exist)
curl -X POST http://localhost:3000/api/ai/config/bronze \
  -H "Content-Type: application/json" \
  -d '{
    "dbType": "postgresql",
    "connectionId": "your-connection-id",
    "tableName": "bank_transactions"
  }'
```

Expected response:
```json
{
  "success": true,
  "suggestions": {
    "incremental_load": { "enabled": true, "confidence": 95, ... },
    "partitioning": { "enabled": true, "confidence": 88, ... },
    "schema_evolution": { "enabled": true, "confidence": 90, ... }
  }
}
```

---

## Environment Variables Checklist

Make sure these are set in `.env.local` (in `apps/web/` directory):

```bash
# Required for AI features
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxx

# Optional (defaults shown)
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
FLOWFORGE_API_URL=http://localhost:3000
```

After adding/changing env variables:
1. Stop the dev server (Ctrl+C)
2. Restart: `npm run dev`

---

## Visual Confirmation Checklist

When everything is working, you should see:

- [ ] Step 1: Database connection selector
- [ ] Step 1: Table selector appears after connection selected
- [ ] Step 1: Schema preview appears after table selected
- [ ] Step 1: "Next" button is enabled
- [ ] Step 2: AI Suggestion Card appears at top
- [ ] Step 2: Loading spinner shows initially
- [ ] Step 2: After 3-5s, AI suggestions appear
- [ ] Step 2: Sparkles icon 🤖 visible
- [ ] Step 2: Confidence badges (High/Medium/Low) visible
- [ ] Step 2: "Review" button works (expands card)
- [ ] Step 2: AI reasoning text with lightbulb icons 💡
- [ ] Step 2: "Accept & Continue" button works
- [ ] After Accept: Form advances to Step 3 (Silver Layer)
- [ ] Bronze config fields are pre-populated

---

## Demo Video Script (For Testing)

1. **Start Recording**
2. Open http://localhost:3000 or 3001
3. Navigate to a workflow
4. Click "Add Job"
5. Say: "I'm creating a new database ingestion job"
6. Select "Database" type
7. Select PostgreSQL connection
8. Say: "Now selecting the bank_transactions table"
9. Select table from dropdown
10. Say: "Notice the schema preview appears"
11. Click "Next"
12. Say: "Here's the AI Data Architect analyzing my data..."
13. Wait for AI suggestions to load
14. Say: "The AI analyzed 1000 rows and suggests incremental loading with 95% confidence"
15. Click "Review" to expand
16. Say: "Here's the detailed reasoning from AI with confidence scores"
17. Click "Accept & Continue"
18. Say: "Bronze configuration is now auto-populated and we've moved to Silver layer"
19. **Stop Recording**

---

## Still Not Seeing AI Features?

If you've tried everything above and still don't see the AI features:

### Quick Diagnosis:
1. **Verify server is running**: Check http://localhost:3000 loads
2. **Check browser console**: Look for JavaScript errors (F12)
3. **Verify files exist**: Run commands in "Method 1" above
4. **Test API directly**: Use curl command in "Method 4" above
5. **Check env variables**: Make sure `ANTHROPIC_API_KEY` is set

### Get Help:
- Check the implementation docs: `docs/AI-BRONZE-CONFIG-IMPLEMENTATION-COMPLETE.md`
- Check the full roadmap: `docs/AI-POWERED-FLOWFORGE-ROADMAP.md`
- Look at the code:
  - Frontend: `apps/web/src/components/jobs/create-job-modal.tsx` (lines 981-994)
  - Component: `apps/web/src/components/ai/ai-suggestion-card.tsx`
  - API: `apps/web/src/app/api/ai/config/bronze/route.ts`

---

## Success!

You'll know the AI features are working when you see the beautiful gradient card with:
- 🤖 Sparkles icon
- Confidence scores
- AI reasoning
- "Accept & Continue" button

This is the beginning of FlowForge as a truly AI-powered data platform! 🚀
