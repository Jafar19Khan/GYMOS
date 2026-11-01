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
- [x] Single-use, expiring invitation tokens; secure password activation and invitation re-issue/revocation
- [ ] Provider-backed invitation email delivery
- [x] Permission-checked member profile editing for contact and emergency-contact details
- [x] Staff suspension/reactivation with session revocation; invitation-pending staff remain activation-only
- [x] Linked refunds and signed adjustments, printable receipts and date-range finance reconciliation
- [x] Manual attendance with active-membership validation and duplicate same-day protection
- [x] Signed, 60-second QR attendance with same-day duplicate protection
- [x] Class scheduling, member booking, transactional capacity and FIFO waitlist promotion
- [x] Gym-scoped audit event review UI
- [ ] Audit retention policy and automated retention controls

## Milestone 3 — Fitness and content

- [x] Text-based workout assignments, member session logs and progress measurements
- [x] Member-specific nutrition targets with explicit non-medical disclaimer
- [x] Text/contact CMS with published public gym page and membership plans
- [ ] Trainer/facility profiles, image/video gallery and configurable media
- [ ] Secure media upload and private member media
- [x] Published gym announcements in Owner and Member workspaces
- [ ] Push/email/SMS notification delivery

## Milestone 4 — Quality and deployment readiness

- [x] Persistent login throttling (5 failed attempts per email/IP window, temporary lock)
- [ ] MFA and secure account recovery
- [ ] Accessibility, performance and end-to-end tests
- [ ] Cross-gym/member isolation and concurrent-operation integration tests
- [ ] Backup and restore drills
- [ ] Monitoring, alerting and incident runbooks
- [ ] Account-specific cloud cost and eligibility review
- [ ] Explicit approval and reviewed Terraform deployment plan
