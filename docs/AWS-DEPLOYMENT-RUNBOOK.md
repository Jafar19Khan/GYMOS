# GYMOS AWS deployment runbook — Windows PowerShell

Use this route when your Windows PC cannot handle Docker Desktop. Terraform creates one Amazon Linux 2023 EC2 host. PostgreSQL, Nginx, Node.js 22 and the GYMOS Next.js app run directly on EC2. The app is built on EC2 through AWS Systems Manager (SSM), so your PC only runs AWS CLI, Terraform and PowerShell.

**Do not run `terraform apply` until you have checked your AWS account plan/credits, estimated the cost and reviewed the Terraform plan.** This is an evaluation deployment, not a production architecture.

## 1. Architecture

Terraform creates a VPC, one public subnet, Internet Gateway, route table, security group, one EC2 instance and an IAM role/instance profile with `AmazonSSMManagedInstanceCore`. Default region is `ap-south-1`; default instance is `t3.medium` (2 vCPU / 4 GiB RAM) with 30 GiB encrypted gp3 storage.

EC2 runs Amazon Linux 2023, Node.js 22/npm, PostgreSQL 15 (localhost only), Nginx and a systemd-managed GYMOS service. Inbound ports 80/443 only; no inbound SSH (22), app (3000) or PostgreSQL (5432). Use SSM instead of SSH.

No Docker Desktop, RDS, NAT Gateway, load balancer, Elastic IP, S3 or automated backup resources are created. PostgreSQL data stays on the EC2 root disk.

## 2. Check cost and AWS account eligibility first

In AWS Console, open **Billing and Cost Management → Credits / Free Tier / Cost and Usage**. Confirm your account plan, remaining credits, credit expiration, current bill and service availability. Do not assume the old 12-month EC2 Free Tier applies. AWS currently advertises up to USD 200 in credits for eligible new customers; the Free account plan ends after six months or when credits run out, whichever comes first. Eligibility and remaining credit balance are account-specific.

Use the [AWS Pricing Calculator](https://calculator.aws/) for Mumbai (`ap-south-1`) and estimate:
- EC2 `t3.medium` for the expected runtime hours.
- 30 GiB gp3 EBS storage (storage remains billable while EC2 is stopped).
- One public IPv4 address while attached, data transfer and taxes.

AWS lists public IPv4 at USD 0.005 per IP-hour. T3 prices vary by region; AWS lists `t3.medium` as 2 vCPU / 4 GiB RAM, but do not treat a price from another region as an `ap-south-1` quote. CPU credits are set to `standard` to avoid Unlimited-mode surplus-credit charges; sustained CPU work may instead be throttled when credits run low.

Sources: [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/), [T3 specifications/pricing](https://aws.amazon.com/ec2/instance-types/t3/), [public IPv4 pricing](https://aws.amazon.com/vpc/pricing/), [AWS Pricing Calculator](https://calculator.aws/).

If your budget is strict ₹0 and you cannot verify sufficient eligible credits, stop before Terraform apply. A billing alert is not a hard spending cap.

## 3. Install Windows tools

Run PowerShell as Administrator for installation. Docker Desktop and local Node.js are not required.

Install AWS CLI v2 and Terraform:

```powershell
winget install --exact --id Amazon.AWSCLI
winget install --exact --id Hashicorp.Terraform
winget install --exact --id Git.Git
```

Install the Session Manager plugin:

```powershell
$ssmInstaller = Join-Path $env:TEMP "SessionManagerPluginSetup.exe"
Invoke-WebRequest "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe" -OutFile $ssmInstaller
Start-Process -FilePath $ssmInstaller -Wait
```

Reopen PowerShell and verify:

```powershell
aws --version
terraform version
session-manager-plugin
git --version
```

If the plugin command is not found, reopen the terminal or add `%PROGRAMFILES%/Amazon/SessionManagerPlugin/bin` to PATH. The installer may request administrator permission.

Official guides: [AWS CLI for Windows](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [Terraform installation](https://developer.hashicorp.com/terraform/install), [Session Manager plugin for Windows](https://docs.aws.amazon.com/systems-manager/latest/userguide/install-plugin-windows.html).

## 4. Authenticate

Prefer an IAM Identity Center / SSO profile supplied by your AWS administrator:

```powershell
aws configure sso --profile gymos
aws sso login --profile gymos
$env:AWS_PROFILE = "gymos"
aws sts get-caller-identity
```

If you already have a configured named profile, set `$env:AWS_PROFILE` to that name instead. Do not use root account access keys, paste credentials into scripts, or commit them to Git.

The Terraform identity needs permission to create the VPC/subnet/routes/Internet Gateway/security group, EC2, IAM role/instance profile/policy attachment and pass the EC2 role. The operator identity also needs SSM send/get/start-session permissions. Ask your AWS administrator to grant the required permissions.

## 5. Get the repository and configure Terraform

```powershell
git clone https://github.com/Jafar19Khan/GYMOS.git
Set-Location GYMOS
git switch main
git pull --ff-only

Copy-Item ./infrastructure/terraform/terraform.tfvars.example ./infrastructure/terraform/terraform.tfvars
notepad ./infrastructure/terraform/terraform.tfvars
```

Keep the default `t3.medium` initially. `t3.micro` is deliberately excluded (1 GiB RAM is not reliable for a Next.js build plus PostgreSQL on one host). `t3.small` has only 2 GiB and may run short of memory during builds.

## 6. Initialize, validate and review the plan

```powershell
Set-Location ./infrastructure/terraform
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out=gymos.tfplan
```

Read the complete plan. Expected resources: VPC, subnet, Internet Gateway, route table/association, security group, EC2 SSM role/instance profile and one EC2 instance. There should be no RDS, NAT Gateway, load balancer, Elastic IP or unexpected resource. Check region, instance type, disk size, public IP exposure, IAM role and security group. Confirm the estimate in AWS Pricing Calculator.

Only after you personally approve the estimated spend and the plan:

```powershell
terraform apply gymos.tfplan
```

Do not use `-auto-approve`. Terraform state and `terraform.tfvars` are local and Git-ignored. Back up Terraform state securely; it can contain sensitive values. Do not upload it to GitHub.

## 7. Wait for EC2 and SSM

Still in `infrastructure/terraform`:

```powershell
$InstanceId = terraform output -raw instance_id
$PublicIp = terraform output -raw public_ip
$Region = terraform output -raw aws_region

$ssmStatus = "None"
for ($attempt = 1; $attempt -le 60; $attempt++) {
    $ssmStatus = aws ssm describe-instance-information --region $Region --filters "Key=InstanceIds,Values=$InstanceId" --query "InstanceInformationList[0].PingStatus" --output text
    Write-Host "SSM status: $ssmStatus"
    if ($ssmStatus -eq "Online") { break }
    Start-Sleep -Seconds 15
}
if ($ssmStatus -ne "Online") {
    throw "EC2 is not Online in Systems Manager. Check EC2 system log and cloud-init/bootstrap output in AWS Console."
}
```

First boot installs packages and configures PostgreSQL/Nginx/TLS; it can take several minutes. Amazon Linux 2023 AMIs generally include SSM Agent. The EC2 role has `AmazonSSMManagedInstanceCore`; outbound HTTPS to Systems Manager endpoints is required.

## 8. Deploy GYMOS — no Docker

Return to the repository root and run:

```powershell
Set-Location ../..
./scripts/deploy-aws.ps1 -InstanceId $InstanceId -Region $Region
```

The SSM deployment script waits for first-boot setup, pulls the public GitHub branch, installs dependencies, generates Prisma Client, applies migrations, builds Next.js and starts the `gymos` systemd service. The app build happens on EC2, not on your PC. The script also checks local HTTPS health and database readiness on EC2.

## 9. Create the first Owner account

Connect to EC2:

```powershell
./scripts/connect-aws.ps1 -InstanceId $InstanceId -Region $Region
```

At the EC2 shell, edit the private env file:

```bash
sudo vi /etc/gymos/gymos.env
```

Set both variables:

```text
BOOTSTRAP_OWNER_EMAIL=your-owner-email@example.com
BOOTSTRAP_OWNER_PASSWORD=replace-with-a-private-random-password
```

Use a unique password of at least 12 characters and no more than 72 UTF-8 bytes. Generate a random 24-byte hex password on EC2 with `openssl rand -hex 24` and save it in your password manager. Do not paste it into chat, Git or Terraform variables.

Save the file, then seed the account as the application user:

```bash
sudo -u gymos bash -lc 'set -a; source /etc/gymos/gymos.env; set +a; cd /opt/gymos && npm run db:seed'
sudo systemctl restart gymos
exit
```

The seed creates the gym and Owner account only when both variables are set. It does not create a default password. Running it again for the matching account does not reset the password.

## 10. Verify the public site

Back in PowerShell:

```powershell
$PublicIp = aws ec2 describe-instances --region $Region --instance-ids $InstanceId --query "Reservations[0].Instances[0].PublicIpAddress" --output text
curl.exe -k https://$PublicIp/api/health
curl.exe -k https://$PublicIp/api/ready
Start-Process "https://$PublicIp/login"
```

The temporary certificate is self-signed, so the browser will warn. For your own short-lived evaluation server, verify that the IP matches this EC2 public IP and proceed manually. Do not use this certificate for public launch or ask members to ignore certificate warnings. A real production domain and trusted certificate are required before launch.

GYMOS uses Secure session cookies in production and needs HTTPS for browser login. Nginx overwrites forwarded client-IP headers before GYMOS trusts them. PostgreSQL and port 3000 remain private. Same-origin camera permission is enabled for QR attendance.

## 11. Routine deployment and diagnostics

Deploy the latest `main` branch after pushing code:

```powershell
git pull --ff-only
./scripts/deploy-aws.ps1 -InstanceId $InstanceId -Region $Region
```

Connect to the instance:

```powershell
./scripts/connect-aws.ps1 -InstanceId $InstanceId -Region $Region
```

Useful commands inside EC2:

```bash
sudo systemctl status gymos nginx postgresql amazon-ssm-agent
sudo journalctl -u gymos -n 100 --no-pager
sudo tail -n 100 /var/log/gymos-bootstrap.log
sudo nginx -t
sudo -u postgres psql -d gymos -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

For failed SSM deployment, inspect its output in PowerShell, then check `journalctl -u gymos` and `/var/log/gymos-bootstrap.log` through Session Manager.

## 12. Stop, start and delete

Stop compute while not using the evaluation server (EBS storage remains billable):

```powershell
aws ec2 stop-instances --region $Region --instance-ids $InstanceId
aws ec2 wait instance-stopped --region $Region --instance-ids $InstanceId
```

Start again:

```powershell
aws ec2 start-instances --region $Region --instance-ids $InstanceId
aws ec2 wait instance-running --region $Region --instance-ids $InstanceId
```

Wait for SSM Online and refresh the public IP (it can change after stop/start):

```powershell
$PublicIp = aws ec2 describe-instances --region $Region --instance-ids $InstanceId --query "Reservations[0].Instances[0].PublicIpAddress" --output text
```

The boot service regenerates the temporary certificate for the new IP.

To permanently delete Terraform-managed infrastructure:

```powershell
Set-Location ./infrastructure/terraform
terraform plan -destroy
terraform destroy
```

**Destructive warning:** the EC2 root disk is deleted on termination and contains PostgreSQL data. `terraform destroy` permanently removes the app and database. Export and verify a database backup before destroying; no automated snapshot/backup resource is included.

## 13. Known limitations — not production-ready

This is one EC2 instance with a local database: no high availability, database failover, automated backups, WAF, stable Elastic IP, trusted public TLS certificate, MFA/account recovery, invitation email provider, payment gateway, private media storage or external monitoring/alerting. Payments are manually recorded and invitations are shared manually. Complete security/E2E/IDOR/concurrency tests, backup restore drills, domain/TLS, monitoring, incident procedures and account-specific cost approval before public production.
