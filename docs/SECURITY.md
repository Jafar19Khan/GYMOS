# Security baseline

## Implemented in this milestone

- Passwords are hashed with bcrypt (work factor 12); no plaintext passwords are stored.
- Login creates a cryptographically random opaque session token. Only the SHA-256 token hash is stored in PostgreSQL.
- Browser sessions use HttpOnly, SameSite=Lax cookies, Secure in production, path scoping and a seven-day expiry.
- Suspended users are rejected when a session is read.
- Top-level role checks happen on the server. Gym staff use explicit permission grants; the primary gym owner is the only account with automatic full gym permissions.
- Staff may delegate only permissions they already hold; elevated permission grants are restricted to the primary gym owner.
- Owner actions verify the signed-in account's gym and required permission before creating member/staff records, changing permissions/status, assigning memberships or recording payment entries.
- Sensitive operational changes create audit entries within the same database transaction as the write.
- Login errors are generic and do not reveal whether an email exists.
- Public self-registration is disabled. Bootstrap credentials are operator-supplied and are never committed.

## Required before production

- Login throttling/rate limiting is not implemented yet.
- MFA and secure account recovery are not implemented yet.
- Member/staff records created from the Owner workspace are `INVITED`; secure invitation delivery and password activation are not implemented yet.
- Finance module currently records `CHARGE` entries only; refund/adjustment workflows and period reconciliation remain pending.
- Every future server action/API must verify gym scope and member ownership; dashboard isolation alone is not sufficient.
- Add integration tests for cross-gym access, IDOR, suspended users, session expiry, permission changes, duplicate requests and concurrent writes.
- Add security headers/CSP review, dependency and image scanning, secret handling, backup/restore and incident drills.

## Identity and access

- Enforce server-side RBAC and resource ownership checks at every data boundary.
- Privileged MFA is a release requirement.
- Rate-limit login, recovery, upload-signing and sensitive write endpoints before public release.
- Revoke sessions after privilege changes, password reset or suspension.
- Deny by default. Platform super-admin access to gym-level data must be explicit, time-bounded and audited.

## Data protection

- Collect minimum member data. Sensitive fitness/medical information is optional, consent-based and separately permissioned.
- Validate input server-side; use parameterized database access and output encoding.
- Protect state-changing requests against CSRF where cookie auth is used.
- Never log passwords, tokens, full payment credentials, private document URLs or unnecessary personal data.
- Keep private member media inaccessible to public gallery routes.
- Use short-lived scoped upload/download URLs; validate type, size and ownership server-side.

## Financial integrity

- Never store card numbers or CVV.
- First release records payments entered by authorized staff; no payment gateway is enabled.
- Payment entries are recorded as append-only charge events; no arbitrary edit/delete UI is available.
- Refunds and adjustments require separate permission-aware ledger workflows before use.
- Record actor, timestamp, amount, currency, method, reference and reason; derive balances from ledger entries.

## Operations

- Secrets stay in secret stores, not Git.
- Protect default branch and require CI checks before merging.
- Scan dependencies, source and container images.
- Audit permission changes, finance actions, exports, deletion and super-admin support access.
- Define tested backup/restore before production.

## Incident response

Document detection, containment, credential rotation, evidence preservation, notification decisions and recovery. A passing scanner alone does not prove an environment secure.
