# Setup Prefect Worker to use Docker Prefect Server
# This script configures the Prefect worker to connect to the containerized Prefect Server
# running on Postgres (avoiding SQLite database locking issues)

Write-Host "=== FlowForge Prefect Worker Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Set Prefect API URL to Docker server
Write-Host "Step 1: Configuring Prefect API URL..." -ForegroundColor Yellow
$env:PREFECT_API_URL = 'http://localhost:4200/api'
Write-Host "✓ Set PREFECT_API_URL to: $env:PREFECT_API_URL" -ForegroundColor Green
Write-Host ""

# Step 2: Test connection to Prefect Server
Write-Host "Step 2: Testing connection to Prefect Server..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4200/api/health" -Method Get
    if ($health) {
        Write-Host "✓ Prefect Server is healthy and reachable" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Failed to reach Prefect Server. Is Docker running?" -ForegroundColor Red
    Write-Host "  Please start Docker containers with: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 3: Verify API connection with ping
Write-Host "Step 3: Pinging Prefect Server..." -ForegroundColor Yellow
$pingResult = prefect server ping 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Prefect Server ping successful" -ForegroundColor Green
} else {
    Write-Host "✗ Prefect Server ping failed: $pingResult" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Create work pool (idempotent)
Write-Host "Step 4: Creating work pool 'flowforge-development'..." -ForegroundColor Yellow
$poolResult = prefect work-pool create flowforge-development -t process 2>&1
if ($LASTEXITCODE -eq 0 -or $poolResult -like "*already exists*") {
    Write-Host "✓ Work pool 'flowforge-development' is ready" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create work pool: $poolResult" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Display configuration
Write-Host "Step 5: Verifying configuration..." -ForegroundColor Yellow
prefect config view | Select-String "PREFECT_API_URL"
Write-Host ""

# Step 6: Instructions to start worker
Write-Host "=== Setup Complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the Prefect worker, run:" -ForegroundColor Yellow
Write-Host "  prefect worker start --pool flowforge-development --type process --name flowforge-worker" -ForegroundColor White
Write-Host ""
Write-Host "This will connect to the Docker Prefect Server (Postgres) and avoid SQLite locking issues." -ForegroundColor Green
Write-Host ""
Write-Host "Note: Make sure to run this in your activated virtual environment (.venv)" -ForegroundColor Cyan
