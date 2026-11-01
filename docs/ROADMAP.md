# GYMOS delivery roadmap

## Milestone 0 — Repository foundation

- [x] Repository structure, product scope and design tokens
- [x] Initial responsive marketing experience
- [x] Docker Compose baseline
- [x] CI/security workflow scaffolding
- [x] Terraform safety baseline and strict cost gate

## Milestone 1 — Product/data foundation

- [x] PostgreSQL schema and initial Prisma migration
- [x] Password hashing, session model and operator-controlled bootstrap accounts
- [x] Server-side role guards and staff permission policy
- [x] Super Admin, Owner and Member dashboard starting pages
- [x] Audit event data model
- [x] Auth validation and permission-policy unit tests

## Milestone 2 — Gym operations

- [ ] Member and staff CRUD with permission-aware workflows
- [ ] Membership plans, renewals, freezes and expiry
- [ ] Manual payment ledger, receipts, refunds and reconciled reporting
- [ ] Manual and QR attendance
- [ ] Class schedule, transactional capacity and FIFO waitlist
- [ ] Immutable audit-event write service and review UI

## Milestone 3 — Fitness and content

- [ ] Workout library, assignments and progress tracking
- [ ] Diet plans and goal support with calculation assumptions
- [ ] Public CMS, trainer/facility pages and gallery
- [ ] Secure media upload and private member media
- [ ] Announcements and notifications

## Milestone 4 — Quality and deployment readiness

- [ ] Login rate limiting, MFA and account recovery
- [ ] Accessibility, performance and end-to-end tests
- [ ] Backup and restore drills
- [ ] Monitoring, alerting and incident runbooks
- [ ] Account-specific cloud cost and eligibility review
- [ ] Explicit approval and reviewed Terraform deployment plan
