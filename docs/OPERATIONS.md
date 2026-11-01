# Local operations

GYMOS is intended to be tested locally with Docker Compose before any cloud deployment.

## Start on Windows 11 / PowerShell

1. Install Docker Desktop (Linux containers) and Node.js 22. The repository requires Node.js 20.19+ and npm 10+.
2. From the repository root, copy the environment file:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

3. Set a strong local `POSTGRES_PASSWORD` and make it match `DATABASE_URL` and `DATABASE_URL_DOCKER`. Set `BOOTSTRAP_OWNER_EMAIL` and `BOOTSTRAP_OWNER_PASSWORD` (12+ characters, no more than 72 UTF-8 bytes). Keep bootstrap credentials local; do not commit `.env`.
4. Build and start the application:

   ```powershell
   docker compose -f docker/compose.yaml up --build -d
   ```

5. Create the owner account. On the host, from the repository root:

   ```powershell
   npm install
   npm run db:seed
   ```

6. Confirm readiness and open the app:

   ```powershell
   Invoke-RestMethod http://localhost:3000/api/health
   Invoke-RestMethod http://localhost:3000/api/ready
   Start-Process http://localhost:3000
   ```

The container applies all committed Prisma migrations before it starts Next.js. The database readiness endpoint returns HTTP 503 until PostgreSQL is reachable.

## Local quality checks

Run these from PowerShell after `npm install`:

```powershell
npx prisma validate
npm run db:generate
npm run lint
npm run typecheck
npm run test
npm run build
```

The GitHub Actions CI runs the same validation, migration, lint, typecheck, test, build and production Docker image steps against PostgreSQL 16.

## Backup and restore

The PostgreSQL data lives in the named `gymos-postgres` Docker volume. A volume is not a backup.

Create a compressed backup:

```powershell
./scripts/backup.ps1
```

Restore a backup (destructive; the script requires typing `RESTORE`):

```powershell
./scripts/restore.ps1 -BackupFile .\backups\gymos-YYYYMMDD-HHMMSS.dump
```

Keep backup files outside Git and protect them as sensitive gym/member data. Test restores into a separate local database before relying on a backup. The restore script targets the current Compose database and replaces its data.

## Useful checks

```powershell
docker compose -f docker/compose.yaml ps
docker compose -f docker/compose.yaml logs --tail 100 web
docker compose -f docker/compose.yaml logs --tail 100 db
```

Stop containers without deleting data:

```powershell
docker compose -f docker/compose.yaml down
```

**Do not use** `docker compose down -v` unless you intentionally want to permanently delete the local database volume.

## Production boundaries

- The first release records payments manually; no card/UPI gateway is connected.
- Invitation email delivery is not configured; owners share expiring one-time links through a trusted channel.
- Local readiness/health endpoints are available. External monitoring/alert delivery still needs an operator-selected service.
- AWS infrastructure is not provisioned. Any cloud deployment requires a separate account/region pricing review and explicit cost approval.
- Before public production use, complete rate-limiting/MFA/recovery, external email delivery, security review, backup restore drills, monitoring/alerting and an end-to-end test pass.
