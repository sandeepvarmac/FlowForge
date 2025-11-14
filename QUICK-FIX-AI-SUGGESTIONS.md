# Quick Fix: AI Suggestions Not Showing

## Problem
The AI Suggestion Card shows "0% ⚠ Low" with no suggestions and buttons don't work.

## Root Cause
The API call is returning an empty suggestions object or failing silently.

## Quick Diagnostics

### Step 1: Check Browser Console
1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. Look for error messages related to:
   - `/api/ai/config/bronze`
   - ANTHROPIC_API_KEY
   - Python errors

### Step 2: Check Network Tab
1. Press **F12** → **Network** tab
2. Reload the page and navigate to Bronze layer
3. Find the request: `POST /api/ai/config/bronze`
4. Click on it → **Response** tab
5. Check the response JSON

**Expected Response:**
```json
{
  "success": true,
  "suggestions": {
    "incremental_load": {...},
    "partitioning": {...},
    "schema_evolution": {...}
  }
}
```

**If you see this instead:**
```json
{
  "success": false,
  "message": "Some error message"
}
```

## Most Likely Fixes

### Fix 1: Set ANTHROPIC_API_KEY

1. Create or edit `.env.local` in `apps/web/` directory:

```bash
# apps/web/.env.local
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
FLOWFORGE_API_URL=http://localhost:3000
```

2. **IMPORTANT**: Restart the dev server:
```bash
# Stop server (Ctrl+C in terminal)
cd apps/web
npm run dev
```

3. Clear browser cache (Ctrl+Shift+Delete)

4. Try again

### Fix 2: Check Python Environment

The AI service needs Python with the virtual environment set up.

```bash
# Check if Python venv exists
ls prefect-flows/.venv/Scripts/python.exe

# If not, create it:
cd prefect-flows
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Fix 3: Test API Directly

Open a new terminal and test the API:

```bash
# First, get a connection ID from the UI or database
# Then test:

curl -X POST http://localhost:3000/api/ai/config/bronze ^
  -H "Content-Type: application/json" ^
  -d "{\"dbType\":\"postgresql\",\"connectionId\":\"your-connection-id\",\"tableName\":\"bank_transactions\"}"
```

**Expected output:** JSON with suggestions
**Error output:** Will show the actual error message

### Fix 4: Manual Test (Fallback)

If AI is not working, you can manually populate the suggestions for testing:

1. Open browser console (F12)
2. Type this JavaScript code:

```javascript
// Manually set AI suggestions (temporary test)
const mockSuggestions = {
  incremental_load: {
    enabled: true,
    watermark_column: "transaction_date",
    confidence: 95,
    reasoning: "Detected timestamp column with sequential data"
  },
  partitioning: {
    enabled: true,
    strategy: "DATE",
    partition_column: "transaction_date",
    confidence: 88,
    reasoning: "Date-based queries expected"
  },
  schema_evolution: {
    enabled: true,
    confidence: 90,
    reasoning: "Production systems often add new columns"
  }
}

// This will trigger re-render with mock data
console.log('Mock suggestions:', mockSuggestions)
```

## Common Errors and Solutions

### Error: "ANTHROPIC_API_KEY environment variable not set"
**Solution**: Add API key to `.env.local` and restart server

### Error: "Failed to fetch sample data"
**Solution**:
- Check database connection is valid
- Check table exists and has data
- Check `prefect-flows/.venv/Scripts/python.exe` exists

### Error: "Failed to parse AI response"
**Solution**:
- Check Claude API key is valid
- Check Claude API is accessible (not blocked by firewall)
- Check Python subprocess can run

### Error: "Module not found: anthropic"
**Solution**:
```bash
cd prefect-flows
.venv\Scripts\activate
pip install anthropic polars pyarrow
```

## Verify Environment

Run this checklist:

```bash
# 1. Check API key exists
cat apps/web/.env.local | findstr ANTHROPIC

# 2. Check Python venv exists
ls prefect-flows/.venv/Scripts/python.exe

# 3. Check AI service file exists
ls prefect-flows/utils/ai_config_assistant.py

# 4. Check API endpoint exists
ls apps/web/src/app/api/ai/config/bronze/route.ts

# 5. Check component exists
ls apps/web/src/components/ai/ai-suggestion-card.tsx
```

All should return valid paths.

## Still Not Working?

### Debug Mode

Add this to `apps/web/src/components/jobs/create-job-modal.tsx` in the `fetchAiSuggestions` function:

```typescript
try {
  console.log('Fetching AI suggestions with:', {
    dbType: formData.sourceConfig.type,
    connectionId: selectedConnectionId,
    tableName: formData.sourceConfig.databaseConfig.tableName
  })

  const response = await fetch('/api/ai/config/bronze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbType: formData.sourceConfig.type,
      connectionId: selectedConnectionId,
      tableName: formData.sourceConfig.databaseConfig.tableName
    })
  })

  console.log('Response status:', response.status)
  const result = await response.json()
  console.log('Response data:', result)

  // ... rest of code
}
```

This will show exactly what's being sent and received.

## Expected Behavior

When working correctly:

1. **Step 1**: Select database connection and table
2. **Click Next**: Move to Bronze Layer (Step 2)
3. **See**: AI Suggestion Card with loading spinner
4. **After 3-5 seconds**: Card updates with suggestions:
   - "91% ✓ High" (or similar confidence)
   - Three suggestions listed
   - "Accept & Continue" button works
   - "Adjust AI Suggestions" button expands card

## Contact Information

If none of these fixes work, check:
- Browser console for JavaScript errors
- Server terminal for API errors
- Network tab for API responses

The error message will point to the exact issue.
