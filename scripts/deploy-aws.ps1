param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^i-[0-9a-f]+$")]
  [string]$InstanceId,

  [string]$Region = "ap-south-1",

  [ValidatePattern("^[A-Za-z0-9._/-]+$")]
  [string]$Branch = "main",

  [ValidateRange(5, 60)]
  [int]$TimeoutMinutes = 40
)

$ErrorActionPreference = "Stop"

$null = & aws sts get-caller-identity --region $Region 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "AWS CLI authentication failed. Run aws sso login or configure the AWS_PROFILE first."
}

$remoteScript = @'
#!/bin/bash
set -Eeuo pipefail

APP_DIR="/opt/gymos"
BRANCH="__BRANCH__"
REPO_URL="https://github.com/Jafar19Khan/GYMOS.git"

for attempt in $(seq 1 240); do
  if id gymos >/dev/null 2>&1 && systemctl is-active --quiet postgresql && systemctl is-active --quiet nginx && test -s /etc/gymos/gymos.env; then
    break
  fi
  sleep 5
done
if ! id gymos >/dev/null 2>&1 || ! systemctl is-active --quiet postgresql || ! systemctl is-active --quiet nginx || [ ! -s /etc/gymos/gymos.env ]; then
  echo "EC2 first-boot setup is not ready yet. Check /var/log/gymos-bootstrap.log and cloud-init status."
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  rm -rf "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

chown -R gymos:gymos "$APP_DIR"

runuser -u gymos -- bash -c '
  set -Eeuo pipefail
  set -a
  source /etc/gymos/gymos.env
  set +a
  cd /opt/gymos
  npm install --include=dev --no-audit --no-fund
  npm run db:generate
  npm run db:deploy
  npm run build
'

systemctl daemon-reload
systemctl enable --now gymos.service
systemctl restart gymos.service

for attempt in $(seq 1 40); do
  if curl --insecure --connect-timeout 3 --max-time 8 --fail --silent https://127.0.0.1/api/health >/dev/null     && curl --insecure --connect-timeout 3 --max-time 8 --fail --silent https://127.0.0.1/api/ready; then
    echo "GYMOS deployment and local HTTPS readiness checks succeeded."
    systemctl --no-pager --full status gymos.service | tail -n 12
    exit 0
  fi
  sleep 3
done

echo "GYMOS did not become ready. Recent application logs:"
journalctl -u gymos.service -n 100 --no-pager
exit 1
'@

$remoteScript = $remoteScript.Replace("__BRANCH__", $Branch)

$payload = @{
  InstanceIds    = @($InstanceId)
  DocumentName   = "AWS-RunShellScript"
  Comment        = "Deploy GYMOS branch $Branch"
  TimeoutSeconds = ($TimeoutMinutes * 60)
  Parameters     = @{
    commands         = @($remoteScript)
    executionTimeout = @([string]($TimeoutMinutes * 60))
  }
}

$tempFile = Join-Path $env:TEMP ("gymos-ssm-" + [guid]::NewGuid().ToString("N") + ".json")

try {
  $json = $payload | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($tempFile, $json, [System.Text.UTF8Encoding]::new($false))

  $sendOutput = & aws ssm send-command --region $Region --cli-input-json "file://$tempFile" --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Could not send the deployment command: $($sendOutput -join [Environment]::NewLine)"
  }

  $sent = ($sendOutput -join [Environment]::NewLine) | ConvertFrom-Json
  $commandId = $sent.Command.CommandId
  Write-Host "Deployment command submitted: $commandId"

  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $invocation = $null

  do {
    Start-Sleep -Seconds 5
    $statusOutput = & aws ssm get-command-invocation --region $Region --command-id $commandId --instance-id $InstanceId --output json 2>&1

    if ($LASTEXITCODE -eq 0) {
      $invocation = ($statusOutput -join [Environment]::NewLine) | ConvertFrom-Json
      Write-Host "Remote deployment status: $($invocation.Status)"
      if ($invocation.Status -in @("Success", "Failed", "TimedOut", "Cancelled", "Undeliverable", "Terminated")) {
        break
      }
    }
  } while ((Get-Date) -lt $deadline)

  if (-not $invocation -or $invocation.Status -ne "Success") {
    if ($invocation.StandardOutputContent) { Write-Host $invocation.StandardOutputContent }
    if ($invocation.StandardErrorContent) { Write-Host $invocation.StandardErrorContent }
    throw "GYMOS deployment did not finish successfully. Review the SSM command output and EC2 logs."
  }

  Write-Host $invocation.StandardOutputContent
  Write-Host "Deployment complete. Check https://<EC2-public-IP>/api/ready"
}
finally {
  Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
}
