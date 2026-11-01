# GYMOS architecture

## System context

GYMOS includes a public gym website, owner operations workspace, member portal and a platform operations surface for super administrators.

## Application shape

- Web: Next.js App Router, TypeScript, Tailwind CSS and Framer Motion.
- Server/domain: server components and route handlers call domain services. Domain services own validation, authorization and transaction boundaries.
- Persistence: PostgreSQL with Prisma. Relational constraints and transactions are preferred for membership, payment, attendance and class booking.
- Local runtime: Docker Compose.
- Delivery: GitHub Actions checks, container build and reviewed Terraform plans.
- Cloud: AWS only after account and strict cost review; no cloud resources are provisioned by the bootstrap.

## Tenancy and access

The first installation is a single gym but core gym data is designed with a `gymId`. Every server query must derive gym scope from trusted session/context, never an arbitrary client-supplied gym ID. Super-admin support access is explicit and audited.

Application roles are `super_admin`, `owner` and `member`. Staff capabilities are owner-managed permissions such as `members.read`, `members.write`, `attendance.manage`, `classes.manage`, `finance.read`, `finance.write`, `cms.manage` and `reports.read`. Deny by default and check authorization in every server action, route and service.

Members can access only their own profile, membership, payments/receipts, attendance, bookings and assigned plans. Optional health-related details require explicit consent, minimization and separate access controls.

## Consistency rules

- Class reservation: transactionally lock/check capacity, then create booking or waitlist row with idempotency protection.
- Waitlist: booking records ordered by `createdAt` and stable ID; never a client-managed array.
- Finance: append-only ledger events; corrections are adjustment/refund records with actor and reason.
- Attendance: deduplicate scans and retain actor/source metadata.
- Media: public gallery and private member documents use different access policies; use short-lived upload URLs after server-side validation.

## Fitness calculations

BMR/TDEE and macro estimates are coaching aids, not medical advice. Mifflin-St Jeor requires a sex-coefficient input; explain assumptions and allow users to avoid supplying it.

## Deployment shape

Local development first. Any AWS architecture must be separately cost-reviewed for account, region, quotas, pricing, logs, data transfer and expected usage before Terraform apply.
