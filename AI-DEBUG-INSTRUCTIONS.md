# AI Suggestions Debugging Instructions

I've added detailed console logging to trace exactly what's happening with the AI suggestions feature.

## How to Test and See Debug Logs

1. **Open the Application**
   - Go to http://localhost:3001 in your browser

2. **Open Browser Developer Tools**
   - Press **F12** to open Developer Tools
   - Go to the **Console** tab
   - Keep it open while you test

3. **Navigate to Create Job**
   - Click on any workflow (e.g., "BFSI Demo Workflow")
   - Click "Add Job" button

4. **Select Database Source**
   - Select "Database" as job type
   - Choose "PostgreSQL" from the dropdown
   - Select an existing database connection
   - Select a table (e.g., "bank_transactions")
   - Wait for schema to load

5. **Click "Next" Button**
   - This should trigger the AI suggestions fetch
   - Watch the console carefully

## What to Look For in Console

You should see log messages with `[AI]` prefix:

### Frontend Logs (Browser Console):
```
[AI] Fetching AI suggestions with: {dbType: "postgresql", connectionId: "...", tableName: "bank_transactions"}
[AI] Response status: 200
[AI] Response data: {...}
```

### OR (if there's an issue):
```
[AI] Skipping AI suggestions - missing required data: {...}
[AI] Failed to get suggestions: "error message"
[AI] Error fetching AI suggestions: Error...
```

### Server Logs (Terminal where npm run dev is running):

Check the terminal and look for:
```
[AI API] Request received: {dbType: "postgresql", tableName: "bank_transactions", ...}
[AI API] Fetching connection details for ID: ...
[AI API] Connection loaded: {host: "...", database: "..."}
[AI API] Python path: ...
[AI API] Python process closed with code: 0
[AI API] Python stdout: ...
[AI API] Parsed result: ...
```

## What This Will Tell Us

1. **If you see "Skipping AI suggestions"** → The required data (connectionId, tableName, dbType) is not being passed correctly

2. **If you see "Request received" but no Python logs** → The Python subprocess is not starting

3. **If you see Python stderr output** → There's an error in the Python AI service

4. **If you see "Invalid response"** → The Python script ran but didn't return valid JSON

5. **If you see "Parsed result" with empty suggestions** → The AI service ran but Claude API failed

## Next Steps

After you complete the test above, please share:
1. **All console logs** from the browser (copy/paste the [AI] messages)
2. **Server terminal output** (the [AI API] messages from where npm run dev is running)

This will tell me exactly where the issue is happening.
