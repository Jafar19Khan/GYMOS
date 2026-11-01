# GYMOS architecture

## System context

GYMOS contains a public gym website, an owner/staff operations workspace, a member portal and a platform operations area for super administrators.

## Application shape

- Web and server: Next.js App Router, TypeScript, Tailwind CSS and Framer Motion.
- Domain/API: route handlers and server components call server-only domain/auth modules.
- Persistence: PostgreSQL with Prisma migrations.
- Local runtime: Docker Compose remains available for development where Docker is supported.
- AWS evaluation runtime: one Amazon Linux 2023 EC2 host runs Node.js 22, PostgreSQL 15 on loopback, Nginx and the Next.js service under systemd. Terraform provisions the VPC/security group/EC2/SSM role; deployment is performed through PowerShell and AWS Systems Manager without local Docker.
- Delivery: GitHub Actions validates the Prisma schema, applies migrations to a temporary PostgreSQL service, runs tests/build, audits dependencies and validates Terraform formatting.
- Cloud: an AWS EC2 deployment configuration is prepared, but no AWS resources have been provisioned. Apply is blocked pending account-specific credit, ap-south-1 price and explicit cost review. This single-host evaluation setup is not production-ready.

## Identity and tenancy

Top-level application roles are `SUPER_ADMIN`, `OWNER` and `MEMBER`.

- A gym owner has the `isGymOwner` flag and receives full permissions for that gym.
- Gym staff also use the Owner workspace but receive explicit `StaffPermission` records. Permission checks fail closed.
- Super Admin has platform-level aggregate access; support access to gym data must be separately approved, scoped and audited.
- Members may access only their own profile, memberships, payment entries, attendance and bookings.

The first deployment is a single gym, but gym-scoped records carry a `gymId`. Server queries must derive that scope from the authenticated user, not a client-supplied gym ID.

## Domain boundaries

The first milestone keeps server-side business logic inside the Next.js application to reduce operational complexity; there is no separate backend service. Route handlers and server actions should call server-only domain/auth modules. Keep domain logic independent of UI components and persistence adapters.

Planned domains: identity/access, gym settings, staff, members, memberships, finance ledger, attendance, classes/bookings, workouts, nutrition, progress, media, CMS, notifications and audit. Use PostgreSQL transactions for capacity-limited bookings and financial writes. Keep waitlist membership in normalized booking rows, not serialized arrays. Never expose private data through public CMS/media endpoints.

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

For Windows machines that cannot run Docker Desktop, the evaluation path is a single EC2 host with Node.js, PostgreSQL and Nginx, managed by Terraform and deployed through SSM from PowerShell. PostgreSQL is local to the instance and not publicly exposed. HTTPS uses a temporary self-signed IP certificate for evaluation only. This is a single point of failure and has no automated database backup. Check account plan, credits, region pricing, quotas, logs, data transfer and expected usage before Terraform apply. Production requires a domain/trusted certificate, backup and restore process, monitoring, MFA/account recovery, high availability and security validation.
