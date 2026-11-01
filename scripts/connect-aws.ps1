param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^i-[0-9a-f]+$")]
  [string]$InstanceId,

  [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"
aws ssm start-session --target $InstanceId --region $Region
if ($LASTEXITCODE -ne 0) {
  throw "Session Manager connection failed. Confirm the instance is Online in SSM and the Session Manager plugin is installed."
}
