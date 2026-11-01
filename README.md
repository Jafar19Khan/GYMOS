# GYMOS

**A premium gym website and gym operations platform.**

GYMOS combines a public-facing gym website with a secure management application for owners, staff and members. The first release targets one gym, while gym-scoped records and server-side authorization prepare the foundation for future multi-gym SaaS growth.

## Product roles

| Role | Scope |
| --- | --- |
| `SUPER_ADMIN` | Platform operations, audited support access, security events and operational health |
| `OWNER` | Gym settings, staff permissions, members, plans, attendance, classes, finance records and website CMS |
| `MEMBER` | Own profile, membership, attendance, receipts, bookings and assigned fitness plans |

Trainer, receptionist, accountant and manager are owner-managed permission sets, not additional top-level roles.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, PostgreSQL, Prisma, Docker Compose, GitHub Actions and Terraform. The application is a modular Next.js codebase; a separate backend service will only be introduced if the product requires it.

## Repository map

- `src/` — Next.js application, route handlers, domain and auth services
- `prisma/` — relational schema, migrations and bootstrap seed
- `backend/` — domain-boundary design notes
- `docker/` — local container orchestration
- `infrastructure/terraform/` — IaC baseline; never auto-applied
- `.github/workflows/` — CI, dependency audit and Terraform validation
- `docs/` — architecture, security, roadmap, design, cost and operations notes
- `tests/` — auth, invitation, date and money-conversion unit tests

## Run locally with Docker

Requirements: Docker Desktop, Docker Compose v2, Node.js 22 and npm 10+.

1. Copy `.env.example` to `.env`.
2. Set a strong local `POSTGRES_PASSWORD`; use the same password in both `DATABASE_URL` and `DATABASE_URL_DOCKER`. Keep the host URL pointed at `localhost` and the Docker URL pointed at `db`.
3. Run `docker compose -f docker/compose.yaml up --build -d`. The web container waits for PostgreSQL, applies committed Prisma migrations, then starts Next.js.
4. To create your first owner account, fill `BOOTSTRAP_OWNER_EMAIL` and `BOOTSTRAP_OWNER_PASSWORD` in `.env`. Optionally set the Super Admin values too.
5. On your host, run `npm install` and then `npm run db:seed`. The seed only creates accounts when both email and password are explicitly supplied; it never creates a default password.
6. Open http://localhost:3000. Sign in at /login. Check `/api/health` and `/api/ready` to confirm service and database readiness.

To run Next.js directly on your host instead of in Docker, start only the database with `docker compose -f docker/compose.yaml up -d db`, then use `npm install`, `npm run db:generate`, `npm run db:migrate` and `npm run dev`.

## Owner operations

The Owner workspace links to Members, Staff, Plans, Payments, Attendance and Classes. Server actions check gym scope and required permission before writing data.

- Member and staff records are created in `INVITED` state with a single-use activation link. Links contain a random 256-bit token, only its SHA-256 hash is stored, and links expire after 48 hours. Re-issuing a link revokes previous unused links. Owners must copy and send links through a trusted channel; provider-backed email is not configured.
- Invitees set their own password (12+ characters); the password is bcrypt-hashed. Activation and token consumption happen in one transaction, and staff permissions remain explicitly granted.
- Authorized staff can edit member contact and emergency-contact details. Email changes revoke active sessions and invalidate old links for invited members.
- The member directory supports search, pagination, permission-checked CSV export and anonymizing archive. Archived member profiles are removed from active lists while ledger and membership history are retained.
- Staff managers can suspend/reactivate staff accounts. Suspension revokes active sessions; staff cannot suspend themselves or bypass invitation activation.
- Membership plans store duration in days and price as integer paise. Membership assignment checks date overlap and serializes assignments for the same member.
- Attendance supports manual and signed QR check-in for active members with a valid membership, once per gym-local day. QR codes expire after 60 seconds; the signing secret is configured locally.
- Classes can be scheduled in the gym timezone. Active members can book; capacity is serialized in a database transaction and cancellations promote the oldest waitlisted member first.
- Workout plans, member workout logs, diet targets, progress measurements, gym announcements and a text-based per-gym website CMS are available. Members can only view their own fitness data.
- The payment ledger supports manual charges, linked refunds, signed adjustments, printable receipt records and date-range reconciliation. No payment gateway is connected.

## Authentication and security

Passwords are bcrypt-hashed. Login creates a cryptographically random opaque session token; only its SHA-256 hash is stored in PostgreSQL, while the browser receives an HttpOnly, SameSite cookie. Sessions expire after seven days and suspended users are rejected on subsequent requests.

The three top-level roles are enforced on the server. Gym staff accounts use the Owner workspace but receive only explicitly granted permissions; the primary gym owner has the full gym permission set. Members can query only records associated with their own user ID. Public self-registration is disabled; privileged accounts are created by an operator-controlled seed process.

This is a working local-first release candidate, not a production security certification. Database-backed login throttling is enabled; proxy IP headers are ignored unless `TRUST_PROXY_HEADERS=true` is configured for a trusted, sanitizing reverse proxy. MFA, secure account recovery, provider-backed invitation email, private media storage, external monitoring, comprehensive E2E/IDOR/concurrency tests and an independent security review remain required before public production use.

## Cost gate

The AWS account and Mumbai-region usage must be reviewed against current account credits, service limits, usage and pricing before any resource is created. Strict ₹0 is a hard constraint. See [AWS cost gate](docs/COST-GATE.md). Local Docker is the default while the review is unresolved.

## Delivery status

Implemented: public landing page, local container setup, PostgreSQL schema/migrations and bootstrap seed, session login/logout, role routing, role-protected dashboards, secure member/staff invitation and password activation, staff permission maintenance, membership plans and assignment, manual attendance, class scheduling and FIFO bookings/waitlist, staff-entered payment entries, audit events, and CI/security workflows.

Still pending: invitation email delivery, TOTP MFA/account recovery, private image/video storage and gallery, trainer profiles/booking, notification delivery, audit retention policy, full E2E/IDOR/concurrency coverage, external monitoring/alerting, verified backup restore drills and cloud deployment approval. This project is not production-ready yet.

For Windows run, quality checks, backup and restore see [local operations](docs/OPERATIONS.md). Also see [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [roadmap](docs/ROADMAP.md) and [design system](docs/DESIGN-SYSTEM.md).
