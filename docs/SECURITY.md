# Security baseline

## Identity and access

- Use established authentication and secure HTTP-only, same-site cookies; do not invent cryptography or casual password handling.
- Enforce server-side RBAC and resource ownership checks at every data boundary.
- Require MFA for privileged accounts where the identity provider supports it.
- Rate-limit login, recovery, upload-signing and sensitive write endpoints.
- Rotate/invalidate sessions after privilege changes or suspension.

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
- Use append-only entries for payment, refund and adjustment history.
- Record actor, timestamp, amount, currency, method, reference and reason; derive balances from ledger entries.

## Operations

- Secrets stay in secret stores, not Git.
- Protect default branch and require CI checks before merging.
- Scan dependencies, source and container images.
- Audit permission changes, finance actions, exports, deletion and super-admin support access.
- Define tested backup/restore before production.

## Incident response

Document detection, containment, credential rotation, evidence preservation, notification decisions and recovery. A passing scanner alone does not prove an environment secure.
