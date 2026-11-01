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
- [x] Audit event data model and authentication audit events
- [x] Auth validation and permission-policy unit tests

## Milestone 2 — Gym operations

- [x] Permission-checked member creation and account suspension/reactivation
- [x] Staff account records and permission assignment/maintenance with non-escalation checks
- [x] Membership plan creation, activation/deactivation and date-based member assignment
- [x] Staff-entered payment charge records in integer paise
- [x] Audit entries for member, staff, permission, plan, membership and payment changes
- [ ] Secure invitation delivery, account activation and password setup
- [ ] Member profile editing, search, pagination, export and deletion lifecycle
- [ ] Staff suspension/reactivation and staff invitation lifecycle
- [ ] Refund/adjustment workflows, receipts and date-range finance reconciliation
- [x] Manual attendance with active-membership validation and duplicate same-day protection
- [ ] QR attendance
- [x] Class scheduling, member booking, transactional capacity and FIFO waitlist promotion
- [ ] Audit event review UI and retention controls

## Milestone 3 — Fitness and content

- [ ] Workout library, assignments and progress tracking
- [ ] Diet plans and goal support with calculation assumptions
- [ ] Public CMS, trainer/facility pages and gallery
- [ ] Secure media upload and private member media
- [ ] Announcements and notifications

## Milestone 4 — Quality and deployment readiness

- [ ] Login rate limiting, MFA and account recovery
- [ ] Accessibility, performance and end-to-end tests
- [ ] Cross-gym/member isolation and concurrent-operation integration tests
- [ ] Backup and restore drills
- [ ] Monitoring, alerting and incident runbooks
- [ ] Account-specific cloud cost and eligibility review
- [ ] Explicit approval and reviewed Terraform deployment plan
