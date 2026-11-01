param(
  [string]$OutputDirectory = ".\backups"
)

$ErrorActionPreference = "Stop"
$composeFile = "docker/compose.yaml"

if (-not (Test-Path $composeFile)) {
  throw "Run this script from the GYMOS repository root."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$dbContainer = (docker compose -f $composeFile ps -q db).Trim()
if (-not $dbContainer) {
  throw "The PostgreSQL container is not running. Start Docker Compose first."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$containerDump = "/tmp/gymos-backup-$timestamp.dump"
$destination = Join-Path $OutputDirectory "gymos-$timestamp.dump"
$dumpCommand = 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "' + $containerDump + '"'

docker compose -f $composeFile exec -T db sh -c $dumpCommand
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }

docker cp "${dbContainer}:$containerDump" $destination
if ($LASTEXITCODE -ne 0) { throw "Could not copy the backup from the database container." }

docker compose -f $composeFile exec -T db rm -f $containerDump | Out-Null
Write-Host "Backup created: $destination"
