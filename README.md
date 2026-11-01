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
- `prisma/` — relational schema, initial migration and bootstrap seed
- `backend/` — domain-boundary design notes
- `docker/` — local container orchestration
- `infrastructure/terraform/` — IaC baseline; never auto-applied
- `.github/workflows/` — CI, dependency audit and Terraform validation
- `docs/` — architecture, security, roadmap, design, cost and operations notes
- `tests/` — automated test strategy and auth-policy smoke tests

## Run locally with Docker

Requirements: Docker Desktop, Docker Compose v2, Node.js 22 and npm 10+.

1. Copy `.env.example` to `.env`.
2. Set a strong local `POSTGRES_PASSWORD`; use the same password in both `DATABASE_URL` and `DATABASE_URL_DOCKER`. Keep the host URL pointed at `localhost` and the Docker URL pointed at `db`.
3. Run `docker compose -f docker/compose.yaml up --build -d`. The web container waits for PostgreSQL, applies committed Prisma migrations, then starts Next.js.
4. To create your first owner account, fill `BOOTSTRAP_OWNER_EMAIL` and `BOOTSTRAP_OWNER_PASSWORD` in `.env`. Optionally set the Super Admin values too.
5. On your host, run `npm install` and then `npm run db:seed`. The seed only creates accounts when both email and password are explicitly supplied; it never creates a default password.
6. Open http://localhost:3000. Sign in at /login.

To run Next.js directly on your host instead of in Docker, start only the database with `docker compose -f docker/compose.yaml up -d db`, then use `npm install`, `npm run db:generate`, `npm run db:migrate` and `npm run dev`.

## Authentication and security

Passwords are bcrypt-hashed. Login creates a cryptographically random opaque session token; only its SHA-256 hash is stored in PostgreSQL, while the browser receives an HttpOnly, SameSite cookie. Sessions expire after seven days and suspended users are rejected on subsequent requests.

The three top-level roles are enforced on the server. Gym staff accounts use the Owner workspace but receive only explicitly granted permissions; the primary gym owner has the full gym permission set. Members can query only records associated with their own user ID. Public self-registration is disabled; privileged accounts are created by an operator-controlled seed process.

This is a security foundation, not a production security certification. Login throttling, MFA, account recovery, complete audit coverage, comprehensive member/tenant isolation tests and security review remain required before public production use.

## Cost gate

The AWS account and Mumbai-region usage must be reviewed against current account credits, service limits, usage and pricing before any resource is created. Strict ₹0 is a hard constraint. See [AWS cost gate](docs/COST-GATE.md). Local Docker is the default while the review is unresolved.

## Delivery status

Implemented: public landing page, local container setup, database schema/migration, bootstrap seed, session login/logout, role routing, role-protected dashboard summaries, staff permission policy and CI checks.

Still pending: member/staff CRUD, memberships, reconciled payment ledger workflows, QR attendance, transactional class booking/waitlist, workouts, diet/progress, public CMS/media, MFA/rate limits, comprehensive integration/E2E tests, backup/restore drills and deployment. This project is not production-ready yet.

See [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [roadmap](docs/ROADMAP.md), [design system](docs/DESIGN-SYSTEM.md) and [local operations](docs/OPERATIONS.md).
