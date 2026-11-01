# Terraform

Terraform is the source of truth for future cloud infrastructure. This directory intentionally contains no deployable resources yet.

Rules: never run `terraform apply` automatically from pull requests; require a reviewed plan and explicit human approval; use GitHub OIDC with narrowly scoped IAM roles; never commit state, plan files, credentials or secrets; confirm account plan, credits, quotas, pricing, logs, transfer and storage costs first. A budget alert is not a spending cap.

Keep production resources disabled until a documented ₹0 feasibility review is approved.
