# Terraform AWS deployment

This directory provisions the no-Docker evaluation host described in docs/AWS-DEPLOYMENT-RUNBOOK.md.

Resources: VPC, public subnet/route, Internet Gateway, security group, EC2 IAM role/profile for Systems Manager, and one Amazon Linux 2023 EC2 instance. The instance runs Node.js 22, PostgreSQL 15 on loopback, Nginx and GYMOS as a systemd service. Default region is ap-south-1; default size is t3.medium with a 30 GiB encrypted gp3 root volume.

The security group exposes only TCP 80/443. There is no SSH, direct app or database ingress. The app is deployed through scripts/deploy-aws.ps1 over SSM. No Docker, RDS, NAT Gateway, ALB, Elastic IP or automated backup is created.

Before apply:
1. Check the AWS account plan and available credits in Billing.
2. Estimate EC2 hours, EBS, public IPv4, data transfer and taxes in the AWS Pricing Calculator for ap-south-1.
3. Run terraform init, fmt, validate and terraform plan; review every resource.
4. Apply only after an explicit owner cost decision. Never use auto-approve in an unreviewed workflow.

Keep terraform.tfvars, Terraform state and plan files out of Git. Do not commit cloud credentials or secrets. Terraform destroy deletes the EC2 root disk and its PostgreSQL data; back up data first. See docs/AWS-DEPLOYMENT-RUNBOOK.md for PowerShell commands and operation details.
