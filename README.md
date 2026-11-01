# GYMOS

**A premium gym website and gym operations platform.**

GYMOS combines a public-facing gym website with a secure management application for owners, staff and members. The first release targets a single gym while keeping tenant boundaries explicit so a future multi-gym SaaS evolution does not require a rewrite.

## Product goals

- Premium, responsive and accessible fitness website.
- Owner tools for members, memberships, attendance, classes, staff permissions, payment records, workouts, announcements and website content.
- Member portal restricted to each member's own information.
- Separate platform operations access for super administrators.
- Reproducible local development with Docker and automated GitHub Actions checks.
- AWS deployment only after account eligibility and strict ₹0 feasibility review. No cloud resources are created by this bootstrap.

## Roles

| Role | Scope |
| --- | --- |
| `super_admin` | Platform settings, audited support access, security events and operational health |
| `owner` | Gym settings, staff permissions, members, plans, attendance, classes, finance entries and CMS |
| `member` | Own profile, membership, attendance, receipts, bookings and assigned fitness plans |

Trainer, receptionist, accountant and manager are owner-managed permission sets, not separate application roles.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, PostgreSQL/Prisma (planned), Docker Compose, GitHub Actions and Terraform. The initial application remains a modular Next.js codebase; separate services will be introduced only when justified.

## Repository map

- `frontend/` — Next.js application
- `backend/` — domain/API boundary notes
- `docker/` — local container orchestration
- `infrastructure/terraform/` — infrastructure as code, not automatically applied
- `.github/workflows/` — CI, security and Terraform validation
- `docs/` — architecture, security, roadmap, design and cost gate
- `tests/` — cross-domain test strategy

## Run locally

Requirements: Docker Desktop and Docker Compose v2.

1. Copy `.env.example` to `.env`.
2. Change `POSTGRES_PASSWORD` and make its value match the password in `DATABASE_URL`.
3. Run `docker compose -f docker/compose.yaml up --build`.
4. Open http://localhost:3000.

For frontend scripts, use Node 22: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

## Security principles

Server-side authorization, gym-scoped records, member data isolation, audited sensitive actions, append-only financial history, transactional class bookings, separate private/public media access and no committed secrets. No payment gateway or cloud deployment is enabled in this foundation.

See [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [cost gate](docs/COST-GATE.md), [roadmap](docs/ROADMAP.md) and [operations](docs/OPERATIONS.md).

## Delivery status

This commit establishes the product specification, visual foundation, local container setup and CI scaffolding. Production authentication, database migrations and core gym workflows are not yet implemented and must not be treated as complete.
