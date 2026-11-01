param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$composeFile = "docker/compose.yaml"

if (-not (Test-Path $composeFile)) {
  throw "Run this script from the GYMOS repository root."
}
if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

Write-Warning "RESTORE REPLACES DATA IN THE CURRENT GYMOS DATABASE."
$confirmation = Read-Host "Type RESTORE to continue"
if ($confirmation -ne "RESTORE") {
  Write-Host "Restore cancelled."
  exit 0
}

$dbContainer = (docker compose -f $composeFile ps -q db).Trim()
if (-not $dbContainer) {
  throw "The PostgreSQL container is not running. Start Docker Compose first."
}

$containerDump = "/tmp/gymos-restore.dump"
docker cp (Resolve-Path $BackupFile).Path "${dbContainer}:$containerDump"
if ($LASTEXITCODE -ne 0) { throw "Could not copy backup into the database container." }

$restoreCommand = 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" "' + $containerDump + '"'
docker compose -f $composeFile exec -T db sh -c $restoreCommand
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed. Review the database logs before using the application." }

docker compose -f $composeFile exec -T db rm -f $containerDump | Out-Null
Write-Host "Restore completed from: $BackupFile"
