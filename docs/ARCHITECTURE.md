# GYMOS architecture

## System context

GYMOS contains a public gym website, an owner/staff operations workspace, a member portal and a platform operations area for super administrators.

## Application shape

- Web and server: Next.js App Router, TypeScript, Tailwind CSS and Framer Motion.
- Domain/API: route handlers and server components call server-only domain/auth modules.
- Persistence: PostgreSQL with Prisma migrations.
- Local runtime: Docker Compose; the web container applies committed migrations before starting.
- Delivery: GitHub Actions validates the Prisma schema, applies migrations to a temporary PostgreSQL service, runs tests/build, audits dependencies and validates Terraform formatting.
- Cloud: AWS only after a separate account and strict ₹0 cost review. No AWS resources are currently provisioned.

## Identity and tenancy

Top-level application roles are `SUPER_ADMIN`, `OWNER` and `MEMBER`.

- A gym owner has the `isGymOwner` flag and receives full permissions for that gym.
- Gym staff also use the Owner workspace but receive explicit `StaffPermission` records. Permission checks fail closed.
- Super Admin has platform-level aggregate access; support access to gym data must be separately approved, scoped and audited.
- Members may access only their own profile, memberships, payment entries, attendance and bookings.

The first deployment is a single gym, but gym-scoped records carry a `gymId`. Server queries must derive that scope from the authenticated user, not a client-supplied gym ID.

## Data model baseline

The initial schema includes gyms, users, sessions, member profiles, staff permissions, membership plans, memberships, attendance, gym classes, class bookings, payment ledger entries and audit logs. Money is stored as integer paise. Payment entries do not store card details and are not connected to a gateway.

## Consistency rules for upcoming services

- Class reservation: transactionally check capacity and create a booking/waitlist row with idempotency protection.
- Waitlist: dedicated booking rows ordered by `createdAt` and a stable ID; never a client-managed array.
- Finance: append-only ledger events; corrections are adjustment/refund records with actor and reason.
- Attendance: deduplicate scans and retain actor/source metadata.
- Media: public gallery and private member documents require different access policies and scoped short-lived upload/download URLs.

## Fitness calculations

BMR/TDEE and macro estimates are coaching aids, not medical advice. Mifflin-St Jeor requires a sex-coefficient input; explain assumptions and allow users to avoid supplying it.

## Deployment shape

Local development first. Any AWS architecture must be separately cost-reviewed for account, region, quotas, pricing, logs, data transfer and expected usage before Terraform apply.
