# AWS cost and deployment gate

**Status: BLOCKED pending account-specific credit and pricing review. No AWS infrastructure has been provisioned.**

GYMOS now has a prepared single-EC2 evaluation deployment, but no resource should be created until the account plan, remaining credits and Mumbai-region estimate have been checked and explicitly approved. A service described as free tier does not prove that this account, region or usage pattern will cost ₹0.

AWS's current new-account offer advertises up to USD 200 in credits for eligible customers. The Free account plan ends after six months or when credits are exhausted, whichever comes first. Eligibility, current account plan, remaining balance and credit expiry must be checked in Billing and Cost Management; do not assume the previous 12-month EC2 Free Tier applies.

The proposed stack uses one t3.medium EC2 instance (2 vCPU, 4 GiB RAM), one 30 GiB encrypted gp3 root disk and one public IPv4 address. Include compute runtime, storage while stopped, public IPv4 hourly charge, data transfer and taxes in the [AWS Pricing Calculator](https://calculator.aws/) for ap-south-1. Public IPv4 is currently listed at USD 0.005 per IP-hour; EC2 pricing is region-specific.

Safeguards:
- Do not create resources just to test whether they are free.
- A billing alert/budget is not a hard spending cap.
- No RDS, NAT Gateway, load balancer, Elastic IP, S3 or snapshots are provisioned by this configuration.
- T3 CPU credits use standard mode to avoid Unlimited surplus-credit charges; CPU can be throttled when credits are exhausted.
- Review the full Terraform plan and apply only after explicit cost approval.
- Terraform state, plan files, database credentials and environment files must never be committed.

If strict ₹0 cannot be supported by current credits and pricing, do not apply Terraform. The AWS runbook is docs/AWS-DEPLOYMENT-RUNBOOK.md. The local Docker route remains documented separately in docs/RUNBOOK.md.
