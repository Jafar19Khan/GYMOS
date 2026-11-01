# Local operations

Start with `cp .env.example .env`, set a strong local-only `POSTGRES_PASSWORD`, and make it match the password in `DATABASE_URL`. Run `docker compose -f docker/compose.yaml up --build`; stop with `docker compose -f docker/compose.yaml down`.

PostgreSQL data persists in named volume `gymos-postgres`. `down -v` permanently removes local database data. For failures inspect `docker compose -f docker/compose.yaml logs db`, verify local credentials and check whether ports 3000/5432 are occupied. Never paste secrets or full env files into issues/logs.

This bootstrap is not production-ready. Implement migrations, backup/restore tests, session security, access-control tests, structured logs, alerting, rate limits, media scanning and incident response before launch.
