# AWS cost and deployment gate

**Status: BLOCKED — no AWS infrastructure has been provisioned.**

The project has a strict ₹0 budget. A service described as free tier does not prove that this account, region or usage pattern will cost ₹0.

Before deployment, verify the account plan and remaining credits, Billing → Free Tier usage, current Bills, Mumbai region (`ap-south-1`) availability and pricing, quotas, logs, storage, API requests, data transfer and backups. Consider expected traffic, retries and failure scenarios.

Safeguards: do not create resources to test whether they are free; billing alerts do not stop spend; avoid always-on compute, NAT Gateway and managed relational DB until approved; do not buy a domain or enable paid payment/messaging services. Local Docker is the default while cost feasibility is unresolved.

Deployment requires a written estimate, explicit owner approval and a reviewed Terraform plan. If strict ₹0 cannot be supported, keep the project local and document the limitation.
